(() => {
  "use strict";

  const api = window.api;
  if (!api) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[c]));

  const today = () => new Date().toISOString().slice(0, 10);

  function financeSection() {
    return [...document.querySelectorAll("#app .card")].find(card =>
      card.querySelector("h2, h3")?.textContent.trim() === "Season ticket holders"
    );
  }

  function seasonSelect() {
    return document.getElementById("finance-season-select");
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

  async function getRows(table, filters = []) {
    const params = new URLSearchParams({ table, filters: JSON.stringify(filters) });
    const response = await api.get(`/api/data.php?${params.toString()}`);
    return response.data || [];
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
        window.location.reload();
      } catch (e) {
        submit.disabled = false;
        submit.textContent = "Add holder";
        error.textContent = e?.message || "Could not add season-ticket holder.";
      }
    });
  }

  const observer = new MutationObserver(() => installButton());
  observer.observe(document.body, { childList: true, subtree: true });
  installButton();
})();