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

  function ensureMobileNavVisible() {
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    const nav = document.querySelector(".nav");
    if (!nav) return;
    nav.style.setProperty("display", "flex", "important");
    nav.style.setProperty("position", "fixed", "important");
    nav.style.setProperty("z-index", "1000", "important");
  }

  function apply() {
    removePlayersPaymentModelColumn();
    ensureMobileNavVisible();
  }

  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", apply);
})();
