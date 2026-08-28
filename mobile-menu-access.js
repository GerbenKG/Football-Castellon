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

    if (document.querySelector(".profile-shell")) return setActive("profile");
    if (document.querySelector(".member-payments-shell")) return setActive("payments");

    if (isPlayer() || window.__appView === "games") setActive("games");
  }

  function goToGames() {
    if (!isPlayer()) return;
    if (window.location.hash === "#profile" || window.location.hash === "#payments") return;
    if (document.querySelector(".profile-shell, .member-payments-shell")) return;

    const game = nav()?.querySelector('[data-view="games"]');
    if (!game) return setTimeout(goToGames, 50);

    window.__memberView = null;
    window.__appView = "games";
    game.click();
  }

  document.addEventListener("click", event => {
    const item = event.target.closest(".nav .nav-item");
    if (!item || !isMember()) return;

    if (item.matches('[data-member-payments="true"]')) setActive("payments");
    else if (item.matches('[data-member-profile], [data-player-profile]')) setActive("profile");
    else if (item.dataset.view === "games") setActive("games");
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
