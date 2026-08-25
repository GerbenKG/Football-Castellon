(() => {
  "use strict";

  // Obsolete legacy cleanup functions must exist because older UI code may call them.
  // The current data model no longer uses players.model or players.season_paid.
  window.removeLegacySeasonPaidField = window.removeLegacySeasonPaidField || function () {};
  window.removeLegacySeasonPaidColumn = window.removeLegacySeasonPaidColumn || function () {};

  const removePresentUi = () => {
    document.querySelectorAll("label.toggle").forEach(label => {
      if (/\bPresent\b/i.test(label.textContent || "")) label.remove();
    });

    document.querySelectorAll(".stat").forEach(stat => {
      const label = stat.querySelector("small");
      if (label && /^PRESENT$/i.test(label.textContent.trim())) stat.remove();
    });

    document.querySelectorAll(".game-overview-stats > div").forEach(item => {
      if (/^Present$/i.test(item.textContent.trim().replace(/\s+/g, " "))) item.remove();
    });
  };

  removePresentUi();
  new MutationObserver(removePresentUi).observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });
})();
