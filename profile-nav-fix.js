(() => {
  "use strict";

  function syncProfileActive() {
    const profile = document.querySelector('.nav [data-member-profile], .nav [data-player-profile]');
    if (!profile) return;
    profile.classList.toggle('active', window.__memberView === 'profile');
  }

  document.addEventListener('click', event => {
    const item = event.target.closest('.nav .nav-item');
    if (item) {
      if (item.matches('[data-member-profile], [data-player-profile]')) {
        window.__memberView = 'profile';
      } else {
        window.__memberView = null;
      }
      syncProfileActive();
    }

    const profileAction = event.target.closest('#member-user-menu [data-user-action="profile"]');
    if (profileAction && !document.querySelector('[data-member-profile], [data-player-profile]')) {
      const nav = document.querySelector('.nav') || document.body;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'nav-item';
      trigger.dataset.memberProfile = 'true';
      trigger.style.display = 'none';
      nav.appendChild(trigger);
      trigger.click();
      setTimeout(() => trigger.remove(), 0);
    }
  }, true);

  const observer = new MutationObserver(syncProfileActive);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  syncProfileActive();
})();