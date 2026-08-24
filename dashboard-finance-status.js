(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const dateText = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  });

  let running = false;
  let lastKey = "";

  async function syncDashboardFinance() {
    if (running) return;
    const app = document.getElementById("app");
    if (!app || !app.querySelector(".hero .game-nav") || !app.querySelector(".stats")) return;

    const heroDate = app.querySelector(".game-nav h1")?.textContent?.trim();
    const heroMeta = app.querySelector(".game-nav p")?.textContent?.trim() || "";
    if (!heroDate) return;

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
        console.warn("[Football] Could not load dashboard finance status:", error.message);
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

      // The game date determines the applicable financial season. This is
      // important around August/September, when the calendar year changes
      // before/after the football season does.
      const season = (seasonsResult.data || []).find(s =>
        game.game_date >= s.starts_on && game.game_date <= s.ends_on
      );
      if (!season) return;

      const tickets = (ticketsResult.data || []).filter(t => t.season_id === season.id);
      const ticketByPlayer = new Map(tickets.map(t => [t.player_id, t]));
      const squad = (squadResult.data || []).filter(x => x.game_id === game.id);
      const payments = (paymentsResult.data || []).filter(p => p.game_id === game.id && p.payment_type === "game" && p.paid);
      const paidByPlayer = new Set(payments.map(p => p.player_id));

      // A player is a season-ticket holder for this game only when they have
      // a ticket for the game's season. Player payment_model is deliberately
      // not used here; Finance is the source of truth.
      const seasonTicketCount = tickets.length;
      const seasonPaidCount = tickets.filter(t => t.paid).length;

      // Count actual outstanding obligations for the selected game:
      // - season-ticket player with an unpaid ticket
      // - attended pay-per-game player without a paid game payment
      // - attended guest without a paid game payment
      const due = squad.filter(row => {
        if (!row.attended) return false;
        if (!row.player_id) return !paidByPlayer.has(null);
        const ticket = ticketByPlayer.get(row.player_id);
        return ticket ? !ticket.paid : !paidByPlayer.has(row.player_id);
      }).length;

      const paidGameCount = squad.filter(row => {
        if (!row.attended || !row.player_id || ticketByPlayer.has(row.player_id)) return false;
        return paidByPlayer.has(row.player_id);
      }).length;
      const payableGameCount = squad.filter(row => {
        if (!row.attended || !row.player_id) return false;
        return !ticketByPlayer.has(row.player_id);
      }).length;
      const collection = payableGameCount ? Math.round((paidGameCount / payableGameCount) * 100) : 0;

      const key = [
        game.id,
        season.id,
        seasonTicketCount,
        seasonPaidCount,
        due,
        paidGameCount,
        payableGameCount
      ].join(":");
      if (key === lastKey) return;
      lastKey = key;

      running = true;
      const stats = app.querySelectorAll(".stats .stat");
      if (stats[2]) {
        const value = stats[2].querySelector("strong");
        if (value) value.textContent = String(seasonTicketCount);
      }
      if (stats[3]) {
        const value = stats[3].querySelector("strong");
        if (value) value.textContent = String(due);
      }

      const analyticsCards = app.querySelectorAll(".analytics-grid .analytics-card");
      const paymentCard = [...analyticsCards].find(card => card.querySelector(".progress-value"));
      if (paymentCard) {
        const progressValue = paymentCard.querySelector(".progress-value strong");
        const progressText = paymentCard.querySelector(".progress-value span");
        const progress = paymentCard.querySelector(".progress i");
        if (progressValue) progressValue.textContent = collection + "%";
        if (progressText) progressText.textContent = paidGameCount + " of " + payableGameCount + " game payments collected";
        if (progress) progress.style.width = collection + "%";

        const miniStats = paymentCard.querySelectorAll(".mini-stats span");
        if (miniStats[0]) {
          const b = miniStats[0].querySelector("b");
          if (b) b.textContent = seasonPaidCount + "/" + seasonTicketCount;
        }
      }
    } catch (error) {
      console.warn("[Football] Dashboard finance sync failed:", error);
    } finally {
      running = false;
    }
  }

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer._timer);
    observer._timer = window.setTimeout(syncDashboardFinance, 80);
  });

  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  window.setTimeout(syncDashboardFinance, 300);
})();
