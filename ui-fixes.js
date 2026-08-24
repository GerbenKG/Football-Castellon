(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let financeRefreshing = false;
  let lastFinanceSignature = "";

  function removeLegacySeasonPaidField() {
    const form = document.getElementById("player-form");
    if (!form) return;
    form.querySelectorAll('input[name="seasonPaid"]').forEach(input => {
      const row = input.closest(".checkline") || input.parentElement;
      if (row) row.remove();
      else input.remove();
    });
  }

  async function refreshDashboardFinanceStats() {
    if (financeRefreshing) return;
    if (!document.querySelector('.hero')) return;

    financeRefreshing = true;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [seasonsResult, ticketsResult, playersResult, gamesResult, gamePlayersResult] = await Promise.all([
        sb.from("finance_seasons").select("id,name,starts_on,ends_on").order("starts_on", { ascending: false }),
        sb.from("finance_season_tickets").select("season_id,player_id,paid"),
        sb.from("players").select("id,model"),
        sb.from("games").select("id,game_date"),
        sb.from("game_players").select("game_id,player_id,guest_name,attended,paid")
      ]);

      if (seasonsResult.error || ticketsResult.error || playersResult.error || gamesResult.error || gamePlayersResult.error) return;

      const seasons = seasonsResult.data || [];
      const tickets = ticketsResult.data || [];
      const players = playersResult.data || [];
      const games = gamesResult.data || [];
      const gamePlayers = gamePlayersResult.data || [];

      const season = seasons.find(s => today >= s.starts_on && today <= s.ends_on) || seasons[0];
      if (!season) return;

      const seasonTickets = tickets.filter(t => t.season_id === season.id);
      const paidSeasonTickets = seasonTickets.filter(t => t.paid).length;
      const seasonTicketPlayers = players.filter(p => p.model === "season");

      const playerById = new Map(players.map(p => [p.id, p]));
      const gameById = new Map(games.map(g => [g.id, g]));
      const outstandingGamePayments = gamePlayers.filter(row => {
        const game = gameById.get(row.game_id);
        if (!game || game.game_date > today || !row.attended || row.paid) return false;
        return !!row.guest_name || playerById.get(row.player_id)?.model === "game";
      }).length;
      const outstandingSeasonPayments = seasonTicketPlayers.filter(p => !seasonTickets.some(t => t.player_id === p.id && t.paid)).length;
      const paymentDue = outstandingSeasonPayments + outstandingGamePayments;

      const signature = [season.id, paidSeasonTickets, seasonTicketPlayers.length, paymentDue].join("|");
      if (signature === lastFinanceSignature) return;
      lastFinanceSignature = signature;

      const stats = document.querySelectorAll(".stats:not(.finance-stats) .stat");
      if (stats[2]) {
        const strong = stats[2].querySelector("strong");
        if (strong) strong.textContent = String(paidSeasonTickets);
      }
      if (stats[3]) {
        const strong = stats[3].querySelector("strong");
        if (strong) strong.textContent = String(paymentDue);
      }

      const paymentCard = [...document.querySelectorAll(".analytics-card")].find(card =>
        card.querySelector("h3")?.textContent.trim() === "Payments"
      );
      if (paymentCard) {
        const mini = paymentCard.querySelector(".mini-stats span");
        if (mini) mini.innerHTML = `Season tickets paid <b>${paidSeasonTickets}/${seasonTicketPlayers.length}</b>`;
      }
    } finally {
      financeRefreshing = false;
    }
  }

  const observer = new MutationObserver(() => {
    removeLegacySeasonPaidField();
    refreshDashboardFinanceStats();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  removeLegacySeasonPaidField();
  refreshDashboardFinanceStats();
})();
