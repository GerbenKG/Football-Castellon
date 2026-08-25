(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));
  let timer = null;
  let lastKey = "";

  function canManage() {
    return !!document.querySelector('[data-a="edit-finance-season"], [data-a="new-finance-season"], [data-a="new-finance-expense"]');
  }

  async function getData(seasonId) {
    const [seasonResult, ticketsResult, playersResult] = await Promise.all([
      sb.from("finance_seasons").select("id,name,starts_on,ends_on,season_ticket_amount").eq("id", seasonId).single(),
      sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid,paid_on").eq("season_id", seasonId),
      sb.from("players").select("id,name").order("name")
    ]);
    const error = seasonResult.error || ticketsResult.error || playersResult.error;
    if (error) throw error;
    return { season: seasonResult.data, tickets: ticketsResult.data || [], players: playersResult.data || [] };
  }

  function openModal(html) {
    const root = document.getElementById("modal-root");
    if (!root) return;
    root.innerHTML = '<div class="modal-bg"><div class="modal">' + html + '</div></div>';
  }

  async function addTicket(seasonId) {
    if (!canManage()) return;
    try {
      const { season, tickets, players } = await getData(seasonId);
      const assigned = new Set(tickets.map(t => t.player_id));
      const available = players.filter(p => !assigned.has(p.id));
      if (!available.length) {
        alert("Every player already has a season ticket for this season.");
        return;
      }
      openModal(
        '<div class="modal-head"><h2>Add season ticket</h2><button class="remove" data-close type="button">×</button></div>' +
        '<div class="notice">' + esc(season.name) + '</div>' +
        '<form id="finance-add-ticket-form">' +
        '<label>Player<select name="player_id" required>' + available.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join("") + '</select></label>' +
        '<label>Amount<input name="amount" type="number" min="0" step="0.01" value="' + esc(season.season_ticket_amount || 0) + '" required></label>' +
        '<label class="checkline"><input name="paid" type="checkbox"> Paid</label>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Add ticket</button></div>' +
        '</form>'
      );
      document.getElementById("finance-add-ticket-form").onsubmit = async event => {
        event.preventDefault();
        const form = new FormData(event.target);
        const paid = form.get("paid") === "on";
        const result = await sb.from("finance_season_tickets").insert({
          season_id: season.id,
          player_id: form.get("player_id"),
          amount: Number(form.get("amount") || 0),
          paid,
          paid_on: paid ? new Date().toISOString().slice(0, 10) : null
        });
        if (result.error) {
          alert("Could not add season ticket: " + result.error.message);
          return;
        }
        document.getElementById("modal-root").innerHTML = "";
        lastKey = "";
        schedule();
      };
    } catch (error) {
      alert("Could not load season ticket data: " + error.message);
    }
  }

  async function render() {
    const target = [...document.querySelectorAll("h2")].find(h => h.textContent.trim() === "Season ticket holders");
    if (!target) return;
    const card = target.closest(".card");
    if (!card) return;

    const [seasonsResult, ticketsResult, playersResult] = await Promise.all([
      sb.from("finance_seasons").select("id,name,starts_on,ends_on,season_ticket_amount").order("starts_on", { ascending: false }),
      sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid,paid_on"),
      sb.from("players").select("id,name").order("name")
    ]);
    if (seasonsResult.error || ticketsResult.error || playersResult.error) return;

    const seasons = seasonsResult.data || [];
    const seasonIds = new Set(seasons.map(s => s.id));
    const select = document.getElementById("finance-season-select") || [...document.querySelectorAll("select")].find(s => [...s.options].some(o => seasonIds.has(o.value)));
    const seasonId = select?.value || seasons[0]?.id;
    if (!seasonId) return;

    const tickets = (ticketsResult.data || []).filter(t => t.season_id === seasonId);
    const players = new Map((playersResult.data || []).map(p => [p.id, p]));
    const key = seasonId + ":" + tickets.map(t => `${t.id}:${t.player_id}:${t.amount}:${t.paid ? 1 : 0}`).join("|");
    const table = card.querySelector(".finance-table");
    if (!table) return;
    if (key === lastKey && table.dataset.ticketRendered === "1") return;
    lastKey = key;

    const rows = tickets.map(ticket => {
      const p = players.get(ticket.player_id);
      return '<tr><td><div class="who"><span class="avatar">' + esc(p?.name || "Unknown player").slice(0, 1).toUpperCase() + '</span><b>' + esc(p?.name || "Unknown player") + '</b></div></td><td>€' + Number(ticket.amount || 0).toFixed(2) + '</td><td>' + (ticket.paid ? '<span class="badge badge-green">Paid</span>' : '<span class="badge badge-amber">Unpaid</span>') + '</td><td>' + (canManage() ? '<button class="btn btn-secondary finance-ticket-toggle" data-ticket-id="' + esc(ticket.id) + '" data-paid="' + (ticket.paid ? 'true' : 'false') + '">' + (ticket.paid ? 'Mark unpaid' : 'Mark paid') + '</button>' : '') + '</td></tr>';
    }).join("");

    table.innerHTML = '<table><thead><tr><th>Player</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="4" class="empty">No season-ticket players.</td></tr>') + '</tbody></table>';
    table.dataset.ticketRendered = "1";

    let add = card.querySelector("#finance-add-ticket");
    if (canManage()) {
      if (!add) {
        add = document.createElement("button");
        add.id = "finance-add-ticket";
        add.className = "btn btn-primary";
        add.textContent = "+ Add season ticket";
        const head = card.querySelector(".card-title");
        if (head) {
          head.style.display = "flex";
          head.style.justifyContent = "space-between";
          head.style.alignItems = "center";
          head.appendChild(add);
        }
      }
      add.onclick = () => addTicket(seasonId);
    } else if (add) add.remove();

    table.querySelectorAll(".finance-ticket-toggle").forEach(button => {
      button.onclick = async () => {
        if (!canManage()) return;
        const paid = button.dataset.paid === "true";
        const result = await sb.from("finance_season_tickets").update({
          paid: !paid,
          paid_on: !paid ? new Date().toISOString().slice(0, 10) : null
        }).eq("id", button.dataset.ticketId);
        if (result.error) {
          alert("Could not update season ticket: " + result.error.message);
          return;
        }
        lastKey = "";
        schedule();
      };
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(() => {}), 120);
  }

  document.addEventListener("change", event => {
    if (event.target?.id === "finance-season-select") {
      lastKey = "";
      schedule();
    }
  });
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
