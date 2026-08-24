(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const dateText = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  });

  let patching = false;
  let lastKey = "";

  async function syncGameFinance() {
    if (patching) return;
    const app = document.getElementById("app");
    if (!app || !app.querySelector(".game-nav") || !app.querySelector(".squad-row")) return;

    const heroDate = app.querySelector(".game-nav h1")?.textContent?.trim();
    const heroMeta = app.querySelector(".game-nav p")?.textContent?.trim() || "";
    if (!heroDate) return;

    try {
      const [gamesResult, playersResult, seasonsResult, ticketsResult, paymentsResult] = await Promise.all([
        sb.from("games").select("id,game_date,start_time,end_time,location"),
        sb.from("players").select("id,name"),
        sb.from("finance_seasons").select("id,name,starts_on,ends_on"),
        sb.from("finance_season_tickets").select("id,season_id,player_id,paid,amount"),
        sb.from("payments").select("id,player_id,game_id,paid,payment_type")
      ]);

      const error = gamesResult.error || playersResult.error || seasonsResult.error || ticketsResult.error || paymentsResult.error;
      if (error) {
        console.warn("[Football] Could not load finance status for Game squad:", error.message);
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

      const season = (seasonsResult.data || []).find(s => game.game_date >= s.starts_on && game.game_date <= s.ends_on);
      if (!season) return;

      const players = playersResult.data || [];
      const tickets = ticketsResult.data || [];
      const payments = paymentsResult.data || [];
      const playerByName = new Map(players.map(p => [String(p.name).trim().toLowerCase(), p]));
      const ticketByPlayer = new Map(tickets.filter(t => t.season_id === season.id).map(t => [t.player_id, t]));
      const paymentByPlayer = new Map(payments.filter(p => p.game_id === game.id && p.payment_type === "game").map(p => [p.player_id, p]));

      const rows = [...app.querySelectorAll(".squad-row")];
      const key = game.id + ":" + season.id + ":" + rows.map(r => r.querySelector(".who b")?.textContent || "").join("|");
      if (key === lastKey) return;
      lastKey = key;

      patching = true;
      rows.forEach(row => {
        const name = row.querySelector(".who b")?.textContent?.trim();
        const typeEl = row.querySelector(".who small");
        if (!name || !typeEl) return;

        // Guests are not linked to the player/finance roster.
        if (typeEl.textContent.trim() === "Guest") return;

        const p = playerByName.get(name.toLowerCase());
        if (!p) return;

        const ticket = ticketByPlayer.get(p.id);
        const isSeasonHolder = !!ticket;
        typeEl.textContent = isSeasonHolder ? "🎟 Season ticket" : "Per game";

        const payment = paymentByPlayer.get(p.id);
        const paid = !!payment?.paid;
        const paymentControl = row.querySelector('input[data-t="paid"]');
        if (paymentControl) {
          paymentControl.checked = paid;
          const label = paymentControl.closest("label");
          const span = label?.querySelector("span");
          if (span) span.textContent = "Paid";
        } else {
          const status = row.querySelector(".badge");
          if (!status) return;
          if (isSeasonHolder) {
            status.textContent = ticket.paid ? "Season paid" : "Season unpaid";
            status.className = "badge badge-" + (ticket.paid ? "green" : "amber");
          } else {
            status.textContent = paid ? "Paid" : "Due";
            status.className = "badge badge-" + (paid ? "green" : "red");
          }
        }
      });
    } catch (error) {
      console.warn("[Football] Finance status sync failed:", error);
    } finally {
      patching = false;
    }
  }

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer._timer);
    observer._timer = window.setTimeout(syncGameFinance, 50);
  });

  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  window.setTimeout(syncGameFinance, 250);
})();
