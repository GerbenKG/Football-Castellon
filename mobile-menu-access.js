(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;

  const isPlayer = () => access?.profile?.role === "player" && access?.profile?.active === true;
  const isActiveMember = () => access?.profile?.active === true;
  const hasPermission = permission => {
    if (!permission) return true;
    if (access?.profile?.role === "super_admin") return true;
    return access?.permissions?.[permission] === true;
  };

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) {
      console.error("Could not load navigation access", result.error);
      return null;
    }
    access = result.data?.allowed ? result.data : null;
    return access;
  }

  function setItemVisibility(item, visible) {
    if (visible) {
      item.style.removeProperty("display");
      item.removeAttribute("aria-hidden");
      item.removeAttribute("tabindex");
    } else {
      item.style.setProperty("display", "none", "important");
      item.setAttribute("aria-hidden", "true");
      item.tabIndex = -1;
      item.classList.remove("active");
    }
  }

  function isMemberProfile(item) {
    return item.matches('[data-member-profile], [data-player-profile]');
  }

  function isMemberPayments(item) {
    return item.matches('[data-member-payments="true"]');
  }

  function itemAllowed(item) {
    // Active members can access their profile and payment history.
    if (isMemberProfile(item)) return isActiveMember();
    if (isMemberPayments(item)) return isActiveMember();

    // Players only get the member-facing Games item from the main navigation.
    if (isPlayer()) return item.dataset.view === "games";

    return hasPermission(item.dataset.permission);
  }

  function activeTarget() {
    // Member-only pages have an explicit state because they do not use the
    // application's normal `view` variable.
    if (window.location.hash === "#profile" || window.__memberView === "profile") return "profile";
    if (window.location.hash === "#payments" || window.__memberView === "payments") return "payments";

    // For normal navigation, use the application's current view when exposed.
    if (window.__appView) return window.__appView;
    if (isPlayer()) return "games";

    return null;
  }

  function itemTarget(item) {
    if (isMemberProfile(item)) return "profile";
    if (isMemberPayments(item)) return "payments";
    return item.dataset.view || null;
  }

  function syncActiveState() {
    const nav = document.querySelector(".nav");
    if (!nav || !access) return;

    const items = [...nav.querySelectorAll(".nav-item")];
    const visible = items.filter(item =>
      getComputedStyle(item).display !== "none" &&
      item.getAttribute("aria-hidden") !== "true"
    );

    const target = activeTarget();

    // The mobile menu must have exactly one active item. Never allow the
    // Payments/Profile helpers to leave a stale active class behind when the
    // user moves back to Games (or any other normal view).
    items.forEach(item => {
      const shouldBeActive = !!target && visible.includes(item) && itemTarget(item) === target;
      item.classList.toggle("active", shouldBeActive);
    });
  }

  function apply() {
    const nav = document.querySelector(".nav");
    if (!nav || !access) return;

    const items = [...nav.querySelectorAll(".nav-item")];
    items.forEach(item => setItemVisibility(item, itemAllowed(item)));

    syncActiveState();
  }

  document.addEventListener("click", event => {
    const item = event.target.closest(".nav .nav-item");
    if (!item || !access) return;

    if (isMemberProfile(item)) {
      window.__memberView = "profile";
      window.__appView = null;
    } else if (isMemberPayments(item)) {
      window.__memberView = "payments";
      window.__appView = null;
    } else if (item.dataset.view) {
      // Switching to a normal navigation item must explicitly clear any
      // previous member-page state, especially Payments.
      window.__memberView = null;
      window.__appView = item.dataset.view;
      if (item.dataset.view === "games" && isPlayer()) {
        window.__playerView = "games";
      }
    }

    // Run immediately and once after the other navigation click handlers.
    // The delayed pass prevents another listener from re-adding a stale
    // `.active` class after this handler has run.
    syncActiveState();
    setTimeout(syncActiveState, 0);
  }, true);

  window.addEventListener("hashchange", () => {
    syncActiveState();
    setTimeout(syncActiveState, 0);
  });

  async function init() {
    await loadAccess();
    if (!access) return;
    apply();
  }

  init();
})();