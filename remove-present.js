(() => {
  "use strict";

  // "Present" is no longer a separate Game Squad field.
  // Do not wrap or proxy Supabase requests here: that breaks the Supabase
  // query builder (notably cloneRequestState) and causes intermittent alerts.
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
