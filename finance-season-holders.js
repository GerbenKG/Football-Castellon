(() => {
  "use strict";

  const api = window.api;
  if (!api) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[c]));

  const money = value => new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));

  const today = () => new Date().toISOString().slice(0, 10);

  async function getRows(table, filters = []) {
    const params = new URLSearchParams({ table, filters: JSON.stringify(filters) });
    const response = await api.get(`/api/data.php?${params.toString()}`);
    return response.data || [];
  }

  function financeSection() {
    return [...document.querySelectorAll("#app .card")].find(card =>
      card.querySelector("h2, h3")?.textContent.trim() === "Season ticket holders"
    );
  }

  function seasonSelect() {
    return document.getElementById("finance-season-select");
  }

  function renderRows(section, tickets, players, seasonId) {
    if (!section) return;

    const canManage = !!section.querySelector("[data-fin-ticket]");
    const playerById = new Map(players.map(player => [player.id, player]));
    const rows = tickets
      .map(ticket => ({ ticket, player: playerById.get(ticket.player_id) }))
      .sort((a, b) => String(a.player?.name || "").localeCompare(String(b.player?.name || "")));

    const key = JSON.stringify({
      seasonId,
      rows: rows.map(({ ticket, player }) => [
        ticket.id,
        ticket.player_id,
        player?.name || null,
        ticket.amount,
        !!ticket.paid,
        ticket.paid_on || null
      ])
    });

    const host = section.querySelector("[data-season-holder-table]");
    if (host?.dataset.seasonHolderKey === key) return;

    const target = host || section.querySelector(".table-card");
    const replacement = document.createElement("div");
    replacement.className = "table-card finance-table";
    replacement.dataset.seasonHolderTable = "true";
    replacement.dataset.seasonHolderKey = key;

    const total = rows.reduce((sum, { ticket }) => sum + Number(ticket.amount || 0), 0);

    replacement.innerHTML = rows.length
      ? `<table><thead><tr><th>Player</th><th>Type</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(({ ticket, player }) => {
          const name = player?.name || "Unknown player";
          const paid = !!ticket.paid;
          return `<tr><td><div class="who"><span class="avatar">${esc(name).slice(0, 1).toUpperCase()}</span><b>${esc(name)}</b></div></td><td>Season ticket</td><td>${money(ticket.amount)}</td><td>${paid ? '<span class="badge badge-green">Paid</span>' : '<span class="badge badge-red">Needs payment</span>'}</td><td>${canManage ? `<button class="btn btn-secondary" data-fin-ticket="${esc(ticket.player_id)}" data-paid="${paid ? "true" : "false"}">${paid ? "Mark unpaid" : "Mark paid"}</button>` : ""}</td></tr>`;
        }).join("")}</tbody><tfoot><tr><th colspan="2">Total</th><th>${money(total)}</th><th colspan="2"></th></tr></tfoot></table>`
      : `<div class="empty"><p>No season-ticket holders for this season.</p></div>`;

    if (target) target.replaceWith(replacement);
    else section.appendChild(replacement);
  }

  function installButton() {
    const section = financeSection();
    if (!section || section.querySelector("[data-season-holder-add]")) return;

    const heading = section.querySelector("h2, h3");
    const head = heading?.closest(".section-head") || heading?.parentElement;
    if (!head) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary";
    button.dataset.seasonHolderAdd = "true";
    button.textContent = "+ Add holder";
    button.style.marginLeft = "auto";
    button.addEventListener("click", openModal);
    head.appendChild(button);
  }

  async function refresh() {
    const section = financeSection();
    const select = seasonSelect();
    if (!section || !select?.value) return;

    const seasonId = select.value;
    const [players, tickets] = await Promise.all([
      getRows("players", []),
      getRows("finance_season_tickets", [{ column: "season_id", value: seasonId, operator: "eq" }])
    ]);

    renderRows(section, tickets, players, seasonId);
    installButton();
  }

  async function openModal() {
    const root = document.getElementById("modal-root");
    const seasonId = seasonSelect()?.value;
    if (!root || !seasonId) return;

    root.innerHTML = `
      <div class="modal-bg">
        <div class="modal">
          <div class="modal-head">
            <h2>Add season-ticket holder</h2>
            <button class="remove" type="button" data-holder-close>×</button>
          </div>
          <form id="season-holder-form">
            <label>Player<select name="player_id" required><option value="">Loading players…</option></select></label>
            <label>Season ticket amount<input name="amount" type="number" min="0" step="0.01" required></label>
            <label style="display:flex;gap:10px;align-items:center"><input name="paid" type="checkbox" style="width:auto"> Paid now</label>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-holder-close>Cancel</button>
              <button type="submit" class="btn btn-primary">Add holder</button>
            </div>
            <p class="muted" id="season-holder-error" style="margin-top:12px"></p>
          </form>
        </div>
      </div>`;

    root.querySelectorAll("[data-holder-close]").forEach(button => {
      button.addEventListener("click", () => { root.innerHTML = ""; });
    });

    const form = root.querySelector("#season-holder-form");
    const select = form.querySelector("select[name=player_id]");
    const amount = form.querySelector("input[name=amount]");
    const error = root.querySelector("#season-holder-error");

    try {
      const [players, seasons, tickets] = await Promise.all([
        getRows("players", []),
        getRows("finance_seasons", [{ column: "id", value: seasonId, operator: "eq" }]),
        getRows("finance_season_tickets", [{ column: "season_id", value: seasonId, operator: "eq" }])
      ]);

      const season = seasons[0];
      const existing = new Set(tickets.map(t => t.player_id));
      amount.value = Number(season?.season_ticket_amount || 0).toFixed(2);

      const available = players
        .filter(p => !existing.has(p.id))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      select.innerHTML = available.length
        ? '<option value="">Select player…</option>' + available.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")
        : '<option value="">All players are already assigned</option>';
      if (!available.length) form.querySelector("button[type=submit]").disabled = true;
    } catch (e) {
      error.textContent = e?.message || "Could not load players.";
      form.querySelector("button[type=submit]").disabled = true;
      return;
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const playerId = select.value;
      const value = Number(amount.value);
      const paid = form.querySelector("input[name=paid]").checked;
      if (!playerId || !Number.isFinite(value) || value < 0) {
        error.textContent = "Select a player and enter a valid amount.";
        return;
      }

      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      submit.textContent = "Saving…";
      try {
        await api.post("/api/data.php?table=finance_season_tickets", {
          action: "insert",
          data: {
            season_id: seasonId,
            player_id: playerId,
            amount: value,
            paid,
            paid_on: paid ? today() : null
          }
        });
        root.innerHTML = "";
        await refresh();
      } catch (e) {
        submit.disabled = false;
        submit.textContent = "Add holder";
        error.textContent = e?.message || "Could not add season-ticket holder.";
      }
    });
  }

  let queued = false;
  const scheduleRefresh = () => {
    if (queued) return;
    queued = true;
    setTimeout(async () => {
      queued = false;
      try {
        installButton();
        await refresh();
      } catch (_) {}
    }, 100);
  };

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleRefresh();
})();
