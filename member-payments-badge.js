(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let timer = null;
  let running = false;

  function navItem() {
    return document.querySelector('.nav [data-member-payments="true"]');
  }

  function setCount(count) {
    const item = navItem();
    if (!item) return;
    let badge = item.querySelector(".member-payments-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "member-payments-badge";
        item.appendChild(badge);
      }
      if (badge.textContent !== String(count)) badge.textContent = String(count);
      badge.setAttribute("aria-label", `${count} open payment${count === 1 ? "" : "s"}`);
    } else if (badge) {
      badge.remove();
    }
  }

  async function load() {
    if (running) return;
    const item = navItem();
    if (!item) return;
    if (item.hidden || item.style.display === "none") {
      setCount(0);
      return;
    }
    running = true;
    try {
      const session = await sb.auth.getSession();
      if (!session.data?.session) {
        setCount(0);
        return;
      }
      const result = await sb.rpc("member_payment_history");
      if (result.error) throw result.error;
      const open = Number(result.data?.summary?.open || 0);
      setCount(Number.isFinite(open) ? open : 0);
    } catch (error) {
      if (error?.status !== 401) console.error("Could not load open payment count", error);
      setCount(0);
    } finally {
      running = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(load, 150);
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", schedule);
  schedule();
})();
