(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  // game_players.attended was removed from the schema. Strip the legacy
  // property from writes so older app code remains compatible while the
  // dashboard is migrated away from attendance tracking.
  const originalFrom = sb.from.bind(sb);
  sb.from = table => {
    const query = originalFrom(table);
    if (table !== "game_players") return query;

    const strip = value => {
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(row => strip(row));
      const next = { ...value };
      delete next.attended;
      return next;
    };

    const originalInsert = query.insert.bind(query);
    const originalUpsert = query.upsert.bind(query);
    const originalUpdate = query.update.bind(query);
    query.insert = values => originalInsert(strip(values));
    query.upsert = values => originalUpsert(strip(values));
    query.update = values => originalUpdate(strip(values));
    return query;
  };

  function removePresentControls() {
    const dashboard = document.querySelector('.nav-item.active[data-view="dashboard"]');
    if (!dashboard) return;

    document.querySelectorAll('#app input[data-dv-toggle="attended"]').forEach(input => {
      input.closest("label")?.remove();
    });

    // The old Present KPI is also derived from the removed column.
    document.querySelectorAll("#app .stat").forEach(stat => {
      const label = stat.querySelector("small")?.textContent?.trim().toUpperCase();
      if (label === "PRESENT") stat.remove();
    });
  }

  const observer = new MutationObserver(removePresentControls);
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  removePresentControls();
})();
