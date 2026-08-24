(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const dateText = date => new Date(String(date).slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  });
  const isoDate = value => String(value || "").slice(0, 10);

  let running = false;
  let lastKey = "";
  let retryTimer = null;

  function retry() {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(syncDashboardFinance, 500);
  }

  async function syncDashboardFinance() {
    if (running) return;
    const app = document.getElementById("app");
    if (!app || !app.querySelector(".hero .game-nav") || !app.querySelector(".stats")) return;

    const heroDate = app.querySelector(".game-nav h1")?.textContent?.trim();
    const heroMeta = app.querySelector(".game-nav p")?.textContent?.trim() || "";
    if (!heroDate) return;

    running = true;
    try {
      // Wait until the authenticated Supabase session is available. The old
      // implementation could run during boot, receive an empty finance
      // result and then overwrite the correct dashboard values with zeroes.
      const sessionResult = await sb.auth.getSession();
      if (sessionResult.error || !sessionResult.data?.session) {
        retry();
        return;
      }

      const [gamesResult, seasonsResult, ticketsResult, squadResult, paymentsResult] = await Promise.all([
        sb.from("games").select("id,game_date,start_time,end_time,location"),
        sb.from("finance_seasons").select("id,name,starts_on,ends_on").order("starts_on", { ascending: false }),
        sb.from("finance_season_tickets").select("id,season_id,player_id,paid,amount"),
        sb.from("game_players").select("id,game_id,player_id,guest_name,attended"),
        sb.from("payments").select("id,player_id,game_id,paid,payment_type")
      ]);

      const error = gamesResult.error || seasonsResult.error || ticketsResult.error || squadResult.error || paymentsResult.error;
      if (error) {
        console.warn("[Football] Could not load dashboard finance status:", error.message);
        retry();
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

      const gameDate = isoDate(game.game_date);
      const seasons = seasonsResult.data || [];
      if (!seasons.length) {
        retry();
        return;
      }

      // Select the latest season that has started on or before the game date.
      // This is deliberately not based on an exact string-range comparison;
      // Supabase may return DATE/TIMESTAMP values with different formatting.
      const season = seasons.find(s => {
        const start = isoDate(s.starts_on);
        const end = isoDate(s.ends_on);
        return start && gameDate >= start && (!end || gameDate <= end);
      }) || seasons.find(s => isoDate(s.starts_on) && gameDate >= isoDate(s.starts_on));
      if (!season) {
        retry();
        return;
      }

      const tickets = (ticketsResult.data || []).filter(t => String(t.season_id) === String(season.id));
      const ticketByPlayer = new Map(tickets.map(t => [String(t.player_id), t]));
      const squad = (squadResult.data || []).filter(x => x.game_id === game.id);
      const payments = (paymentsResult.data || []).filter(p => p.game_id === game.id && p.payment_type === "game" && p.paid);
      const paidByPlayer = new Set(payments.filter(p => p.player_id).map(p => String(p.player_id)));
      const paidGuest = payments.some(p => !p.player_id);

      // Finance is the source of truth. A player is a season-ticket holder
      // only if a ticket exists for this game's financial season. Otherwise
      // the game is payable per game.
      const seasonTicketCount = tickets.length;
      const seasonPaidCount = tickets.filter(t => t.paid).length;

      const due = squad.filter(row => {
        if (!row.attended) return false;
        if (!row.player_id) return !paidGuest;
        const ticket = ticketByPlayer.get(String(row.player_id));
        return ticket ? !ticket.paid : !paidByPlayer.has(String(row.player_id));
      }).length;

      const paidGameCount = squad.filter(row => {
        if (!row.attended || !row.player_id) return false;
        if (ticketByPlayer.has(String(row.player_id))) return false;
        return paidByPlayer.has(String(row.player_id));
      }).length;
      const payableGameCount = squad.filter(row => {
        if (!row.attended || !row.player_id) return false;
        return !ticketByPlayer.has(String(row.player_id));
      }).length;
      const collection = payableGameCount ? Math.round((paidGameCount / payableGameCount) * 100) : 0;

      // Never replace a valid dashboard value with zero because a transient
      // query returned an incomplete dataset. Once the finance data is fully
      // available, these are the only values written to the dashboard.
      const key = [game.id, season.id, seasonTicketCount, seasonPaidCount, due, paidGameCount, payableGameCount].join(":");
      if (key === lastKey) return;
      lastKey = key;

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
      retry();
    } finally {
      running = false;
    }
  }

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer._timer);
    observer._timer = window.setTimeout(syncDashboardFinance, 100);
  });

  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  window.setTimeout(syncDashboardFinance, 600);
})();
