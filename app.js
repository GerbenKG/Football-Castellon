(() => {
"use strict";
let state={players:[],games:[]}, view="dashboard", gameId=null, currentUser=null, gameFilter="upcoming";
let financeData={seasons:[],tickets:[],expenses:[]}, financeLoaded=false, financeLoading=false, financeSeasonId=null;
let playerFinanceData={seasons:[],tickets:[]};
let access={profile:null,permissions:{},members:[],rolePermissions:[]};
let actingAs=null;
const isPreview=()=>!!actingAs;
const effectivePermissions=()=>actingAs?(actingAs.role==="super_admin"?Object.fromEntries(PERMISSIONS.map(x=>[x[0],true])):Object.fromEntries((access.rolePermissions||[]).filter(x=>x.role===actingAs.role&&x.enabled).map(x=>[x.permission,true]))):access.permissions;
const sb=window.supabaseClient;
const ROLES=[["super_admin","Super Admin"],["admin","Admin"],["attendance","Attendance"],["finance","Finance"],["viewer","Viewer"]];
const PERMISSIONS=[
 ["dashboard.view","Dashboard"],["players.view","View players"],["players.manage","Manage players"],
 ["games.view","View games"],["games.manage","Manage games"],["attendance.view","View attendance"],
 ["attendance.manage","Manage attendance"],["payments.view","View payments"],["payments.manage","Manage payments"],
 ["access.manage","Manage access"]
];
const roleName=r=>(ROLES.find(x=>x[0]===r)||["",r])[1];
const can=p=>effectivePermissions()?.[p]===true;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const player=id=>state.players.find(p=>p.id===id);
const game=()=>state.games.find(g=>g.id===gameId)||state.games[0]||{participants:[]};
const dateText=d=>new Date(d+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
const badge=(t,c="slate")=>'<span class="badge badge-'+c+'">'+t+"</span>";
const ticketForPlayer=(playerId,date)=>{const season=playerFinanceData.seasons.find(s=>date>=s.starts_on&&date<=s.ends_on);return season?playerFinanceData.tickets.find(t=>t.season_id===season.id&&t.player_id===playerId):null;};
const isSeasonTicket=(playerId,date)=>!!ticketForPlayer(playerId,date);

function showFatal(m){document.getElementById("app").innerHTML='<section class="card error-card"><h2>Football could not start</h2><p>'+esc(m)+'</p></section>';}
function accessDenied(){
 const e=currentUser?.email||"";
 document.getElementById("app").innerHTML='<section class="auth-card card access-denied"><div class="ball-logo">🔒</div><div class="eyebrow">ACCESS CONTROLLED</div><h1>Access pending</h1><p class="muted">The Google account <b>'+esc(e)+'</b> is not on the admin list.</p><p class="muted">Ask a Super Admin to add this email under <b>Admin & Access</b>, then sign in again.</p><button id="denied-out" class="btn btn-secondary">Sign out</button></section>';
 document.getElementById("denied-out").onclick=async()=>{await sb.auth.signOut();location.reload();};
}
async function loadAccess(){
 const c=await sb.rpc("claim_access_profile"); if(c.error)throw c.error;
 const m=await sb.rpc("get_my_access"); if(m.error)throw m.error;
 if(!m.data?.allowed){access={profile:null,permissions:{},members:[],rolePermissions:[]};return false;}
 access.profile=m.data.profile; access.permissions=m.data.permissions||{};
 if(access.profile.role==="super_admin"){
   const a=await sb.rpc("admin_list_access"); if(a.error)throw a.error;
   const p=await sb.rpc("admin_list_permissions"); if(p.error)throw p.error;
   access.members=a.data||[]; access.rolePermissions=p.data||[];
 }
 return true;
}
function nextGameDate(){
 const d=new Date();
 return d.toISOString().slice(0,10);
}
function makeSeasonGames(){
 const out=[],start=new Date("2026-09-04T12:00:00"),end=new Date("2027-08-31T12:00:00");
 for(let d=new Date(start);d<=end;d.setDate(d.getDate()+7)){
   const date=d.toISOString().slice(0,10), summer=[6,7].includes(d.getMonth());
   out.push({id:crypto.randomUUID(),date,startTime:summer?"20:00":"19:30",endTime:summer?"22:00":"21:30",time:summer?"20:00–22:00":"19:30–21:30",location:"Castellón",participants:[]});
 }
 return out;
}
async function save(){
 if(!currentUser)return;
 const check=async(q,label)=>{if(q.error)throw new Error(label+": "+q.error.message);return q;};
 if(can("players.manage")){
  const rp=await check(await sb.from("players").select("id"),"Loading players");
  const ids=new Set(state.players.map(p=>p.id));
  if(state.players.length)await check(await sb.from("players").upsert(state.players.map(p=>({id:p.id,name:p.name,phone:p.phone||null,email:p.email||null}))),"Saving players");
  for(const p of rp.data||[])if(!ids.has(p.id))await check(await sb.from("players").delete().eq("id",p.id),"Deleting player");
 }
 if(can("games.manage")){
  const rg=await check(await sb.from("games").select("id"),"Loading games");
  const ids=new Set(state.games.map(g=>g.id));
  if(state.games.length)await check(await sb.from("games").upsert(state.games.map(g=>({id:g.id,game_date:g.date,start_time:g.startTime,end_time:g.endTime,location:g.location}))),"Saving games");
  for(const g of rg.data||[])if(!ids.has(g.id))await check(await sb.from("games").delete().eq("id",g.id),"Deleting game");
 }
 if(can("attendance.manage")){
  const rr=await check(await sb.from("game_players").select("id"),"Loading Game squad");
  const ids=new Set(),rows=[];
  state.games.forEach(g=>(g.participants||[]).forEach(x=>{
   if(!x.rowId)x.rowId=crypto.randomUUID();ids.add(x.rowId);
   rows.push({id:x.rowId,game_id:g.id,player_id:x.guest?null:x.playerId,guest_name:x.guest?x.name:null,playing:!!x.playing,attended:!!x.attended,paid:!!x.paid});
  }));
  if(rows.length)await check(await sb.from("game_players").upsert(rows),"Saving Game squad");
  for(const x of rr.data||[])if(!ids.has(x.id))await check(await sb.from("game_players").delete().eq("id",x.id),"Deleting Game squad record");
 }
 if(can("payments.manage")){
  await check(await sb.from("payments").delete().neq("id","00000000-0000-0000-0000-000000000000"),"Resetting payments");
  const ps=[];
  state.games.forEach(g=>(g.participants||[]).forEach(x=>{if(!x.guest&&x.attended&&x.paid)ps.push({id:crypto.randomUUID(),player_id:x.playerId,game_id:g.id,payment_type:"game",paid:true});}));
  if(ps.length)await check(await sb.from("payments").insert(ps),"Saving payments");
 }
}

async function loadRemote(options={}){
 const preserveGameId=gameId;
 const p=await sb.from("players").select("id,name,phone,email").order("name");
 const g=await sb.from("games").select("*").order("game_date");
 const r=await sb.from("game_players").select("*");
 const fs=await sb.from("finance_seasons").select("id,starts_on,ends_on");
 const ft=await sb.from("finance_season_tickets").select("id,season_id,player_id,amount,paid,paid_on");
 if(p.error||g.error||r.error||fs.error||ft.error)throw(p.error||g.error||r.error||fs.error||ft.error);
 playerFinanceData={seasons:fs.data||[],tickets:ft.data||[]};
 state.players=(p.data||[]).map(x=>({id:x.id,name:x.name,phone:x.phone||"",email:x.email||""}));
 state.games=(g.data||[]).map(x=>({id:x.id,date:x.game_date,startTime:String(x.start_time).slice(0,5),endTime:String(x.end_time).slice(0,5),time:String(x.start_time).slice(0,5)+"–"+String(x.end_time).slice(0,5),location:x.location,participants:[]}));
 const map=new Map(state.games.map(x=>[x.id,x]));
 (r.data||[]).forEach(x=>{const g=map.get(x.game_id);if(g)g.participants.push({rowId:x.id,playerId:x.player_id,guest:!x.player_id,name:x.guest_name,playing:x.playing,attended:x.attended,paid:x.paid});});
 if(!state.games.length&&can("games.manage")){state.games=makeSeasonGames();gameId=state.games[0]?.id;await save();}
 if(!state.games.length){gameId=null;return;}
 // Keep the game the user is currently working on. Only pick the next upcoming
 // game when there is no valid selection (e.g. the initial page load).
 if(!options.resetSelection && preserveGameId && state.games.some(x=>x.id===preserveGameId)){
   gameId=preserveGameId;
 }else{
   gameId=state.games.find(x=>x.date>=new Date().toISOString().slice(0,10))?.id||state.games[0]?.id;
 }
}
function dashboard(){
 const g=game(),rows=g.participants||[],playing=rows.filter(x=>x.playing).length,present=rows.filter(x=>x.attended).length;
 const season=state.players.filter(p=>isSeasonTicket(p.id,g.date)),pay=state.players.filter(p=>!isSeasonTicket(p.id,g.date));
 const due=rows.filter(x=>{if(x.guest)return !x.paid;const t=ticketForPlayer(x.playerId,g.date);return t?!t.paid:!x.paid;}).length;
 const att=p=>{const a=state.games.flatMap(x=>x.participants||[]).filter(x=>!x.guest&&x.playerId===p.id);return a.length?a.filter(x=>x.attended).length/a.length*100:0;};
 const all=state.players.length?state.players.reduce((a,p)=>a+att(p),0)/state.players.length:0;
 const payAvg=pay.length?pay.reduce((a,p)=>a+att(p),0)/pay.length:0;
 const completed=state.games.filter(x=>(x.participants||[]).some(p=>p.attended)).length;
 const total=state.games.reduce((a,x)=>a+(x.participants||[]).filter(p=>p.attended).length,0);
 const avg=completed?total/completed:0;
 const paid=state.games.reduce((a,x)=>a+(x.participants||[]).filter(p=>p.attended&&!p.guest&&!isSeasonTicket(p.playerId,g.date)&&p.paid).length,0);
 const payable=state.games.reduce((a,x)=>a+(x.participants||[]).filter(p=>p.attended&&!p.guest&&!isSeasonTicket(p.playerId,g.date)).length,0);
 const collection=payable?paid/payable*100:0;
 const leaders=[...state.players].sort((a,b)=>att(b)-att(a)).slice(0,5);
 return '<section class="hero"><div class="hero-pitch"></div><div class="hero-copy"><div class="game-nav"><button class="game-arrow" data-game-nav="prev" title="Previous game" aria-label="Previous game">←</button><div><div class="eyebrow light">GAME</div><h1>'+dateText(g.date)+'</h1><p>⚽ '+esc(g.time)+' · '+esc(g.location)+'</p></div><button class="game-arrow" data-game-nav="next" title="Next game" aria-label="Next game">→</button></div><div class="hero-actions">'+(can("attendance.manage")?'<button class="btn btn-light" data-a="add-player">+ Player</button>':"")+(can("attendance.manage")?'<button class="btn btn-ghost" data-a="guest">+ Guest</button>':"")+'</div></div><div class="hero-ball">⚽</div></section>'+
 '<div class="stats"><div class="stat"><div class="stat-icon">⚽</div><div><small>PLAYING</small><strong>'+playing+'</strong></div></div><div class="stat"><div class="stat-icon">✓</div><div><small>PRESENT</small><strong>'+present+'</strong></div></div><div class="stat"><div class="stat-icon">🎟</div><div><small>SEASON TICKETS</small><strong>'+season.length+'</strong></div></div><div class="stat"><div class="stat-icon">€</div><div><small>PAYMENTS DUE</small><strong>'+due+'</strong></div></div></div>'+
 '<section class="analytics-grid"><div class="card analytics-card"><div class="card-title"><div><h3>Attendance overview</h3><p>Average attendance across recorded appearances.</p></div></div><div class="metric-row"><div><small>ALL PLAYERS</small><strong>'+all.toFixed(0)+'%</strong></div><div><small>PAY PER GAME</small><strong>'+payAvg.toFixed(0)+'%</strong></div><div><small>AVG PRESENT / GAME</small><strong>'+avg.toFixed(1)+'</strong></div></div></div>'+
 '<div class="card analytics-card"><div class="card-title"><div><h3>Payments</h3><p>Collection performance.</p></div></div><div class="progress-value"><strong>'+collection.toFixed(0)+'%</strong><span>'+paid+' of '+payable+' game payments collected</span></div><div class="progress"><i style="width:'+collection+'%"></i></div><div class="mini-stats"><span>Season tickets paid <b>'+season.filter(p=>p.seasonPaid).length+'/'+season.length+'</b></span><span>Games with attendance <b>'+completed+'</b></span></div></div></section>'+
 '<section class="section"><div class="section-head"><div><h2>Attendance leaders</h2><p>Top players by attendance rate.</p></div><button class="btn btn-secondary" data-view="players">View players →</button></div><div class="card leaders">'+leaders.map(p=>'<div class="leader-row"><div class="who"><span class="avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</span><div><b>'+esc(p.name)+'</b><small>'+(isSeasonTicket(p.id,g.date)?"🎟 Season ticket":"Per game")+'</small></div></div><strong>'+att(p).toFixed(0)+'%</strong></div>').join("")+'</div></section>'+
 '<section class="section"><div class="section-head"><div><h2>Game squad</h2><p>Manage attendance and payment for this match.</p></div></div><div class="squad card">'+rows.map(x=>{
  const p=x.guest?null:player(x.playerId),name=x.guest?x.name:(p?.name||"Player"),type=x.guest?"Guest":isSeasonTicket(p.id,g.date)?"🎟 Season":"Per game";
  const payLabel=x.guest?(x.paid?"Paid":"Due"):(ticketForPlayer(p.id,g.date)?(ticketForPlayer(p.id,g.date).paid?"Season paid":"Season unpaid"):(x.paid?"Paid":"Mark paid"));
  const pc=x.guest||isSeasonTicket(p.id,g.date)?((ticketForPlayer(p.id,g.date)?.paid)||x.paid?"green":"amber"):(x.paid?"green":"red");
  return '<div class="squad-row"><div class="who"><span class="avatar">'+esc(name).slice(0,1).toUpperCase()+'</span><div><b>'+esc(name)+'</b><small>'+type+'</small></div></div>'+(can("attendance.manage")?'<label class="toggle"><input type="checkbox" data-t="attended" data-id="'+x.rowId+'" '+(x.attended?"checked":"")+'><span>Present</span></label>':'<span>'+badge(x.attended?"Present":"Not present",x.attended?"green":"slate")+'</span>')+(can("payments.manage")&&(!x.guest&&!isSeasonTicket(p.id,g.date) || x.guest)?'<label class="toggle payment-toggle"><input type="checkbox" data-t="paid" data-id="'+x.rowId+'" '+(x.paid?"checked":"")+'><span>Paid</span></label>':'<span>'+badge(payLabel,pc)+'</span>')+(can("attendance.manage")?'<button class="remove" data-a="remove" data-id="'+x.rowId+'">×</button>':"")+'</div>';
 }).join("")+'</div></section>';
}
function players(){
 return '<div class="page-head"><div><div class="eyebrow">ROSTER</div><h1 class="title">Players</h1><p class="muted">Roster and contact information.</p></div>'+(can("players.manage")?'<button class="btn btn-primary" data-a="new-player">+ Add player</button>':"")+'</div>'+
 '<div class="card table-card"><table><thead><tr><th>Player</th><th>Phone</th><th>Email</th><th></th></tr></thead><tbody>'+
 state.players.map(p=>{
   const actions='<button class="btn btn-secondary" data-a="history" data-id="'+p.id+'">Attendance</button>'+
     (can("players.manage")?'<button class="btn btn-secondary" data-a="edit" data-id="'+p.id+'">Edit</button>':"")+
     (can("players.manage")&&can("attendance.manage")?'<button class="btn btn-secondary" data-a="delete-player" data-id="'+p.id+'">Delete</button>':"");
   return '<tr><td><div class="who"><span class="avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</span><b>'+esc(p.name)+'</b></div></td><td>'+
     esc(p.phone||"—")+'</td><td>'+esc(p.email||"—")+
     '</td><td><div class="actions">'+actions+'</div></td></tr>';
 }).join("")+
 '</tbody></table></div>';
}
function gameOverviewCard(g,today){
 const rows=g.participants||[];
 const active=rows.filter(x=>x.playing||x.attended);
 const present=rows.filter(x=>x.attended);
 const guests=active.filter(x=>x.guest);
 const people=active.map(x=>{
  const p=x.guest?null:player(x.playerId);
  return {name:x.guest?(x.name||"Guest"):(p?.name||"Player"),guest:!!x.guest,playing:!!x.playing,attended:!!x.attended};
 });
 const isPast=g.date<today;
 const title=dateText(g.date);
 return '<article class="card game-overview-card '+(isPast?"past":"upcoming")+'">'+
   '<div class="game-overview-main">'+
     '<div class="game-overview-date"><span class="game-day">'+esc(new Date(g.date+"T12:00:00").toLocaleDateString("en-GB",{day:"2-digit"}))+'</span><div><div class="eyebrow">'+(isPast?"PLAYED":"UP NEXT")+'</div><h3>'+esc(title.replace(/^.*?, /,""))+'</h3><p>⚽ '+esc(g.time)+' · '+esc(g.location)+'</p></div></div>'+
     '<div class="game-overview-stats">'+
       '<div><strong>'+rows.filter(x=>x.playing).length+'</strong><span>Playing</span></div>'+
       '<div><strong>'+present.length+'</strong><span>Present</span></div>'+
       '<div><strong>'+guests.length+'</strong><span>Guests</span></div>'+
     '</div>'+
   '</div>'+
   '<div class="game-overview-players">'+
     (people.length?people.map(x=>'<span class="player-chip '+(x.guest?"guest":"")+' '+(x.attended?"attended":(x.playing?"playing":""))+'"><i>'+esc(x.name).slice(0,1).toUpperCase()+'</i>'+esc(x.name)+(x.guest?'<em>Guest</em>':"")+(x.attended?'<b>✓</b>':"")+'</span>').join(""):'<span class="empty-game-note">No players have been added yet</span>')+
   '</div>'+
   '<div class="game-overview-actions">'+
     '<span class="game-status">'+(isPast?"Attendance recorded":"Squad planning")+'</span>'+
     (can("games.view")?'<button class="btn btn-primary" data-game="'+g.id+'">'+(isPast?"Open attendance →":"Manage squad →")+'</button>':"")+
     (can("games.manage")?'<button class="btn btn-secondary" data-a="edit-game" data-id="'+g.id+'">Edit</button>':"")+
     (can("games.manage")&&can("attendance.manage")&&can("payments.manage")?'<button class="btn btn-secondary" data-a="delete-game" data-id="'+g.id+'">Delete</button>':"")+
   '</div>'+
 '</article>';
}
function games(){
 const today=new Date().toISOString().slice(0,10);
 const upcoming=state.games.filter(g=>g.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
 const past=state.games.filter(g=>g.date<today).sort((a,b)=>b.date.localeCompare(a.date));
 const list=gameFilter==="upcoming"?upcoming:gameFilter==="past"?past:[...upcoming,...past];
 const next=upcoming[0];
 const filterButton=(key,label,count)=>'<button class="game-filter '+(gameFilter===key?"active":"")+'" data-game-filter="'+key+'">'+label+' <span>'+count+'</span></button>';
 return '<div class="page-head"><div><div class="eyebrow">GAME OVERVIEW</div><h1 class="title">Who is playing?</h1><p class="muted">A quick view of every game, who is playing, who attended and which guests joined.</p></div>'+(can("games.manage")?'<button class="btn btn-primary" data-a="new-game">+ New Game</button>':"")+'</div>'+
   '<section class="game-overview-hero card">'+
     '<div><div class="eyebrow">NEXT GAME</div><h2>'+esc(next?dateText(next.date):"No upcoming game")+'</h2><p>'+esc(next?next.time+" · "+next.location:"Create a game to get started")+'</p></div>'+
     '<div class="next-count"><strong>'+((next?.participants||[]).filter(x=>x.playing).length)+'</strong><span>playing</span></div>'+
     (next&&can("games.view")?'<button class="btn btn-primary" data-game="'+next.id+'">Open squad →</button>':"")+
   '</section>'+
   '<div class="game-filter-bar">'+filterButton("upcoming","Upcoming",upcoming.length)+filterButton("past","Played",past.length)+filterButton("all","All games",state.games.length)+'</div>'+
   '<div class="game-overview-list">'+(list.length?list.map(g=>gameOverviewCard(g,today)).join(""):'<section class="card empty"><h2>No games here</h2><p>Try another filter.</p></section>')+'</div>';
}

const money=v=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"EUR"}).format(Number(v||0));
const seasonForDate=d=>financeData.seasons.find(s=>d>=s.starts_on&&d<=s.ends_on);
async function loadFinance(){
  if(financeLoading)return;
  financeLoading=true;
  try{
    const [s,t,e]=await Promise.all([
      sb.from("finance_seasons").select("*").order("starts_on",{ascending:false}),
      sb.from("finance_season_tickets").select("*"),
      sb.from("finance_expenses").select("*").order("due_date")
    ]);
    if(s.error||t.error||e.error)throw(s.error||t.error||e.error);
    financeData={seasons:s.data||[],tickets:t.data||[],expenses:e.data||[]};
    if(!financeSeasonId||!financeData.seasons.some(x=>x.id===financeSeasonId))financeSeasonId=financeData.seasons[0]?.id||null;
    financeLoaded=true;
  }finally{financeLoading=false;}
}
function finance(){
 if(!can("payments.view"))return '<section class="card empty"><h2>Finance</h2><p>You do not have permission to view finances.</p></section>';
 if(!financeLoaded){
   if(!financeLoading)loadFinance().then(render).catch(e=>{financeLoading=false;document.getElementById("app").innerHTML=previewBanner()+'<section class="card error-card"><h2>Finance setup required</h2><p>'+esc(e.message||"Could not load finance data.")+'</p><p class="muted">Run <b>supabase-finance.sql</b> once in Supabase, then reload this page.</p></section>';});
   return '<section class="card empty"><h2>Loading finances…</h2><p>Preparing the season, payments and forecast.</p></section>';
 }
 const s=financeData.seasons.find(x=>x.id===financeSeasonId)||financeData.seasons[0];
 if(!s)return '<section class="card empty"><h2>No season configured</h2><p>Create your first season to start tracking finances.</p></section>';
 const tickets=financeData.tickets.filter(x=>x.season_id===s.id);
 const expenses=financeData.expenses.filter(x=>x.season_id===s.id);
 const seasonPlayers=tickets.map(t=>player(t.player_id)).filter(Boolean);
 const ticketByPlayer=new Map(tickets.map(x=>[x.player_id,x]));
 const seasonGames=state.games.filter(g=>g.date>=s.starts_on&&g.date<=s.ends_on);
 const gamePlayers=seasonGames.flatMap(g=>(g.participants||[]).map(x=>({g,x})));
 const gamePaid=gamePlayers.filter(({x})=>x.paid);
 const actualSeasonIncome=tickets.filter(x=>x.paid).reduce((a,x)=>a+Number(x.amount),0);
 const actualGameIncome=gamePaid.reduce((a,{g,x})=>a+(x.guest||player(x.playerId)?.model==="game"?Number(s.pay_per_game_amount):0),0);
 const paidExpenses=expenses.filter(x=>x.paid).reduce((a,x)=>a+Number(x.amount),0);
 const balance=actualSeasonIncome+actualGameIncome-paidExpenses;
 const unpaidSeason=seasonPlayers.filter(p=>!ticketByPlayer.get(p.id)?.paid);
 const unpaidGame=gamePlayers.filter(({g,x})=>g.date<=new Date().toISOString().slice(0,10)&&x.attended&&(!x.guest&&player(x.playerId)?.model==="game"||x.guest)&&!x.paid);
 const ppPlayers=state.players.filter(p=>!tickets.some(t=>t.player_id===p.id));
 let projectedGame=0;
 ppPlayers.forEach(p=>{
   const appearances=state.games.flatMap(g=>(g.participants||[]).filter(x=>!x.guest&&x.playerId===p.id&&x.attended)).length;
     const playedGames=seasonGames.filter(g=>g.date<=new Date().toISOString().slice(0,10)).length;
   const rate=playedGames?appearances/playedGames:0;
   const futureGames=seasonGames.filter(g=>g.date>=new Date().toISOString().slice(0,10)).length;
   projectedGame+=rate*futureGames*Number(s.pay_per_game_amount);
 });
 const outstandingSeason=unpaidSeason.length*Number(s.season_ticket_amount);
 const unpaidGameAmount=unpaidGame.reduce((a,{})=>a+Number(s.pay_per_game_amount),0);
 const futureExpenses=expenses.filter(x=>!x.paid&&x.due_date>=new Date().toISOString().slice(0,10)).reduce((a,x)=>a+Number(x.amount),0);
 const projectedEnd=balance+outstandingSeason+unpaidGameAmount+projectedGame-futureExpenses;
 const seasonTicketRows=seasonPlayers.map(p=>{
   const t=ticketByPlayer.get(p.id);
   return '<tr><td><div class="who"><span class="avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</span><b>'+esc(p.name)+'</b></div></td><td>'+money(t?.amount??s.season_ticket_amount)+'</td><td>'+badge(t?.paid?"Paid":"Needs payment",t?.paid?"green":"red")+'</td><td>'+(can("payments.manage")?'<button class="btn btn-secondary" data-fin-ticket="'+p.id+'" data-paid="'+(t?.paid?"true":"false")+'">'+(t?.paid?"Mark unpaid":"Mark paid")+'</button>':"")+'</td></tr>';
 }).join("");
 const dueRows=[
   ...unpaidSeason.map(p=>'<tr><td>'+esc(p.name)+'</td><td>Season ticket</td><td>'+money(s.season_ticket_amount)+'</td><td>'+badge("Due","red")+'</td></tr>'),
   ...unpaidGame.map(({g,x})=>'<tr><td>'+esc(x.guest?(x.name||"Guest"):(player(x.playerId)?.name||"Player"))+'</td><td>'+esc(dateText(g.date))+'</td><td>'+money(s.pay_per_game_amount)+'</td><td>'+badge("Due","red")+'</td></tr>')
 ].join("");
 const expenseRows=expenses.map(x=>'<tr><td>'+esc(new Date(x.due_date+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}))+'</td><td>'+esc(x.description)+'</td><td>'+money(x.amount)+'</td><td>'+badge(x.paid?"Paid":"Upcoming",x.paid?"green":x.due_date<new Date().toISOString().slice(0,10)?"red":"amber")+'</td><td>'+(can("payments.manage")?'<button class="btn btn-secondary" data-fin-expense="'+x.id+'">'+(x.paid?"Mark unpaid":"Mark paid")+'</button>':"")+'</td></tr>').join("");
 const forecastRows=expenses.filter(x=>!x.paid).reduce((m,x)=>{const k=x.due_date.slice(0,7);m[k]=(m[k]||0)+Number(x.amount);return m;},{});
 return '<div class="page-head"><div><div class="eyebrow">FINANCE</div><h1 class="title">Finances</h1><p class="muted">Season income, pitch costs, outstanding payments and forward balance.</p></div><div class="actions">'+(can("payments.manage")?'<button class="btn btn-secondary" data-a="new-finance-season">+ Season</button><button class="btn btn-primary" data-a="edit-finance-season" data-id="'+s.id+'">Edit pricing</button>':"")+'</div></div>'+
 '<section class="card finance-toolbar"><div><label>Season<select id="finance-season-select">'+financeData.seasons.map(x=>'<option value="'+x.id+'" '+(x.id===s.id?"selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label></div><div class="finance-rates"><span>Season ticket <b>'+money(s.season_ticket_amount)+'</b></span><span>Pay per game <b>'+money(s.pay_per_game_amount)+'</b></span></div></section>'+
 '<div class="stats finance-stats"><div class="stat"><div class="stat-icon">€</div><div><small>CURRENT BALANCE</small><strong>'+money(balance)+'</strong></div></div><div class="stat"><div class="stat-icon">↑</div><div><small>EXPECTED INCOME</small><strong>'+money(outstandingSeason+unpaidGameAmount+projectedGame)+'</strong></div></div><div class="stat"><div class="stat-icon">↓</div><div><small>FUTURE PITCH COSTS</small><strong>'+money(futureExpenses)+'</strong></div></div><div class="stat"><div class="stat-icon">◎</div><div><small>PROJECTED END BALANCE</small><strong>'+money(projectedEnd)+'</strong></div></div></div>'+
 '<section class="analytics-grid"><div class="card analytics-card"><div class="card-title"><div><h3>Season ticket holders</h3><p>Who purchased a ticket and for which season.</p></div></div><div class="table-card finance-table"><table><thead><tr><th>Player</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>'+(seasonTicketRows||'<tr><td colspan="4" class="empty">No season-ticket players.</td></tr>')+'</tbody></table></div></div>'+
 '<div class="card analytics-card"><div class="card-title"><div><h3>Who still needs to pay?</h3><p>Outstanding season tickets and attended pay-per-game matches.</p></div></div><div class="table-card finance-table"><table><thead><tr><th>Person</th><th>For</th><th>Amount</th><th>Status</th></tr></thead><tbody>'+(dueRows||'<tr><td colspan="4" class="empty">Nothing outstanding.</td></tr>')+'</tbody></table></div></div></section>'+
 '<section class="card finance-card"><div class="section-head"><div><h2>Pitch rental payments</h2><p>Scheduled costs for '+esc(s.name)+'.</p></div>'+(can("payments.manage")?'<button class="btn btn-primary" data-a="new-finance-expense">+ Add payment</button>':"")+'</div><div class="table-card finance-table"><table><thead><tr><th>Due</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>'+expenseRows+'</tbody></table></div></section>'+
 '<section class="card finance-card"><div class="section-head"><div><h2>Financial outlook</h2><p>Projection assumes all outstanding dues are collected and uses current pay-per-game attendance rates for future games.</p></div></div><div class="finance-outlook"><div><span>Collected so far</span><b>'+money(actualSeasonIncome+actualGameIncome)+'</b></div><div><span>Pitch costs paid</span><b>'+money(paidExpenses)+'</b></div><div><span>Projected game income</span><b>'+money(projectedGame)+'</b></div><div><span>Projected end balance</span><b>'+money(projectedEnd)+'</b></div></div><div class="forecast-list">'+Object.keys(forecastRows).sort().map(k=>'<div><span>'+esc(k)+'</span><b>'+money(forecastRows[k])+'</b></div>').join("")+'</div></section>';
}

function admin(){
 if(!can("access.manage"))return '<section class="card empty"><h2>Access management</h2><p>You do not have permission to manage site access.</p></section>';
 const members=access.members||[],rp=access.rolePermissions||[],roles=ROLES.filter(x=>x[0]!=="super_admin");
 const enabled=(role,p)=>rp.some(x=>x.role===role&&x.permission===p&&x.enabled);
 return '<div class="page-head"><div><div class="eyebrow">CONTROL CENTRE</div><h1 class="title">Admin & Access</h1><p class="muted">Manage invited members and what each profile can see or do.</p></div><button class="btn btn-primary" data-a="new-member">+ Add member</button></div>'+
 '<section class="card access-card"><div class="section-head"><div><h2>Members</h2><p>Add an email to allow that Google account into the site.</p></div></div><div class="member-list">'+
 members.map(m=>'<div class="member-row"><div class="who"><span class="avatar">'+esc((m.display_name||m.email).slice(0,1).toUpperCase())+'</span><div><b>'+esc(m.display_name||m.email)+'</b><small>'+esc(m.email)+(m.user_id?" · linked":" · pending")+'</small></div></div><div class="member-role">'+badge(roleName(m.role),m.role==="super_admin"?"green":"slate")+' '+(m.active?badge("Active","green"):badge("Disabled","red"))+'</div><div class="actions"><button class="btn btn-secondary" data-a="login-as" data-id="'+esc(m.email)+'">Login as</button><button class="btn btn-secondary" data-a="edit-member" data-id="'+esc(m.email)+'">Edit</button>'+(m.email.toLowerCase()!==String(currentUser?.email||"").toLowerCase()?'<button class="btn btn-secondary" data-a="delete-member" data-id="'+esc(m.email)+'">Remove</button>':"")+'</div></div>').join("")+
 '</div></section><section class="card access-card"><div class="section-head"><div><h2>Profile permissions</h2><p>Super Admin is fixed. Other profiles can be tailored below.</p></div></div><div class="permission-table"><div class="permission-head"><span>Permission</span>'+roles.map(r=>'<b>'+r[1]+'</b>').join("")+'</div>'+
 PERMISSIONS.map(x=>'<div class="permission-row"><span><b>'+esc(x[1])+'</b><small>'+esc(x[0])+'</small></span>'+roles.map(r=>'<label class="perm-toggle"><input type="checkbox" data-perm-role="'+r[0]+'" data-perm="'+x[0]+'" '+(enabled(r[0],x[0])?"checked":"")+'><span></span></label>').join("")+'</div>').join("")+
 '</div></section>';
}
function modal(title,body){document.getElementById("modal-root").innerHTML='<div class="modal-bg"><div class="modal"><div class="modal-head"><h2>'+title+'</h2><button class="remove" data-close type="button">×</button></div>'+body+'</div></div>';}
function act(a,id){
 if(a==="exit-preview"){actingAs=null;view="dashboard";render();return;}
 if(a==="login-as"){const m=access.members.find(x=>x.email===id);if(!m)return;actingAs={...m};view="dashboard";render();return;}
 if(isPreview()){alert("Preview mode is read-only. Exit preview to make changes.");return;}
 if(a==="remove"){
  if(!can("attendance.manage"))return;
  const row=game().participants.find(x=>x.rowId===id);
  if(!row)return;
  const label=row.guest?(row.name||"Guest"):(player(row.playerId)?.name||"Player");
  if(!confirm("Remove "+label+" from this Game squad?"))return;
  game().participants=game().participants.filter(x=>x.rowId!==id);
  save().then(()=>loadRemote()).then(render).catch(err=>alert(err.message||"Could not remove squad member."));
  return;
}
 if(a==="delete-player"){if(!can("players.manage")||!can("attendance.manage"))return;const p=player(id);if(!p||!confirm("Delete "+p.name+"? This also removes their game records."))return;state.players=state.players.filter(x=>x.id!==id);state.games.forEach(g=>g.participants=g.participants.filter(x=>x.playerId!==id));save().then(render);return;}
 if(a==="delete-game"){if(!can("games.manage")||!can("attendance.manage")||!can("payments.manage"))return;const t=state.games.find(x=>x.id===id);if(!t||state.games.length<=1)return alert("You must keep at least one game.");if(!confirm("Delete "+dateText(t.date)+"? Attendance and payment records will also be removed."))return;state.games=state.games.filter(x=>x.id!==id);gameId=state.games[0]?.id;save().then(render);return;}
 if(a==="new-game"||a==="edit-game"){
  if(!can("games.manage"))return;
  const existing=a==="edit-game"?state.games.find(x=>x.id===id):null;
  if(a==="edit-game"&&!existing)return;
  const title=existing?"Edit Game":"New Game";
  const submit=existing?"Save changes":"Create Game";
  return modal(title,'<form id="game-form" data-id="'+(existing?.id||"")+'"><label>Date<input name="date" type="date" value="'+esc(existing?.date||nextGameDate())+'" required></label><div class="form-grid"><label>Start time<input name="startTime" type="time" value="'+esc(existing?.startTime||"20:00")+'" required></label><label>End time<input name="endTime" type="time" value="'+esc(existing?.endTime||"22:00")+'" required></label></div><label>Location<input name="location" value="'+esc(existing?.location||"Castellón")+'"></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">'+submit+'</button></div></form>');
}
 if(a==="new-player"||a==="edit"){const p=a==="edit"?player(id):null;return modal(p?"Edit player":"Add player",'<form id="player-form" data-id="'+(p?.id||"")+'"><label>Name<input name="name" value="'+esc(p?.name||"")+'" required></label><label>Phone<input name="phone" type="tel" value="'+esc(p?.phone||"")+'"></label><label>Email<input name="email" type="email" value="'+esc(p?.email||"")+'"></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save player</button></div></form>');}
 if(a==="history"){
  const p=player(id);
  if(!p)return;
  const attended=state.games.filter(g=>(g.participants||[]).some(x=>!x.guest&&x.playerId===p.id&&x.attended)).sort((a,b)=>b.date.localeCompare(a.date));
  const body=attended.length
    ? '<div class="history-list">'+attended.map(g=>{
        const x=(g.participants||[]).find(x=>!x.guest&&x.playerId===p.id&&x.attended);
        return '<div class="history-row"><div><b>'+esc(dateText(g.date))+'</b><small>⚽ '+esc(g.time)+' · '+esc(g.location)+'</small></div><span>'+badge(x?.paid?"Paid":"Attended",x?.paid?"green":"slate")+'</span></div>';
      }).join("")+'</div>'
    : '<p class="muted">No attended games recorded yet.</p>';
  return modal("Attendance history — "+esc(p.name),body+'<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Close</button></div>');
}
if(a==="add-player"){const selectedGame=game();const used=new Set(selectedGame.participants.filter(x=>!x.guest).map(x=>x.playerId));const av=state.players.filter(p=>!used.has(p.id));return modal("Add player to game",'<form id="pick-form" data-game-id="'+esc(selectedGame.id)+'"><label>Player<select name="id" required>'+av.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("")+'</select></label>'+(av.length?'':'<p class="notice">Everyone on the roster is already assigned to this game.</p>')+'<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" '+(!av.length?"disabled":"")+'>Add player</button></div></form>');}
 if(a==="guest")return modal("Add guest",'<form id="guest-form"><label>Guest name<input name="name" required autofocus></label><p class="notice">Guest payment is tracked for this game only.</p><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Add guest</button></div></form>');
 if(a==="new-finance-season"){
  if(!can("payments.manage"))return;
  return modal("New season",'<form id="finance-season-form"><label>Name<input name="name" required placeholder="2027/28"></label><div class="form-grid"><label>Starts<input name="starts_on" type="date" required></label><label>Ends<input name="ends_on" type="date" required></label></div><label>Season ticket amount<input name="season_ticket_amount" type="number" min="0" step="0.01" value="0"></label><label>Pay per game amount<input name="pay_per_game_amount" type="number" min="0" step="0.01" value="0"></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Create season</button></div></form>');
}
 if(a==="edit-finance-season"){
  if(!can("payments.manage"))return;
  const s=financeData.seasons.find(x=>x.id===id);if(!s)return;
  return modal("Edit season pricing",'<form id="finance-season-form" data-id="'+esc(s.id)+'"><label>Name<input name="name" value="'+esc(s.name)+'" required></label><div class="form-grid"><label>Starts<input name="starts_on" type="date" value="'+esc(s.starts_on)+'" required></label><label>Ends<input name="ends_on" type="date" value="'+esc(s.ends_on)+'" required></label></div><label>Season ticket amount<input name="season_ticket_amount" type="number" min="0" step="0.01" value="'+esc(s.season_ticket_amount)+'"></label><label>Pay per game amount<input name="pay_per_game_amount" type="number" min="0" step="0.01" value="'+esc(s.pay_per_game_amount)+'"></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save changes</button></div></form>');
 }
 if(a==="new-finance-expense"){
  if(!can("payments.manage"))return;
  return modal("Schedule pitch payment",'<form id="finance-expense-form"><label>Due date<input name="due_date" type="date" required></label><label>Description<input name="description" value="Pitch rental" required></label><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Schedule payment</button></div></form>');
 } 
 if(a==="new-member")return modal("Add member",'<form id="member-form"><label>Email<input name="email" type="email" required placeholder="admin@example.com"></label><label>Name<input name="display_name" placeholder="Optional display name"></label><label>Profile<select name="role">'+ROLES.map(r=>'<option value="'+r[0]+'">'+r[1]+'</option>').join("")+'</select></label><label class="checkline"><input name="active" type="checkbox" checked> Active access</label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save member</button></div></form>');
 if(a==="edit-member"){const m=access.members.find(x=>x.email===id);if(!m)return;return modal("Edit member",'<form id="member-form" data-email="'+esc(m.email)+'"><label>Email<input name="email" type="email" value="'+esc(m.email)+'" readonly></label><label>Name<input name="display_name" value="'+esc(m.display_name||"")+'"></label><label>Profile<select name="role">'+ROLES.map(r=>'<option value="'+r[0]+'" '+(r[0]===m.role?"selected":"")+'>'+r[1]+'</option>').join("")+'</select></label><label class="checkline"><input name="active" type="checkbox" '+(m.active?"checked":"")+'> Active access</label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save member</button></div></form>');}
 if(a==="delete-member"){const m=access.members.find(x=>x.email===id);if(!m||!confirm("Remove "+m.email+" from site access?"))return;sb.rpc("admin_delete_access",{p_email:m.email}).then(x=>x.error?alert(x.error.message):loadAccess().then(render));}
}
function previewBanner(){
 if(!actingAs)return "";
 return '<div class="preview-banner"><div><b>Preview mode</b> · Viewing the site as '+esc(actingAs.display_name||actingAs.email)+' ('+esc(roleName(actingAs.role))+')</div><button class="btn btn-secondary" data-a="exit-preview">Exit preview</button></div>';
}
function render(){
 const app=document.getElementById("app");
 document.querySelectorAll(".nav-item").forEach(b=>{b.classList.toggle("active",b.dataset.view===view);b.style.display=b.dataset.permission&&!can(b.dataset.permission)?"none":"";});
 app.innerHTML=previewBanner()+(view==="dashboard"?dashboard():view==="players"?players():view==="games"?games():view==="finance"?finance():view==="admin"?admin():dashboard());
 document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
 document.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>act(b.dataset.a,b.dataset.id));
 document.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>{gameId=b.dataset.game;view="dashboard";render();});
 document.querySelectorAll("[data-game-nav]").forEach(b=>b.onclick=()=>{
   const ordered=[...state.games].sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime));
   const i=ordered.findIndex(x=>x.id===gameId);
   if(i<0)return;
   const next=b.dataset.gameNav==="next"?ordered[i+1]:ordered[i-1];
   if(next){gameId=next.id;render();}
 });
 document.querySelectorAll("[data-game-filter]").forEach(b=>b.onclick=()=>{gameFilter=b.dataset.gameFilter;render();});
 document.getElementById("finance-season-select")?.addEventListener("change",e=>{financeSeasonId=e.target.value;render();});

document.querySelectorAll("[data-fin-ticket]").forEach(b=>b.onclick=async()=>{
 const pid=b.dataset.finTicket, paid=b.dataset.paid==="true";
 if(!can("payments.manage"))return;
 const existing=financeData.tickets.find(x=>x.season_id===financeSeasonId&&x.player_id===pid);
 let q;
 if(existing) q=await sb.from("finance_season_tickets").update({amount:Number(financeData.seasons.find(x=>x.id===financeSeasonId)?.season_ticket_amount||0),paid:!paid,paid_on:!paid?new Date().toISOString().slice(0,10):null}).eq("id",existing.id);
 else q=await sb.from("finance_season_tickets").insert({season_id:financeSeasonId,player_id:pid,amount:Number(financeData.seasons.find(x=>x.id===financeSeasonId)?.season_ticket_amount||0),paid:true,paid_on:new Date().toISOString().slice(0,10)});
 if(q.error){alert(q.error.message);return;}await loadFinance();render();
});
document.querySelectorAll("[data-fin-expense]").forEach(b=>b.onclick=async()=>{
 const id=b.dataset.finExpense, x=financeData.expenses.find(x=>x.id===id);
 if(!x||!can("payments.manage"))return;
 const q=await sb.from("finance_expenses").update({paid:!x.paid,paid_on:!x.paid?new Date().toISOString().slice(0,10):null}).eq("id",id);
 if(q.error){alert(q.error.message);return;}await loadFinance();render();
});
document.querySelectorAll("[data-finance-season-select]").forEach(b=>b.onchange=()=>{financeSeasonId=b.value;render();});

 document.querySelectorAll("[data-perm-role]").forEach(b=>b.onchange=async()=>{const x=await sb.rpc("admin_update_permission",{p_role:b.dataset.permRole,p_permission:b.dataset.perm,p_enabled:b.checked});if(x.error){b.checked=!b.checked;alert(x.error.message);return;}await loadAccess();render();});
 document.querySelectorAll("[data-t]").forEach(b=>b.onchange=async()=>{
  const p=game().participants.find(x=>x.rowId===b.dataset.id);
  if(!p)return;
  p[b.dataset.t]=b.checked;
  if(b.dataset.t==="attended"&&!b.checked)p.paid=false;
  try{await save();await loadRemote();render();}catch(err){alert(err.message||"Could not save change.");render();}
});
}
document.addEventListener("click",e=>{const c=e.target.closest("[data-close]");if(c){e.preventDefault();document.getElementById("modal-root").innerHTML="";}});
console.info("[Football] APP BUILD 20260824-26 loaded");
document.addEventListener("submit",async e=>{
 console.info("[Football] SUBMIT EVENT", { id:e.target?.id, tag:e.target?.tagName, action:e.submitter?.textContent?.trim() });
 e.preventDefault();const f=new FormData(e.target);
 if(e.target.id==="finance-season-form"){
  if(!can("payments.manage"))return;
  const payload={name:f.get("name").trim(),starts_on:f.get("starts_on"),ends_on:f.get("ends_on"),season_ticket_amount:Number(f.get("season_ticket_amount")||0),pay_per_game_amount:Number(f.get("pay_per_game_amount")||0)};
  if(payload.ends_on<=payload.starts_on)return alert("Season end must be after season start.");
  const q=e.target.dataset.id?await sb.from("finance_seasons").update(payload).eq("id",e.target.dataset.id):await sb.from("finance_seasons").insert(payload);
  if(q.error){alert(q.error.message);return;}
  await loadFinance();document.getElementById("modal-root").innerHTML="";render();return;
}
if(e.target.id==="finance-expense-form"){
  if(!can("payments.manage"))return;
  const q=await sb.from("finance_expenses").insert({season_id:financeSeasonId,due_date:f.get("due_date"),description:f.get("description").trim(),category:"Pitch rental",amount:Number(f.get("amount")||0),paid:false});
  if(q.error){alert(q.error.message);return;}
  await loadFinance();document.getElementById("modal-root").innerHTML="";render();return;
}
if(e.target.id==="member-form"){const x=await sb.rpc("admin_upsert_access",{p_email:f.get("email").trim().toLowerCase(),p_display_name:f.get("display_name").trim(),p_role:f.get("role"),p_active:f.has("active")});if(x.error){alert(x.error.message);return;}await loadAccess();document.getElementById("modal-root").innerHTML="";render();return;}
 if(e.target.id==="game-form"){
  const date=f.get("date"),start=f.get("startTime"),end=f.get("endTime");
  if(!date||!start||!end)return alert("Date, start time and end time are required.");
  if(end<=start)return alert("End time must be later than start time.");
  const existingId=e.target.dataset.id;
  if(existingId){
    const g=state.games.find(x=>x.id===existingId);
    if(!g)return alert("Game no longer exists. Refresh and try again.");
    g.date=date;g.startTime=start;g.endTime=end;g.time=start+"–"+end;g.location=f.get("location").trim();
    gameId=g.id;
  }else{
    const g={id:crypto.randomUUID(),date,startTime:start,endTime:end,time:start+"–"+end,location:f.get("location").trim(),participants:[]};
    state.games.push(g);gameId=g.id;
  }
}
 if(e.target.id==="player-form"){let p=player(e.target.dataset.id);if(!p){p={id:crypto.randomUUID()};state.players.push(p);}p.name=f.get("name").trim();p.phone=f.get("phone")?.trim()||"";p.email=f.get("email")?.trim()||"";}
 const isPlayerPickForm=e.target?.tagName==="FORM" &&
   !!e.target.dataset.gameId &&
   !!e.target.querySelector('select[name="id"]');
 if(isPlayerPickForm){
   console.info("[Football] PICK-FORM REACHED", {
     formId:e.target.getAttribute("id"),
     gameId:e.target.dataset.gameId
   });
   const selectedGameId=e.target.dataset.gameId;
   const pid=String(f.get("id")||"");
   const g=state.games.find(x=>x.id===selectedGameId);
   const p=player(pid);
   console.groupCollapsed("[Football] Add player to game");
   console.log("Form data:", { selectedGameId, pid });
   console.log("Game found:", g ? { id:g.id, date:g.date, participants:g.participants.length } : null);
   console.log("Player found:", p ? { id:p.id, name:p.name } : null);
   if(!g||!pid){console.error("Missing game or player", {selectedGameId,pid});console.groupEnd();return alert("No game or player selected.");}
   if(!p){console.error("Player not found in current roster", {pid, playerIds:state.players.map(x=>x.id)});console.groupEnd();return alert("The selected player is not available in the current roster. Refresh the page and try again.");}
   if(g.participants.some(x=>!x.guest&&x.playerId===pid)){
     document.getElementById("modal-root").innerHTML="";
     render();
     return;
   }
   const payload={
     id:crypto.randomUUID(),
     game_id:selectedGameId,
     player_id:pid,
     guest_name:null,
     playing:true,
     attended:false,
     paid:false
   };
   console.log("Insert payload:", payload);
   const result=await sb.from("game_players").insert(payload).select("*").single();
   console.log("Supabase insert result:", {
     data:result.data,
     error:result.error ? {
       message:result.error.message,
       code:result.error.code,
       details:result.error.details,
       hint:result.error.hint
     } : null
   });
   if(result.error){
     if(result.error.code==="23505"){
       console.warn("Player already assigned according to Supabase (23505). Reloading game.", result.error);
       await loadRemote({resetSelection:false});
       gameId=selectedGameId;
       document.getElementById("modal-root").innerHTML="";
       render();
       return;
     }
     console.error("Player assignment failed.", result.error);
     console.groupEnd();
     alert("Could not add player to game: "+result.error.message);
     return;
   }
   const saved=result.data;
   console.log("Player assignment succeeded:", saved);
   console.groupEnd();
   g.participants.push({
     rowId:saved.id,
     playerId:saved.player_id,
     guest:false,
     name:p.name,
     playing:!!saved.playing,
     attended:!!saved.attended,
     paid:!!saved.paid
   });
   gameId=selectedGameId;
   document.getElementById("modal-root").innerHTML="";
   render();
   return;
 }
 if(e.target.id==="guest-form"){
   const g=game(),name=f.get("name").trim(),row={rowId:crypto.randomUUID(),playerId:null,guest:true,name,playing:true,attended:false,paid:false};
   if(!g||!name)return alert("No game or guest name supplied.");
   const x=await sb.from("game_players").insert({id:row.rowId,game_id:g.id,player_id:null,guest_name:name,playing:true,attended:false,paid:false});
   if(x.error){alert("Could not add guest: "+x.error.message);return;}
   g.participants.push(row);
   document.getElementById("modal-root").innerHTML="";render();return;
 }
 try{await save();await loadRemote();document.getElementById("modal-root").innerHTML="";render();}catch(err){alert(err.message||"Could not save changes.");}
});
document.getElementById("newGame").onclick=()=>{if(can("games.manage"))act("new-game");};
document.getElementById("signOut").onclick=async()=>{await sb.auth.signOut();location.reload();};
async function authScreen(){
 document.querySelector(".nav").style.display="none";document.getElementById("newGame").style.display="none";document.getElementById("signOut").style.display="none";
 document.getElementById("app").innerHTML='<section class="auth-card card"><div class="ball-logo">⚽</div><div class="eyebrow">ADMIN ACCESS</div><h1>Football</h1><p class="muted">Sign in with your Google account.</p><button id="google-login" class="btn btn-primary">Continue with Google</button><p id="auth-error" class="auth-error"></p></section>';
 document.getElementById("google-login").onclick=async()=>{const x=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+window.location.pathname}});if(x.error)document.getElementById("auth-error").textContent=x.error.message;};
}
async function boot(){
 if(!sb){showFatal(window.supabaseInitError?.message||"Supabase client unavailable.");return;}
 try{
  const s=await sb.auth.getSession();currentUser=s.data?.session?.user||null;
  if(!currentUser){await authScreen();return;}
  const ok=await loadAccess();
  if(!ok){document.getElementById("signOut").style.display="";accessDenied();return;}
  document.getElementById("newGame").style.display=can("games.manage")?"":"none";document.getElementById("signOut").style.display="";
  await loadRemote();render();
 }catch(e){showFatal(e.message||"Unexpected startup error.");}
}
boot();
})();