(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  // Finance is the single source of truth for these two dashboard KPIs.
  // Keep the financial values hidden until Finance has resolved them. This
  // prevents the dashboard's legacy 0 values from flashing before the async
  // Finance query completes.
  const style = document.createElement("style");
  style.textContent = [
    ".stats .stat:nth-child(3) strong,.stats .stat:nth-child(4) strong{visibility:hidden}",
    ".stats.finance-ready .stat:nth-child(3) strong,.stats.finance-ready .stat:nth-child(4) strong{visibility:visible}"
  ].join("");
  document.head.appendChild(style);

  const dateText = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  });

  let running = false;
  let lastKey = "";
  let currentStats = null;
  let currentGameKey = "";

  async function syncDashboardFinance() {
    if (running) return;

    const app = document.getElementById("app");
    const stats = app?.querySelector(".hero + .stats");
    const hero = app?.querySelector(".hero .game-nav");
    if (!stats || !hero) return;

    const heroDate = hero.querySelector("h1")?.textContent?.trim();
    const heroMeta = hero.querySelector("p")?.textContent?.trim() || "";
    if (!heroDate) return;

    const renderChanged = currentStats !== stats;
    if (renderChanged) {
      currentStats = stats;
      currentGameKey = "";
      lastKey = "";
      stats.classList.remove("finance-ready");
    }

    running = true;
    try {
      const [gamesResult, seasonsResult, ticketsResult, squadResult, paymentsResult] = await Promise.all([
        sb.from("games").select("id,game_date,start_time,end_time,location"),
        sb.from("finance_seasons").select("id,name,starts_on,ends_on"),
        sb.from("finance_season_tickets").select("id,season_id,player_id,paid,amount"),
        sb.from("game_players").select("id,game_id,player_id,guest_name,attended"),
        sb.from("payments").select("id,player_id,game_id,paid,payment_type")
      ]);

      const error = gamesResult.error || seasonsResult.error || ticketsResult.error || squadResult.error || paymentsResult.error;
      if (error) {
        console.warn("[Football] Dashboard Finance data unavailable:", error.message);
        return;
      }

      const games = gamesResult.data || [];
      const game = games.find(g => {
        const sameDate = dateText(g.game_date) === heroDate;
        const time = String(g.start_time || "").slice(0, 5);
        const location = String(g.location || "");
        return sameDate && heroMeta.includes(time) && (!location || heroMeta.includes(location));
      });
      if (!game) return;

      const season = (seasonsResult.data || []).find(s =>
        game.game_date >= s.starts_on && game.game_date <= s.ends_on
      );
      if (!season) return;

      const gameKey = `${game.id}:${season.id}`;
      if (currentGameKey !== gameKey) {
        currentGameKey = gameKey;
        lastKey = "";
      }

      const tickets = (ticketsResult.data || []).filter(t => t.season_id === season.id);
      const ticketByPlayer = new Map(tickets.map(t => [t.player_id, t]));
      const squad = (squadResult.data || []).filter(x => x.game_id === game.id);
      const gamePayments = (paymentsResult.data || []).filter(
        p => p.game_id === game.id && p.payment_type === "game"
      );
      const paidByPlayer = new Map(gamePayments.map(p => [p.player_id, !!p.paid]));

      const seasonTicketCount = tickets.length;
      const due = squad.filter(row => {
        if (!row.attended) return false;
        if (!row.player_id) return !paidByPlayer.get(null);
        const ticket = ticketByPlayer.get(row.player_id);
        if (ticket) return !ticket.paid;
        return !paidByPlayer.get(row.player_id);
      }).length;

      const key = [
        game.id,
        season.id,
        tickets.map(t => `${t.id}:${t.paid ? 1 : 0}`).join(","),
        squad.map(x => `${x.id}:${x.attended ? 1 : 0}`).join(","),
        gamePayments.map(p => `${p.id}:${p.paid ? 1 : 0}`).join(",")
      ].join("|");

      if (key !== lastKey) {
        lastKey = key;
        const values = stats.querySelectorAll("strong");
        if (values[2]) values[2].textContent = String(seasonTicketCount);
        if (values[3]) values[3].textContent = String(due);
      }

      stats.classList.add("finance-ready");
    } catch (error) {
      console.warn("[Football] Dashboard Finance sync failed:", error);
    } finally {
      running = false;
    }
  }

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer._timer);
    observer._timer = window.setTimeout(syncDashboardFinance, 40);
  });

  observer.observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });

  window.setTimeout(syncDashboardFinance, 150);
})();
