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

    const isEffectivePlayer = () => isPlayerRole(actualRole) || isPlayerRole(previewRole());

    const enforce = () => {
      if (isEffectivePlayer()) hidePlayersNav();
      else restorePlayersNav();
    };

    document.addEventListener("click", event => {
      if (!isEffectivePlayer()) return;
      const players = event.target.closest('.nav-item[data-view="players"]');
      if (!players) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const games = document.querySelector('.nav-item[data-view="games"]');
      if (games) games.click();
    }, true);

    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (window.supabaseClient) init();
  else window.addEventListener("load", init, { once: true });
})();
