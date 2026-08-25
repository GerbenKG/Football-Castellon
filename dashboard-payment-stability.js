(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  // Payments Due is owned by Finance. Never expose the legacy dashboard value
  // (usually 0) while the Finance query is still resolving.
  const style = document.createElement("style");
  style.textContent = ".stats .stat:nth-child(4) strong{visibility:hidden}.stats.finance-payment-ready .stat:nth-child(4) strong{visibility:visible}";
  document.head.appendChild(style);

  let lastDue = null;
  let running = false;
  let currentStats = null;

  function markLoading(stats) {
    if (currentStats !== stats) {
      currentStats = stats;
      lastDue = null;
      stats.classList.remove("finance-payment-ready");
    }
  }

  async function sync() {
    if (running) return;
    const stats = document.querySelectorAll(".stats:not(.finance-stats) .stat");
    if (stats.length < 4) return;
    const hero = document.querySelector(".game-nav h1");
    if (!hero) return;

    const statsContainer = stats[0].closest(".stats");
    if (!statsContainer) return;
    markLoading(statsContainer);

    running = true;
    try {
      const [games, players, seasons, tickets, gamePlayers, payments] = await Promise.all([
        sb.from("games").select("id,game_date,start_time,location"),
        sb.from("players").select("id,model"),
        sb.from("finance_seasons").select("id,starts_on,ends_on"),
        sb.from("finance_season_tickets").select("season_id,player_id,paid"),
        sb.from("game_players").select("game_id,player_id,guest_name"),
        sb.from("payments").select("game_id,player_id,paid,payment_type")
      ]);
      const error = games.error || players.error || seasons.error || tickets.error || gamePlayers.error || payments.error;
      if (error) {
        console.warn("[Football] Dashboard payment data unavailable:", error.message);
        return;
      }

      const wantedDate = hero.textContent.trim();
      const dateLabel = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" });
      const game = (games.data || []).find(g => dateLabel(g.game_date) === wantedDate);
      if (!game) return;
      const season = (seasons.data || []).find(s => game.game_date >= s.starts_on && game.game_date <= s.ends_on);
      if (!season) return;

      const playerById = new Map((players.data || []).map(p => [p.id, p]));
      const seasonTickets = (tickets.data || []).filter(t => t.season_id === season.id);
      const ticketed = new Set(seasonTickets.map(t => t.player_id));
      const signedUp = (gamePlayers.data || []).filter(r => r.game_id === game.id);
      const gamePayments = (payments.data || []).filter(p => p.game_id === game.id && p.payment_type === "game");
      const paid = new Map(gamePayments.map(p => [p.player_id, !!p.paid]));

      let due = 0;
      for (const row of signedUp) {
        if (!row.player_id) {
          if (!paid.get(null)) due++;
          continue;
        }

        if (ticketed.has(row.player_id)) {
          const ticket = seasonTickets.find(t => t.player_id === row.player_id);
          if (!ticket?.paid) due++;
        } else if (playerById.get(row.player_id)?.model === "game" && !paid.get(row.player_id)) {
          due++;
        }
      }

      const target = stats[3].querySelector("strong");
      if (target && (lastDue !== due || target.textContent !== String(due))) {
        target.textContent = String(due);
      }
      lastDue = due;
      statsContainer.classList.add("finance-payment-ready");
    } finally {
      running = false;
    }
  }

  const app = document.getElementById("app");
  const observer = new MutationObserver(() => {
    window.clearTimeout(observer._timer);
    observer._timer = window.setTimeout(sync, 40);
  });
  if (app) observer.observe(app, { childList:true, subtree:true, characterData:true });
  setTimeout(sync, 150);
})();
