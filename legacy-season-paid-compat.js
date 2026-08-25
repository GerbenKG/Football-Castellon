(() => {
  "use strict";

  // Compatibility stubs for obsolete legacy cleanup calls.
  // The current data model no longer uses players.model or players.season_paid.
  // Expose the functions both on window and as global var bindings so older
  // startup code can call them safely without a ReferenceError.
  var removeLegacySeasonPaidField = window.removeLegacySeasonPaidField = function removeLegacySeasonPaidField() {
    return;
  };

  var removeLegacySeasonPaidColumn = window.removeLegacySeasonPaidColumn = function removeLegacySeasonPaidColumn() {
    return;
  };
})();
