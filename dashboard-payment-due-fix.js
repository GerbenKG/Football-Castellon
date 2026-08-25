(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;
  let running = false;
  async function fix() {
    if (running) return;
    const stats = document.querySelectorAll('.stats .stat');
    if (stats.length < 4) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;
    running = true;
    try {
      const dateText = hero.querySelector('h1')?.textContent?.trim();
      const games = await sb.from('games').select('id,game_date');
      if (games.error) throw games.error;
      const game = (games.data || []).find(g => new Date(g.game_date + 'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}) === dateText);
      if (!game) return;
      const seasons = await sb.from('finance_seasons').select('id,starts_on,ends_on');
      const tickets = await sb.from('finance_season_tickets').select('season_id,player_id,paid');
      const squad = await sb.from('game_players').select('game_id,player_id,guest_name,paid');
      if (seasons.error || tickets.error || squad.error) throw seasons.error || tickets.error || squad.error;
      const season = (seasons.data || []).find(s => game.game_date >= s.starts_on && game.game_date <= s.ends_on);
      if (!season) return;
      const seasonTickets = (tickets.data || []).filter(t => t.season_id === season.id);
      const ticketed = new Map(seasonTickets.map(t => [t.player_id, t]));
      const rows = (squad.data || []).filter(r => r.game_id === game.id);
      let due = 0;
      rows.forEach(r => {
        if (r.player_id && ticketed.has(r.player_id)) {
          if (!ticketed.get(r.player_id).paid) due++;
        } else if (!r.paid) {
          due++;
        }
      });
      const seasonEl = stats[2].querySelector('strong');
      const dueEl = stats[3].querySelector('strong');
      if (seasonEl) seasonEl.textContent = String(seasonTickets.length);
      if (dueEl) dueEl.textContent = String(due);
      stats[2].style.visibility = 'visible';
      stats[3].style.visibility = 'visible';
      stats[2].querySelector('small').textContent = 'THIS SEASON · SEASON TICKETS';
      stats[3].querySelector('small').textContent = 'THIS GAME · PAYMENTS DUE';
    } catch (e) {
      console.warn('[Football] Finance payment due fix failed', e);
    } finally {
      running = false;
    }
  }
  new MutationObserver(m => {
    if (m.some(x => [...x.addedNodes].some(n => n.nodeType === 1))) setTimeout(fix, 30);
  }).observe(document.getElementById('app'), {childList:true,subtree:true});
  setTimeout(fix, 100);
})();
