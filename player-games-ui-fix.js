(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let isPlayer = false;
  let busy = false;
  let timer = null;
  let currentGame = null;
  let currentPlaying = false;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));

  const initials = name => String(name || "Player")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || "")
    .join("")
    .toUpperCase();

  function isGamesPage() {
    return !!document.querySelector('.nav-item.active[data-view="games"]');
  }

  function shortDate(value) {
    return new Date(value + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long"
    });
  }

  function getCandidate() {
    if (!isPlayer || !isGamesPage()) return null;
    const buttons = [...document.querySelectorAll("button")];
    const button = buttons.find(b => {
      const text = b.textContent.trim().toLowerCase();
      return text === "sign me up!" || text === "i'm playing ✓" || text === "i’m playing ✓" || text === "i'm playing" || text === "i’m playing";
    });
    if (!button) return null;
    return button.closest(".card") || button.closest("section") || button.parentElement?.parentElement || null;
  }

  async function loadGameState() {
    const { data, error } = await sb.rpc("player_list_games");
    if (error) throw error;
    const games = (data || []).filter(game => game.game_date >= new Date().toISOString().slice(0, 10));
    currentGame = games[0] || null;
    currentPlaying = !!currentGame?.playing;
    return currentGame;
  }

  async function loadSquad(gameId) {
    const { data, error } = await sb.rpc("player_list_game_squad", { p_game_id: gameId });
    if (error) throw error;
    return data || [];
  }

  function renderCard(card, game, squad) {
    if (!card || !game) return;
    card.classList.add("player-next-game-card");
    card.innerHTML =
      '<div class="player-next-game-main">' +
        '<div class="player-next-game-info">' +
          '<div class="eyebrow">NEXT GAME</div>' +
          '<h2>' + esc(shortDate(game.game_date)) + '</h2>' +
          '<p>⚽ ' + esc(String(game.start_time).slice(0, 5) + "–" + String(game.end_time).slice(0, 5)) + ' · ' + esc(game.location || "Castellón") + '</p>' +
        '</div>' +
        '<div class="player-next-game-actions">' +
          '<div class="player-playing-count"><strong>' + esc(game.playing_count) + '</strong><span>PLAYING</span></div>' +
          '<button type="button" class="btn ' + (currentPlaying ? 'btn-secondary' : 'btn-primary') + '" data-player-signup-action>' + (currentPlaying ? "I'm playing ✓" : "Sign me up!") + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="player-next-game-squad">' +
        '<div class="player-squad-heading"><span>PLAYERS PLAYING</span><b>' + esc(game.playing_count) + '</b></div>' +
        (squad.length
          ? '<div class="player-squad-chips">' + squad.map(row => {
              const mine = currentPlaying && row.name === (window.__footballPlayerName || "");
              return '<span class="player-squad-chip' + (mine ? ' is-me' : '') + '"><span class="player-squad-avatar">' + esc(initials(row.name)) + '</span><span>' + esc(row.name) + (mine ? ' <small>YOU</small>' : '') + '</span></span>';
            }).join("") + '</div>'
          : '<div class="player-squad-empty">No players signed up yet.</div>') +
      '</div>';
  }

  async function enhance() {
    if (!isPlayer || !isGamesPage() || busy) return;
    const card = getCandidate();
    if (!card || card.classList.contains("player-next-game-card")) return;
    try {
      const game = await loadGameState();
      if (!game) return;
      const squad = await loadSquad(game.id);
      renderCard(card, game, squad);
    } catch (error) {
      console.warn("[Football] Player game UI enhancement failed", error);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    busy = true;

    const button = event.target.closest("[data-player-signup-action], button");
    if (button) {
      button.disabled = true;
      button.textContent = currentPlaying ? "Updating…" : "Signing up…";
    }

    try {
      const game = currentGame || await loadGameState();
      if (!game) throw new Error("No upcoming game found.");

      const result = await sb.rpc("member_toggle_game", { p_game_id: game.id });
      if (result.error) throw result.error;

      currentPlaying = result.data?.playing === true;
      const squad = await loadSquad(game.id);
      const nextGame = await loadGameState();
      const card = document.querySelector(".player-next-game-card") || getCandidate();
      if (card && nextGame) renderCard(card, nextGame, squad);
    } catch (error) {
      console.warn("[Football] Player signup failed", error);
      if (button) {
        button.disabled = false;
        button.textContent = currentPlaying ? "I'm playing ✓" : "Sign me up!";
      }
      window.alert("Could not update your game signup: " + (error.message || "Unknown error"));
    } finally {
      busy = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(enhance, 40);
  }

  function installSignupInterceptor() {
    document.addEventListener("click", async event => {
      const target = event.target.closest("button");
      if (!target) return;
      const text = target.textContent.trim().toLowerCase();
      if (text !== "sign me up!" && text !== "i'm playing ✓" && text !== "i’m playing ✓" && text !== "i'm playing" && text !== "i’m playing") return;
      if (!isGamesPage()) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (!isPlayer) {
        try {
          const access = await sb.rpc("get_my_access");
          isPlayer = access.data?.allowed === true && access.data?.profile?.role === "player";
          window.__footballPlayerName = access.data?.profile?.display_name || "";
        } catch (_) {
          return;
        }
      }

      if (isPlayer) await handleSignup(event);
    }, true);
  }

  async function init() {
    installSignupInterceptor();

    try {
      const access = await sb.rpc("get_my_access");
      isPlayer = access.data?.allowed === true && access.data?.profile?.role === "player";
      if (!isPlayer) return;
      window.__footballPlayerName = access.data?.profile?.display_name || "";
      schedule();
    } catch (error) {
      console.warn("[Football] Could not determine player access", error);
      return;
    }

    const app = document.getElementById("app");
    if (app) new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  }

  init();
})();
