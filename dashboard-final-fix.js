(() => {
  const sb = window.supabaseClient;
  const app = document.getElementById("app");
  if (!sb || !app) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));
  const card = (icon, label, value) =>
    `<div class="stat"><div class="stat-icon">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`;

  let key = "";
  let timer = null;
  let running = false;

  async function sync() {
    if (running) return;
    const stats = app.querySelector(".hero + .stats");
    const hero = app.querySelector(".hero .game-nav");
    if (!stats || !hero) return;

    const heroDate = hero.querySelector("h1")?.textContent?.trim();
    const heroMeta = hero.querySelector("p")?.textContent?.trim() || "";
    if (!heroDate) return;

    running = true;
    try {
      const [gamesResult, seasonsResult, ticketsResult, squadResult] = await Promise.all([
        sb.from("games").select("id,game_date,start_time,end_time,location"),
        sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on", { ascending: false }),
        sb.from("finance_season_tickets").select("id,season_id,player_id,paid"),
        sb.from("game_players").select("id,game_id,player_id,guest_name,paid,playing,attended")
      ]);
      const error = gamesResult.error || seasonsResult.error || ticketsResult.error || squadResult.error;
      if (error) return;

      const dateText = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long"
      });
      const game = (gamesResult.data || []).find(g => {
        const sameDate = dateText(g.game_date) === heroDate;
        const time = String(g.start_time || "").slice(0, 5);
        return sameDate && heroMeta.includes(time) && (!g.location || heroMeta.includes(String(g.location)));
      });
      if (!game) return;

      const season = (seasonsResult.data || []).find(s =>
        game.game_date >= s.starts_on && game.game_date <= s.ends_on
      );
      if (!season) return;

      const tickets = (ticketsResult.data || []).filter(t => t.season_id === season.id);
      const ticketByPlayer = new Map(tickets.map(t => [t.player_id, t]));
      const squad = (squadResult.data || []).filter(x => x.game_id === game.id);

      const numberOfPlayers = squad.length;
      const paymentDue = squad.filter(row => {
        const ticket = row.player_id ? ticketByPlayer.get(row.player_id) : null;
        return ticket ? !ticket.paid : !row.paid;
      }).length;
      const seasonTickets = tickets.length;

      const nextKey = [
        game.id,
        season.id,
        numberOfPlayers,
        paymentDue,
        seasonTickets,
        tickets.map(t => `${t.id}:${t.paid ? 1 : 0}`).join(","),
        squad.map(x => `${x.id}:${x.paid ? 1 : 0}`).join(",")
      ].join("|");
      if (nextKey === key) return;
      key = nextKey;

      stats.innerHTML =
        card("⚽", "THIS GAME · NUMBER OF PLAYERS", numberOfPlayers) +
        card("€", "THIS GAME · PAYMENT DUE", paymentDue) +
        card("🎟", "THIS SEASON · NUMBER OF SEASON TICKETS", seasonTickets);
    } finally {
      running = false;
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(sync, 50);
  });
  observer.observe(app, { childList: true, subtree: true });
  sync();
})();
