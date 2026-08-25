(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  // Dashboard financial stats are display-only projections of Finance data.
  // Never fall back to the legacy player fields and never write 0 on errors.
  let running = false;
  let lastGameId = null;
  let lastValue = null;

  const getStats = () => document.querySelector(".stats:not(.finance-stats)");
  const getGame = () => {
    const hero = document.querySelector(".game-nav h1");
    if (!hero) return null;
    const label = hero.textContent.trim();
    return label;
  };
  const dateLabel = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" });

  async function sync() {
    if (running) return;
    const stats = getStats();
    const wantedDate = getGame();
    if (!stats || !wantedDate) return;

    running = true;
    try {
      const [games, seasons, tickets, gamePlayers, payments] = await Promise.all([
        sb.from("games").select("id,game_date"),
        sb.from("finance_seasons").select("id,starts_on,ends_on"),
        sb.from("finance_season_tickets").select("season_id,player_id,paid"),
        sb.from("game_players").select("game_id,player_id,guest_name"),
        sb.from("payments").select("game_id,player_id,paid,payment_type")
      ]);

      const error = games.error || seasons.error || tickets.error || gamePlayers.error || payments.error;
      if (error) {
        console.warn("[Football] Finance dashboard sync unavailable:", error.message);
        return;
      }

      const currentGame = (games.data || []).find(g => dateLabel(g.game_date) === wantedDate);
      if (!currentGame) return;
      const season = (seasons.data || []).find(s => currentGame.game_date >= s.starts_on && currentGame.game_date <= s.ends_on);
      if (!season) return;

      const ticketed = new Map((tickets.data || []).filter(t => t.season_id === season.id).map(t => [t.player_id, t]));
      const rows = (gamePlayers.data || []).filter(x => x.game_id === currentGame.id);
      const gamePaid = new Map((payments.data || []).filter(x => x.game_id === currentGame.id && x.payment_type === "game").map(x => [x.player_id, !!x.paid]));

      // A due payment is a financial obligation attached to this game:
      // an unpaid season ticket for a ticket holder, or an unpaid game payment.
      // Guests without a payment record are also due.
      let due = 0;
      for (const row of rows) {
        if (!row.player_id) {
          if (!gamePaid.get(null)) due++;
        } else if (ticketed.has(row.player_id)) {
          if (!ticketed.get(row.player_id).paid) due++;
        } else if (!gamePaid.get(row.player_id)) {
          due++;
        }
      }

      // Only update after a complete Finance-backed calculation.
      const target = stats.querySelector(".stat:nth-child(4) strong");
      if (target) target.textContent = String(due);
      stats.classList.add("finance-payment-ready");
      lastGameId = currentGame.id;
      lastValue = due;
    } catch (e) {
      console.warn("[Football] Finance dashboard sync failed:", e);
    } finally {
      running = false;
    }
  }

  // Do not observe text mutations: updating the stat itself must never trigger
  // another calculation. Only a dashboard/game navigation DOM replacement is relevant.
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  };
  const app = document.getElementById("app");
  if (app) new MutationObserver(mutations => {
    if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1))) schedule();
  }).observe(app, { childList:true, subtree:true });

  schedule();
})();
