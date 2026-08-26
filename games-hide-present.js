(() => {
  "use strict";

  function isGamesPage() {
    return !!document.querySelector('.nav-item.active[data-view="games"]');
  }

  function hidePresentStat() {
    if (!isGamesPage()) return;
    document.querySelectorAll(".game-overview-stats > div").forEach(stat => {
      const label = stat.querySelector("span")?.textContent?.trim().toLowerCase();
      if (label === "present") stat.remove();
    });
  }

  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(hidePresentStat, 0);
  };

  schedule();
  new MutationObserver(schedule).observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });
})();
