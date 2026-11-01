(() => {
  "use strict";

  const sb = window.footballClient;
  if (!sb) return;

  let busy = false;
  let cachedAccess = null;

  function previewBannerText() {
    return document.body?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function isPlayerPreview() {
    return /Viewing the site as\s+.+?\s*\(player\)/i.test(previewBannerText());
  }

  async function loadAccess() {
    if (cachedAccess) return cachedAccess;
    const result = await sb.rpc("get_my_access");
    if (result.error || !result.data?.allowed) return null;
    cachedAccess = result.data;
    return cachedAccess;
  }

  async function getNextGame() {
    const result = await sb
      .from("games")
      .select("id,game_date,start_time")
      .order("game_date");
    if (result.error) throw result.error;
    const today = new Date().toISOString().slice(0, 10);
    return (result.data || [])
      .filter(game => game.game_date >= today)
      .sort((a, b) => a.game_date.localeCompare(b.game_date) || String(a.start_time).localeCompare(String(b.start_time)))[0] || null;
  }

  async function getSignup(gameId, playerId) {
    if (!playerId) return null;
    const result = await sb.rpc("player_list_games");
    if (result.error) throw result.error;
    return result.data?.find(game => game.id === gameId) || null;
  }

  function findNextGameCard() {
    return Array.from(document.querySelectorAll(".card")).find(card => /NEXT GAME/i.test(card.textContent || ""));
  }

  function renderButton(card, playing, disabled = false) {
    let wrap = card.querySelector("[data-self-game-signup]");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.dataset.selfGameSignup = "true";
      wrap.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:12px;";
      card.appendChild(wrap);
    }

    let button = wrap.querySelector("[data-self-game-signup-button]");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.selfGameSignupButton = "true";
      wrap.appendChild(button);
    }

    button.className = playing ? "btn btn-secondary" : "btn btn-primary";
    button.disabled = disabled;
    button.textContent = playing ? "I'm playing ✓" : "Sign me up!";
    button.dataset.playing = playing ? "true" : "false";
    button.setAttribute("aria-pressed", playing ? "true" : "false");
    button.title = playing ? "Click to leave this match" : "Click to sign up for this match";
  }

  async function refresh() {
    if (!document.querySelector('.nav-item.active[data-view="games"]')) return;

    const card = findNextGameCard();
    if (!card) return;

    const preview = isPlayerPreview();
    const access = await loadAccess();
    const isRealPlayer = access?.profile?.role === "player" && access.profile.active === true;

    if (!isRealPlayer && !preview) {
      card.querySelector("[data-self-game-signup]")?.remove();
      return;
    }

    if (preview) {
      renderButton(card, false, true);
      const button = card.querySelector("[data-self-game-signup-button]");
      button.textContent = "Preview is read-only";
      return;
    }

    const nextGame = await getNextGame();
    if (!nextGame) return;

    const existing = await getSignup(nextGame.id, access.profile.player_id);
    renderButton(card, !!existing?.playing);
  }

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-self-game-signup-button]");
    if (!button || busy) return;

    const card = button.closest("[data-self-game-signup]")?.closest(".card");
    if (!card) return;

    const preview = isPlayerPreview();
    if (preview) return;
    const access = await loadAccess();
    const isRealPlayer = access?.profile?.role === "player" && access.profile.active === true;
    if (!preview && !isRealPlayer) return;

    busy = true;
    const wasPlaying = button.dataset.playing === "true";
    button.disabled = true;
    button.textContent = "Saving…";

    try {
      const nextGame = await getNextGame();
      if (!nextGame) throw new Error("No upcoming game found");

      const result = await sb.rpc("member_toggle_game", { p_game_id: nextGame.id });

      if (result.error) throw result.error;

      window.dispatchEvent(new CustomEvent("football:game-squad-changed", { detail: result.data }));
      button.dataset.playing = result.data?.playing ? "true" : "false";
      button.className = result.data?.playing ? "btn btn-secondary" : "btn btn-primary";
      button.textContent = result.data?.playing ? "I'm playing ✓" : "Sign me up!";
      setTimeout(() => window.location.reload(), 150);
    } catch (error) {
      console.error("Self game signup failed", error);
      button.disabled = false;
      button.className = wasPlaying ? "btn btn-secondary" : "btn btn-primary";
      button.dataset.playing = wasPlaying ? "true" : "false";
      button.textContent = wasPlaying ? "I'm playing ✓" : "Sign me up!";
      alert("Could not update your game signup: " + (error?.message || error));
    } finally {
      busy = false;
    }
  });

  const observer = new MutationObserver(records => {
    if (busy) return;
    const onlySignupMutations = records.length > 0 && records.every(record => {
      const target = record.target?.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
      return target?.closest?.("[data-self-game-signup]");
    });
    if (onlySignupMutations) return;

    clearTimeout(window.__memberGameSignupTimer);
    window.__memberGameSignupTimer = setTimeout(() => refresh().catch(console.error), 100);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => refresh().catch(console.error), 500);
})();
