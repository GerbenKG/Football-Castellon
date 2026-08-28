(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;
  let syncQueued = false;

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
    if (isMemberProfile(item)) return isActiveMember();
    if (isMemberPayments(item)) return isActiveMember();
    if (isPlayer()) return item.dataset.view === "games";
    return hasPermission(item.dataset.permission);
  }

  function itemTarget(item) {
    if (isMemberProfile(item)) return "profile";
    if (isMemberPayments(item)) return "payments";
    return item.dataset.view || null;
  }

  function visibleItems(nav) {
    return [...nav.querySelectorAll(".nav-item")].filter(item =>
      getComputedStyle(item).display !== "none" &&
      item.getAttribute("aria-hidden") !== "true"
    );
  }

  function routeTarget() {
    if (window.location.hash === "#profile" || window.__memberView === "profile") return "profile";
    if (window.location.hash === "#payments" || window.__memberView === "payments") return "payments";
    if (window.__appView) return window.__appView;
    if (isPlayer()) return "games";
    return null;
  }

  function syncActiveState() {
    const nav = document.querySelector(".nav");
    if (!nav || !access) return;

    const items = [...nav.querySelectorAll(".nav-item")];
    const visible = visibleItems(nav);
    if (!visible.length) return;

    // The route is the source of truth. In particular, member pages must
    // override any stale `.active` class left by the normal app navigation.
    // This prevents Games from remaining highlighted after navigating to
    // Payments or Profile.
    const target = routeTarget();
    if (target) {
      const matching = visible.filter(item => itemTarget(item) === target);
      if (matching.length) {
        items.forEach(item => item.classList.toggle("active", matching.includes(item)));
        return;
      }
    }

    // If no route target is available, preserve the normal app navigation's
    // selected item rather than guessing from stale member-navigation state.
    const normalActive = visible.find(item =>
      item.dataset.view && item.classList.contains("active")
    );
    items.forEach(item => item.classList.toggle("active", item === normalActive));
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncActiveState();
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
      // Normal navigation clears the member-page route state. The app's own
      // render then owns the active class for the selected normal view.
      window.__memberView = null;
      window.__appView = item.dataset.view;
      if (item.dataset.view === "games" && isPlayer()) {
        window.__playerView = "games";
      }
    }

    queueSync();
    setTimeout(syncActiveState, 0);
  }, true);

  window.addEventListener("hashchange", queueSync);

  // Several legacy member-navigation helpers also touch `.active`. Observe
  // the final DOM state and enforce the single-active-item invariant after
  // every render, including renders initiated by app.js.
  const observer = new MutationObserver(queueSync);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-hidden"]
  });

  async function init() {
    await loadAccess();
    if (!access) return;
    apply();
  }

  init();
})();