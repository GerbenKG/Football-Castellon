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

  function activeMemberTarget() {
    if (window.location.hash === "#profile" || window.__memberView === "profile") return "profile";
    if (window.location.hash === "#payments" || window.__memberView === "payments") return "payments";
    if (isPlayer()) return "games";
    return null;
  }

  function syncActiveState() {
    const nav = document.querySelector(".nav");
    if (!nav || !access) return;

    const memberItems = [...nav.querySelectorAll(".nav-item")].filter(item =>
      isMemberProfile(item) || isMemberPayments(item) || item.dataset.view === "games"
    );
    if (!memberItems.length) return;

    const target = activeMemberTarget();
    if (!target) return;

    memberItems.forEach(item => {
      const matches =
        (target === "profile" && isMemberProfile(item)) ||
        (target === "payments" && isMemberPayments(item)) ||
        (target === "games" && item.dataset.view === "games");
      item.classList.toggle("active", matches && getComputedStyle(item).display !== "none");
    });
  }

  function apply() {
    const nav = document.querySelector(".nav");
    if (!nav || !access) return;

    const items = [...nav.querySelectorAll(".nav-item")];
    items.forEach(item => setItemVisibility(item, itemAllowed(item)));

    const visible = items.filter(item =>
      getComputedStyle(item).display !== "none" &&
      item.getAttribute("aria-hidden") !== "true"
    );

    // For member navigation, never leave an unrelated item active.
    const target = activeMemberTarget();
    if (target) {
      const memberItems = visible.filter(item =>
        isMemberProfile(item) || isMemberPayments(item) || item.dataset.view === "games"
      );
      memberItems.forEach(item => item.classList.remove("active"));
      const selected = memberItems.find(item =>
        (target === "profile" && isMemberProfile(item)) ||
        (target === "payments" && isMemberPayments(item)) ||
        (target === "games" && item.dataset.view === "games")
      );
      selected?.classList.add("active");
      return;
    }

    const active = nav.querySelector(".nav-item.active");
    if (active && !visible.includes(active)) active.classList.remove("active");

    if (!nav.querySelector(".nav-item.active") && visible.length) {
      const preferred = visible.find(item => item.dataset.view === "dashboard") || visible[0];
      preferred?.classList.add("active");
    }
  }

  document.addEventListener("click", event => {
    const item = event.target.closest(".nav .nav-item");
    if (!item || !access) return;

    if (isMemberProfile(item)) {
      window.__memberView = "profile";
      syncActiveState();
    } else if (isMemberPayments(item)) {
      window.__memberView = "payments";
      syncActiveState();
    } else if (item.dataset.view === "games" && isPlayer()) {
      window.__memberView = "games";
      window.__playerView = "games";
      syncActiveState();
    }
  }, true);

  window.addEventListener("hashchange", syncActiveState);

  async function init() {
    await loadAccess();
    if (!access) return;
    apply();
  }

  init();
})();