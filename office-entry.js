(() => {
  const link = document.createElement('a');
  link.href = '/#office'; link.className = 'btn btn-secondary'; link.textContent = '← Clubhouse';
  document.querySelector('.top-actions').prepend(link);
  document.querySelector('.brand').textContent = 'FC Castellón';
  document.querySelector('.sub').textContent = 'Club Office · Management tools';
  document.title = 'Club Office · FC Castellón';
})();
