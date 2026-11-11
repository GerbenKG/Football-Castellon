(() => {
  'use strict';
  const api=window.api,M=window.ClubModel,root=document.getElementById('club-app'),dialog=document.getElementById('club-dialog');
  let data=null,payments=null,predictionsData=null,predictionsLoading=null,predictionsError='',paymentError='',filter='upcoming',predictionTab='next14',archiveSeason='',search='',sort='appearances',busy=false,lastFocus=null,refreshing=false,gameBadgeLoad=null;
  const gameClubBadges={};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const date=(v,options={day:'numeric',month:'short'})=>new Date(v+'T12:00:00').toLocaleDateString('en-GB',options);
  const fullDate=v=>date(v,{weekday:'long',day:'numeric',month:'long'});
  const time=g=>`${g.start_time.slice(0,5)}–${g.end_time.slice(0,5)}`;
  const player=id=>data.players.find(p=>p.id===id);
  const name=r=>r.player_id?(player(r.player_id)?.name||'Former player'):(r.guest_name||'Guest');
  const me=()=>player(data.user.player_id)?.name||data.user.display_name||'Club member';
  const can=p=>data?.permissions?.[p]===true;
  const board=()=>window.ClubAccessModel.isBoard(data?.user?.role);
  const role=()=>({super_admin:'Club board · Full access',admin:'Club board',attendance:'Match organiser',finance:'Club treasurer',viewer:'Club member',player:'Player'}[data.user.role]||'Club member');
  const initials=(s,large=false,id='')=>window.ClubAvatar.render(window.ClubAvatar.resolve(s,id),large);
  const memberLabel=(name,id='',person=null)=>window.ClubFavorites.label(name,id,person);
  const pill=(s,c='')=>`<span class="pill ${c}">${esc(s)}</span>`;
  const paths={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',squad:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',shirt:'<path d="m8 3-5 3-2 5 4 2 2-3v11h10V10l2 3 4-2-2-5-5-3c-1 4-7 4-8 0Z"/>',office:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-11 0v3h4v-3"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 0h8"/>',wallet:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z"/>',chart:'<path d="M4 20h17M7 16v-5m5 5V4m5 12V8"/>',news:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 8h10M7 12h4m-4 4h10"/>',logout:'<path d="M9 4H4v16h5m5-12 4 4-4 4m-6-4h13"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'};
  const icon=(n,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.home}</svg>`;
  const pitch=()=>`<div class="pitch-art" aria-hidden="true"><svg viewBox="0 0 300 430" fill="none" stroke="#d7e8ac" stroke-width="1.5"><rect x="18" y="20" width="264" height="390" rx="2"/><path d="M18 215h264M80 20v68h140V20M112 20v25h76V20M80 410v-68h140v68M112 410v-25h76v25"/><circle cx="150" cy="215" r="46"/><circle cx="150" cy="215" r="3" fill="#d7e8ac"/><path d="M112 88a45 45 0 0 0 76 0m-76 254a45 45 0 0 1 76 0"/></svg></div>`;
  const btn=(text,action,id='',style='primary')=>`<button class="btn btn-${style}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;
  const link=(text,href,style='outline')=>`<a class="btn btn-${style}" href="${esc(href)}">${text}</a>`;
  const heading=(tag,title,subtitle,action='')=>`<div class="page-heading"><div><div class="eyebrow">${esc(tag)}</div><h1 tabindex="-1">${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="actions">${action}</div></div>`;
  const empty=(title,body,ico='news')=>`<div class="empty">${icon(ico,26)}<strong>${esc(title)}</strong>${esc(body)}</div>`;
  const metric=(label,value,detail,ico)=>`<div class="metric">${icon(ico)}<span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`;
  const section=(title,body,action='',sub='')=>`<section><div class="section-title"><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>${action}</div>${body}</section>`;
  const route=()=>{const r=location.hash.slice(1).split('/');return {page:['clubhouse','matches','squad','playgame','myclub','office','match'].includes(r[0])?r[0]:(data&&!can('clubhouse.view')?'myclub':'clubhouse'),id:r[1]||''};};
  const environment=()=>location.hostname==='dev.castellon.futbol'?'DEV · LIVE DATA':location.hostname==='localhost'||location.hostname==='127.0.0.1'?'LOCAL · SAMPLE DATA':'';
  const nextMatch=()=>data.games.find(g=>!M.started(g));
  const currentTicket=()=>{const s=M.season(data);return s&&data.my_tickets.find(t=>t.season_id===s.id);};

  function shell(body){
    const r=route(),page=r.page==='match'?'matches':r.page;
    const nav=[...(can('clubhouse.view')?[['clubhouse','Clubhouse','home']]:[]),...(can('games.view')?[['matches','Matches','calendar']]:[]),...(can('squad.view')?[['squad','Squad','squad']]:[]),['playgame','Play a Game','trophy'],['myclub','My Club','shirt'],...(board()?[['office','Club Office','office']]:[])];
    const identity=`<a class="identity" href="#clubhouse"><img src="club-crest.svg" alt="FC Castellón crest"><div><strong>FC Castellón</strong><small>THE CLUBHOUSE</small></div></a>`;
    root.innerHTML=`<aside class="sidebar">${identity}<div class="nav-label">Your club</div><nav class="nav-links" aria-label="Club navigation">${nav.map(([id,label,ico])=>`<a href="#${id}" ${page===id?'class="active" aria-current="page"':''}>${icon(ico)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="club-motto"><p>Good football.<br>Better company.</p><small>CASTELLÓN · SPAIN</small></div><div class="account">${window.ClubAvatar.render(data.user)}<div><strong>${memberLabel(me(),data.user.player_id,data.user)}</strong><small>${esc(role())}</small></div></div><button class="signout" data-action="logout">Sign out</button></div></aside><div class="workspace"><header class="topbar"><div class="crumb">FC Castellón ${icon('chevron',12)} <b>${nav.find(n=>n[0]===page)?.[1]||'Match centre'}</b></div><a class="mobile-brand" href="#clubhouse"><img src="club-crest.svg" alt="">FC Castellón</a><div class="topbar-right">${environment()?`<span class="environment">${environment()}</span>`:''}<span class="fresh" id="freshness">Updated ${new Date(data.updated_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span><button class="icon-button" data-action="refresh" aria-label="Refresh club data" title="Refresh">${icon('refresh')}</button><button class="icon-button" data-action="logout" aria-label="Sign out" title="Sign out">${icon('logout')}</button></div></header><main id="content" class="content">${body}<footer class="club-footer"><span>FC Castellón · Good football. Better company.</span><span>Match times are shown in Castellón time · Europe/Madrid</span></footer></main></div>`;
  }

  function signupButton(g,style='primary'){
    if(M.started(g))return pill(M.ended(g)?'Full time':'In progress');
    if(!data.user.player_id)return pill('Ask the board to link your player','neutral');
    const status=M.signupState(data,g.id);
    const choice=(label,join)=>`<button class="btn btn-${style}" data-action="signup" data-id="${esc(g.id)}" data-join="${join?'true':'false'}">${label}</button>`;
    if(status==='playing')return `<div class="signup-actions"><span class="pill success">✓ You’re signed up to play</span>${choice("I’m out",false)}</div>`;
    if(status==='waiting')return `<div class="signup-actions"><span class="pill amber">You’re on the waiting list</span>${choice("I’m out",false)}</div>`;
    if(status==='out')return `<div class="signup-actions"><span class="pill neutral">You’ve opted out</span>${choice("I’m playing",true)}</div>`;
    return `<div class="signup-actions">${choice("I’m playing",true)}${choice("I’m out",false)}</div>`;
  }
  function bibsStatus(g){
    const info=M.bibs(data,g.id),names=items=>items.map(r=>memberLabel(player(r.player_id)?.name||'Former player',r.player_id)).join(', ');
    if(M.ended(g))return info.assigned.length?`<div class="hero-bibs"><span>Recorded bibs taker</span><strong>${names(info.assigned)}</strong></div>`:'';
    return `<div class="hero-bibs"><div><span>Bring the bibs</span><strong>${info.holder.length?names(info.holder):'Holder not recorded'}</strong></div><div><span>Wash after this match</span><strong>${info.assigned.length?names(info.assigned):'Not assigned yet'}</strong></div></div>`;
  }
  function hero(g,detail=false){
    if(!g)return `<section class="match-hero">${pitch()}<div><div class="eyebrow">The next chapter</div><h2>Another match.<br>More memories.</h2><p>The board will publish the next fixture here.</p></div></section>`;
    const count=M.squad(data,g.id).length,capacity=data.matches[g.id]?.capacity;
    return `<section class="match-hero">${pitch()}<div class="hero-top"><span class="eyebrow">${M.started(g)?'Match centre':'Next on the pitch'}</span>${pill(`${count}${capacity?' / '+capacity:''} players${capacity?' · '+Math.max(0,capacity-count)+' places left':''}`,'light')}</div><div style="position:relative"><h2>${detail?esc(date(g.game_date,{weekday:'long'}))+'<br>'+esc(date(g.game_date,{day:'numeric',month:'long'})):'Your club.<br>Your next match.'}</h2><p>${detail?'Bring your boots. We’ll bring the football.':'A game to look forward to. A squad to be part of.'}</p></div><div class="hero-bottom"><div class="hero-date"><strong>${esc(date(g.game_date,{weekday:'short',day:'numeric',month:'short'}))}</strong><span>${esc(time(g))} · ${esc(g.location)}</span></div>${detail?signupButton(g,'lime'):link('Match centre '+icon('arrow',14),'#match/'+g.id,'lime')}</div>${bibsStatus(g)}</section>`;
  }

  function clubhouse(){
    const g=nextMatch(),s=M.season(data),ticket=currentTicket(),st=data.user.player_id?M.stats(data,data.user.player_id):null;
    const recorded=M.recordedGames(data),total=recorded.reduce((n,g)=>n+M.squad(data,g.id).length,0),active=data.players.filter(p=>!p.archived_at);
    const leaders=active.map(p=>({...p,stats:M.stats(data,p.id)})).sort((a,b)=>b.stats.appearances-a.stats.appearances||a.name.localeCompare(b.name)).slice(0,5);
    const latest=[...data.games].reverse().find(g=>M.ended(g)&&data.matches[g.id]?.score_a!==undefined);
    const birthdayDate=(p)=>{if(!p.birthday_month||!p.birthday_day)return null;const today=data.server_date;let year=Number(today.slice(0,4));for(let offset=0;offset<8;offset++){const y=year+offset;if(Number(p.birthday_month)===2&&Number(p.birthday_day)===29&&new Date(Date.UTC(y,1,29)).getUTCMonth()!==1)continue;const candidate=`${y}-${String(p.birthday_month).padStart(2,'0')}-${String(p.birthday_day).padStart(2,'0')}`;if(candidate>=today)return candidate;}return null;};
    const birthdays=active.map(p=>({...p,nextBirthday:birthdayDate(p)})).filter(p=>p.nextBirthday).sort((a,b)=>a.nextBirthday.localeCompare(b.nextBirthday)||a.name.localeCompare(b.name)).slice(0,5);
    const birthdayHtml=birthdays.length?birthdays.map(p=>{const days=Math.round((Date.parse(p.nextBirthday+'T00:00:00Z')-Date.parse(data.server_date+'T00:00:00Z'))/86400000);return `<div class="birthday-row">${initials(p.name,false,p.id)}<span class="birthday-name">${memberLabel(p.name,p.id)}<small>${days===0?'Today':days===1?'Tomorrow':'In '+days+' days'}</small></span><strong>${esc(date(p.nextBirthday,{day:'numeric',month:'short'}))}</strong></div>`;}).join(''):empty('No birthdays added yet','Add your day and month in My Club → Edit my details.','squad');
    const posts=data.announcements.map(p=>`<article class="feed-post"><div class="post-meta">${pill('From the board')}<span>${esc(date(p.created_at.slice(0,10)))}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p><div class="post-author">${initials(p.author)} ${esc(p.author)}${can('clubhouse.manage')?`<button class="text-link" data-action="remove-post" data-id="${esc(p.id)}" style="margin-left:auto">Remove</button>`:''}</div></article>`).join('');
    const leaderHtml=recorded.length?leaders.map((p,i)=>`<button class="leader" data-action="player" data-id="${p.id}"><span class="rank">${String(i+1).padStart(2,'0')}</span>${initials(p.name,false,p.id)}<span class="leader-name">${memberLabel(p.name,p.id)}<small>${p.stats.streak>1?p.stats.streak+' consecutive matches':p.stats.rate+'% of recorded matches'}</small></span><strong>${p.stats.appearances}<span class="unit">apps</span></strong></button>`).join(''):empty('The season starts with you','Recorded appearances will build the leaderboard.','trophy');
    return heading(s?.name||'Welcome to the club','The clubhouse',`Good to see you, ${me().split(' ')[0]}. Here’s what’s happening at your club.`,can('games.manage')?btn(icon('plus',15)+' New match','fixture','','outline'):'')+
      `<div class="intro-grid">${hero(g)}<aside class="personal-card"><div><div class="eyebrow">Your season</div><h3>${ticket?'Season ticket holder':'Part of the squad'}</h3>${pill(ticket?(ticket.paid?'Ticket confirmed':'Ticket awaiting payment'):data.user.player_id?'Pay per game':'Club account',ticket&&!ticket.paid?'amber':'')}<p style="margin-top:12px">${st?st.appearances+' recorded appearances this season.':'Your club details, all in one place.'}</p></div><hr><div><div class="eyebrow">Your outstanding balance</div><div class="amount">${payments?money(payments.summary.outstanding):'—'}</div><p>${paymentError?'Payments temporarily unavailable':M.openPayments(payments).length?M.openPayments(payments).length+' open payment items':'You’re all up to date.'}</p></div><a class="text-link" href="#myclub">Go to My Club ${icon('arrow',14)}</a></aside></div>`+
      `<div class="stats-grid">${metric('The squad',active.length,'Active club players','squad')}${metric('Matches played',recorded.length,s?.name||'Recorded matches','calendar')}${metric('Average turnout',recorded.length?(total/recorded.length).toFixed(1):'—','Players per recorded match','chart')}${metric('Your appearances',st?.appearances??'—',st?st.rate+'% of recorded matches':'Link a player to your account','shirt')}</div>`+
      `<div class="club-grid"><div>${section('Around the club',`<div class="panel">${posts||empty('Your club noticeboard','Match news, club announcements and the little things that keep everyone connected.')}</div>`,can('clubhouse.manage')?btn(icon('plus',13)+' Post update','announcement','','outline'):'')}</div><div>${section('The regulars',`<div class="panel">${leaderHtml}</div>`,'<a class="text-link" href="#squad">Full squad '+icon('arrow',13)+'</a>','Most appearances this season')}<br>${section('Upcoming birthdays',`<div class="panel birthday-panel">${birthdayHtml}</div>`,'','Next five club birthdays')}${latest?`<div class="result-card"><div class="eyebrow">Last recorded result · ${esc(date(latest.game_date))}</div><div class="result-score"><span>Team A</span><strong>${data.matches[latest.id].score_a} : ${data.matches[latest.id].score_b}</strong><span>Team B</span></div><a class="text-link" href="#match/${latest.id}">Match report & voting ${icon('arrow',13)}</a></div>`:''}</div></div>`;
  }

  function matches(){
    let games=data.games.filter(g=>filter==='archive'?M.started(g):filter==='mine'?['playing','waiting'].includes(M.signupState(data,g.id))&&!M.started(g):!M.started(g));
    if(filter==='archive')games=games.filter(g=>!archiveSeason||(g.game_date>=data.seasons.find(s=>s.id===archiveSeason)?.starts_on&&g.game_date<=data.seasons.find(s=>s.id===archiveSeason)?.ends_on)).reverse();
    let month='';
    const items=games.map(g=>{const label=date(g.game_date,{month:'long',year:'numeric'}),newMonth=month!==label;month=label;const m=data.matches[g.id]||{},status=M.signupState(data,g.id);return `${newMonth?`<h2 class="month-label">${esc(label)}</h2>`:''}<div class="panel" style="margin-bottom:10px"><article class="fixture"><div class="fixture-date"><span>${date(g.game_date,{weekday:'short'})}</span><b>${date(g.game_date,{day:'numeric'})}</b></div><div class="fixture-main"><h3>${esc(g.location)}</h3><p>${esc(time(g))} · ${M.squad(data,g.id).length}${m.capacity?' / '+m.capacity:''} players${status==='playing'?' · You’re signed up':status==='waiting'?' · You’re on the waiting list':status==='out'?' · You’ve opted out':''}</p></div><div class="fixture-actions">${m.score_a!==undefined&&m.teams?.length!==3?pill(m.score_a+' : '+m.score_b):signupButton(g,'outline')}${link('Match centre '+icon('arrow',13),'#match/'+g.id,'outline')}${can('games.manage')&&!M.started(g)?btn('Delete match','delete-fixture',g.id,'outline'):''}</div></article></div>`;}).join('');
    return heading('Fixtures & results','The football comes first.','Find your next game, claim your place and relive the last one.',can('games.manage')?btn(icon('plus',15)+' New match','fixture'):'')+`<div class="filters" aria-label="Match filters">${[['upcoming','Upcoming'],['mine','My matches'],['archive','Season archive']].map(([v,t])=>`<button data-filter="${v}" class="${filter===v?'active':''}" aria-pressed="${filter===v}">${t}</button>`).join('')}</div>${filter==='archive'?`<label class="field" style="max-width:240px">Season<select id="archive-season"><option value="">All seasons</option>${data.seasons.map(s=>`<option value="${s.id}" ${archiveSeason===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`:''}${items||`<div class="panel">${empty('No matches here yet',filter==='mine'?'Join an upcoming match to see it here.':'The next fixtures will appear here when they’re available.','calendar')}</div>`}`;
  }

  function matchDetail(id){
    const back=route().page==='office'?'#office/matches':'#matches';
    const g=data.games.find(g=>g.id===id);if(!g)return heading('Match centre','Match not found','It may have been removed.','<a class="btn btn-outline" href="${back}">Back to matches</a>');
    const m=data.matches[id]||{},rows=M.squad(data,id),waiting=data.waiting.filter(w=>w.game_id===id).sort((a,b)=>a.joined_at.localeCompare(b.joined_at)),declined=(data.declined||[]).filter(r=>r.game_id===id),ended=M.ended(g),myPlaying=rows.some(r=>r.player_id===data.user.player_id);
    const people=rows.map(r=>`<div class="roster-person">${initials(name(r),false,r.player_id||r.id)}<span>${memberLabel(name(r),r.player_id||r.id)}<small>${r.player_id===data.user.player_id?'You':!r.player_id?'Guest':data.player_cards[r.player_id]?.position||'Club player'}${r.took_bibs?' · Bib duty':''}</small></span>${can('attendance.manage')?`<button class="btn btn-outline btn-small" data-office-action="remove-player" data-id="${r.id}">Remove</button>`:''}</div>`).join('');
    const sheetRows=[...rows,...(data.lineup_players||[]).filter(r=>r.game_id===id&&!rows.some(p=>p.id===r.id))];
    const teams=m.teams?`<div class="team-grid ${m.teams.length===3?'three-teams':''}">${m.teams.map((ids,i)=>`<div><h3><i class="team-tag ${i===1?'gold':i===2?'blue':''}"></i>Team ${['A','B','C'][i]}</h3>${ids.map(rid=>{const r=sheetRows.find(r=>r.id===rid);return r?`<p class="lineup-player">${initials(name(r),false,r.player_id||r.id)}<span>${memberLabel(name(r),r.player_id||r.id)}</span>${m.captains?.[i]===rid?' <span class="pill neutral">Captain</span>':''}</p>`:'';}).join('')}</div>`).join('')}</div>${m.teams.length===3?'<p class="office-footnote">Three-team session. The club’s single final-score record applies to two-team matches.</p>':''}`:empty('No saved team assignments',ended?'The playing list is recorded above. A full team split was not saved for this game.':'Auto-select two or three teams, review them and publish the line-up.','shirt');
    const captainHistory=m.recorded_captains?.length&&!m.captains?.some(Boolean)?`<div class="recorded-captains"><h3>Recorded captains</h3>${m.recorded_captains.map(c=>`<p>${esc(c.team_name.replace(/Green/g,'A').replace(/Gold/g,'B').replace(/Blue/g,'C'))} · ${memberLabel(player(c.player_id)?.name||'Former player',c.player_id)}</p>`).join('')}</div>`:'';
    const votes=data.votes[id]||{},voteTotal=Object.values(votes).reduce((a,b)=>a+b,0),top=Object.entries(votes).sort((a,b)=>b[1]-a[1]);
    const voting=ended&&m.score_a!==undefined&&m.teams?.length!==3?`<div class="panel panel-pad"><div class="eyebrow">Player of the match</div><h3 style="margin:12px 0">Give a teammate their flowers.</h3><p class="muted" style="font-size:12px">${voteTotal} vote${voteTotal===1?'':'s'} cast. ${top.length?esc(player(top[0][0])?.name||'A teammate')+' '+(top.filter(x=>x[1]===top[0][1]).length>1?'is jointly leading.':'is leading.'):''}</p>${myPlaying?`<label class="field" style="margin-top:16px">Your vote<select id="vote-player"><option value="">Choose a teammate</option>${rows.filter(r=>r.player_id&&r.player_id!==data.user.player_id).map(r=>`<option value="${r.player_id}" ${data.my_votes[id]===r.player_id?'selected':''}>${esc(name(r))}</option>`).join('')}</select></label>${btn(data.my_votes[id]?'Update my vote':'Cast my vote','vote',id,'outline')}`:'<p class="muted" style="font-size:11px;margin-top:15px">Voting is for the players who took part.</p>'}</div>`:'';
    return heading('Match centre',fullDate(g.game_date),`${time(g)} · ${g.location}`,`<a class="btn btn-outline" href="${back}">Back to matches</a>${can('games.manage')?btn('Edit fixture','fixture',id,'outline'):''}`)+
      (m.score_a!==undefined&&m.teams?.length!==3?`<div class="result-detail"><div class="eyebrow">Full time · FC Castellón</div><div class="result-score"><span>Team A</span><strong>${m.score_a} : ${m.score_b}</strong><span>Team B</span></div><p>${esc(g.location)}</p></div>`:hero(g,true))+
      `<div class="match-layout"><div class="stack">${section(`The squad · ${rows.length}`,`<div class="panel">${people?`<div class="roster">${people}</div>`:empty('The pitch is waiting','Be the first to put your name down.','squad')}</div>`,can('attendance.manage')?`<div class="actions">${['add-player','add-guest',...(rows.some(r=>r.player_id)?['bibs-auto','bibs']:[])].map(a=>`<button class="btn btn-outline btn-small" data-office-action="${a}" data-id="${id}">${{'add-player':'Add player','add-guest':'Add guest','bibs-auto':'Auto-assign bibs',bibs:'Change bib duty'}[a]}</button>`).join('')}</div>`:'')}${section('The line-ups',`<div class="panel panel-pad">${m.teams&&(m.teams.flat().length!==rows.length||rows.some(r=>!m.teams.flat().includes(r.id)))?'<p class="notice amber" style="margin-bottom:16px">The playing list has changed since this line-up was published. Review the teams before the game.</p>':''}${teams}${captainHistory}</div>`,can('games.manage')&&rows.length>=2?btn(m.teams?'Edit / auto-select teams':'Auto-select teams','lineup',id,'outline'):'')}${m.report?section('The match report',`<div class="panel panel-pad"><p class="inline-notes">${esc(m.report)}</p></div>`):''}${m.goals&&Object.values(m.goals).some(n=>n>0)?section('On the scoresheet',`<div class="panel">${Object.entries(m.goals).filter(([,n])=>n>0).map(([pid,n])=>`<div class="leader">${initials(player(pid)?.name||'Player')}<span class="leader-name">${memberLabel(player(pid)?.name||'Former player',pid)}</span><strong>${n}<span class="unit">goals</span></strong></div>`).join('')}</div>`):''}</div><aside class="stack"><div class="panel panel-pad"><div class="eyebrow">Match essentials</div><h3 style="margin:13px 0">${esc(g.location)}</h3><p class="muted" style="font-size:12px">${esc(fullDate(g.game_date))}<br>${esc(time(g))} · Castellón time</p>${m.notes?`<p class="inline-notes" style="margin-top:16px">${esc(m.notes)}</p>`:''}<div class="actions" style="margin-top:20px">${btn(icon('download',14)+' Add to calendar','calendar',id,'outline')}${can('games.manage')?btn('Match settings','settings',id,'outline'):''}</div></div>${waiting.length?`<div class="panel panel-pad"><h3>Waiting for a place · ${waiting.length}</h3><p class="muted" style="font-size:11px;margin:10px 0">When someone withdraws, the first waiting player joins automatically. Check your status here before kick-off.</p>${waiting.map((w,i)=>`<p style="font-size:12px;margin-top:10px">${i+1}. ${memberLabel(player(w.player_id)?.name||'Player',w.player_id)}${w.player_id===data.user.player_id?' · You':''}</p>`).join('')}</div>`:''}${can('attendance.manage')&&declined.length?'<div class="panel panel-pad"><h3>Not playing · '+declined.length+'</h3><p class="muted" style="font-size:11px;margin:8px 0 12px">Players who explicitly marked themselves as out for this match.</p>'+declined.map(r=>'<p style="font-size:12px;margin-top:8px">'+memberLabel(player(r.player_id)?.name||'Former player',r.player_id)+'</p>').join('')+'</div>':''}${voting}${can('games.manage')&&ended&&m.teams?.length!==3?`<div class="panel panel-pad"><h3>The final whistle</h3><p class="muted" style="font-size:12px;margin:8px 0 16px">Record the result and goalscorers to build the club’s history.</p>${btn(m.score_a!==undefined&&m.teams?.length!==3?'Edit result':'Record result','result',id)}</div>`:''}</aside></div>`;
  }

  function playerCards(){
    let players=data.players.filter(p=>!p.archived_at&&p.name.toLowerCase().includes(search.toLowerCase()));
    players=players.map(p=>({...p,stats:M.stats(data,p.id)})).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):b.stats.appearances-a.stats.appearances||a.name.localeCompare(b.name));
    return players.map(p=>{const c=data.player_cards[p.id]||{};return `<button class="player-card" data-action="player" data-id="${p.id}">${initials(p.name,true,p.id)}${c.number?`<span class="shirt-number">${c.number}</span>`:''}<h3>${memberLabel(p.name,p.id)}</h3><p>${esc(c.position||'Club player')}${p.id===data.user.player_id?' · You':''}</p><div class="player-card-bottom"><div><b>${p.stats.appearances}</b><small>Appearances</small></div><div><b>${p.stats.goals}</b><small>Recorded goals</small></div></div></button>`;}).join('')||empty('No players found','Try another name.','squad');
  }
  function squad(){return heading(M.season(data)?.name||'Meet the club','One club. All of us.','The people who make the football happen.',board()&&can('players.manage')?link('Manage players','#office/people','outline'):'')+`<div class="squad-tools"><input class="search" id="squad-search" type="search" placeholder="Find a teammate…" aria-label="Find a teammate" value="${esc(search)}"><label style="font-size:11px;color:var(--muted)">Sort <select id="squad-sort" style="padding:8px;border:1px solid var(--line);border-radius:7px;background:white"><option value="appearances" ${sort==='appearances'?'selected':''}>Appearances</option><option value="name" ${sort==='name'?'selected':''}>Name A–Z</option></select></label></div><div class="player-grid" id="player-grid">${playerCards()}</div><p class="muted" style="font-size:11px;margin-top:20px">Appearances use the playing lists of completed matches. Goals and results appear only when recorded by the board.</p>`;}

  function personalPaymentRows(){
    if(paymentError)return `<div class="notice amber">We couldn’t load your payments. ${btn('Try again','refresh','','outline')}</div>`;
    if(!payments)return empty('Loading your payments','Please wait a moment.','wallet');
    const items=[...payments.items].sort((a,b)=>Number(a.paid)-Number(b.paid)||b.date.localeCompare(a.date));
    return items.map(p=>{const pending=data.payment_reports.some(r=>r.id===p.id&&r.type===p.type&&r.status==='pending');return `<div class="payment-row"><div><h3>${esc(p.label)}</h3><p>${esc(date(p.date,{day:'numeric',month:'short',year:'numeric'}))}${p.date>data.server_date?' · Upcoming':''}${p.paid_on?' · Confirmed '+esc(date(p.paid_on)):''}</p></div><strong>${money(p.amount)}</strong><div class="actions">${pill(p.paid?'Confirmed':pending?'Awaiting confirmation':'Open',p.paid?'':pending?'neutral':'amber')}${!p.paid&&!pending?`<button class="btn btn-outline btn-small" data-action="report-payment" data-id="${p.id}" data-type="${p.type}">I’ve sent payment</button>`:''}</div></div>`;}).join('')||empty('No payment items','Your season ticket and match fees will appear here.','wallet');
  }
  function myclub(){
    const pid=data.user.player_id,st=pid?M.stats(data,pid):null,t=currentTicket(),s=M.season(data),c=data.player_cards[pid]||{};
    return heading('Your membership','My Club','Your football, your season ticket and your payments.')+`<div class="profile-banner">${window.ClubAvatar.render(data.user,true)}<div><h2>${memberLabel(me(),data.user.player_id,data.user)}</h2><p>${esc(c.position||'FC Castellón member')}${c.number?' · Shirt '+c.number:''} · ${esc(role())}</p></div>${btn('Edit my details','profile','','lime')}</div>${window.ClubFavorites.card(data.user)}${!pid?'<div class="notice amber">Your account isn’t linked to a player yet. Ask a board member to link your existing squad record before signing up.</div>':''}<div class="stats-grid">${metric('Your appearances',st?.appearances??'—',s?.name||'This season','shirt')}${metric('Attendance streak',st?.streak??'—','Consecutive recorded matches','chart')}${metric('Recorded goals',st?.goals??'—','From board match reports','trophy')}${metric('Outstanding',payments?money(payments.summary.outstanding):'—',M.openPayments(payments).length+' open items','wallet')}</div><div class="club-grid"><div>${section('Your payments',`<div class="panel">${personalPaymentRows()}</div>`,'','Only you and authorised board members can see these details.')}<div class="notice" style="margin-top:17px">Sending payment and confirming payment are separate steps. Use “I’ve sent payment” after making a transfer; the treasurer will check it before clearing your balance.</div></div><aside class="stack"><div class="panel panel-pad"><div class="eyebrow">Your season ticket</div><h3 style="margin:13px 0">${esc(s?.name||'No current season')}</h3>${pill(t?(t.paid?'Confirmed':'Awaiting payment'):'Pay per game',t&&!t.paid?'amber':'')}<p class="muted" style="font-size:12px;margin-top:13px">${t?'Your ticket covers match fees for this season.':"Your match fees are tracked individually. Contact the treasurer if you’d like a season ticket."}</p>${s?`<p class="muted" style="font-size:11px;margin-top:13px">${esc(date(s.starts_on))} – ${esc(date(s.ends_on,{day:'numeric',month:'short',year:'numeric'}))}</p>`:''}</div>${section('Your upcoming football',`<div class="panel">${data.games.filter(g=>!M.started(g)&&M.signupState(data,g.id)!=='out').slice(0,5).map(g=>`<a class="leader" href="#match/${g.id}" style="text-decoration:none"><span class="leader-name">${esc(date(g.game_date,{weekday:'short',day:'numeric',month:'short'}))}<small>${esc(time(g))} · ${M.signupState(data,g.id)==='waiting'?'Waiting list':'You’re playing'}</small></span>${icon('chevron',14)}</a>`).join('')||empty('Your next match is waiting','Put your name down in Matches.','calendar')}</div>`)}</aside></div>`;
  }

  function gameClubBadge(club){
    const key=String(club||'').toLowerCase();
    const favorite=data.players.map(p=>p.favorite_club).find(c=>c?.name?.toLowerCase()===key)||gameClubBadges[key];
    return favorite?.badge_id?'<img class="play-game-team-badge" src="/api/clubs.php?badge='+esc(favorite.badge_id)+'" alt="'+esc(club)+' badge" onerror="this.hidden=true">':'<span class="play-game-team-placeholder">⚽</span>';
  }
  function loadGameClubBadges(){
    if(gameBadgeLoad)return gameBadgeLoad;
    gameBadgeLoad=Promise.all(['Tottenham Hotspur','West Ham United'].map(async name=>{try{const result=await api.get('/api/clubs.php?q='+encodeURIComponent(name));const club=(result.clubs||[]).find(c=>c.name.toLowerCase()===name.toLowerCase());if(club)gameClubBadges[name.toLowerCase()]=club;}catch(_){}})).then(()=>{if(route().page==='playgame'&&route().id==='love-or-hate')render();});
    return gameBadgeLoad;
  }
  async function loadPredictions(){
    if(predictionsData)return predictionsData;
    if(!predictionsLoading){
      predictionsError='';
      predictionsLoading=api.get('/api/predictions.php')
        .then(r=>(predictionsData=r))
        .catch(e=>{predictionsError=e.message||'Unable to load predictions';throw e;})
        .finally(()=>{predictionsLoading=null;});
    }
    return predictionsLoading;
  }
  function playGame(){
    const games=[{id:'love-or-hate',title:'Love or Hate?',description:'Choose the clubs you love, and the ones you love to hate.',symbol:'♥'},{id:'league-predictions',title:'League Games Predictions',description:'Predict the scores of domestic league matches and climb the club leaderboard.',symbol:'⚽'}];
    return heading('Games & challenges','Play a Game','A little friendly competition away from the pitch.')+'<div class="play-game-tiles">'+games.map(g=>'<a class="play-game-tile" href="#playgame/'+g.id+'"><div class="play-game-tile-art"><span>'+esc(g.symbol)+'</span><small>FC CASTELLÓN</small></div><div class="play-game-tile-copy"><span class="eyebrow">CLUB GAME</span><h2>'+esc(g.title)+'</h2><p>'+esc(g.description)+'</p><span class="play-game-tile-link">Play now '+icon('arrow',14)+'</span></div></a>').join('')+'</div>';
  }
  function leaguePredictions(){
    // Start one request only. Once data is loaded, do not schedule another render
    // from every subsequent render (which would create an infinite render loop).
    if(!predictionsData&&!predictionsLoading){
      loadPredictions().then(()=>{
        if(route().page==='playgame'&&route().id==='league-predictions')render();
      }).catch(()=>{
        if(route().page==='playgame'&&route().id==='league-predictions')render();
      });
    }
    const payload=predictionsData,fixtures=payload?.fixtures||[],mine=payload?.my_predictions||{},now=Date.now();
    const future=fixtures.filter(f=>new Date(f.kickoff_utc.replace(' ','T')+'Z').getTime()>=now).sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc));
    const cutoff=now+(14*24*60*60*1000);
    const next14=future.filter(f=>new Date(f.kickoff_utc.replace(' ','T')+'Z').getTime()<cutoff);
    const later=future.filter(f=>new Date(f.kickoff_utc.replace(' ','T')+'Z').getTime()>=cutoff);
    const past=fixtures.filter(f=>new Date(f.kickoff_utc.replace(' ','T')+'Z').getTime()<now).sort((a,b)=>b.kickoff_utc.localeCompare(a.kickoff_utc));
    const selected=predictionTab==='past'?past:predictionTab==='later'?later:next14;
    const cards=selected.map(f=>{
      const kick=new Date(f.kickoff_utc.replace(' ','T')+'Z'),locked=now>=kick.getTime()-60000||Number(f.result_confirmed)===1,p=mine[String(f.id)]||{},played=p.predicted_home_score!==undefined,finished=Number(f.result_confirmed)===1;
      const kickoff=kick.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
      const score=finished?'<b>'+f.home_score+' : '+f.away_score+'</b>':'<span>vs</span>';
      const entry=locked?'<span class="pill neutral">'+(finished?'Full time':'Predictions closed')+'</span>':'<div class="prediction-inputs"><label>Home<input type="number" min="0" max="20" value="'+(played?p.predicted_home_score:'')+'" data-home-score></label><b>:</b><label>Away<input type="number" min="0" max="20" value="'+(played?p.predicted_away_score:'')+'" data-away-score></label><button class="btn btn-primary" data-action="save-prediction" data-id="'+f.id+'">'+(played?'Update':'Save prediction')+'</button></div>';
      return '<article class="prediction-fixture"><div class="prediction-meta"><span>'+esc(f.league_name)+' · '+esc(f.country)+'</span><span>'+esc(kickoff)+'</span></div><div class="prediction-teams"><div><img src="'+esc(f.home_team_logo||'')+'" alt="" onerror="this.hidden=true"><strong>'+esc(f.home_team_name)+'</strong></div><div class="prediction-score">'+score+'</div><div><img src="'+esc(f.away_team_logo||'')+'" alt="" onerror="this.hidden=true"><strong>'+esc(f.away_team_name)+'</strong></div></div><div class="prediction-entry">'+(played?'<span class="pill success">Your prediction: '+p.predicted_home_score+' – '+p.predicted_away_score+(p.scored_at?' · '+p.points_awarded+' pts':'')+'</span>':'<span class="muted">No prediction saved · 0 points if left blank</span>')+entry+'</div></article>';
    }).join('');
    const board=(payload?.leaderboard||[]).map((p,i)=>'<div class="prediction-leader"><span class="rank">'+(i+1)+'</span><strong>'+esc(p.name)+'</strong><b>'+Number(p.points||0)+' pts</b><span>'+Number(p.correct_games||0)+' correct</span></div>').join('');
    const tabs='<div class="prediction-tabs" role="tablist" aria-label="Fixture period"><button type="button" role="tab" aria-selected="'+(predictionTab==='next14'?'true':'false')+'" class="'+(predictionTab==='next14'?'active':'')+'" data-action="prediction-tab" data-id="next14">Next 2 weeks <span>'+next14.length+'</span></button><button type="button" role="tab" aria-selected="'+(predictionTab==='later'?'true':'false')+'" class="'+(predictionTab==='later'?'active':'')+'" data-action="prediction-tab" data-id="later">Later <span>'+later.length+'</span></button><button type="button" role="tab" aria-selected="'+(predictionTab==='past'?'true':'false')+'" class="'+(predictionTab==='past'?'active':'')+'" data-action="prediction-tab" data-id="past">Past games <span>'+past.length+'</span></button></div>';
    const fixtureContent=!payload?(predictionsError?'<div class="panel panel-pad"><strong>Predictions could not be loaded</strong><p class="muted">'+esc(predictionsError)+'</p><button class="btn btn-outline" data-action="retry-predictions">Try again</button></div>':'<div class="panel">'+empty('Loading fixtures','League fixtures and your predictions are being loaded.','clock')+'</div>'):!selected.length?'<div class="panel">'+empty(predictionTab==='past'?'No past games yet':predictionTab==='later'?'No later fixtures':'No fixtures in the next two weeks','Fixtures involving your selected clubs will appear here.','calendar')+'</div>':'<div class="prediction-fixtures">'+cards+'</div>';
    const leaderboard='<aside class="prediction-sidebar"><section class="prediction-leaderboard"><div class="section-title"><div><h2>Leaderboard</h2><p>Points and correct predictions.</p></div></div><div class="panel prediction-board">'+(board||'<div class="prediction-leader">No predictions scored yet.</div>')+'</div></section></aside>';
    return heading('League predictions','League Games Predictions','Predict domestic league fixtures involving clubs selected in My Club. Change your score until one minute before kick-off.','<a class="btn btn-outline" href="#playgame">'+icon('arrow',13)+' All games</a>')+'<div class="play-game-intro"><div class="eyebrow" style="color:#d7e8ac">HOW TO SCORE</div><h2>Know your football?</h2><p>Exact score: 3 points. Correct result (win, draw or loss): 1 point. Wrong prediction or no prediction: 0 points. Only domestic league matches are included.</p></div>'+(payload?'<div class="prediction-layout"><main class="prediction-main">'+tabs+fixtureContent+'</main>'+leaderboard+'</div>':fixtureContent);
  }
  function playLoveHate(){
    loadGameClubBadges();
    const clubs=new Map();
    for(const p of data.players){const c=p.favorite_club;if(c?.name)clubs.set(c.name.toLowerCase(),c.name);}
    ['Tottenham Hotspur','West Ham United'].forEach(n=>clubs.set(n.toLowerCase(),n));
    const rows=[...clubs.values()].sort((a,b)=>a.localeCompare(b));
    const counts=data.game_votes||{};
    const cards=rows.map(club=>{const c=counts[club.toLowerCase()]||{likes:0,dislikes:0};return '<article class="play-game-card"><div class="play-game-card-logo">'+gameClubBadge(club)+'</div><div class="play-game-card-main"><h3>'+esc(club)+'</h3><div class="play-game-counts"><span>👍 <b>'+(c.likes||0)+'</b> likes</span><span>👎 <b>'+(c.dislikes||0)+'</b> dislikes</span></div></div><div class="play-game-actions"><button class="btn btn-outline" data-action="club-vote" data-choice="like" data-club="'+esc(club)+'">Like</button><button class="btn btn-outline" data-action="club-vote" data-choice="dislike" data-club="'+esc(club)+'">Dislike</button></div></article>';}).join('');
    const log=(data.game_vote_log||[]).map(v=>'<div class="play-game-log-row"><b>'+esc(v.player_name)+'</b> '+(v.choice==='like'?'liked':'disliked')+' <strong>'+esc(v.club)+'</strong><small>'+esc(new Date(v.voted_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}))+'</small></div>').join('');
    return heading('Club rivalry','Love or Hate?','Choose Like or Dislike for the clubs below. Your vote can be cast more than once.','<a class="btn btn-outline" href="#playgame">'+icon('arrow',13)+' All games</a>')+'<div class="play-game-intro"><div class="eyebrow" style="color:#d7e8ac">LOVE OR HATE?</div><h2>Which side are you on?</h2><p>Club choices come from players’ My Club profiles. Every vote counts towards the club totals and appears in the voting log.</p></div>'+(!data.user.player_id?'<div class="notice amber">Your account needs to be linked to a player profile before you can vote.</div>':'')+'<div class="play-game-grid">'+cards+'</div><section style="margin-top:30px"><div class="section-title"><div><h2>Voting log</h2><p>Each entry shows the club and outcome that actually received the vote.</p></div></div><div class="panel play-game-log">'+(log||'<div class="play-game-log-row">No votes yet. Be the first to join in.</div>')+'</div></section>';
  }
  function office(){return board()?window.ClubOffice.render():heading('Club Office','Your club','Your membership is available in My Club.');}

  function render(){
    if(!data)return;
    if(route().page==='office'&&!board())history.replaceState(null,'','#myclub');
    window.ClubOffice.setContext(data,{esc,icon,money,date,fullDate,initials,heading,section,metric,pill,btn,memberLabel,showDialog,toast,refresh,render,matchDetail});
    const r=route(),permission={clubhouse:'clubhouse.view',matches:'games.view',match:'games.view',squad:'squad.view'}[r.page];
    const denied=permission&&!can(permission);
    shell(denied?heading('Your club','This page isn’t in your profile','A Club owner can update your page access. Your own membership and payments remain available.','<a class="btn btn-primary" href="#myclub">Go to My Club</a>'):r.page==='matches'?matches():r.page==='match'?matchDetail(r.id):r.page==='squad'?squad():r.page==='playgame'?(r.id==='love-or-hate'?playLoveHate():r.id==='league-predictions'?leaguePredictions():playGame()):r.page==='myclub'?myclub():r.page==='office'?office():clubhouse());
    document.title=`${r.page==='match'?'Match centre':r.page==='myclub'?'My Club':r.page==='office'?'Club Office':r.page==='squad'?'The squad':r.page==='playgame'?'Play a Game':r.page==='matches'?'Matches':'Clubhouse'} · FC Castellón`;
  }
  function toast(message){const t=document.getElementById('toast');t.textContent=message;t.classList.add('visible');clearTimeout(window.clubToastTimer);window.clubToastTimer=setTimeout(()=>t.classList.remove('visible'),4500);}
  function closeDialog(){dialog.close();lastFocus?.focus?.();}
  function showDialog(title,subtitle,body,onSubmit=null,submitLabel='Save changes'){
    dialog.classList.remove('lineup-dialog','favorite-dialog','game-vote-dialog');
    lastFocus=document.activeElement;
    dialog.innerHTML=`<div class="dialog-head"><div><h2 id="dialog-title">${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="icon-button" type="button" data-close-dialog aria-label="Close dialog">${icon('close')}</button></div>${onSubmit?'<form id="club-form">':''}${body}${onSubmit?`<p class="form-error" role="alert" id="form-error"></p><div class="form-actions"><button class="btn btn-outline" type="button" data-close-dialog>Cancel</button><button class="btn btn-primary" type="submit">${esc(submitLabel)}</button></div></form>`:''}`;
    dialog.showModal();
    dialog.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=closeDialog);
    if(onSubmit)dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;const b=e.submitter;busy=true;b.disabled=true;try{await onSubmit(new FormData(e.target));closeDialog();await refresh();toast('Saved to the club.');}catch(e){document.getElementById('form-error').textContent=e.message;}finally{busy=false;if(b.isConnected)b.disabled=false;}};
  }
  const field=(label,name,value='',type='text',extra='')=>`<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const textarea=(label,name,value='',max=2000)=>`<label class="field">${esc(label)}<textarea name="${name}" maxlength="${max}">${esc(value)}</textarea></label>`;
  const post=body=>api.post('/api/club.php',body);

  async function handleAction(action,id,button){
    const g=data?.games.find(g=>g.id===id),m=data?.matches[id]||{};
    if(action==='refresh'){await refresh();toast('Club data refreshed.');return;}
    if(action==='logout'){await window.ClubActivity.depart();await api.post('/api/auth/logout.php',{});window.ClubActivity.stop();location.href='/';return;}
    if(action==='signup'){
      const status=M.signupState(data,id),joining=button.dataset.join==='true';
      const update=async()=>{const r=await post({action:'signup',game_id:id,join:joining});await refresh();toast(r.waiting?'You’re on the waiting list.':r.playing?'You’re signed up to play.':'You’ve opted out of this match.');};
      if(!joining){showDialog('Confirm you’re not playing?',fullDate(g.game_date),'<p class="muted" style="font-size:13px">You’ll be marked as not playing for this match. If you’re currently signed up, your place will be released and may be offered to someone on the waiting list.</p>',update,'Yes, I’m out');return;}
      await update();return;
    }
    if(action==='announcement'){showDialog('A word from the board','Share something with the whole club.',field('Title','title','','text','required maxlength="100"')+textarea('Club update','body','',2000),f=>post({action,title:f.get('title'),body:f.get('body')}),'Publish update');return;}
    if(action==='remove-post'){showDialog('Remove this update?','It will disappear from the club noticeboard.','',()=>post({action:'remove_announcement',id:id.replace('announcement:','')}),'Remove update');return;}
    if(action==='settings'){showDialog('Match settings','Set the capacity and what your players need to know.',field('Player capacity (leave empty for no limit)','capacity',m.capacity??'','number','min="2" max="100"')+textarea('Match notes','notes',m.notes||'',1500)+'<p class="notice">A full match gets a waiting list. When a player withdraws or you increase capacity, waiting players are added automatically in order.</p>',f=>post({action:'match_settings',game_id:id,capacity:f.get('capacity')===''?null:Number(f.get('capacity')),notes:f.get('notes')}));return;}
    if(action==='delete-fixture'){
      showDialog('Delete this upcoming match?',fullDate(g.game_date),'<p class="notice amber">This permanently removes the fixture, its sign-ups, waiting list and match details. Players will no longer see it in the schedule. This action cannot be undone.</p><p class="muted" style="font-size:13px">Matches with recorded payments cannot be deleted. Resolve or refund those payments first.</p>',()=>post({action:'delete_fixture',game_id:id}),'Delete match');
      return;
    }
    if(action==='fixture'){
      showDialog(g?'Edit fixture':'A new date for the diary','All match times are in Castellón time.',field('Match date','date',g?.game_date||data.server_date,'date','required')+`<div class="form-grid">${field('Kick-off','start',g?.start_time.slice(0,5)||'19:30','time','required')}${field('Full time','end',g?.end_time.slice(0,5)||'21:30','time','required')}</div>`+field('Venue','location',g?.location||'Castellón','text','required maxlength="255"'),async f=>{const r=await post({action:'fixture',...(g?{id}:{}),date:f.get('date'),start:f.get('start'),end:f.get('end'),location:f.get('location')});location.hash='match/'+r.id;},'Save fixture');return;
    }
    if(action==='lineup'){await window.ClubLineup.open(data,id,{showDialog,post,esc,name,toast});return;}
    if(action==='result'){
      const rows=M.squad(data,id).filter(r=>r.player_id);
      showDialog('The final score','Only record what happened on the pitch.',`<div class="form-grid">${field('Team A','score_a',m.score_a??0,'number','required min="0" max="99"')}${field('Team B','score_b',m.score_b??0,'number','required min="0" max="99"')}</div>`+textarea('Match report (optional)','report',m.report||'')+`<details><summary style="font-size:12px;margin-bottom:12px">Add goalscorers (optional)</summary>${rows.map(r=>`<div class="goal-entry"><label for="goal-${r.player_id}">${esc(name(r))}</label><input id="goal-${r.player_id}" name="goals:${r.player_id}" type="number" min="0" max="99" value="${m.goals?.[r.player_id]||0}"></div>`).join('')}</details>`,f=>post({action:'result',game_id:id,score_a:Number(f.get('score_a')),score_b:Number(f.get('score_b')),report:f.get('report'),goals:Object.fromEntries(rows.map(r=>[r.player_id,Number(f.get('goals:'+r.player_id)||0)]))}),'Save result');return;
    }
    if(action==='vote'){const pid=document.getElementById('vote-player').value;if(!pid)throw new Error('Choose a teammate first.');await post({action,game_id:id,player_id:pid});await refresh();toast('Your vote is in.');return;}
    if(action==='player'){
      const p=player(id),st=M.stats(data,id),all=M.stats(data,id,true),card=data.player_cards[id]||{};
      const appearances=M.recordedGames(data,true).filter(g=>M.squad(data,g.id).some(r=>r.player_id===id)).reverse();
      showDialog(p?.name||'Player',`${card.position||'Club player'}${card.number?' · Shirt '+card.number:''}`,`<div class="player-dialog-avatar">${initials(p?.name||'Player',true,id)}${window.ClubFavorites.badge(window.ClubFavorites.choice(p?.name,id),true)}</div><div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-top:0">${metric('This season',st.appearances,'Recorded appearances','shirt')}${metric('All time',all.appearances,'Recorded appearances','trophy')}${metric('Recorded goals',st.goals,'This season','chart')}${metric('W / D / L',st.wins+' / '+st.draws+' / '+st.losses,st.results+' matches with teams & results','calendar')}</div><p class="notice">${st.streak} consecutive matches · ${st.rate}% of recorded matches this season. Historical signups are used as recorded appearances.</p><h3 style="margin:22px 0 12px">Recent appearances</h3>${appearances.slice(0,8).map(g=>`<a class="leader" href="#match/${g.id}" data-close-dialog style="text-decoration:none"><span class="leader-name">${esc(fullDate(g.game_date))}<small>${esc(g.location)}</small></span>${icon('arrow',13)}</a>`).join('')||'<p class="muted" style="font-size:12px">Your football story starts here.</p>'}`);return;
    }
    if(action==='prediction-tab'){if(['next14','later','past'].includes(id)){predictionTab=id;render();}return;}
    if(action==='retry-predictions'){predictionsData=null;predictionsError='';await loadPredictions();render();return;}
    if(action==='save-prediction'){
      const card=button.closest('.prediction-fixture'),homeRaw=card?.querySelector('[data-home-score]')?.value,awayRaw=card?.querySelector('[data-away-score]')?.value,home=Number(homeRaw),away=Number(awayRaw);
      if(!card||homeRaw===''||awayRaw===''||!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0||home>20||away>20)throw new Error('Enter a whole-number score from 0 to 20.');
      await post({action:'save_prediction',fixture_id:Number(id),home_score:home,away_score:away});predictionsData=null;await loadPredictions();render();toast('Your prediction has been saved.');return;
    }
    if(action==='club-vote'){
      const club=button.dataset.club,choice=button.dataset.choice;
      if(!['like','dislike'].includes(choice)||!club)throw new Error('Choose a valid vote');
      const result=await post({action:'game_vote',club_name:club,choice});await refresh();await loadGameClubBadges();
      const outcome=result.effective_votes?.[0]||{club,choice};
      const verb=outcome.choice==='like'?'liking':'disliking';
      showDialog('Thank you for '+verb+' '+outcome.club,'Your vote has been counted.', '<div class="game-vote-confirmation"><div class="game-vote-confirmation-badge">'+gameClubBadge(outcome.club)+'</div><p>Thank you for '+verb+' <strong>'+esc(outcome.club)+'</strong>.</p><small>Your vote has been added to the club totals.</small><button type="button" class="btn btn-primary" data-close-dialog>Continue</button></div>');
      dialog.classList.add('game-vote-dialog');return;
    }
    if(action==='favorite-club'){await window.ClubFavorites.open(data,{showDialog});return;}
    if(action==='profile'){
      const c=data.player_cards[data.user.player_id]||{};
      showDialog('Your club details','Your photo appears around the club. Contact details stay private.',window.ClubPhoto.fields(data.user)+field('Contact email','email',data.user.contact_email||data.user.email,'email','maxlength="254"')+field('Phone','phone',data.user.phone||'','tel','maxlength="64"')+(data.user.player_id?`${field('Birthday (DD/MM)','birthday',player(data.user.player_id)?.birthday_day&&player(data.user.player_id)?.birthday_month?String(player(data.user.player_id).birthday_day).padStart(2,'0')+'/'+String(player(data.user.player_id).birthday_month).padStart(2,'0'):'','text','placeholder="DD/MM" inputmode="numeric" pattern="(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])" maxlength="5" title="Enter day and month as DD/MM, for example 14/06"')}<p class="notice">Only the day and month are saved. Your birth year is never requested or displayed. Your birthday will appear to club members in the Clubhouse.</p><div class="form-grid"><label class="field">Preferred position<select name="position">${['','Goalkeeper','Defender','Midfielder','Forward','Anywhere'].map(p=>`<option value="${p}" ${c.position===p?'selected':''}>${p||'Choose a position'}</option>`).join('')}</select></label>${field('Preferred shirt number','number',c.number??'','number','min="1" max="99"')}</div><p class="notice">Position and preferred shirt number appear on your squad card. A preferred number is not an exclusive allocation.</p>`:''),async f=>{const picture=await window.ClubPhoto.upload(f,data.user);await api.post('/api/auth/member-profile.php',{email:f.get('email'),phone:f.get('phone'),...picture});if(data.user.player_id){const birthday=String(f.get('birthday')||'').trim();const [day,month]=birthday?birthday.split('/').map(Number):[null,null];await post({action:'player_birthday',month,day});await post({action:'player_card',position:f.get('position'),number:f.get('number')===''?null:Number(f.get('number'))});}});window.ClubPhoto.bind(data.user);return;
    }
    if(action==='report-payment'){showDialog('Let the treasurer know','Only report a payment after you’ve sent it.','<p class="notice">This doesn’t make a bank transfer. Your balance clears after the treasurer checks and confirms receipt.</p><label class="checkbox"><input type="checkbox" required> I have already sent this payment.</label>',()=>post({action:'report_payment',id,type:button.dataset.type}),'Report payment sent');return;}
    if(action==='confirm-payment'){showDialog('Confirm money received','Check the club’s bank or cash records first.','<label class="checkbox"><input type="checkbox" required> I have checked that the club received this payment.</label>',()=>post({action:'confirm_payment',id,type:button.dataset.type}),'Confirm received');return;}
    if(action==='expense'){showDialog('Record a club expense',data.finance?.season?.name||'',field('Description','description','','text','required maxlength="255"')+`<div class="form-grid">${field('Amount (€)','amount','','number','required min="0.01" max="999999.99" step="0.01"')}${field('Due date','date',data.server_date,'date','required')}</div><label class="field">Category<select name="category"><option>Pitch rental</option><option>Equipment</option><option>Reimbursement</option><option>Other</option></select></label>`,f=>post({action,season_id:data.finance.season.id,description:f.get('description'),amount:Number(f.get('amount')),date:f.get('date'),category:f.get('category')}),'Record expense');return;}
    if(action==='pay-expense'){showDialog('Confirm expense paid','This updates the club’s records. It does not send money.','<label class="checkbox"><input type="checkbox" required> This expense has actually been paid.</label>',()=>post({action:'pay_expense',id}),'Mark expense paid');return;}
    if(action==='calendar'){
      const safe=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
      const stamp=t=>g.game_date.replaceAll('-','')+'T'+t.replaceAll(':','');
      const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FC Castellon//Clubhouse//EN','BEGIN:VTIMEZONE','TZID:Europe/Madrid','BEGIN:DAYLIGHT','DTSTART:19700329T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701025T030000','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','END:STANDARD','END:VTIMEZONE','BEGIN:VEVENT','UID:'+g.id+'@castellon.futbol','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;TZID=Europe/Madrid:'+stamp(g.start_time),'DTEND;TZID=Europe/Madrid:'+stamp(g.end_time),'SUMMARY:FC Castellón · Football','LOCATION:'+safe(g.location),'DESCRIPTION:'+safe(m.notes||'See your place and teams in the club match centre.'),'END:VEVENT','END:VCALENDAR'].join('\r\n');
      const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='FC-Castellon-'+g.game_date+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
    }
  }

  async function refresh(background=false){
    if(refreshing)return;refreshing=true;
    try{
      const [snapshot,history]=await Promise.allSettled([api.get('/api/club.php'+window.ClubOffice.query()),api.get('/api/auth/member-payment-history.php')]);
      if(snapshot.status==='rejected')throw snapshot.reason;
      data=snapshot.value;window.ClubActivity.sync(data);window.ClubAvatar.setPlayers(data.players,data.user);window.ClubFavorites.setContext(data);
      if(history.status==='fulfilled'){payments=history.value;paymentError='';}else{payments=null;paymentError=history.reason.message;}
      if(!background)render();else{const fresh=document.getElementById('freshness');if(fresh)fresh.textContent='Updated '+new Date(data.updated_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
    }finally{refreshing=false;}
  }
  function login(error=''){
    data=null;window.ClubActivity.stop();
    root.innerHTML=`<div class="login-page"><section class="login-story">${pitch()}<a class="identity" href="/"><img src="club-crest.svg" alt="FC Castellón crest"><div><strong>FC Castellón</strong><small>THE CLUBHOUSE</small></div></a><div><h1>For the football.<br><em>For the people.</em></h1><p>Your next match. Your teammates. Your club.<br>Everything that brings us together, in one place.</p></div><footer>GOOD FOOTBALL. BETTER COMPANY.</footer></section><main class="login-form" id="content"><div class="login-box">${environment()?`<span class="environment">${environment()}</span>`:''}<div class="eyebrow" style="margin-top:28px">Welcome to the clubhouse</div><h2>Your place at the club.</h2><p>Sign in to join the next game, catch up with the squad and keep your season on track.</p><a class="btn btn-primary" href="/api/auth/google.php"><span style="font-weight:700;background:white;color:#345642;border-radius:50%;width:23px;height:23px;display:inline-grid;place-items:center;margin-right:6px">G</span> Continue with Google ${icon('arrow',16)}</a>${error?`<p class="form-error" style="margin-top:15px">${esc(error)}</p>`:''}<div id="email-sign-in"></div><p class="login-note">For invited club members. Use the email address registered with the club.</p><div class="login-features"><div class="login-feature">${icon('calendar')} Put your name down for the next match.</div><div class="login-feature">${icon('squad')} Follow the squad and your season stats.</div><div class="login-feature">${icon('wallet')} Stay on top of your payments.</div></div></div></main></div>`;
    window.ClubEmailLogin.mount(document.getElementById('email-sign-in'));
  }
  document.addEventListener('click',async e=>{
    const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;render();return;}
    const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
    b.disabled=true;try{await handleAction(b.dataset.action,b.dataset.id,b);}catch(e){if(e.status===401)login('Your session ended. Please sign in again.');else toast(e.message||'Something went wrong. Please try again.');}finally{if(b.isConnected)b.disabled=false;}
  });
  // Handle deletion before the browser/mobile keyboard mutates the value.
  // This lets Backspace/Delete skip the separator instead of repeatedly
  // triggering the formatter to put it back under the user's cursor.
  document.addEventListener('beforeinput',e=>{
    const input=e.target;
    if(input.name!=='birthday'||!e.inputType?.startsWith('delete'))return;
    const value=input.value,start=input.selectionStart??value.length,end=input.selectionEnd??start;
    let next=value,caretDigits=0;
    if(start!==end){
      next=value.slice(0,start)+value.slice(end);
      caretDigits=value.slice(0,start).replace(/\D/g,'').length;
    }else if(e.inputType==='deleteContentBackward'){
      let at=start-1;
      if(value[at]==='/')at--;
      if(at>=0)next=value.slice(0,at)+value.slice(at+1);
      caretDigits=value.slice(0,Math.max(0,at)).replace(/\D/g,'').length;
    }else{
      let at=start;
      if(value[at]==='/')at++;
      if(at<value.length)next=value.slice(0,at)+value.slice(at+1);
      caretDigits=value.slice(0,start).replace(/\D/g,'').length;
    }
    e.preventDefault();
    const digits=next.replace(/\D/g,'').slice(0,4);
    const formatted=digits.length>2?digits.slice(0,2)+'/'+digits.slice(2):digits;
    input.value=formatted;
    const nextCaret=Math.min(formatted.length,caretDigits+(caretDigits>2?1:0));
    try{input.setSelectionRange(nextCaret,nextCaret);}catch(_){}
  });
  document.addEventListener('input',e=>{
    if(e.target.name==='birthday'){
      const input=e.target;
      // Format typed or pasted digits; deletion is handled in beforeinput.
      const raw=input.value;
      const caret=input.selectionStart??raw.length;
      const digitsBeforeCaret=raw.slice(0,caret).replace(/\D/g,'').length;
      const digits=raw.replace(/\D/g,'').slice(0,4);
      const formatted=digits.length>2?digits.slice(0,2)+'/'+digits.slice(2):digits;
      if(input.value!==formatted){
        input.value=formatted;
        const nextCaret=Math.min(formatted.length,digitsBeforeCaret+(digitsBeforeCaret>2?1:0));
        try{input.setSelectionRange(nextCaret,nextCaret);}catch(_){}
      }
    }
    if(e.target.id==='squad-search'){search=e.target.value;document.getElementById('player-grid').innerHTML=playerCards();}
  });
  document.addEventListener('change',e=>{if(e.target.id==='squad-sort'){sort=e.target.value;document.getElementById('player-grid').innerHTML=playerCards();}if(e.target.id==='archive-season'){archiveSeason=e.target.value;render();}});
  window.addEventListener('hashchange',()=>{if(dialog.open)closeDialog();render();window.scrollTo(0,0);document.querySelector('h1')?.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  // Refresh shared data without replacing focused inputs or unsaved dialog forms.
  setInterval(async()=>{if(!data||document.hidden||dialog.open||document.getElementById('member-access-dialog')?.open||window.ClubAccess?.hasUnsaved()||busy||refreshing)return;const active=document.activeElement;if(active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName))return;const scroll=window.scrollY;try{await refresh();window.scrollTo(0,scroll);}catch(e){const fresh=document.getElementById('freshness');if(fresh)fresh.textContent='Refresh failed · try again';}},60000);
  (async()=>{try{await refresh();}catch(e){if(e.status===401)login(new URLSearchParams(location.search).get('error')||'');else root.innerHTML=`<main id="content" class="boot"><img src="club-crest.svg" width="72" alt="FC Castellón"><h1>The clubhouse couldn’t open</h1><p>${esc(e.message)}</p><button class="btn btn-primary" onclick="location.reload()">Try again</button><a href="/api/auth/logout.php">Return to sign-in</a></main>`;}})();
})();
