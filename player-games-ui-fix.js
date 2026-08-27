(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let isPlayer = false;
  let accessResolved = false;
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

  function installStableLayoutStyles() {
    if (document.getElementById("player-next-game-stable-layout")) return;
    const style = document.createElement("style");
    style.id = "player-next-game-stable-layout";
    style.textContent = `
      .player-next-game-card.player-next-game-card {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      .player-next-game-card.player-next-game-card > .player-next-game-main {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: space-between !important;
        width: 100% !important;
        min-width: 0 !important;
        gap: 24px !important;
        padding: 22px 24px !important;
        border-bottom: 1px solid #edf2ee !important;
      }
      .player-next-game-card .player-next-game-info {
        flex: 1 1 auto !important;
        min-width: 0 !important;
      }
      .player-next-game-card .player-next-game-info h2 {
        margin: 4px 0 5px !important;
        font-size: 24px !important;
        line-height: 1.15 !important;
        white-space: nowrap !important;
      }
      .player-next-game-card .player-next-game-info p {
        margin: 0 !important;
      }
      .player-next-game-card .player-next-game-actions {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: flex-end !important;
        flex: 0 0 auto !important;
        gap: 12px !important;
      }
      .player-next-game-card .player-playing-count {
        flex: 0 0 auto !important;
        min-width: 82px !important;
      }
      .player-next-game-card > .player-next-game-squad {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        padding: 16px 24px 20px !important;
      }
      .player-next-game-card .player-squad-chips {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 8px !important;
      }
      .player-next-game-card .player-squad-chip {
        display: inline-flex !important;
        width: auto !important;
        max-width: 100% !important;
      }
      @media (max-width: 760px) {
        .player-next-game-card.player-next-game-card > .player-next-game-main {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 14px !important;
          padding: 18px !important;
        }
        .player-next-game-card .player-next-game-info h2 {
          white-space: normal !important;
          font-size: 22px !important;
        }
        .player-next-game-card .player-next-game-actions {
          width: 100% !important;
          justify-content: flex-start !important;
        }
        .player-next-game-card > .player-next-game-squad {
          padding: 14px 18px 18px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

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
    installStableLayoutStyles();
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

    const action = card.querySelector("[data-player-signup-action]");
    if (action) action.addEventListener("click", handleSignup, true);
  }

  async function enhance() {
    if (!isPlayer || !isGamesPage() || busy) return;
    installStableLayoutStyles();
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
      if (!isGamesPage() || !accessResolved || !isPlayer) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      await handleSignup(event);
    }, true);
  }

  async function init() {
    installStableLayoutStyles();
    installSignupInterceptor();

    try {
      const access = await sb.rpc("get_my_access");
      isPlayer = access.data?.allowed === true && access.data?.profile?.role === "player";
      accessResolved = true;
      if (!isPlayer) return;
      window.__footballPlayerName = access.data?.profile?.display_name || "";
      schedule();
    } catch (error) {
      accessResolved = true;
      console.warn("[Football] Could not determine player access", error);
      return;
    }

    const app = document.getElementById("app");
    if (app) new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  }

  init();
})();
