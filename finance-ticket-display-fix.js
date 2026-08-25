(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  let timer = null;
  let busy = false;

  function getSeasonSelect() {
    return document.getElementById("finance-season-select") || [...document.querySelectorAll("select")].find(s => [...s.options].some(o => /^202\d\/\d{2}$/.test(o.textContent.trim())));
  }

  function getCard() {
    const h = [...document.querySelectorAll("h2")].find(x => x.textContent.trim() === "Season ticket holders");
    return h?.closest(".card") || null;
  }

  function canManage() {
    return !!document.querySelector('[data-a="edit-finance-season"], [data-a="edit-finance-pricing"], [data-a="new-finance-season"], [data-a="new-finance-expense"]');
  }

  async function render() {
    if (busy) return;
    const card = getCard();
    const select = getSeasonSelect();
    if (!card || !select?.value) return;
    busy = true;
    try {
      const seasonId = select.value;
      const [seasonResult, ticketsResult, playersResult] = await Promise.all([
        sb.from("finance_seasons").select("id,name,season_ticket_amount").eq("id", seasonId).single(),
        sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid,paid_on").eq("season_id", seasonId),
        sb.from("players").select("id,name").order("name")
      ]);
      if (seasonResult.error || ticketsResult.error || playersResult.error) {
        console.error("Season ticket holders", seasonResult.error || ticketsResult.error || playersResult.error);
        return;
      }

      const season = seasonResult.data;
      const tickets = ticketsResult.data || [];
      const players = new Map((playersResult.data || []).map(p => [p.id, p]));
      const manage = canManage();

      const rows = tickets.map(t => {
        const p = players.get(t.player_id);
        const name = p?.name || "Unknown player";
        return `<div class="finance-ticket-display-row"><div><b>${esc(name)}</b></div><div>€${Number(t.amount || 0).toFixed(2)}</div><div>${t.paid ? '<span class="badge badge-green">Paid</span>' : '<span class="badge badge-amber">Unpaid</span>'}</div>${manage ? `<div><button type="button" class="btn btn-secondary finance-ticket-toggle" data-ticket-id="${esc(t.id)}" data-paid="${t.paid ? "true" : "false"}">${t.paid ? "Mark unpaid" : "Mark paid"}</button></div>` : ""}</div>`;
      }).join("");

      card.innerHTML = `<div class="card-title finance-ticket-title"><div><h2>Season ticket holders</h2><p>Who purchased a ticket and for which season.</p></div>${manage ? '<button type="button" class="btn btn-primary" id="finance-add-ticket">+ Add season ticket</button>' : ""}</div><div class="finance-ticket-display"><div class="finance-ticket-display-head"><span>PLAYER</span><span>AMOUNT</span><span>STATUS</span>${manage ? "<span></span>" : ""}</div>${tickets.length ? rows : '<div class="finance-ticket-empty">No season-ticket players.</div>'}</div>`;

      const add = document.getElementById("finance-add-ticket");
      if (add) add.onclick = () => openAddTicket(seasonId);
      card.querySelectorAll(".finance-ticket-toggle").forEach(button => {
        button.onclick = async () => {
          const paid = button.dataset.paid === "true";
          const result = await sb.from("finance_season_tickets").update({ paid: !paid, paid_on: !paid ? new Date().toISOString().slice(0,10) : null }).eq("id", button.dataset.ticketId);
          if (result.error) return alert("Could not update season ticket: " + result.error.message);
          render();
        };
      });
    } finally {
      busy = false;
    }
  }

  async function openAddTicket(seasonId) {
    const [seasonResult, ticketsResult, playersResult] = await Promise.all([
      sb.from("finance_seasons").select("id,name,season_ticket_amount").eq("id", seasonId).single(),
      sb.from("finance_season_tickets").select("player_id").eq("season_id", seasonId),
      sb.from("players").select("id,name").order("name")
    ]);
    if (seasonResult.error || ticketsResult.error || playersResult.error) return alert("Could not load season ticket data.");
    const assigned = new Set((ticketsResult.data || []).map(x => x.player_id));
    const available = (playersResult.data || []).filter(p => !assigned.has(p.id));
    if (!available.length) return alert("Every player already has a season ticket for this season.");
    const season = seasonResult.data;
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-bg"><div class="modal"><div class="modal-head"><h2>Add season ticket</h2><button class="remove" id="close-season-ticket" type="button">×</button></div><div class="notice">${esc(season.name)}</div><form id="add-season-ticket-form"><label>Player<select name="player_id" required>${available.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label><label>Amount<input name="amount" type="number" min="0" step="0.01" value="${Number(season.season_ticket_amount || 0).toFixed(2)}" required></label><label class="checkline"><input name="paid" type="checkbox"> Paid</label><div class="modal-actions"><button class="btn btn-secondary" type="button" id="cancel-season-ticket">Cancel</button><button class="btn btn-primary" type="submit">Add ticket</button></div></form></div></div>`;
    const close = () => root.innerHTML = "";
    document.getElementById("close-season-ticket").onclick = close;
    document.getElementById("cancel-season-ticket").onclick = close;
    document.getElementById("add-season-ticket-form").onsubmit = async e => {
      e.preventDefault();
      const form = new FormData(e.target);
      const paid = form.get("paid") === "on";
      const result = await sb.from("finance_season_tickets").insert({ season_id: seasonId, player_id: form.get("player_id"), amount: Number(form.get("amount") || 0), paid, paid_on: paid ? new Date().toISOString().slice(0,10) : null });
      if (result.error) return alert("Could not add season ticket: " + result.error.message);
      close();
      render();
    };
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(console.error), 120);
  }

  document.addEventListener("change", e => { if (e.target === getSeasonSelect()) schedule(); });
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
