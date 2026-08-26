(() => {
  "use strict";

  function syncProfileActive() {
    const profile = document.querySelector('.nav [data-member-profile], .nav [data-player-profile]');
    if (!profile) return;
    profile.classList.toggle('active', window.__memberView === 'profile');
  }

  document.addEventListener('click', event => {
    const item = event.target.closest('.nav .nav-item');
    if (!item) return;

    if (item.matches('[data-member-profile], [data-player-profile]')) {
      window.__memberView = 'profile';
    } else {
      window.__memberView = null;
    }
    syncProfileActive();
  }, true);

  const observer = new MutationObserver(syncProfileActive);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  syncProfileActive();
})();