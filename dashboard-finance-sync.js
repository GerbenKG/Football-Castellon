(() => {
  "use strict";
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

  const update = () => {
    const stats = document.querySelectorAll(".stats .stat");
    if (stats.length < 4) return;
    const labels = ["THIS GAME · PLAYING", "THIS GAME · PRESENT", "THIS SEASON · SEASON TICKETS", "THIS GAME · PAYMENTS DUE"];
    labels.forEach((text, i) => {
      const el = stats[i]?.querySelector("small");
      if (el) el.textContent = text;
    });

    // Payments Due is deliberately simple: use the Game Squad's payment status.
    // No Finance query, no async calculation, and therefore no value jumping.
    const squadRows = document.querySelectorAll(".game-squad .squad-row, .game-squad tbody tr, [data-game-squad] .squad-row");
    let due = 0;
    squadRows.forEach(row => {
      const text = norm(row.textContent);
      const paid = row.querySelector('input[type="checkbox"][data-paid], input[type="checkbox"]');
      if (text.includes("season unpaid") && paid && !paid.checked) due++;
    });

    const dueStrong = stats[3]?.querySelector("strong");
    if (dueStrong) dueStrong.textContent = String(due);
  };

  const app = document.getElementById("app");
  if (!app) return;
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; update(); });
  };
  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
})();
