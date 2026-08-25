(() => {
  "use strict";

  const sb = window.supabaseClient;
  const app = document.getElementById("app");
  if (!app) return;

  let financeCache = null;
  let loading = false;

  const esc = value => String(value ?? "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));

  const card = (icon, label, value) =>
    `<div class="stat"><div class="stat-icon">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`;

  const currentGameDate = () => {
    const hero = app.querySelector(".hero h1");
    const rows = app.querySelectorAll(".squad .squad-row");
    if (!hero && !rows.length) return null;

    // The dashboard already has the selected game in its hero. The game date is
    // also available in the rendered game-navigation buttons only indirectly, so
    // use the season containing today's/selected game when finance data is loaded.
    return null;
  };

  async function loadSeasonTicketCount() {
    if (!sb) return 0;
    if (financeCache !== null) return financeCache;

    const [seasons, tickets] = await Promise.all([
      sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on", { ascending: false }),
      sb.from("finance_season_tickets").select("id,season_id")
    ]);

    if (seasons.error || tickets.error) {
      console.warn("[Football] Could not load season-ticket stat", seasons.error || tickets.error);
      financeCache = 0;
      return 0;
    }

    const today = new Date().toISOString().slice(0, 10);
    const season = (seasons.data || []).find(s => today >= s.starts_on && today <= s.ends_on) || (seasons.data || [])[0];
    financeCache = season ? (tickets.data || []).filter(t => t.season_id === season.id).length : 0;
    return financeCache;
  }

  async function update() {
    const dashboard = !!app.querySelector(".hero") && !!app.querySelector(".squad");
    if (!dashboard) return;

    const stats = app.querySelector(".stats");
    if (!stats) return;

    // Do not let the old four-stat dashboard or the Present-removal observer
    // determine the final layout. Dashboard has exactly three stats now.
    stats.style.visibility = "hidden";

    const rows = [...app.querySelectorAll(".squad .squad-row")];
    const playing = rows.length;
    const paymentsDue = rows.filter(row => /season unpaid/i.test(row.textContent || "")).length;
    const seasonTickets = await loadSeasonTicketCount();

    // The Finance query is intentionally done once and cached. No intermediate
    // zero is rendered, so the stat cannot jump from the correct value to 0.
    stats.innerHTML =
      card("⚽", "THIS GAME · PLAYING", playing) +
      card("🎟", "THIS SEASON · SEASON TICKETS", seasonTickets) +
      card("€", "THIS GAME · PAYMENTS DUE", paymentsDue);

    stats.style.visibility = "visible";
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      try { await update(); } catch (error) { console.warn("[Football] Dashboard stats update failed", error); }
    });
  };

  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
})();
