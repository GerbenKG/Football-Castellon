(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let busy = false;
  const money = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const dateText = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" });

  async function refresh() {
    if (busy) return;
    const isDashboard = !!document.querySelector(".hero");
    const isFinance = document.querySelector(".page-head .title")?.textContent.trim() === "Finances";
    if (!isDashboard && !isFinance) return;

    busy = true;
    try {
      const [s, t, p, g, gp, e] = await Promise.all([
        sb.from("finance_seasons").select("id,name,starts_on,ends_on,season_ticket_amount,pay_per_game_amount").order("starts_on", { ascending:false }),
        sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid"),
        sb.from("players").select("id,name"),
        sb.from("games").select("id,game_date"),
        sb.from("game_players").select("game_id,player_id,guest_name,attended,paid"),
        sb.from("finance_expenses").select("season_id,amount,paid,due_date")
      ]);
      const error = s.error || t.error || p.error || g.error || gp.error || e.error;
      if (error) throw error;

      const seasons = s.data || [];
      const tickets = t.data || [];
      const players = p.data || [];
      const games = g.data || [];
      const gamePlayers = gp.data || [];
      const expenses = e.data || [];
      const playerById = new Map(players.map(x => [x.id, x]));
      const gameById = new Map(games.map(x => [x.id, x]));

      let dashboardSeason = null;
      let dashboardGame = null;
      if (isDashboard) {
        const hero = document.querySelector(".hero .game-nav");
        const heroDate = hero?.querySelector("h1")?.textContent?.trim() || "";
        dashboardGame = games.find(x => dateText(x.game_date) === heroDate) || null;
        if (dashboardGame) dashboardSeason = seasons.find(x => dashboardGame.game_date >= x.starts_on && dashboardGame.game_date <= x.ends_on) || null;
      }

      const current = dashboardSeason || seasons.find(x => today() >= x.starts_on && today() <= x.ends_on) || seasons[0];
      if (!current) return;

      const currentTickets = tickets.filter(x => x.season_id === current.id);
      const ticketIds = new Set(currentTickets.map(x => x.player_id));
      const currentGameIds = new Set(games.filter(x => x.game_date >= current.starts_on && x.game_date <= current.ends_on).map(x => x.id));
      const currentGameRows = gamePlayers.filter(x => currentGameIds.has(x.game_id));

      const gameIncomeRows = currentGameRows.filter(x => x.paid && (x.guest_name || !ticketIds.has(x.player_id)));
      const unpaidGameRows = currentGameRows.filter(x => {
        const game = gameById.get(x.game_id);
        if (!game || game.game_date > today() || !x.attended || x.paid) return false;
        return !!x.guest_name || !ticketIds.has(x.player_id);
      });

      if (isDashboard) {
        const selectedGameRows = dashboardGame ? gamePlayers.filter(x => x.game_id === dashboardGame.id) : [];
        const selectedGamePaymentsDue = selectedGameRows.filter(x => {
          if (x.player_id && ticketIds.has(x.player_id)) return !currentTickets.find(t => t.player_id === x.player_id)?.paid;
          return !x.paid;
        }).length;
        const stats = document.querySelectorAll(".stats:not(.finance-stats) .stat");
        if (stats[2]?.querySelector("strong")) stats[2].querySelector("strong").textContent = String(currentTickets.length);
        if (stats[3]?.querySelector("strong")) stats[3].querySelector("strong").textContent = String(selectedGamePaymentsDue);
        const card = [...document.querySelectorAll(".analytics-card")].find(x => x.querySelector("h3")?.textContent.trim() === "Payments");
        const mini = card?.querySelector(".mini-stats span");
        if (mini) mini.innerHTML = `Season tickets paid <b>${currentTickets.filter(x => x.paid).length}/${currentTickets.length}</b>`;
      }

      if (isFinance) {
        const selectedId = document.getElementById("finance-season-select")?.value;
        const season = seasons.find(x => x.id === selectedId) || current;
        const seasonTickets = tickets.filter(x => x.season_id === season.id);
        const seasonTicketIds = new Set(seasonTickets.map(x => x.player_id));
        const seasonGameIds = new Set(games.filter(x => x.game_date >= season.starts_on && x.game_date <= season.ends_on).map(x => x.id));
        const seasonRows = gamePlayers.filter(x => seasonGameIds.has(x.game_id));
        const paidGameRows = seasonRows.filter(x => x.paid && (x.guest_name || !seasonTicketIds.has(x.player_id)));
        const unpaidRows = seasonRows.filter(x => {
          const game = gameById.get(x.game_id);
          if (!game || game.game_date > today() || !x.attended || x.paid) return false;
          return !!x.guest_name || !seasonTicketIds.has(x.player_id);
        });
        const seasonExpenses = expenses.filter(x => x.season_id === season.id);
        const paidTicketIncome = seasonTickets.filter(x => x.paid).reduce((a,x) => a + Number(x.amount || 0), 0);
        const paidGameIncome = paidGameRows.length * Number(season.pay_per_game_amount || 0);
        const outstandingTickets = seasonTickets.filter(x => !x.paid).reduce((a,x) => a + Number(x.amount || 0), 0);
        const paidExpenses = seasonExpenses.filter(x => x.paid).reduce((a,x) => a + Number(x.amount || 0), 0);
        const futureExpenses = seasonExpenses.filter(x => !x.paid && x.due_date >= today()).reduce((a,x) => a + Number(x.amount || 0), 0);
        const balance = paidTicketIncome + paidGameIncome - paidExpenses;
        const futureGames = games.filter(x => x.game_date >= today() && x.game_date <= season.ends_on).length;
        const pastGames = games.filter(x => x.game_date >= season.starts_on && x.game_date < today()).length;
        const appearances = new Map();
        seasonRows.forEach(x => { if (x.player_id && x.attended) appearances.set(x.player_id, (appearances.get(x.player_id) || 0) + 1); });
        let projectedGameIncome = 0;
        players.filter(x => !seasonTicketIds.has(x.id)).forEach(x => {
          const rate = pastGames ? (appearances.get(x.id) || 0) / pastGames : 0;
          projectedGameIncome += rate * futureGames * Number(season.pay_per_game_amount || 0);
        });
        const projectedEnd = balance + outstandingTickets + projectedGameIncome - futureExpenses;

        const stats = document.querySelectorAll(".finance-stats .stat");
        if (stats[0]?.querySelector("strong")) stats[0].querySelector("strong").textContent = money(balance);
        if (stats[1]?.querySelector("strong")) stats[1].querySelector("strong").textContent = money(outstandingTickets + projectedGameIncome);
        if (stats[2]?.querySelector("strong")) stats[2].querySelector("strong").textContent = money(futureExpenses);
        if (stats[3]?.querySelector("strong")) stats[3].querySelector("strong").textContent = money(projectedEnd);

        const dueCard = [...document.querySelectorAll(".analytics-card")].find(x => x.querySelector("h3")?.textContent.trim() === "Who still needs to pay?");
        const body = dueCard?.querySelector("tbody");
        if (body) {
          const rows = [
            ...seasonTickets.filter(x => !x.paid).map(x => `<tr><td>${esc(playerById.get(x.player_id)?.name || "Unknown player")}</td><td>Season ticket ${esc(season.name)}</td><td>${money(x.amount)}</td><td><span class="badge badge-red">Due</span></td></tr>`),
            ...unpaidRows.map(x => {
              const game = gameById.get(x.game_id);
              const name = x.guest_name || playerById.get(x.player_id)?.name || "Player";
              return `<tr><td>${esc(name)}</td><td>${esc(game?.game_date || "Game")}</td><td>${money(season.pay_per_game_amount)}</td><td><span class="badge badge-red">Due</span></td></tr>`;
            })
          ];
          body.innerHTML = rows.join("") || '<tr><td colspan="4" class="empty">Nothing outstanding.</td></tr>';
        }
      }
    } catch (error) {
      console.warn("[Football] Season-specific finance rule refresh failed", error);
    } finally {
      busy = false;
    }
  }

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer._timer);
    observer._timer = window.setTimeout(refresh, 50);
  });
  observer.observe(document.body, { childList:true, subtree:true });
  refresh();
})();
