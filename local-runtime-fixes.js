(() => {
  "use strict";
  // Keep legacy UI hooks harmless when the old helper script is not loaded.
  window.removeLegacySeasonPaidField ||= () => {};
  window.removeLegacySeasonPaidColumn ||= () => {};
})();
