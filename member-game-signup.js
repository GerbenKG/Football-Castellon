(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let busy = false;
  let cachedAccess = null;

  function previewBannerText() {
    return document.querySelector(".preview-banner")?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function isPlayerPreview() {
    return /Viewing the site as .+\(player\)/i.test(previewBannerText());
  }

  function previewName() {
    const text = previewBannerText();
    const match = text.match(/Viewing the site as\s+(.+?)\s*\(player\)/i);
    return match?.[1]?.trim() || null;
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
      .gte("game_date", new Date().toISOString().slice(0, 10))
      .order("game_date")
      .order("start_time")
      .limit(1);
    if (result.error) throw result.error;
    return result.data?.[0] || null;
  }

  async function getSignup(gameId, playerId) {
    const result = await sb
      .from("game_players")
      .select("id,playing")
      .eq("game_id", gameId)
      .eq("player_id", playerId)
      .limit(1);
    if (result.error) throw result.error;
    return result.data?.[0] || null;
  }

  function findNextGameCard() {
    return Array.from(document.querySelectorAll(".card")).find(card => /NEXT GAME/i.test(card.textContent || ""));
  }

  function renderButton(card, label, disabled = false) {
    let wrap = card.querySelector("[data-self-game-signup]");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.dataset.selfGameSignup = "true";
      wrap.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:12px;";
      card.appendChild(wrap);
    }

    const existing = wrap.querySelector("[data-self-game-signup-button]");
    if (existing) {
      if (!existing.disabled || !disabled) existing.disabled = disabled;
      existing.textContent = label;
      return;
    }

    wrap.innerHTML = '<button type="button" class="btn btn-primary" data-self-game-signup-button' + (disabled ? " disabled" : "") + ">" + label + "</button>";
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

    const nextGame = await getNextGame();
    if (!nextGame) return;

    if (preview) {
      renderButton(card, "I'm playing");
    } else {
      const existing = await getSignup(nextGame.id, access.profile.player_id);
      renderButton(card, existing?.playing ? "I'm playing ✓" : "I'm playing");
    }
  }

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-self-game-signup-button]");
    if (!button || busy) return;

    const card = button.closest("[data-self-game-signup]")?.closest(".card");
    if (!card) return;

    const preview = isPlayerPreview();
    const access = await loadAccess();
    const isRealPlayer = access?.profile?.role === "player" && access.profile.active === true;
    if (!preview && !isRealPlayer) return;

    busy = true;
    button.disabled = true;
    button.textContent = "Saving…";

    try {
      const nextGame = await getNextGame();
      if (!nextGame) throw new Error("No upcoming game found");

      let result;
      if (preview) {
        const name = previewName();
        if (!name) throw new Error("Could not determine the Player being previewed");
        result = await sb.rpc("admin_preview_join_game", {
          p_game_id: nextGame.id,
          p_member_name: name
        });
      } else {
        result = await sb.rpc("member_join_game", { p_game_id: nextGame.id });
      }

      if (result.error) throw result.error;

      button.textContent = "I'm playing ✓";
      window.dispatchEvent(new CustomEvent("football:game-squad-changed"));
    } catch (error) {
      console.error("Self game signup failed", error);
      alert("Could not add you to the game: " + (error?.message || error));
      button.disabled = false;
      button.textContent = "I'm playing";
    } finally {
      busy = false;
    }
  });

  const observer = new MutationObserver(() => {
    clearTimeout(window.__memberGameSignupTimer);
    window.__memberGameSignupTimer = setTimeout(() => refresh().catch(console.error), 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => refresh().catch(console.error), 500);
})();
