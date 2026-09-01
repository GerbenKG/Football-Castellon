(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = { permissions: {}, profile: null };
  let players = [];
  let games = [];
  let seasons = [];
  let tickets = [];
  let gameId = null;
  let busy = false;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[c]));
  const can = permission => access.permissions?.[permission] === true || access.profile?.role === "super_admin";
  const dateText = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const shortDate = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const player = id => players.find(p => p.id === id);
  const currentGame = () => games.find(g => g.id === gameId) || games[0] || { participants: [] };
  const ticketFor = (playerId, date) => { const season = seasons.find(s => date >= s.starts_on && date <= s.ends_on); return season ? tickets.find(t => t.season_id === season.id && t.player_id === playerId) : null; };
  const seasonTicket = (playerId, date) => !!ticketFor(playerId, date);

  async function load() {
    const [accessResult, playersResult, gamesResult, rowsResult, seasonsResult, ticketsResult] = await Promise.all([
      sb.rpc("get_my_access"),
      sb.from("players").select("id,name,phone,email").order("name"),
      sb.from("games").select("*").order("game_date"),
      sb.from("game_players").select("*"),
      sb.from("finance_seasons").select("id,name,starts_on,ends_on,season_ticket_amount,pay_per_game_amount").order("starts_on", { ascending: false }),
      sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid,paid_on")
    ]);
    if (accessResult.error) throw accessResult.error;
    if (!accessResult.data?.allowed) throw new Error("Access denied");
    if (playersResult.error) throw playersResult.error;
    if (gamesResult.error) throw gamesResult.error;
    if (rowsResult.error) throw rowsResult.error;
    if (seasonsResult.error) throw seasonsResult.error;
    if (ticketsResult.error) throw ticketsResult.error;

    access = accessResult.data;
    players = playersResult.data || [];
    seasons = seasonsResult.data || [];
    tickets = ticketsResult.data || [];

    const rows = rowsResult.data || [];
    games = (gamesResult.data || []).map(g => ({
      id: g.id,
      date: g.game_date,
      startTime: String(g.start_time).slice(0, 5),
      endTime: String(g.end_time).slice(0, 5),
      time: String(g.start_time).slice(0, 5) + "–" + String(g.end_time).slice(0, 5),
      location: g.location,
      participants: rows.filter(x => x.game_id === g.id).map(x => ({
        rowId: x.id,
        playerId: x.player_id,
        guest: !x.player_id,
        name: x.guest_name,
        playing: !!x.playing,
        attended: !!x.attended,
        paid: !!x.paid,
        took_bibs: !!x.took_bibs
      }))
    }));

    if (!games.length) {
      gameId = null;
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    gameId = games.find(g => g.date >= today)?.id || games[0].id;
  }

  async function refresh() {
    await load();
    render();
  }

  function dashboardHtml() {
    const g = currentGame();
    const rows = g.participants || [];
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = g.date < today ? g.date : today;
    const currentSeason = seasons.find(s => cutoff >= s.starts_on && cutoff <= s.ends_on);
    const gamesToDate = currentSeason ? games.filter(x => x.date >= currentSeason.starts_on && x.date <= currentSeason.ends_on && x.date <= cutoff) : [];
    const playing = rows.filter(x => x.playing).length;
    const present = rows.filter(x => x.attended).length;
    const season = players.filter(p => seasonTicket(p.id, g.date));
    const pay = players.filter(p => !seasonTicket(p.id, g.date));
    const due = rows.filter(x => {
      if (x.guest) return !x.paid;
      const t = ticketFor(x.playerId, g.date);
      return t ? !t.paid : !x.paid;
    }).length;
    const attendanceRate = p => {
      const signups = gamesToDate.filter(x => (x.participants || []).some(r => !r.guest && r.playerId === p.id));
      return gamesToDate.length ? signups.length / gamesToDate.length * 100 : 0;
    };
    const all = players.length ? players.reduce((a, p) => a + attendanceRate(p), 0) / players.length : 0;
    const payAvg = pay.length ? pay.reduce((a, p) => a + attendanceRate(p), 0) / pay.length : 0;
    const gamesWithSignups = gamesToDate.filter(x => (x.participants || []).some(p => !p.guest)).length;
    const total = gamesToDate.reduce((a, x) => a + (x.participants || []).filter(p => !p.guest).length, 0);
    const avg = gamesToDate.length ? total / gamesToDate.length : 0;
    const paid = games.reduce((a, x) => a + (x.participants || []).filter(p => p.attended && !p.guest && !seasonTicket(p.playerId, x.date) && p.paid).length, 0);
    const payable = games.reduce((a, x) => a + (x.participants || []).filter(p => p.attended && !p.guest && !seasonTicket(p.playerId, x.date)).length, 0);
    const collection = payable ? paid / payable * 100 : 0;
    const leaders = [...players].sort((a, b) => attendanceRate(b) - attendanceRate(a)).slice(0, 5);

    const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const index = ordered.findIndex(x => x.id === g.id);
    const hasPrev = index > 0;
    const hasNext = index >= 0 && index < ordered.length - 1;

    return '<section class="hero"><div class="hero-pitch"></div><div class="hero-copy"><div class="game-nav">' +
      '<button class="game-arrow" data-dv-game-nav="prev" title="Previous game" aria-label="Previous game" ' + (!hasPrev ? 'disabled' : '') + '>←</button>' +
      '<div><div class="eyebrow light">GAME</div><h1>' + dateText(g.date) + '</h1><p>⚽ ' + esc(g.time) + ' · ' + esc(g.location) + '</p></div>' +
      '<button class="game-arrow" data-dv-game-nav="next" title="Next game" aria-label="Next game" ' + (!hasNext ? 'disabled' : '') + '>→</button>' +
      '</div>' + previousBibs(g) +
      '<div class="hero-actions">' +
      (can("attendance.manage") ? '<button class="btn btn-light" data-dv-action="add-player">+ Player</button><button class="btn btn-ghost" data-dv-action="guest">+ Guest</button>' : '') +
      '<button class="btn btn-ghost" data-dv-action="teams">⚽ Teams</button>' +
      '</div></div><div class="hero-ball">⚽</div></section>' +
      '<div class="stats"><div class="stat"><div class="stat-icon">⚽</div><div><small>PLAYING</small><strong>' + playing + '</strong></div></div>' +
      '<div class="stat"><div class="stat-icon">✓</div><div><small>PRESENT</small><strong>' + present + '</strong></div></div>' +
      '<div class="stat"><div class="stat-icon">🎟</div><div><small>SEASON TICKETS</small><strong>' + season.length + '</strong></div></div>' +
      '<div class="stat"><div class="stat-icon">€</div><div><small>PAYMENTS DUE</small><strong>' + due + '</strong></div></div></div>' +
      '<section class="analytics-grid"><div class="card analytics-card"><div class="card-title"><div><h3>Signup overview</h3><p>Signup rate for games in the current season to date.</p></div></div>' +
      '<div class="metric-row"><div><small>ALL PLAYERS</small><strong>' + all.toFixed(0) + '%</strong></div><div><small>PAY PER GAME</small><strong>' + payAvg.toFixed(0) + '%</strong></div><div><small>AVG SIGNUPS / GAME</small><strong>' + avg.toFixed(1) + '</strong></div></div></div>' +
      '<div class="card analytics-card"><div class="card-title"><div><h3>Payments</h3><p>Collection performance.</p></div></div><div class="progress-value"><strong>' + collection.toFixed(0) + '%</strong><span>' + paid + ' of ' + payable + ' game payments collected</span></div><div class="progress"><i style="width:' + collection + '%"></i></div><div class="mini-stats"><span>Season tickets paid <b>' + season.filter(p => ticketFor(p.id, g.date)?.paid).length + '/' + season.length + '</b></span><span>Games with signups <b>' + gamesWithSignups + '</b></span></div></div></section>' +
      '<section class="section"><div class="section-head"><div><h2>Attendance leaders</h2><p>Top players by signup rate.</p></div><button class="btn btn-secondary" data-view="players">View players →</button></div><div class="card leaders">' +
      leaders.map(p => '<div class="leader-row"><div class="who"><span class="avatar">' + esc(p.name).slice(0, 1).toUpperCase() + '</span><div><b>' + esc(p.name) + '</b><small>' + (seasonTicket(p.id, g.date) ? '🎟 Season ticket' : 'Per game') + '</small></div></div><strong>' + attendanceRate(p).toFixed(0) + '%</strong></div>').join('') +
      '</div></section>' +
      '<section class="section"><div class="section-head"><div><h2>Game squad</h2><p>Manage attendance and payment for this match.</p></div></div><div class="squad card">' +
      rows.map(x => squadRow(x, g)).join('') +
      '</div></section>';
  }

  function previousBibs(g) {
    const ordered = [...games].filter(x => x.date < g.date).sort((a, b) => b.date.localeCompare(a.date));
    const previous = ordered[0];
    if (!previous) return '';
    const bibber = (previous.participants || []).find(x => x.took_bibs && !x.guest);
    const name = bibber ? player(bibber.playerId)?.name : null;
    return '<div class="previous-bibs-banner">🦺 Previous game bibs: <strong>' + esc(name || 'Unknown') + '</strong></div>';
  }

  function squadRow(x, g) {
    const p = x.guest ? null : player(x.playerId);
    const name = x.guest ? x.name : (p?.name || 'Player');
    const type = x.guest ? 'Guest' : seasonTicket(p?.id, g.date) ? '🎟 Season' : 'Per game';
    const ticket = p ? ticketFor(p.id, g.date) : null;
    const payLabel = x.guest ? (x.paid ? 'Paid' : 'Due') : ticket ? (ticket.paid ? 'Season paid' : 'Season unpaid') : (x.paid ? 'Paid' : 'Mark paid');
    const pc = x.guest || seasonTicket(p?.id, g.date) ? ((ticket?.paid || x.paid) ? 'green' : 'amber') : (x.paid ? 'green' : 'red');
    return '<div class="squad-row"><div class="who"><span class="avatar">' + esc(name).slice(0, 1).toUpperCase() + '</span><div><b>' + esc(name) + '</b><small>' + type + '</small></div></div>' +
      (can("attendance.manage") ? '<label class="toggle"><input type="checkbox" data-dv-toggle="attended" data-id="' + esc(x.rowId) + '" ' + (x.attended ? 'checked' : '') + '><span>Present</span></label>' : '<span>' + (x.attended ? 'Present' : 'Not present') + '</span>') +
      (can("payments.manage") && (x.guest || !seasonTicket(p?.id, g.date)) ? '<label class="toggle payment-toggle"><input type="checkbox" data-dv-toggle="paid" data-id="' + esc(x.rowId) + '" ' + (x.paid ? 'checked' : '') + '><span>Paid</span></label>' : '<span class="badge badge-' + pc + '">' + esc(payLabel) + '</span>') +
      (can("attendance.manage") ? '<button class="remove" data-dv-action="remove" data-id="' + esc(x.rowId) + '">×</button>' : '') + '</div>';
  }

  async function chooseTeams() {
    const g = currentGame();
    const squad = (g.participants || []).filter(x => x.playerId || x.guest).map((x, i) => ({ id: x.playerId || ('guest-' + i), name: x.guest ? x.name : player(x.playerId)?.name || 'Player', skill: x.guest ? 3 : Number(player(x.playerId)?.skill_level || 3), guest: x.guest }));
    const count = Number(prompt('How many teams? Enter 2 or 3.', '2'));
    if (![2, 3].includes(count)) return;
    if (squad.length < count) return alert('There are not enough players for ' + count + ' teams.');
    squad.sort((a, b) => b.skill - a.skill || a.name.localeCompare(b.name));
    const teams = Array.from({ length: count }, (_, i) => ({ name: 'Team ' + String.fromCharCode(65 + i), players: [], total: 0 }));
    squad.forEach(p => { teams.sort((a, b) => a.total - b.total || a.players.length - b.players.length); teams[0].players.push(p); teams[0].total += p.skill; });
    const body = teams.map(t => '<section class="card analytics-card"><div class="card-title"><div><h3>' + esc(t.name) + '</h3><p>Skill total: ' + t.total + '</p></div></div><div class="history-list">' + t.players.map(p => '<div class="history-row"><b>' + esc(p.name) + '</b></div>').join('') + '</div></section>').join('');
    document.getElementById('modal-root').innerHTML = '<div class="modal-bg"><div class="modal" style="max-width:760px"><div class="modal-head"><h2>Suggested teams</h2><button class="remove" data-dv-close type="button">×</button></div><div class="analytics-grid" style="grid-template-columns:repeat(' + count + ',minmax(0,1fr))">' + body + '</div><div class="modal-actions"><button class="btn btn-secondary" data-dv-close>Close</button></div></div></div>';
  }

  async function addPlayer() {
    const g = currentGame();
    const used = new Set((g.participants || []).filter(x => !x.guest).map(x => x.playerId));
    const available = players.filter(p => !used.has(p.id));
    document.getElementById('modal-root').innerHTML = '<div class="modal-bg"><div class="modal"><div class="modal-head"><h2>Add player to game</h2><button class="remove" data-dv-close>×</button></div><form id="dv-pick-form"><label>Player<select name="id" required>' + available.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('') + '</select></label>' + (!available.length ? '<p class="notice">Everyone on the roster is already assigned.</p>' : '') + '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-dv-close>Cancel</button><button class="btn btn-primary" ' + (!available.length ? 'disabled' : '') + '>Add player</button></div></form></div></div>';
  }

  async function addGuest() {
    document.getElementById('modal-root').innerHTML = '<div class="modal-bg"><div class="modal"><div class="modal-head"><h2>Add guest</h2><button class="remove" data-dv-close>×</button></div><form id="dv-guest-form"><label>Guest name<input name="name" required autofocus></label><p class="notice">Guest payment is tracked for this game only.</p><div class="modal-actions"><button type="button" class="btn btn-secondary" data-dv-close>Cancel</button><button class="btn btn-primary">Add guest</button></div></form></div></div>';
  }

  async function saveToggle(rowId, field, checked) {
    const payload = { [field]: checked };
    if (field === 'attended' && !checked) payload.paid = false;
    const result = await sb.from('game_players').update(payload).eq('id', rowId);
    if (result.error) throw result.error;
    await refresh();
  }

  async function removeRow(rowId) {
    const g = currentGame();
    const row = (g.participants || []).find(x => x.rowId === rowId);
    if (!row) return;
    const name = row.guest ? row.name : player(row.playerId)?.name || 'Player';
    if (!confirm('Remove ' + name + ' from this Game squad?')) return;
    const result = await sb.from('game_players').delete().eq('id', rowId);
    if (result.error) throw result.error;
    await refresh();
  }

  async function handleAction(action, id) {
    if (busy) return;
    if (action === 'teams') return chooseTeams();
    if (action === 'add-player') return addPlayer();
    if (action === 'guest') return addGuest();
    if (action === 'remove') return removeRow(id);
  }

  document.addEventListener('click', async event => {
    if (!document.querySelector('.nav-item.active[data-view="dashboard"]')) return;
    const close = event.target.closest('[data-dv-close]');
    if (close) { event.preventDefault(); document.getElementById('modal-root').innerHTML = ''; return; }
    const action = event.target.closest('[data-dv-action]');
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      try { await handleAction(action.dataset.dvAction, action.dataset.id); } catch (error) { alert(error.message || 'Could not complete action.'); }
      return;
    }
    const nav = event.target.closest('[data-dv-game-nav]');
    if (nav && !nav.disabled) {
      event.preventDefault();
      const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      const i = ordered.findIndex(x => x.id === gameId);
      const next = nav.dataset.dvGameNav === 'next' ? ordered[i + 1] : ordered[i - 1];
      if (next) { gameId = next.id; render(); }
    }
  }, true);

  document.addEventListener('change', async event => {
    if (!document.querySelector('.nav-item.active[data-view="dashboard"]')) return;
    const toggle = event.target.closest('[data-dv-toggle]');
    if (!toggle) return;
    try { await saveToggle(toggle.dataset.id, toggle.dataset.dvToggle, toggle.checked); } catch (error) { alert(error.message || 'Could not save change.'); render(); }
  }, true);

  document.addEventListener('submit', async event => {
    if (!document.querySelector('.nav-item.active[data-view="dashboard"]')) return;
    if (event.target.id === 'dv-pick-form') {
      event.preventDefault();
      const id = new FormData(event.target).get('id');
      const g = currentGame();
      if (!id || !g) return;
      const result = await sb.from('game_players').insert({ game_id: g.id, player_id: id, guest_name: null, playing: true, attended: false, paid: false }).select('*').single();
      if (result.error) return alert(result.error.message);
      document.getElementById('modal-root').innerHTML = '';
      await refresh();
    }
    if (event.target.id === 'dv-guest-form') {
      event.preventDefault();
      const name = String(new FormData(event.target).get('name') || '').trim();
      if (!name) return;
      const g = currentGame();
      const result = await sb.from('game_players').insert({ game_id: g.id, player_id: null, guest_name: name, playing: true, attended: false, paid: false });
      if (result.error) return alert(result.error.message);
      document.getElementById('modal-root').innerHTML = '';
      await refresh();
    }
  }, true);

  function render() {
    if (!document.querySelector('.nav-item.active[data-view="dashboard"]')) return;
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = dashboardHtml();
    document.querySelectorAll('#app [data-view]').forEach(button => {
      button.onclick = () => {
        if (button.dataset.view === 'players') {
          document.querySelector('.nav-item[data-view="players"]')?.click();
        }
      };
    });
  }

  async function start() {
    if (!document.querySelector('.nav-item.active[data-view="dashboard"]')) return;
    try { await load(); render(); } catch (error) { console.error('[Football] Dashboard view failed', error); }
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('.nav-item[data-view="dashboard"]');
    if (!nav) return;
    setTimeout(() => start(), 0);
  }, true);

  setTimeout(start, 0);
})();
