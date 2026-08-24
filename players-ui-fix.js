(() => {
  "use strict";

  function removePlayersPaymentModelColumn() {
    const title = document.querySelector(".page-head .title");
    if (!title || title.textContent.trim() !== "Players") return;

    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table) return;

    const headers = [...table.querySelectorAll("thead th")];
    const header = headers.find(th => th.textContent.trim().toLowerCase() === "payment model");
    if (!header) return;

    const index = headers.indexOf(header);
    header.remove();
    table.querySelectorAll("tbody tr").forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells[index]) cells[index].remove();
    });
  }

  function addPlayerCount() {
    const title = document.querySelector(".page-head .title");
    if (!title || title.textContent.trim() !== "Players") return;

    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table) return;

    const count = table.querySelectorAll("tbody tr").length;
    let badge = title.parentElement.querySelector(".players-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "players-count";
      title.insertAdjacentElement("afterend", badge);
    }
    badge.textContent = `${count} ${count === 1 ? "player" : "players"}`;
  }

  function ensureMobileNavVisible() {
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    const nav = document.querySelector(".nav");
    if (!nav) return;
    nav.style.setProperty("display", "flex", "important");
    nav.style.setProperty("position", "fixed", "important");
    nav.style.setProperty("left", "10px", "important");
    nav.style.setProperty("right", "10px", "important");
    nav.style.setProperty("bottom", "calc(10px + env(safe-area-inset-bottom))", "important");
    nav.style.setProperty("width", "auto", "important");
    nav.style.setProperty("margin", "0", "important");
    nav.style.setProperty("z-index", "1000", "important");
  }

  function apply() {
    removePlayersPaymentModelColumn();
    addPlayerCount();
    ensureMobileNavVisible();
  }

  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", apply);
})();
