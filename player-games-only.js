(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;

  const isPlayer = () => access?.profile?.role === "player" && access?.profile?.active === true;

  function hideNavItem(selector) {
    const item = document.querySelector(selector);
    if (!item) return;
    item.style.display = "none";
    item.setAttribute("aria-hidden", "true");
    item.tabIndex = -1;
  }

  function showNavItem(selector) {
    const item = document.querySelector(selector);
    if (!item) return;
    item.style.display = "";
    item.removeAttribute("aria-hidden");
    item.removeAttribute("tabindex");
  }

  function goToGames() {
    const games = document.querySelector('.nav-item[data-view="games"]');
    if (games) {
      games.click();
      return;
    }
    window.location.hash = "games";
  }

  function enforcePlayerArea() {
    if (!isPlayer()) return;

    // Players only get Games and Profile. Dashboard and Players are not part
    // of the Player experience and are removed from navigation.
    hideNavItem('.nav-item[data-view="dashboard"]');
    hideNavItem('.nav-item[data-view="players"]');
    showNavItem('.nav-item[data-view="games"]');

    // If a Player lands on Dashboard (including after a refresh), move them
    // immediately to Games rather than rendering the admin dashboard.
    const active = document.querySelector('.nav-item.active');
    if (active?.dataset.view === "dashboard") goToGames();
  }

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return;
    access = result.data?.allowed ? result.data : null;
    enforcePlayerArea();
  }

  document.addEventListener("click", event => {
    if (!isPlayer()) return;

    const dashboard = event.target.closest('.nav-item[data-view="dashboard"]');
    if (dashboard) {
      event.preventDefault();
      event.stopImmediatePropagation();
      goToGames();
      return;
    }

    const players = event.target.closest('.nav-item[data-view="players"]');
    if (players) {
      event.preventDefault();
      event.stopImmediatePropagation();
      goToGames();
    }
  }, true);

  const observer = new MutationObserver(() => enforcePlayerArea());
  observer.observe(document.body, { childList: true, subtree: true });

  loadAccess();
})();
