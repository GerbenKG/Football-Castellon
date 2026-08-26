(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let lastKey = "";

  async function render() {
    if (!document.querySelector('.nav-item.active[data-view="players"]')) return;

    const table = document.querySelector('.page-head + .table-card table');
    if (!table) return;

    const bodyRows = [...table.querySelectorAll("tbody tr")];
    if (!bodyRows.length) return;

    const { data, error } = await sb
      .from("game_players")
      .select("player_id,took_bibs")
      .eq("took_bibs", true);
    if (error) {
      console.warn("[Football] Could not load bib counts", error);
      return;
    }

    const counts = new Map();
    (data || []).forEach(row => {
      if (!row.player_id) return;
      counts.set(row.player_id, (counts.get(row.player_id) || 0) + 1);
    });

    const key = bodyRows.map(row => row.querySelector(".who b")?.textContent?.trim() || "").join("|") + ":" + [...counts].map(x => x.join("=")).join(",");
    if (key === lastKey && table.querySelector("[data-bibs-count-column]")) return;
    lastKey = key;

    const existingHeader = table.querySelector('th[data-bibs-count-column]');
    if (!existingHeader) {
      const headerRow = table.querySelector("thead tr");
      if (headerRow) {
        const th = document.createElement("th");
        th.dataset.bibsCountColumn = "true";
        th.textContent = "Bibs taken";
        headerRow.insertBefore(th, headerRow.lastElementChild);
      }
    }

    table.querySelectorAll("tbody tr").forEach(row => {
      if (row.querySelector("td[data-bibs-count-cell]")) return;

      const name = row.querySelector(".who b")?.textContent?.trim();
      if (!name) return;

      const edit = row.querySelector('[data-a="edit"]');
      const playerId = edit?.dataset?.id;
      const cell = document.createElement("td");
      cell.dataset.bibsCountCell = "true";
      cell.textContent = String(playerId ? (counts.get(playerId) || 0) : 0);
      row.insertBefore(cell, row.lastElementChild);
    });
  }

  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(() => {}), 50);
  };

  new MutationObserver(schedule).observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });

  schedule();
})();
