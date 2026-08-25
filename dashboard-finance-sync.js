(() => {
  "use strict";

  const update = () => {
    const stats = document.querySelectorAll(".stats .stat");
    if (stats.length < 4) return;

    const labels = [
      "THIS GAME · PLAYING",
      "THIS GAME · PRESENT",
      "THIS SEASON · SEASON TICKETS",
      "THIS GAME · PAYMENTS DUE"
    ];
    labels.forEach((text, i) => {
      const el = stats[i]?.querySelector("small");
      if (el) el.textContent = text;
    });

    // Payments Due = Season unpaid entries in the current Game Squad.
    // Keep this local to the rendered squad: no Finance query and no async value changes.
    const rows = document.querySelectorAll(".squad .squad-row");
    const due = [...rows].filter(row => /season unpaid/i.test(row.textContent || "")).length;

    const dueStrong = stats[3]?.querySelector("strong");
    if (dueStrong) dueStrong.textContent = String(due);
  };

  const app = document.getElementById("app");
  if (!app) return;

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  };

  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
})();
