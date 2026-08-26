(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let busy = false;

  async function render() {
    if (busy) return;
    if (!document.querySelector('.nav-item.active[data-view="players"]')) return;

    const table = document.querySelector('.page-head + .table-card table');
    if (!table || table.querySelector('th[data-bibs-count-column]')) return;

    busy = true;
    try {
      const { data, error } = await sb
        .from("game_players")
        .select("player_id")
        .eq("took_bibs", true);
      if (error) throw error;

      const counts = new Map();
      (data || []).forEach(row => {
        if (!row.player_id) return;
        counts.set(row.player_id, (counts.get(row.player_id) || 0) + 1);
      });

      const headerRow = table.querySelector("thead tr");
      if (!headerRow) return;
      const th = document.createElement("th");
      th.dataset.bibsCountColumn = "true";
      th.textContent = "Bibs taken";
      headerRow.insertBefore(th, headerRow.lastElementChild);

      table.querySelectorAll("tbody tr").forEach(row => {
        const edit = row.querySelector('[data-a="edit"]');
        const cell = document.createElement("td");
        cell.dataset.bibsCountCell = "true";
        cell.textContent = String(counts.get(edit?.dataset?.id) || 0);
        row.insertBefore(cell, row.lastElementChild);
      });
    } catch (error) {
      console.warn("[Football] Could not load bib counts", error);
    } finally {
      busy = false;
    }
  }

  const observer = new MutationObserver(() => render());
  observer.observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });

  // The app renders asynchronously on first load. Retry briefly so the
  // column appears immediately without requiring navigation/tab switching.
  const startup = setInterval(() => render(), 100);
  setTimeout(() => clearInterval(startup), 5000);

  render();
})();
