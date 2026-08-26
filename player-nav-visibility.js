(() => {
  "use strict";

  const isPlayerRole = value => String(value || "").trim().toLowerCase() === "player";

  function previewRole() {
    const banner = document.querySelector(".preview-banner");
    if (!banner) return null;
    const text = banner.querySelector(":scope > div")?.textContent?.trim() || "";
    const match = text.match(/^Preview mode\s*·\s*Viewing the site as .+?\s*\((.+)\)$/i);
    return match?.[1]?.trim() || null;
  }

  function hidePlayersNav() {
    const players = document.querySelector('.nav-item[data-view="players"]');
    if (!players) return;
    players.style.display = "none";
    players.setAttribute("aria-hidden", "true");
    players.tabIndex = -1;
  }

  function restorePlayersNav() {
    const players = document.querySelector('.nav-item[data-view="players"]');
    if (!players) return;
    players.style.display = "";
    players.removeAttribute("aria-hidden");
    players.removeAttribute("tabindex");
  }

  async function init() {
    const sb = window.supabaseClient;
    if (!sb) return;

    const result = await sb.rpc("get_my_access");
    const actualRole = result.data?.allowed ? result.data?.profile?.role : null;

    const enforce = () => {
      const player = isPlayerRole(actualRole) || isPlayerRole(previewRole());
      if (player) hidePlayersNav();
      else restorePlayersNav();
    };

    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (window.supabaseClient) init();
  else window.addEventListener("load", init, { once: true });
})();
