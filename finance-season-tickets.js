(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));

  async function getSeasonData(seasonId) {
    const [seasonResult, ticketResult, playerResult] = await Promise.all([
      sb.from("finance_seasons").select("id,name,starts_on,ends_on,season_ticket_amount").eq("id", seasonId).single(),
      sb.from("finance_season_tickets").select("id,player_id,amount,paid,paid_on").eq("season_id", seasonId),
      sb.from("players").select("id,name").order("name")
    ]);
    const error = seasonResult.error || ticketResult.error || playerResult.error;
    if (error) throw error;
    return { season: seasonResult.data, tickets: ticketResult.data || [], players: playerResult.data || [] };
  }

  function canManage() {
    return !!document.querySelector('[data-a="edit-finance-season"], [data-a="new-finance-season"], [data-a="new-finance-expense"]');
  }

  async function openAddTicket(seasonId) {
    if (!canManage()) return;

    try {
      const { season, tickets, players } = await getSeasonData(seasonId);
      const assigned = new Set(tickets.map(t => t.player_id));
      const available = players.filter(p => !assigned.has(p.id));
      if (!available.length) {
        alert("Every player already has a season ticket for this season.");
        return;
      }

      const options = available.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
      document.getElementById("modal-root").innerHTML = `
        <div class="modal-bg">
          <div class="modal">
            <div class="modal-head">
              <h2>Add season ticket</h2>
              <button class="remove" data-close type="button">×</button>
            </div>
            <div class="notice">${esc(season.name)} · ${esc(season.starts_on)} to ${esc(season.ends_on)}</div>
            <label>Player<select id="new-season-ticket-player">${options}</select></label>
            <label>Amount<input id="new-season-ticket-amount" type="number" min="0" step="0.01" value="${esc(season.season_ticket_amount || 0)}"></label>
            <label class="checkline"><input id="new-season-ticket-paid" type="checkbox"> Paid</label>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-close>Cancel</button>
              <button type="button" class="btn btn-primary" id="new-season-ticket-save">Add ticket</button>
            </div>
          </div>
        </div>`;

      document.getElementById("new-season-ticket-save").onclick = async () => {
        const playerId = document.getElementById("new-season-ticket-player")?.value;
        const amount = Number(document.getElementById("new-season-ticket-amount")?.value || 0);
        const paid = !!document.getElementById("new-season-ticket-paid")?.checked;
        if (!playerId || amount < 0) return alert("Player and amount are required.");

        const result = await sb.from("finance_season_tickets").insert({
          season_id: season.id,
          player_id: playerId,
          amount,
          paid,
          paid_on: paid ? new Date().toISOString().slice(0, 10) : null
        });

        if (result.error) {
          alert("Could not add season ticket: " + result.error.message);
          return;
        }
        window.location.reload();
      };
    } catch (error) {
      alert("Could not load season ticket data: " + error.message);
    }
  }

  function wireAddButton() {
    const button = document.getElementById("finance-add-ticket");
    const select = document.getElementById("finance-season-select");
    if (!button || !select || !canManage()) return;

    button.disabled = false;
    button.onclick = () => openAddTicket(select.value);
  }

  const observer = new MutationObserver(wireAddButton);
  observer.observe(document.body, { childList: true, subtree: true });
  wireAddButton();
})();
