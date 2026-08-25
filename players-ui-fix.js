(() => {
  "use strict";

  function isPlayersPage() {
    const title = document.querySelector(".page-head .title");
    return !!title && title.textContent.trim() === "Players";
  }

  function removeFinanceColumns() {
    if (!isPlayersPage()) return;
    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table) return;
    const headers = [...table.querySelectorAll("thead th")];
    const indexes = headers
      .map((th, index) => ({ text: th.textContent.trim().toLowerCase(), index }))
      .filter(x => x.text === "payment model" || x.text === "season ticket")
      .map(x => x.index)
      .sort((a, b) => b - a);
    indexes.forEach(index => {
      headers[index]?.remove();
      table.querySelectorAll("tbody tr").forEach(row => row.querySelectorAll("td")[index]?.remove());
    });
  }

  function cleanPlayersHeading() {
    if (!isPlayersPage()) return;
    const subtitle = document.querySelector(".page-head .title")?.parentElement?.querySelector(".muted");
    if (subtitle && /payment model|season-ticket status/i.test(subtitle.textContent)) {
      subtitle.textContent = "Roster and attendance history.";
    }
  }

  function addPlayerCount() {
    if (!isPlayersPage()) return;
    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table) return;
    const count = table.querySelectorAll("tbody tr").length;
    let badge = document.querySelector(".page-head .players-count");
    if (!badge) {
      const title = document.querySelector(".page-head .title");
      if (!title) return;
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
    removeFinanceColumns();
    cleanPlayersHeading();
    addPlayerCount();
    ensureMobileNavVisible();
  }

  apply();
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", apply);
})();
