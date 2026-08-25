(() => {
  "use strict";

  // Legacy cleanup hook kept for older UI-fixes code. The current data model
  // no longer uses players.model or players.season_paid, so there is nothing
  // to migrate or render here. Keeping the hook defined prevents old startup
  // code from aborting the application with a ReferenceError.
  window.removeLegacySeasonPaidField = function removeLegacySeasonPaidField() {
    return;
  };
})();
