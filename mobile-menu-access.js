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

  function itemAllowed(item) {
    // Players only get member-facing Games and Payments.
    // Games is intentionally independent of the admin permission matrix.
    if (isPlayer()) {
      if (item.dataset.view === "games") return true;
      if (item.matches('[data-member-payments="true"]')) return isActiveMember();
      return false;
    }

    if (item.matches('[data-member-payments="true"]')) return isActiveMember();
    return hasPermission(item.dataset.permission);
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

    const active = nav.querySelector(".nav-item.active");
    if (active && !visible.includes(active)) active.classList.remove("active");

    if (!nav.querySelector(".nav-item.active") && visible.length) {
      const preferred = isPlayer()
        ? visible.find(item => item.dataset.view === "games")
        : visible.find(item => item.dataset.view === "dashboard") || visible[0];
      preferred?.classList.add("active");
    }
  }

  async function init() {
    await loadAccess();
    if (!access) return;
    apply();
  }

  init();
})();
