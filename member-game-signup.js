(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let busy = false;
  let cachedAccess = null;

  const isPlayerPreview = () => {
    const banner = document.querySelector(".preview-banner");
    const text = banner?.querySelector(":scope > div")?.textContent?.trim() || "";
    return /\(player\)$/i.test(text);
  };

  const previewName = () => {
    const banner = document.querySelector(".preview-banner");
    const text = banner?.querySelector(":scope > div")?.textContent?.trim() || "";
    const match = text.match(/^Preview mode\s*·\s*Viewing the site as (.+?)\s*\(player\)$/i);
    return match?.[1]?.trim() || null;
  };

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
    return Array.from(document.querySelectorAll(".card")).find(card =>
      /NEXT GAME/i.test(card.textContent || "")
    );
  }

  function renderButton(card, label, disabled = false) {
    let wrap = card.querySelector("[data-self-game-signup]");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.dataset.selfGameSignup = "true";
      wrap.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:12px;";
      card.appendChild(wrap);
    }

    wrap.innerHTML =
      '<button type="button" class="btn btn-primary" data-self-game-signup-button' +
      (disabled ? " disabled" : "") +
      ">" + label + "</button>";
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

    const button = card.querySelector("[data-self-game-signup-button]");
    if (!button || button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      button.textContent = "Saving…";

      try {
        const result = preview
          ? await sb.rpc("admin_preview_join_game", {
              p_game_id: nextGame.id,
              p_member_name: previewName()
            })
          : await sb.rpc("member_join_game", { p_game_id: nextGame.id });

        if (result.error) throw result.error;

        button.textContent = "I'm playing ✓";
        window.dispatchEvent(new CustomEvent("football:game-squad-changed"));
      } catch (error) {
        console.error("Self game signup failed", error);
        alert("Could not add you to the game: " + error.message);
        button.disabled = false;
        button.textContent = "I'm playing";
      } finally {
        busy = false;
      }
    });
  }

  const observer = new MutationObserver(() => refresh().catch(console.error));
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => refresh().catch(console.error), 300);
})();
