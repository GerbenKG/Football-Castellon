(() => {
  const query = new URLSearchParams(location.search);
  const views = ['dashboard', 'players', 'games', 'finance', 'admin'];
  const target = query.get('view');
  let opened = false;
  const observer = new MutationObserver(() => {
    if (opened || !document.querySelector('.nav') || document.querySelector('#google-login') || !document.querySelector('#signOut:not([style*="display: none"])')) return;
    const item = views.includes(target) ? document.querySelector('.nav [data-view="' + target + '"]') : null;
    if (!item || item.style.display === 'none') return;
    opened = true;
    observer.disconnect();
    window.openClubOffice?.(target, query.get('game'));
  });
  observer.observe(document.getElementById('app'), {childList: true, subtree: true});
  const link = document.createElement('a');
  link.href = '/#office'; link.className = 'btn btn-secondary'; link.textContent = '← Clubhouse';
  document.querySelector('.top-actions').prepend(link);
  document.querySelector('.brand').textContent = 'FC Castellón';
  document.querySelector('.sub').textContent = 'Club Office · Management tools';
  document.title = 'Club Office · FC Castellón';
})();
