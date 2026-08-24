(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const money = v => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(Number(v || 0));
  const esc = s => String(s ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const dateKey = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" });

  let refreshing = false;
  let lastDashboardKey = "";
  let lastFinanceKey = "";

  async function load() {
    const [gamesQ, playersQ, rowsQ, seasonsQ, ticketsQ] = await Promise.all([
      sb.from("games").select("id,game_date"),
      sb.from("players").select("id,name,model"),
      sb.from("game_players").select("id,game_id,player_id,guest_name,paid"),
      sb.from("finance_seasons").select("id,name,starts_on,ends_on,season_ticket_amount,pay_per_game_amount"),
      sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid")
    ]);
    if (gamesQ.error || playersQ.error || rowsQ.error || seasonsQ.error || ticketsQ.error) return;
    return { games: gamesQ.data || [], players: playersQ.data || [], rows: rowsQ.data || [], seasons: seasonsQ.data || [], tickets: ticketsQ.data || [] };
  }

  function selectedGame(data) {
    const heading = document.querySelector(".hero h1");
    if (!heading) return null;
    const key = heading.textContent.trim();
    return data.games.find(g => dateKey(g.game_date) === key) || null;
  }

  function seasonForGame(data, game) {
    return data.seasons.find(s => game && game.game_date >= s.starts_on && game.game_date <= s.ends_on) || null;
  }

  function applyDashboard(data) {
    const game = selectedGame(data);
    if (!game) return;
    const players = new Map(data.players.map(p => [p.id, p]));
    const rows = data.rows.filter(r => r.game_id === game.id);
    const season = seasonForGame(data, game);
    const tickets = season ? new Map(data.tickets.filter(t => t.season_id === season.id).map(t => [t.player_id, t])) : new Map();

    const seasonPlayers = data.players.filter(p => tickets.has(p.id));
    const payableRows = rows.filter(r => r.player_id || r.guest_name);
    const dueRows = payableRows.filter(r => {
      if (r.player_id) {
        const p = players.get(r.player_id);
        if (p?.model === "season") return !tickets.get(r.player_id)?.paid;
      }
      return !r.paid;
    });
    const paidRows = payableRows.length - dueRows.length;
    const collection = payableRows.length ? paidRows / payableRows.length * 100 : 0;
    const key = game.id + ":" + season?.id + ":" + seasonPlayers.length + ":" + dueRows.length + ":" + paidRows;
    if (key !== lastDashboardKey) {
      lastDashboardKey = key;
      const stats = document.querySelectorAll(".stats .stat");
      if (stats[2]) stats[2].querySelector("strong").textContent = String(seasonPlayers.length);
      if (stats[3]) stats[3].querySelector("strong").textContent = String(dueRows.length);

      const progress = document.querySelector(".analytics-card .progress-value");
      const bar = document.querySelector(".analytics-card .progress i");
      if (progress) progress.innerHTML = `<strong>${collection.toFixed(0)}%</strong><span>${paidRows} of ${payableRows.length} game payments collected</span>`;
      if (bar) bar.style.width = collection + "%";
    }

    // Signup is the payment commitment. Attendance is deliberately not used here.
    document.querySelectorAll(".squad .squad-row").forEach(row => {
      row.querySelectorAll(".toggle:not(.payment-toggle)").forEach(el => el.remove());
      row.querySelectorAll(".badge").forEach(el => {
        if (/Present|Not present/i.test(el.textContent)) el.remove();
      });
    });
  }

  function applyFinance(data) {
    const select = document.querySelector("#finance-season-select");
    const financePage = document.querySelector(".finance-stats");
    if (!select || !financePage) return;
    const season = data.seasons.find(s => s.id === select.value) || data.seasons[0];
    if (!season) return;
    const players = new Map(data.players.map(p => [p.id, p]));
    const tickets = new Map(data.tickets.filter(t => t.season_id === season.id).map(t => [t.player_id, t]));
    const seasonPlayers = data.players.filter(p => tickets.has(p.id));
    const seasonGames = data.games.filter(g => g.game_date >= season.starts_on && g.game_date <= season.ends_on);
    const rows = data.rows.filter(r => seasonGames.some(g => g.id === r.game_id));

    const unpaidSeason = seasonPlayers.filter(p => !tickets.get(p.id)?.paid);
    // A game signup creates the payment obligation. Attendance is irrelevant.
    const payableGameRows = rows.filter(r => r.player_id || r.guest_name).filter(r => {
      const p = r.player_id ? players.get(r.player_id) : null;
      return !(p?.model === "season");
    });
    const unpaidGame = payableGameRows.filter(r => !r.paid);
    const paidGameIncome = payableGameRows.filter(r => r.paid).length * Number(season.pay_per_game_amount || 0);
    const seasonIncome = data.tickets.filter(t => t.season_id === season.id && t.paid).reduce((a,t) => a + Number(t.amount || 0), 0);
    const outstanding = unpaidSeason.length * Number(season.season_ticket_amount || 0) + unpaidGame.length * Number(season.pay_per_game_amount || 0);

    const key = season.id + ":" + unpaidSeason.map(p => p.id).sort().join(",") + ":" + unpaidGame.map(r => r.id).sort().join(",") + ":" + outstanding;
    if (key === lastFinanceKey) return;
    lastFinanceKey = key;

    const values = [seasonIncome + paidGameIncome, outstanding, null, null];
    const stats = financePage.querySelectorAll(".stat strong");
    if (stats[0]) stats[0].textContent = money(values[0]);
    if (stats[1]) stats[1].textContent = money(outstanding);

    const dueTable = [...document.querySelectorAll(".finance-table table")].find(t => /Who still needs to pay/i.test(t.closest(".analytics-card")?.textContent || ""));
    if (dueTable) {
      const tbody = dueTable.querySelector("tbody");
      if (tbody) {
        const rowsHtml = [
          ...unpaidSeason.map(p => `<tr><td>${esc(p.name)}</td><td>Season ticket</td><td>${money(season.season_ticket_amount)}</td><td><span class="badge badge-red">Due</span></td></tr>`),
          ...unpaidGame.map(r => `<tr><td>${esc(r.player_id ? (players.get(r.player_id)?.name || "Player") : (r.guest_name || "Guest"))}</td><td>Game</td><td>${money(season.pay_per_game_amount)}</td><td><span class="badge badge-red">Due</span></td></tr>`)
        ].join("");
        const nextHtml = rowsHtml || '<tr><td colspan="4" class="empty">Nothing outstanding.</td></tr>';
        if (tbody.innerHTML !== nextHtml) tbody.innerHTML = nextHtml;
      }
    }
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const data = await load();
      if (!data) return;
      applyDashboard(data);
      applyFinance(data);
    } catch (_) {} finally {
      refreshing = false;
    }
  }

  // Only observe page-level renders. Observing the whole subtree caused our own
  // KPI/table updates to trigger another refresh, producing the visible flip/blink.
  const observer = new MutationObserver(() => {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(refresh, 100);
  });
  observer.observe(document.getElementById("app") || document.body, { childList:true, subtree:false });
  refresh();
})();
