(() => {
  "use strict";

  const api = window.api;
  if (!api) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[c]));

  const getRows = async (table, filters = []) => {
    const params = new URLSearchParams({ table, filters: JSON.stringify(filters) });
    const response = await api.get(`/api/data.php?${params.toString()}`);
    return response.data || [];
  };

  const money = value => `€${Number(value || 0).toFixed(2)}`;

  function findSeasonSelect(seasons) {
    const ids = new Set(seasons.map(s => s.id));
    return [...document.querySelectorAll("#app select")].find(select => ids.has(select.value)) || null;
  }

  function findHeading(text) {
    const target = String(text).trim().toLowerCase();
    return [...document.querySelectorAll("#app h2, #app h3")].find(el =>
      el.textContent.trim().toLowerCase() === target
    ) || null;
  }

  function renderOutstanding(section, dues, key) {
    if (!section) return;

    let host = section.querySelector("[data-finance-outstanding]");
    if (host?.dataset.financeKey === key) return;

    if (!host) {
      host = document.createElement("div");
      host.dataset.financeOutstanding = "true";
      const heading = section.querySelector("h2, h3");
      const table = section.querySelector("table");
      if (table) {
        table.replaceWith(host);
      } else if (heading?.parentElement) {
        heading.parentElement.insertAdjacentElement("afterend", host);
        [...section.querySelectorAll("p")].filter(p => /nothing outstanding|no outstanding/i.test(p.textContent)).forEach(p => p.remove());
      } else {
        section.appendChild(host);
      }
    }

    host.dataset.financeKey = key;
    const total = dues.reduce((sum, row) => sum + row.amount, 0);
    host.innerHTML = dues.length
      ? `<div class="table-card"><table><thead><tr><th>Player</th><th>Type</th><th>Amount</th></tr></thead><tbody>${dues.map(row => `<tr><td><b>${esc(row.name)}</b></td><td>${esc(row.type)}</td><td><strong>${money(row.amount)}</strong></td></tr>`).join("")}</tbody><tfoot><tr><th colspan="2">Total outstanding</th><th>${money(total)}</th></tr></tfoot></table></div>`
      : `<div class="empty"><p>Nothing outstanding.</p></div>`;
  }

  async function refresh() {
    if (!document.getElementById("app") || !findHeading("Who still needs to pay?")) return;

    const [seasons, tickets, games, gamePlayers, players] = await Promise.all([
      getRows("finance_seasons"),
      getRows("finance_season_tickets"),
      getRows("games"),
      getRows("game_players"),
      getRows("players")
    ]);

    if (!seasons.length) return;

    const select = findSeasonSelect(seasons);
    const selectedId = select?.value || seasons[0].id;
    const season = seasons.find(s => s.id === selectedId) || seasons[0];
    const playerById = new Map(players.map(p => [p.id, p]));
    const seasonTickets = tickets.filter(t => t.season_id === season.id);
    const seasonTicketPlayers = new Set(seasonTickets.map(t => t.player_id));
    const seasonGames = games.filter(g => g.game_date >= season.starts_on && g.game_date <= season.ends_on);
    const gameById = new Map(seasonGames.map(g => [g.id, g]));

    const dues = [];
    seasonTickets.filter(t => !t.paid).forEach(t => {
      const player = playerById.get(t.player_id);
      if (player) dues.push({ name: player.name, type: "Season ticket", amount: Number(t.amount || 0) });
    });

    gamePlayers.forEach(row => {
      const game = gameById.get(row.game_id);
      if (!game || !row.playing || row.paid) return;
      const isSeasonTicket = !!row.player_id && seasonTicketPlayers.has(row.player_id);
      if (isSeasonTicket) return;
      const name = row.player_id ? playerById.get(row.player_id)?.name : row.guest_name;
      if (!name) return;
      dues.push({ name, type: row.player_id ? "Pay per game" : "Guest", amount: Number(season.pay_per_game_amount || 0) });
    });

    const outstanding = dues.reduce((sum, row) => sum + row.amount, 0);
    const stat = [...document.querySelectorAll("#app .finance-stats .stat")].find(el => /expected income/i.test(el.textContent));
    if (stat?.querySelector("strong")) stat.querySelector("strong").textContent = money(outstanding);

    const key = JSON.stringify({ season: season.id, dues: dues.map(row => [row.name, row.type, row.amount]) });
    const heading = findHeading("Who still needs to pay?");
    const section = heading?.closest("section") || heading?.closest(".card") || heading?.parentElement;
    renderOutstanding(section, dues, key);
  }

  let queued = false;
  const scheduleRefresh = () => {
    if (queued) return;
    queued = true;
    setTimeout(async () => {
      queued = false;
      try { await refresh(); } catch (_) {}
    }, 80);
  };

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleRefresh();
})();
