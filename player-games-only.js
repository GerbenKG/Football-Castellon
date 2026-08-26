(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return;
    access = result.data?.allowed ? result.data : null;
    if (!isPlayer()) return;
    enforceNavigation();
  }

  const isPlayer = () => access?.profile?.role === "player" && access?.profile?.active === true;

  function enforceNavigation() {
    if (!isPlayer()) return;
    const nav = document.querySelector(".nav");
    if (!nav) return;

    const players = nav.querySelector('.nav-item[data-view="players"]');
    const games = nav.querySelector('.nav-item[data-view="games"]');

    if (players) {
      players.style.display = "none";
      players.setAttribute("aria-hidden", "true");
      players.tabIndex = -1;
    }

    if (games) {
      games.style.display = "";
      games.removeAttribute("aria-hidden");
      games.removeAttribute("tabindex");
    }
  }

  document.addEventListener("click", event => {
    if (!isPlayer()) return;
    const players = event.target.closest('.nav-item[data-view="players"]');
    if (!players) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const games = document.querySelector('.nav-item[data-view="games"]');
    if (games) games.click();
  }, true);

  const observer = new MutationObserver(() => {
    if (isPlayer()) enforceNavigation();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  loadAccess();
})();
