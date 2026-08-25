(() => {
  "use strict";

  const sb = window.supabaseClient;
  const app = document.getElementById("app");
  if (!sb || !app) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));
  const dateText = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  });
  const card = (icon, label, value) =>
    `<div class="stat"><div class="stat-icon">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`;

  let syncing = false;
  let lastKey = "";

  async function sync() {
    const stats = app.querySelector(".hero + .stats");
    const hero = app.querySelector(".hero .game-nav");
    if (!stats || !hero || syncing) return;

    syncing = true;
    stats.classList.remove("stats-ready");
    try {
      const heroDate = hero.querySelector("h1")?.textContent?.trim() || "";
      const heroMeta = hero.querySelector("p")?.textContent?.trim() || "";

      const [gamesResult, seasonsResult, ticketsResult, squadResult] = await Promise.all([
        sb.from("games").select("id,game_date,start_time"),
        sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on", { ascending: false }),
        sb.from("finance_season_tickets").select("id,season_id,player_id,paid"),
        sb.from("game_players").select("id,game_id,player_id,guest_name,paid")
      ]);

      const error = gamesResult.error || seasonsResult.error || ticketsResult.error || squadResult.error;
      if (error) throw error;

      const selectedGame = (gamesResult.data || []).find(g => {
        const sameDate = dateText(g.game_date) === heroDate;
        const time = String(g.start_time || "").slice(0, 5);
        return sameDate && (!time || heroMeta.includes(time));
      });
      if (!selectedGame) throw new Error("Selected game not found");

      const seasons = seasonsResult.data || [];
      const season = seasons.find(s => selectedGame.game_date >= s.starts_on && selectedGame.game_date <= s.ends_on);
      if (!season) throw new Error("Current season not found");

      const tickets = (ticketsResult.data || []).filter(t => t.season_id === season.id);
      const ticketByPlayer = new Map(tickets.map(t => [t.player_id, t]));
      const squad = (squadResult.data || []).filter(x => x.game_id === selectedGame.id);

      // Simple definitions:
      // - Playing = everyone in Game Squad.
      // - Season tickets = tickets for the current season.
      // - Payments due = Game Squad rows whose payment is not paid. A season
      //   ticket makes that row paid/unpaid according to the Finance ticket.
      const playing = squad.length;
      const due = squad.filter(row => {
        if (!row.player_id) return !row.paid;
        const ticket = ticketByPlayer.get(row.player_id);
        return ticket ? !ticket.paid : !row.paid;
      }).length;

      const key = `${selectedGame.id}|${season.id}|${tickets.map(t => `${t.player_id}:${t.paid ? 1 : 0}`).join(",")}|${squad.map(x => `${x.id}:${x.paid ? 1 : 0}`).join(",")}`;
      if (key !== lastKey) {
        lastKey = key;
        stats.innerHTML =
          card("⚽", "THIS GAME · PLAYING", playing) +
          card("🎟", "THIS SEASON · SEASON TICKETS", tickets.length) +
          card("€", "THIS GAME · PAYMENTS DUE", due);
      }

      stats.classList.add("stats-ready");
    } catch (error) {
      console.warn("[Football] Dashboard status sync failed:", error);
      // Keep the previous valid snapshot. Never replace it with zeroes.
      // This is what prevents the visible flash when a background request fails.
      if (lastKey) stats.classList.add("stats-ready");
    } finally {
      syncing = false;
    }
  }

  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 30);
  };

  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
})();
