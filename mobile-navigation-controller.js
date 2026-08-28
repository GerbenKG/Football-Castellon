(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;
  let loginHandled = false;
  let syncQueued = false;

  const nav = () => document.querySelector(".nav");
  const items = () => [...document.querySelectorAll(".nav .nav-item")];
  const isPlayer = () => access?.profile?.role === "player" && access?.profile?.active === true;
  const isMember = () => access?.profile?.active === true;

  function itemFor(target) {
    const n = nav();
    if (!n) return null;
    if (target === "payments") return n.querySelector('[data-member-payments="true"]');
    if (target === "profile") return n.querySelector("[data-member-profile], [data-player-profile]");
    return n.querySelector('.nav-item[data-view="games"]');
  }

  function pageTarget() {
    // Rendered page is the strongest signal because normal app.js navigation
    // does not consistently update the URL.
    if (document.querySelector(".member-payments-shell")) return "payments";
    if (document.querySelector(".profile-shell")) return "profile";

    if (window.location.hash === "#payments" || window.__memberView === "payments") return "payments";
    if (window.location.hash === "#profile" || window.__memberView === "profile") return "profile";

    if (isPlayer()) return "games";
    if (window.__appView === "games") return "games";
    return null;
  }

  function setSingleActive(target) {
    const n = nav();
    if (!n || !target) return;

    const targetItem = itemFor(target);
    if (!targetItem || getComputedStyle(targetItem).display === "none") return;

    items().forEach(item => item.classList.toggle("active", item === targetItem));
  }

  function syncActive() {
    const target = pageTarget();
    if (!target) return;

    // Only this controller owns the member/player mobile active state. For
    // normal admin navigation, app.js remains the source of truth.
    if (isMember() || isPlayer()) setSingleActive(target);
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncActive();
    });
  }

  function gamesItem() {
    return document.querySelector('.nav .nav-item[data-view="games"]');
  }

  function goToGames() {
    const game = gamesItem();
    if (!game) return false;

    window.__memberView = null;
    window.__appView = "games";
    window.__playerView = "games";

    if (window.location.hash) {
      history.replaceState({ playerDefault: true }, "", window.location.pathname + window.location.search);
    }

    game.click();
    setTimeout(syncActive, 0);
    return true;
  }

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return null;
    access = result.data?.allowed ? result.data : null;
    return access;
  }

  async function ensurePlayerLanding() {
    if (!isPlayer() || loginHandled) return;
    loginHandled = true;

    // A fresh player session always starts at Games. Profile/Payments remain
    // explicit destinations after the user is inside the application.
    let attempts = 0;
    const tryNavigate = () => {
      if (!isPlayer()) return;
      const game = gamesItem();
      if (!game) {
        if (++attempts < 40) setTimeout(tryNavigate, 50);
        return;
      }
      goToGames();
    };
    tryNavigate();
  }

  async function initialise() {
    await loadAccess();
    if (!access) return;
    await ensurePlayerLanding();
    syncActive();
  }

  // Supabase may finish the Google callback after the page scripts have
  // already initialised, so handle both an existing session and SIGNED_IN.
  sb.auth.onAuthStateChange(event => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
      setTimeout(async () => {
        await loadAccess();
        if (event === "SIGNED_IN") loginHandled = false;
        await ensurePlayerLanding();
        syncActive();
      }, 0);
    }
  });

  document.addEventListener("click", event => {
    const item = event.target.closest(".nav .nav-item");
    if (!item) return;

    // Give the other navigation handlers one turn to render their destination,
    // then enforce exactly one active item from the rendered page/route.
    setTimeout(syncActive, 0);
    setTimeout(syncActive, 80);
    setTimeout(syncActive, 250);
  }, true);

  window.addEventListener("hashchange", () => {
    setTimeout(syncActive, 0);
    setTimeout(syncActive, 100);
  });

  const observer = new MutationObserver(queueSync);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-hidden"]
  });

  initialise();
})();
