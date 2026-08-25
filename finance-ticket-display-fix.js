(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));

  let timer = null;
  let lastKey = "";

  async function renderSeasonTickets() {
    const select = document.getElementById("finance-season-select");
    if (!select?.value) return;

    const seasonId = select.value;
    const target = [...document.querySelectorAll("h2")].find(h => h.textContent.trim() === "Season ticket holders");
    if (!target) return;
    const card = target.closest(".card");
    if (!card) return;

    const result = await Promise.all([
      sb.from("finance_season_tickets").select("id,player_id,amount,paid,paid_on").eq("season_id", seasonId),
      sb.from("players").select("id,name").order("name")
    ]);
    if (result[0].error || result[1].error) return;

    const tickets = result[0].data || [];
    const players = new Map((result[1].data || []).map(p => [p.id, p]));
    const key = seasonId + ":" + tickets.map(t => `${t.id}:${t.player_id}:${t.amount}:${t.paid}`).join("|");
    if (key === lastKey && card.querySelector(".finance-ticket-display")) return;
    lastKey = key;

    const header = card.querySelector(".card-title, .section-head") || target.parentElement;
    const existingButton = card.querySelector("#finance-add-ticket")?.outerHTML || "";
    const rows = tickets.map(ticket => {
      const player = players.get(ticket.player_id);
      return `<div class="finance-ticket-display-row"><div><b>${esc(player?.name || "Unknown player")}</b></div><div>€${Number(ticket.amount || 0).toFixed(2)}</div><div>${ticket.paid ? '<span class="badge badge-green">Paid</span>' : '<span class="badge badge-amber">Unpaid</span>'}</div></div>`;
    }).join("");

    const body = tickets.length
      ? `<div class="finance-ticket-display"><div class="finance-ticket-display-head"><span>PLAYER</span><span>AMOUNT</span><span>STATUS</span></div>${rows}</div>`
      : `<div class="finance-ticket-display empty">No season-ticket players.</div>`;

    if (header) {
      const headerHtml = header.outerHTML;
      card.innerHTML = headerHtml + body;
      if (existingButton && !card.querySelector("#finance-add-ticket")) {
        const head = card.querySelector(".card-title, .section-head");
        if (head) head.insertAdjacentHTML("beforeend", existingButton);
      }
    } else {
      card.innerHTML = body;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => renderSeasonTickets().catch(() => {}), 50);
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("change", e => {
    if (e.target?.id === "finance-season-select") {
      lastKey = "";
      schedule();
    }
  });
  schedule();
})();
