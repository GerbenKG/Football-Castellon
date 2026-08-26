(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let rendering = false;

  async function renderBibCount() {
    if (rendering) return;

    const title = document.querySelector(".page-head .title");
    const table = document.querySelector(".table-card table");
    if (!title || title.textContent.trim() !== "Players" || !table) return;
    if (table.querySelector("thead th[data-bibs-column]")) return;

    rendering = true;
    try {
      const { data, error } = await sb
        .from("game_players")
        .select("player_id,took_bibs")
        .eq("took_bibs", true);
      if (error) throw error;

      const counts = new Map();
      (data || []).forEach(row => {
        if (!row.player_id) return;
        counts.set(row.player_id, (counts.get(row.player_id) || 0) + 1);
      });

      const headerRow = table.querySelector("thead tr");
      if (!headerRow) return;

      const header = document.createElement("th");
      header.dataset.bibsColumn = "true";
      header.textContent = "Bibs taken";
      headerRow.insertBefore(header, headerRow.lastElementChild);

      table.querySelectorAll("tbody tr").forEach(row => {
        const edit = row.querySelector('[data-a="edit"]');
        const playerId = edit?.dataset.id;
        const cell = document.createElement("td");
        cell.dataset.bibsColumn = "true";
        cell.textContent = String(counts.get(playerId) || 0);
        row.insertBefore(cell, row.lastElementChild);
      });
    } catch (error) {
      console.warn("[Football] Could not load bib counts", error);
    } finally {
      rendering = false;
    }
  }

  const observer = new MutationObserver(() => renderBibCount());
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });

  renderBibCount();
})();
