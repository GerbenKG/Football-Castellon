(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let lastDue = null;
  let running = false;

  async function sync() {
    if (running) return;
    const stats = document.querySelectorAll(".stats:not(.finance-stats) .stat");
    if (stats.length < 4) return;
    const hero = document.querySelector(".game-nav h1");
    if (!hero) return;

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
      if (error) return;

      const wantedDate = hero.textContent.trim();
      const dateLabel = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" });
      const game = (games.data || []).find(g => dateLabel(g.game_date) === wantedDate);
      if (!game) return;
      const season = (seasons.data || []).find(s => game.game_date >= s.starts_on && game.game_date <= s.ends_on);
      if (!season) return;

      const playerById = new Map((players.data || []).map(p => [p.id, p]));
      const ticketed = new Set((tickets.data || []).filter(t => t.season_id === season.id).map(t => t.player_id));
      const signedUp = (gamePlayers.data || []).filter(r => r.game_id === game.id);
      const paid = new Map((payments.data || []).filter(p => p.game_id === game.id && p.payment_type === "game").map(p => [p.player_id, p.paid]));

      let due = 0;
      for (const row of signedUp) {
        if (!row.player_id) {
          const payment = (payments.data || []).find(p => p.game_id === game.id && p.player_id == null && p.payment_type === "game" && p.paid);
          if (!payment) due++;
          continue;
        }
        if (ticketed.has(row.player_id)) {
          const ticket = (tickets.data || []).find(t => t.season_id === season.id && t.player_id === row.player_id);
          if (!ticket?.paid) due++;
        } else if (playerById.get(row.player_id)?.model === "game" && !paid.get(row.player_id)) {
          due++;
        }
      }

      if (lastDue === due && stats[3].querySelector("strong")?.textContent === String(due)) return;
      lastDue = due;
      const target = stats[3].querySelector("strong");
      if (target) target.textContent = String(due);
    } finally {
      running = false;
    }
  }

  const app = document.getElementById("app");
  const observer = new MutationObserver(() => queueMicrotask(sync));
  if (app) observer.observe(app, { childList:true, subtree:true, characterData:true });
  setTimeout(sync, 300);
})();
