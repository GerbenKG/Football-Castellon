(() => {
  "use strict";

  function isPlayersPage() {
    const title = document.querySelector(".page-head .title");
    return !!title && title.textContent.trim() === "Players";
  }

  function rosterTable() {
    return document.querySelector(".page-head ~ .card table") || document.querySelector("table");
  }

  function removeFinanceColumns() {
    if (!isPlayersPage()) return;
    const table = rosterTable();
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

  function removeAttendanceButtons() {
    if (!isPlayersPage()) return;
    const table = rosterTable();
    if (!table) return;
    table.querySelectorAll("button").forEach(button => {
      if (button.textContent.trim().toLowerCase() === "attendance") button.remove();
    });
  }

  function normalizeTableLayout() {
    if (!isPlayersPage()) return;
    const table = rosterTable();
    if (!table) return;

    table.classList.add("players-roster-table");

    // The base Players table owns the Edit/Archive action column. Feature
    // scripts add Skill Level, Bibs Taken and Member afterwards. Keep all
    // data columns together and put Actions at the far right.
    const head = table.querySelector("thead tr");
    if (head) {
      const actionHead = [...head.children].find(th => {
        if (th.dataset.memberActionHead || th.dataset.skillLevel || th.dataset.bibsCountColumn) return false;
        return !th.textContent.trim();
      });
      if (actionHead) head.appendChild(actionHead);
    }

    table.querySelectorAll("tbody tr").forEach(row => {
      const actionCell = [...row.children].find(td => {
        if (td.dataset.memberActionCell || td.dataset.skillLevel || td.dataset.bibsCountCell) return false;
        return !!td.querySelector('[data-a="edit"], [data-a="history"], [data-a="delete"], [data-archive-player]');
      });
      if (actionCell) row.appendChild(actionCell);
    });

    if (!document.getElementById("players-roster-layout-style")) {
      const style = document.createElement("style");
      style.id = "players-roster-layout-style";
      style.textContent = `
        .players-roster-table { min-width: 900px; }
        .players-roster-table th,
        .players-roster-table td { vertical-align: middle; }
        .players-roster-table th:nth-child(1),
        .players-roster-table td:nth-child(1) { min-width: 180px; }
        .players-roster-table th:nth-child(2),
        .players-roster-table td:nth-child(2) { min-width: 145px; }
        .players-roster-table th:nth-child(3),
        .players-roster-table td:nth-child(3) { min-width: 220px; }
        .players-roster-table th[data-skill-level],
        .players-roster-table td[data-skill-level],
        .players-roster-table th[data-bibs-count-column],
        .players-roster-table td[data-bibs-count-cell] { width: 105px; min-width: 105px; }
        .players-roster-table th[data-member-action-head],
        .players-roster-table td[data-member-action-cell] { width: 150px; min-width: 150px; }
        .players-roster-table tbody td:last-child { white-space: nowrap; }
        .players-roster-table tbody td:last-child .actions { flex-wrap: nowrap; }
      `;
      document.head.appendChild(style);
    }
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
    const table = rosterTable();
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
    removeAttendanceButtons();
    normalizeTableLayout();
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
