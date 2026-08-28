(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;
  let redirecting = false;

  const isPlayerRole = value => String(value || "").trim().toLowerCase() === "player";
  const previewRole = () => {
    const banner = document.querySelector(".preview-banner");
    if (!banner) return null;
    const text = banner.querySelector(":scope > div")?.textContent?.trim() || "";
    const match = text.match(/^Preview mode\s*·\s*Viewing the site as .+?\s*\((.+)\)$/i);
    return match?.[1]?.trim() || null;
  };

  const isEffectivePlayer = () => {
    const actualPlayer = access?.profile?.role === "player" && access?.profile?.active === true;
    return actualPlayer || isPlayerRole(previewRole());
  };

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

  function hidePlayerGameActions() {
    if (!isEffectivePlayer()) return;

    // Players can see the Games overview, but cannot open or manage a squad.
    document.querySelectorAll('button[data-game]').forEach(button => {
      button.style.display = "none";
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
    });
  }

  function goToGames() {
    if (redirecting) return;
    const games = document.querySelector('.nav-item[data-view="games"]');
    if (!games) return;
    redirecting = true;
    games.click();
    setTimeout(() => { redirecting = false; }, 100);
  }

  function hasExplicitMemberRoute() {
    return window.location.hash === "#profile" ||
      window.location.hash === "#payments" ||
      window.__memberView === "profile" ||
      window.__memberView === "payments";
  }

  function enforcePlayerArea() {
    if (!isEffectivePlayer()) return;

    // A Player's application surface is Games + Profile only.
    hideNavItem('.nav-item[data-view="dashboard"]');
    hideNavItem('.nav-item[data-view="players"]');
    hideNavItem('.nav-item[data-view="finance"]');
    hideNavItem('.nav-item[data-view="admin"]');
    showNavItem('.nav-item[data-view="games"]');
    hidePlayerGameActions();

    // Games is the default landing page for players. Respect an explicit
    // Profile/Payments route so normal member navigation is never overridden.
    // This also replaces the admin app's default Dashboard on initial login.
    const active = document.querySelector('.nav-item.active');
    if (!hasExplicitMemberRoute() && (!active || active.dataset.view !== "games")) {
      goToGames();
    }
  }

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return;
    access = result.data?.allowed ? result.data : null;
    enforcePlayerArea();
  }

  document.addEventListener("click", event => {
    if (!isEffectivePlayer()) return;

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
      return;
    }

    const gameAction = event.target.closest('button[data-game]');
    if (gameAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  const observer = new MutationObserver(() => enforcePlayerArea());
  observer.observe(document.body, { childList: true, subtree: true });

  loadAccess();
})();
