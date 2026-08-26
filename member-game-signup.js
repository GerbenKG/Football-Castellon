(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let busy = false;
  let cachedAccess = null;

  function previewBannerText() {
    return document.body?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function isPlayerPreview() {
    return /Viewing the site as\s+.+?\s*\(player\)/i.test(previewBannerText());
  }

  function previewName() {
    const match = previewBannerText().match(/Viewing the site as\s+(.+?)\s*\(player\)/i);
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
    if (!playerId) return null;
    const result = await sb
      .from("game_players")
      .select("id,playing")
      .eq("game_id", gameId)
      .eq("player_id", playerId)
      .limit(1);
    if (result.error) throw result.error;
    return result.data?.[0] || null;
  }

  async function getPreviewPlayerId(name) {
    if (!name) return null;
    const access = await loadAccess();
    if (access?.members?.length) {
      const member = access.members.find(m =>
        String(m.display_name || m.name || "").trim().toLowerCase() === name.trim().toLowerCase() &&
        m.role === "player" && m.active !== false
      );
      if (member?.player_id) return member.player_id;
    }

    const result = await sb.rpc("admin_list_access");
    if (result.error) return null;
    const member = (result.data || []).find(m =>
      String(m.display_name || m.name || "").trim().toLowerCase() === name.trim().toLowerCase() &&
      m.role === "player" && m.active !== false
    );
    return member?.player_id || null;
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
      button.className = "btn btn-primary";
      button.dataset.selfGameSignupButton = "true";
      wrap.appendChild(button);
    }

    button.disabled = disabled;
    button.textContent = playing ? "I'm playing ✓" : "I'm playing";
    button.dataset.playing = playing ? "true" : "false";
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

    const playerId = preview
      ? await getPreviewPlayerId(previewName())
      : access.profile.player_id;
    const existing = await getSignup(nextGame.id, playerId);
    renderButton(card, !!existing?.playing);
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
        result = await sb.rpc("admin_preview_toggle_game", {
          p_game_id: nextGame.id,
          p_member_name: name
        });
      } else {
        result = await sb.rpc("member_toggle_game", { p_game_id: nextGame.id });
      }

      if (result.error) throw result.error;

      // The Games view gets its squad from the database when the application
      // loads. Reloading here makes the new signup/removal immediately visible
      // in the player list, playing count, and button state.
      window.dispatchEvent(new CustomEvent("football:game-squad-changed", { detail: result.data }));
      button.textContent = result.data?.playing ? "I'm playing ✓" : "I'm playing";
      setTimeout(() => window.location.reload(), 150);
    } catch (error) {
      console.error("Self game signup failed", error);
      button.disabled = false;
      button.textContent = button.dataset.playing === "true" ? "I'm playing ✓" : "I'm playing";
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
