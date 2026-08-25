(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let financeRefreshing = false;
  let lastDashboardSignature = "";
  let lastFinanceSignature = "";

  const money = value => new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));

  const today = () => new Date().toISOString().slice(0, 10);

  async function loadFinanceSnapshot() {
    const [seasonsResult, ticketsResult, playersResult, gamesResult, gamePlayersResult, expensesResult] = await Promise.all([
      sb.from("finance_seasons").select("id,name,starts_on,ends_on,season_ticket_amount,pay_per_game_amount").order("starts_on", { ascending: false }),
      sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid,paid_on"),
      sb.from("players").select("id,name").order("name"),
      sb.from("games").select("id,game_date,start_time,end_time"),
      sb.from("game_players").select("id,game_id,player_id,guest_name,attended,paid"),
      sb.from("finance_expenses").select("id,season_id,due_date,amount,paid")
    ]);

    const error = seasonsResult.error || ticketsResult.error || playersResult.error || gamesResult.error || gamePlayersResult.error || expensesResult.error;
    if (error) throw error;

    return {
      seasons: seasonsResult.data || [],
      tickets: ticketsResult.data || [],
      players: playersResult.data || [],
      games: gamesResult.data || [],
      gamePlayers: gamePlayersResult.data || [],
      expenses: expensesResult.data || []
    };
  }

  function currentSeason(seasons) {
    const d = today();
    return seasons.find(s => d >= s.starts_on && d <= s.ends_on) || seasons[0] || null;
  }

  async function refreshDashboardFinanceStats() {
    if (financeRefreshing || !document.querySelector('.hero')) return;
    financeRefreshing = true;

    try {
      const data = await loadFinanceSnapshot();
      const season = currentSeason(data.seasons);
      if (!season) return;

      const seasonTickets = data.tickets.filter(t => t.season_id === season.id);
      const paidSeasonTickets = seasonTickets.filter(t => t.paid).length;
      const unpaidSeasonTickets = seasonTickets.filter(t => !t.paid).length;

      const playerById = new Map(data.players.map(p => [p.id, p]));
      const gameById = new Map(data.games.map(g => [g.id, g]));
      const outstandingGamePayments = data.gamePlayers.filter(row => {
        const g = gameById.get(row.game_id);
        if (!g || g.game_date > today() || !row.attended || row.paid) return false;
        return !!row.guest_name || !seasonTickets.some(t => t.player_id === row.player_id);
      }).length;

      const paymentDue = unpaidSeasonTickets + outstandingGamePayments;
      const signature = [season.id, seasonTickets.length, paidSeasonTickets, paymentDue].join("|");
      if (signature === lastDashboardSignature) return;
      lastDashboardSignature = signature;

      const stats = document.querySelectorAll(".stats:not(.finance-stats) .stat");
      if (stats[2]?.querySelector("strong")) {
        stats[2].querySelector("strong").textContent = String(seasonTickets.length);
      }
      if (stats[3]?.querySelector("strong")) {
        stats[3].querySelector("strong").textContent = String(paymentDue);
      }

      const paymentCard = [...document.querySelectorAll(".analytics-card")].find(card =>
        card.querySelector("h3")?.textContent.trim() === "Payments"
      );
      if (paymentCard) {
        const mini = paymentCard.querySelector(".mini-stats span");
        if (mini) mini.innerHTML = `Season tickets paid <b>${paidSeasonTickets}/${seasonTickets.length}</b>`;
      }
    } catch (error) {
      console.warn("[Football] Could not refresh finance dashboard stats", error);
    } finally {
      financeRefreshing = false;
    }
  }

  function financeManageAllowed() {
    return !!document.querySelector('[data-a="edit-finance-season"], [data-a="new-finance-season"], [data-a="new-finance-expense"]');
  }

  function openSeasonTicketModal({ season, players, ticket = null }) {
    const existingPlayerId = ticket?.player_id || "";
    const alreadyTicketed = new Set(
      ticket ? [] : players.map(p => p.id)
    );

    const availablePlayers = ticket
      ? players
      : players.filter(p => !alreadyTicketed.has(p.id));

    const options = ticket
      ? players.map(p => `<option value="${esc(p.id)}" ${p.id === existingPlayerId ? "selected" : ""}>${esc(p.name)}</option>`).join("")
      : players.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");

    document.getElementById("modal-root").innerHTML = `
      <div class="modal-bg">
        <div class="modal">
          <div class="modal-head">
            <h2>${ticket ? "Edit season ticket" : "Add season ticket"}</h2>
            <button class="remove" data-close type="button">×</button>
          </div>
          <div class="notice">${esc(season.name)} · ${esc(season.starts_on)} to ${esc(season.ends_on)}</div>
          ${ticket ? `<label>Player<select id="finance-ticket-player" disabled>${options}</select></label>` : `<label>Player<select id="finance-ticket-player" required>${options || '<option value="">No players available</option>'}</select></label>`}
          <label>Amount<input id="finance-ticket-amount" type="number" min="0" step="0.01" value="${esc(ticket?.amount ?? season.season_ticket_amount ?? 0)}"></label>
          <label class="checkline"><input id="finance-ticket-paid" type="checkbox" ${ticket?.paid ? "checked" : ""}> Paid</label>
          <div class="modal-actions">
            ${ticket ? '<button type="button" class="btn btn-secondary" id="finance-ticket-delete">Remove ticket</button>' : ''}
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
            <button type="button" class="btn btn-primary" id="finance-ticket-save" ${!ticket && !availablePlayers.length ? "disabled" : ""}>${ticket ? "Save changes" : "Add ticket"}</button>
          </div>
        </div>
      </div>`;

    document.getElementById("finance-ticket-save")?.addEventListener("click", async () => {
      const playerId = document.getElementById("finance-ticket-player")?.value;
      const amount = Number(document.getElementById("finance-ticket-amount")?.value || 0);
      const paid = !!document.getElementById("finance-ticket-paid")?.checked;
      if (!playerId || amount < 0) return alert("Player and amount are required.");

      const payload = {
        season_id: season.id,
        player_id: playerId,
        amount,
        paid,
        paid_on: paid ? (ticket?.paid_on || today()) : null
      };

      const result = ticket
        ? await sb.from("finance_season_tickets").update({ amount, paid, paid_on: payload.paid_on }).eq("id", ticket.id)
        : await sb.from("finance_season_tickets").insert(payload);

      if (result.error) {
        alert("Could not save season ticket: " + result.error.message);
        return;
      }

      document.getElementById("modal-root").innerHTML = "";
      lastDashboardSignature = "";
      lastFinanceSignature = "";
      await patchFinancePage(true);
      await refreshDashboardFinanceStats();
    });

    document.getElementById("finance-ticket-delete")?.addEventListener("click", async () => {
      if (!ticket || !confirm("Remove this season ticket record?")) return;
      const result = await sb.from("finance_season_tickets").delete().eq("id", ticket.id);
      if (result.error) {
        alert("Could not remove season ticket: " + result.error.message);
        return;
      }
      document.getElementById("modal-root").innerHTML = "";
      lastDashboardSignature = "";
      lastFinanceSignature = "";
      await patchFinancePage(true);
      await refreshDashboardFinanceStats();
    });
  }

  async function patchFinancePage(force = false) {
    const title = document.querySelector(".page-head .title");
    if (!title || title.textContent.trim() !== "Finances") return;

    const select = document.getElementById("finance-season-select");
    const selectedSeasonId = select?.value;
    if (!selectedSeasonId) return;

    try {
      const data = await loadFinanceSnapshot();
      const season = data.seasons.find(s => s.id === selectedSeasonId) || currentSeason(data.seasons);
      if (!season) return;

      const tickets = data.tickets.filter(t => t.season_id === season.id);
      const playersById = new Map(data.players.map(p => [p.id, p]));
      const expenses = data.expenses.filter(x => x.season_id === season.id);
      const seasonGames = data.games.filter(g => g.game_date >= season.starts_on && g.game_date <= season.ends_on);
      const seasonGameIds = new Set(seasonGames.map(g => g.id));
      const gameRows = data.gamePlayers.filter(x => seasonGameIds.has(x.game_id));
      const paidGameIncome = gameRows.filter(x => x.paid && (x.guest_name || !tickets.some(t => t.player_id === x.player_id))).length * Number(season.pay_per_game_amount || 0);
      const paidTicketIncome = tickets.filter(t => t.paid).reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const outstandingTicketIncome = tickets.filter(t => !t.paid).reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const paidExpenses = expenses.filter(x => x.paid).reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const futureExpenses = expenses.filter(x => !x.paid && x.due_date >= today()).reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const balance = paidTicketIncome + paidGameIncome - paidExpenses;

      const pastGames = seasonGames.filter(g => g.game_date <= today()).length;
      const futureGames = seasonGames.filter(g => g.game_date >= today()).length;
      const attendanceByPlayer = new Map();
      gameRows.forEach(row => {
        if (!row.player_id || !row.attended) return;
        attendanceByPlayer.set(row.player_id, (attendanceByPlayer.get(row.player_id) || 0) + 1);
      });
      let projectedGameIncome = 0;
      data.players.filter(p => !tickets.some(t => t.player_id === p.id)).forEach(p => {
        const appearances = attendanceByPlayer.get(p.id) || 0;
        const rate = pastGames ? appearances / pastGames : 0;
        projectedGameIncome += rate * futureGames * Number(season.pay_per_game_amount || 0);
      });

      const projectedEnd = balance + outstandingTicketIncome + projectedGameIncome - futureExpenses;
      const signature = [season.id, tickets.length, tickets.filter(t => t.paid).length, paidTicketIncome, balance, futureExpenses, projectedEnd].join("|");
      if (!force && signature === lastFinanceSignature) return;
      lastFinanceSignature = signature;

      const cards = document.querySelectorAll(".analytics-grid .analytics-card");
      const ticketCard = [...cards].find(card => card.querySelector("h3")?.textContent.trim() === "Season ticket holders");
      if (ticketCard) {
        const titleRow = ticketCard.querySelector(".card-title");
        if (titleRow && financeManageAllowed() && !titleRow.querySelector("#finance-add-ticket")) {
          const button = document.createElement("button");
          button.id = "finance-add-ticket";
          button.className = "btn btn-primary";
          button.textContent = "+ Season ticket";
          button.onclick = () => openSeasonTicketModal({ season, players: data.players });
          titleRow.appendChild(button);
        }

        const body = ticketCard.querySelector("tbody");
        if (body) {
          if (!tickets.length) {
            body.innerHTML = `<tr><td colspan="5" class="empty">No season tickets recorded for ${esc(season.name)}.</td></tr>`;
          } else {
            body.innerHTML = tickets
              .slice()
              .sort((a, b) => (playersById.get(a.player_id)?.name || "").localeCompare(playersById.get(b.player_id)?.name || ""))
              .map(t => {
                const p = playersById.get(t.player_id);
                const actions = financeManageAllowed()
                  ? `<button class="btn btn-secondary" data-fin-season-ticket-edit="${esc(t.id)}">Edit</button>`
                  : "";
                return `<tr>
                  <td><div class="who"><span class="avatar">${esc((p?.name || "?").slice(0, 1).toUpperCase())}</span><b>${esc(p?.name || "Unknown player")}</b></div></td>
                  <td>${money(t.amount)}</td>
                  <td>${t.paid ? '<span class="badge badge-green">Paid</span>' : '<span class="badge badge-red">Needs payment</span>'}</td>
                  <td>${t.paid_on ? esc(new Date(t.paid_on + "T12:00:00").toLocaleDateString("en-GB")) : "—"}</td>
                  <td>${actions}</td>
                </tr>`;
              }).join("");

            const header = ticketCard.querySelector("thead tr");
            if (header && header.children.length === 4) {
              header.insertAdjacentHTML("beforeend", "<th>Paid on</th><th></th>");
            }
          }

          ticketCard.querySelectorAll("[data-fin-season-ticket-edit]").forEach(button => {
            button.onclick = () => {
              const ticket = tickets.find(t => t.id === button.dataset.finSeasonTicketEdit);
              if (ticket) openSeasonTicketModal({ season, players: data.players, ticket });
            };
          });
        }
      }

      const dueCard = [...cards].find(card => card.querySelector("h3")?.textContent.trim() === "Who still needs to pay?");
      if (dueCard) {
        const body = dueCard.querySelector("tbody");
        if (body) {
          const unpaidTickets = tickets.filter(t => !t.paid);
          const unpaidGames = gameRows.filter(x => {
            const g = seasonGames.find(game => game.id === x.game_id);
            if (!g || g.game_date > today() || !x.attended || x.paid) return false;
            return !!x.guest_name || !tickets.some(t => t.player_id === x.player_id);
          });

          const rows = [
            ...unpaidTickets.map(t => `<tr><td>${esc(playersById.get(t.player_id)?.name || "Unknown player")}</td><td>Season ticket ${esc(season.name)}</td><td>${money(t.amount)}</td><td><span class="badge badge-red">Due</span></td></tr>`),
            ...unpaidGames.map(x => {
              const g = seasonGames.find(game => game.id === x.game_id);
              const name = x.guest_name || playersById.get(x.player_id)?.name || "Player";
              return `<tr><td>${esc(name)}</td><td>${esc(g?.game_date || "Game")}</td><td>${money(season.pay_per_game_amount)}</td><td><span class="badge badge-red">Due</span></td></tr>`;
            })
          ];
          body.innerHTML = rows.join("") || '<tr><td colspan="4" class="empty">Nothing outstanding.</td></tr>';
        }
      }

      const financeStats = document.querySelectorAll(".finance-stats .stat");
      if (financeStats[0]?.querySelector("strong")) financeStats[0].querySelector("strong").textContent = money(balance);
      if (financeStats[1]?.querySelector("strong")) financeStats[1].querySelector("strong").textContent = money(outstandingTicketIncome + projectedGameIncome);
      if (financeStats[2]?.querySelector("strong")) financeStats[2].querySelector("strong").textContent = money(futureExpenses);
      if (financeStats[3]?.querySelector("strong")) financeStats[3].querySelector("strong").textContent = money(projectedEnd);

      const outlook = document.querySelector(".finance-outlook");
      if (outlook) {
        const values = outlook.querySelectorAll("div");
        if (values[0]?.querySelector("b")) values[0].querySelector("b").textContent = money(paidTicketIncome + paidGameIncome);
        if (values[1]?.querySelector("b")) values[1].querySelector("b").textContent = money(paidExpenses);
        if (values[2]?.querySelector("b")) values[2].querySelector("b").textContent = money(projectedGameIncome);
        if (values[3]?.querySelector("b")) values[3].querySelector("b").textContent = money(projectedEnd);
      }
    } catch (error) {
      console.warn("[Football] Could not patch season-specific finance data", error);
    }
  }

  const observer = new MutationObserver(() => {
    refreshDashboardFinanceStats();
    patchFinancePage();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  removeLegacySeasonPaidField();
  removeLegacySeasonPaidColumn();
  refreshDashboardFinanceStats();
  patchFinancePage(true);
})();
