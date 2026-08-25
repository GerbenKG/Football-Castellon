(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  // Payments Due is owned by Finance. The dashboard must never render its
  // legacy value while the Finance calculation is being resolved.
  let running = false;
  let currentStats = null;

  function findStats() {
    const first = document.querySelector(".stats:not(.finance-stats) .stat:nth-child(4)");
    return first?.closest(".stats") || null;
  }

  function markLoading(stats) {
    if (currentStats === stats) return;
    currentStats = stats;
    stats.classList.remove("finance-payment-ready");
    const target = stats.querySelector(".stat:nth-child(4) strong");
    if (target) target.textContent = "";
  }

  async function sync() {
    if (running) return;

    const statsContainer = findStats();
    if (!statsContainer) return;
    markLoading(statsContainer);

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
      if (error) {
        console.warn("[Football] Dashboard payment data unavailable:", error.message);
        return;
      }

      const wantedDate = hero.textContent.trim();
      const dateLabel = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long"
      });
      const game = (games.data || []).find(g => dateLabel(g.game_date) === wantedDate);
      if (!game) return;

      const season = (seasons.data || []).find(s =>
        game.game_date >= s.starts_on && game.game_date <= s.ends_on
      );
      if (!season) return;

      const playerById = new Map((players.data || []).map(p => [p.id, p]));
      const seasonTickets = (tickets.data || []).filter(t => t.season_id === season.id);
      const ticketed = new Map(seasonTickets.map(t => [t.player_id, t]));
      const signedUp = (gamePlayers.data || []).filter(r => r.game_id === game.id);
      const gamePayments = (payments.data || []).filter(
        p => p.game_id === game.id && p.payment_type === "game"
      );
      const paid = new Map(gamePayments.map(p => [p.player_id, !!p.paid]));

      let due = 0;
      for (const row of signedUp) {
        if (!row.player_id) {
          if (!paid.get(null)) due++;
          continue;
        }

        const ticket = ticketed.get(row.player_id);
        if (ticket) {
          if (!ticket.paid) due++;
        } else if (playerById.get(row.player_id)?.model === "game" && !paid.get(row.player_id)) {
          due++;
        }
      }

      // Only now expose the Finance-derived value.
      const target = statsContainer.querySelector(".stat:nth-child(4) strong");
      if (target) target.textContent = String(due);
      statsContainer.classList.add("finance-payment-ready");
    } catch (error) {
      console.warn("[Football] Dashboard payment sync failed:", error);
    } finally {
      running = false;
    }
  }

  const app = document.getElementById("app");
  const observer = new MutationObserver(() => {
    window.clearTimeout(observer._timer);
    observer._timer = window.setTimeout(sync, 30);
  });
  if (app) observer.observe(app, { childList: true, subtree: true });

  window.setTimeout(sync, 0);
})();
