(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(enhance, 40);
  };

  async function enhance() {
    await enhanceGameSquad();
    await enhancePlayersTable();
  }

  async function enhanceGameSquad() {
    const rows = [...document.querySelectorAll("#app .squad-row")];
    if (!rows.length) return;

    const ids = rows.map(row => row.querySelector('input[data-t][data-id]')?.dataset.id).filter(Boolean);
    if (!ids.length) return;

    const { data, error } = await sb
      .from("game_players")
      .select("id,player_id,took_bibs")
      .in("id", ids);
    if (error) return;

    const byId = new Map((data || []).map(x => [x.id, x]));

    rows.forEach(row => {
      if (row.querySelector(".bib-toggle")) return;
      const rowId = row.querySelector('input[data-t][data-id]')?.dataset.id;
      const record = byId.get(rowId);
      if (!record) return;

      const label = document.createElement("label");
      label.className = "toggle bib-toggle";
      label.innerHTML = '<input type="checkbox" data-bibs-id="' + rowId + '" ' +
        (record.took_bibs ? "checked" : "") + '><span>Took bibs</span>';

      const remove = row.querySelector(".remove");
      if (remove) row.insertBefore(label, remove);
      else row.appendChild(label);

      label.querySelector("input").addEventListener("change", async event => {
        event.target.disabled = true;
        const q = await sb
          .from("game_players")
          .update({ took_bibs: event.target.checked })
          .eq("id", rowId);

        if (q.error) {
          event.target.checked = !event.target.checked;
          alert(q.error.message || "Could not save bibs record.");
        }
        event.target.disabled = false;
        schedule();
      });
    });
  }

  async function enhancePlayersTable() {
    const table = [...document.querySelectorAll("#app table")].find(table => {
      const headers = [...table.querySelectorAll("thead th")].map(x => x.textContent.trim().toLowerCase());
      return headers[0] === "player" && headers[1] === "phone" && headers[2] === "email";
    });
    if (!table) return;

    if (!table.dataset.bibsEnhanced) {
      const header = document.createElement("th");
      header.textContent = "Bibs taken";
      table.querySelector("thead tr")?.appendChild(header);

      table.querySelectorAll("tbody tr").forEach(row => {
        const editButton = row.querySelector('[data-a="edit"]');
        const playerButton = row.querySelector('[data-a="history"]');
        const playerId = editButton?.dataset.id || playerButton?.dataset.id;
        const cell = document.createElement("td");
        cell.dataset.bibsPlayer = playerId || "";
        cell.textContent = "—";
        row.appendChild(cell);
      });
      table.dataset.bibsEnhanced = "true";
    }

    const playerIds = [...table.querySelectorAll("td[data-bibs-player]")]
      .map(cell => cell.dataset.bibsPlayer)
      .filter(Boolean);
    if (!playerIds.length) return;

    const { data, error } = await sb
      .from("players")
      .select("id,bibs_taken_count")
      .in("id", playerIds);
    if (error) return;

    const counts = new Map((data || []).map(x => [x.id, x.bibs_taken_count ?? 0]));
    table.querySelectorAll("td[data-bibs-player]").forEach(cell => {
      cell.textContent = String(counts.get(cell.dataset.bibsPlayer) ?? 0);
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  schedule();
})();
