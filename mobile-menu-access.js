(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;

  const nav = () => document.querySelector(".nav");
  const items = () => [...document.querySelectorAll(".nav .nav-item")];
  const isMember = () => access?.profile?.active === true;
  const isPlayer = () => isMember() && access?.profile?.role === "player";

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return;
    access = result.data?.allowed ? result.data : null;
    applyVisibility();
  }

  function allowed(item) {
    if (item.matches('[data-member-profile], [data-player-profile]')) return isMember();
    if (item.matches('[data-member-payments="true"]')) return isMember();
    if (isPlayer()) return item.dataset.view === "games";
    return access?.profile?.role === "super_admin" || access?.permissions?.[item.dataset.permission] === true;
  }

  function applyVisibility() {
    if (!access) return;
    items().forEach(item => {
      item.style.display = allowed(item) ? "" : "none";
    });
  }

  function setActive(name) {
    const n = nav();
    if (!n) return;

    let target = null;
    if (name === "payments") target = n.querySelector('[data-member-payments="true"]');
    if (name === "profile") target = n.querySelector("[data-member-profile], [data-player-profile]");
    if (name === "games") target = n.querySelector('[data-view="games"]');
    if (!target || getComputedStyle(target).display === "none") return;

    items().forEach(item => item.classList.toggle("active", item === target));
  }

  function syncActive() {
    if (!isMember()) return;

    // The explicit member view wins while its page is rendering. This prevents
    // the Games fallback from re-activating itself during the Payments/Profile
    // loading phase.
    if (window.__memberView === "payments") return setActive("payments");
    if (window.__memberView === "profile") return setActive("profile");

    if (document.querySelector(".profile-shell")) return setActive("profile");
    if (document.querySelector(".member-payments-shell")) return setActive("payments");

    if (isPlayer() || window.__appView === "games") setActive("games");
  }

  function clearMemberRoute() {
    window.__memberView = null;
    if (window.location.hash === "#payments" || window.location.hash === "#profile") {
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    }
  }

  function goToGames() {
    if (!isPlayer()) return;
    if (document.querySelector(".profile-shell, .member-payments-shell")) return;

    const game = nav()?.querySelector('[data-view="games"]');
    if (!game) return setTimeout(goToGames, 50);

    clearMemberRoute();
    window.__appView = "games";
    game.click();
  }

  document.addEventListener("click", event => {
    const item = event.target.closest(".nav .nav-item");
    if (!item || !isMember()) return;

    if (item.matches('[data-member-payments="true"]')) {
      window.__memberView = "payments";
      setActive("payments");
    } else if (item.matches('[data-member-profile], [data-player-profile]')) {
      clearMemberRoute();
      window.__memberView = "profile";
      setActive("profile");
    } else if (item.dataset.view === "games") {
      clearMemberRoute();
      window.__appView = "games";
      setActive("games");
    }
  }, true);

  const observer = new MutationObserver(() => {
    applyVisibility();
    syncActive();
  });
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });

  sb.auth.onAuthStateChange(() => setTimeout(async () => {
    await loadAccess();
    goToGames();
    syncActive();
  }, 0));

  loadAccess().then(() => {
    goToGames();
    syncActive();
  });
})();
