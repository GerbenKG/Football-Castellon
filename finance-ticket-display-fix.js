(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));
  let timer = null;
  let lastKey = "";

  async function render() {
    const target = [...document.querySelectorAll("h2")].find(h => h.textContent.trim() === "Season ticket holders");
    if (!target) return;
    const card = target.closest(".card");
    if (!card) return;

    const [seasonsResult, ticketsResult, playersResult] = await Promise.all([
      sb.from("finance_seasons").select("id,name,starts_on,ends_on").order("starts_on", { ascending: false }),
      sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid,paid_on"),
      sb.from("players").select("id,name").order("name")
    ]);
    if (seasonsResult.error || ticketsResult.error || playersResult.error) return;

    const seasons = seasonsResult.data || [];
    const seasonIds = new Set(seasons.map(s => s.id));
    const select = document.getElementById("finance-season-select") ||
      [...document.querySelectorAll("select")].find(s => [...s.options].some(o => seasonIds.has(o.value)));
    const seasonId = select?.value || seasons[0]?.id;
    if (!seasonId) return;

    const tickets = (ticketsResult.data || []).filter(t => t.season_id === seasonId);
    const players = new Map((playersResult.data || []).map(p => [p.id, p]));
    const key = seasonId + ":" + tickets.map(t => `${t.id}:${t.player_id}:${t.amount}:${t.paid ? 1 : 0}`).join("|");
    if (key === lastKey && card.querySelector(".finance-ticket-display")) return;
    lastKey = key;

    const rows = tickets.map(ticket => {
      const player = players.get(ticket.player_id);
      return `<div class="finance-ticket-display-row"><div><b>${esc(player?.name || "Unknown player")}</b></div><div>€${Number(ticket.amount || 0).toFixed(2)}</div><div>${ticket.paid ? '<span class="badge badge-green">Paid</span>' : '<span class="badge badge-amber">Unpaid</span>'}</div></div>`;
    }).join("");

    let body = card.querySelector(".finance-ticket-display");
    if (!body) {
      body = document.createElement("div");
      body.className = "finance-ticket-display";
      card.appendChild(body);
    }
    body.className = "finance-ticket-display" + (tickets.length ? "" : " empty");
    body.innerHTML = tickets.length
      ? `<div class="finance-ticket-display-head"><span>PLAYER</span><span>AMOUNT</span><span>STATUS</span></div>${rows}`
      : "No season-ticket players.";
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(() => {}), 80);
  }

  document.addEventListener("change", event => {
    if (event.target?.matches("select")) {
      lastKey = "";
      schedule();
    }
  });
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
