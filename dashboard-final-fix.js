(() => {
  "use strict";

  const sb = window.supabaseClient;
  const app = document.getElementById("app");
  if (!sb || !app) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));
  const card = (icon, label, value) =>
    `<div class="stat"><div class="stat-icon">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`;

  let lastKey = "";

  async function sync() {
    const stats = app.querySelector(".hero + .stats");
    const squadRows = [...app.querySelectorAll(".squad-row")];
    if (!stats || !squadRows.length) return;

    // Keep this deliberately simple. The game stats are driven by the
    // Game Squad currently rendered on screen. This avoids a second
    // asynchronous source overwriting the values with zeroes.
    const playing = squadRows.length;
    let due = 0;
    squadRows.forEach(row => {
      const text = row.textContent || "";
      if (/Season unpaid/i.test(text)) {
        due += 1;
        return;
      }
      const paid = row.querySelector('input[data-t="paid"]');
      if (paid && !paid.checked) due += 1;
    });

    // Season-ticket count is the only dashboard stat that is not a
    // Game Squad value. Read the current season's Finance tickets.
    let seasonTickets = null;
    try {
      const { data, error } = await sb
        .from("finance_season_tickets")
        .select("id,season_id,paid");
      if (!error) {
        // The Finance page already exposes the current season in the DOM.
        // Prefer its selected season id when available.
        const financeSeason = app.querySelector("[data-finance-season-id]")?.getAttribute("data-finance-season-id");
        if (financeSeason) {
          seasonTickets = (data || []).filter(x => x.season_id === financeSeason).length;
        } else {
          // Fallback: use the largest current-season ticket set. This is
          // stable and does not affect the Game Squad payment calculation.
          const counts = new Map();
          (data || []).forEach(x => counts.set(x.season_id, (counts.get(x.season_id) || 0) + 1));
          seasonTickets = Math.max(0, ...counts.values());
        }
      }
    } catch (_) {}

    if (seasonTickets == null) return;

    const key = `${playing}|${seasonTickets}|${due}`;
    if (key === lastKey) return;
    lastKey = key;
    stats.innerHTML =
      card("⚽", "THIS GAME · PLAYING", playing) +
      card("🎟", "THIS SEASON · SEASON TICKETS", seasonTickets) +
      card("€", "THIS GAME · PAYMENTS DUE", due);
  }

  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 50);
  };

  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
})();
