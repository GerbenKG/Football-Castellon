(() => {
  "use strict";

  // Compatibility stubs for obsolete legacy cleanup calls.
  // The current data model no longer uses players.model or players.season_paid.
  // These no-op functions keep the remaining legacy startup calls harmless
  // until ui-fixes.js is fully retired.
  window.removeLegacySeasonPaidField = function removeLegacySeasonPaidField() {
    return;
  };

  window.removeLegacySeasonPaidColumn = function removeLegacySeasonPaidColumn() {
    return;
  };
})();
