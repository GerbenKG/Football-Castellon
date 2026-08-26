(() => {
  "use strict";

  function cleanup() {
    const form = document.getElementById("member-form");
    if (!form) return;

    const fields = [...form.querySelectorAll('select[name="player_id"]')];
    if (fields.length <= 1) return;

    const keep = fields[0];
    fields.slice(1).forEach(select => {
      const label = select.closest("label");
      if (label) label.remove();
      else select.remove();
    });

    keep.closest("label")?.setAttribute("id", "player-member-link-field");
  }

  const observer = new MutationObserver(cleanup);
  observer.observe(document.body, { childList: true, subtree: true });
  cleanup();
})();
