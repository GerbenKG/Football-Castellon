(() => {
"use strict";
let state={players:[],games:[]}, view="dashboard", gameId=null, currentUser=null, gameFilter="upcoming";
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

function showFatal(m){document.getElementById("app").innerHTML='<section class="card error-card"><h2>Friday Football could not start</h2><p>'+esc(m)+'</p></section>';}
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
function friday(){
 const d=new Date(), add=((5-d.getDay())+7)%7||7; d.setDate(d.getDate()+add);
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
  if(state.players.length)await check(await sb.from("players").upsert(state.players.map(p=>({id:p.id,name:p.name,model:p.model,season_paid:!!p.seasonPaid}))),"Saving players");
  for(const p of rp.data||[])if(!ids.has(p.id))await check(await sb.from("players").delete().eq("id",p.id),"Deleting player");
 }
 if(can("games.manage")){
  const rg=await check(await sb.from("games").select("id"),"Loading games");
  const ids=new Set(state.games.map(g=>g.id));
  if(state.games.length)await check(await sb.from("games").upsert(state.games.map(g=>({id:g.id,game_date:g.date,start_time:g.startTime,end_time:g.endTime,location:g.location}))),"Saving games");
  for(const g of rg.data||[])if(!ids.has(g.id))await check(await sb.from("games").delete().eq("id",g.id),"Deleting game");
 }
 if(can("attendance.manage")){
  const rr=await check(await sb.from("game_players").select("id"),"Loading Friday squad");
  const ids=new Set(),rows=[];
  state.games.forEach(g=>(g.participants||[]).forEach(x=>{
   if(!x.rowId)x.rowId=crypto.randomUUID();ids.add(x.rowId);
   rows.push({id:x.rowId,game_id:g.id,player_id:x.guest?null:x.playerId,guest_name:x.guest?x.name:null,playing:!!x.playing,attended:!!x.attended,paid:!!x.paid});
  }));
  if(rows.length)await check(await sb.from("game_players").upsert(rows),"Saving Friday squad");
  for(const x of rr.data||[])if(!ids.has(x.id))await check(await sb.from("game_players").delete().eq("id",x.id),"Deleting Friday squad record");
 }
 if(can("payments.manage")){
  await check(await sb.from("payments").delete().neq("id","00000000-0000-0000-0000-000000000000"),"Resetting payments");
  const ps=[];
  state.players.filter(p=>p.model==="season"&&p.seasonPaid).forEach(p=>ps.push({id:crypto.randomUUID(),player_id:p.id,payment_type:"season",paid:true}));
  state.games.forEach(g=>(g.participants||[]).forEach(x=>{if(!x.guest&&x.attended&&x.paid)ps.push({id:crypto.randomUUID(),player_id:x.playerId,game_id:g.id,payment_type:"game",paid:true});}));
  if(ps.length)await check(await sb.from("payments").insert(ps),"Saving payments");
 }
}

async function loadRemote(){
 const p=await sb.from("players").select("*").order("name");
 const g=await sb.from("games").select("*").order("game_date");
 const r=await sb.from("game_players").select("*");
 if(p.error||g.error||r.error)throw(p.error||g.error||r.error);
 state.players=(p.data||[]).map(x=>({id:x.id,name:x.name,model:x.model,seasonPaid:x.season_paid}));
 state.games=(g.data||[]).map(x=>({id:x.id,date:x.game_date,startTime:String(x.start_time).slice(0,5),endTime:String(x.end_time).slice(0,5),time:String(x.start_time).slice(0,5)+"–"+String(x.end_time).slice(0,5),location:x.location,participants:[]}));
 const map=new Map(state.games.map(x=>[x.id,x]));
 (r.data||[]).forEach(x=>{const g=map.get(x.game_id);if(g)g.participants.push({rowId:x.id,playerId:x.player_id,guest:!x.player_id,name:x.guest_name,playing:x.playing,attended:x.attended,paid:x.paid});});
 if(!state.games.length&&can("games.manage")){state.games=makeSeasonGames();gameId=state.games[0]?.id;await save();}
 gameId=state.games.find(x=>x.date>=new Date().toISOString().slice(0,10))?.id||state.games[0]?.id;
}
function dashboard(){
 const g=game(),rows=g.participants||[],playing=rows.filter(x=>x.playing).length,present=rows.filter(x=>x.attended).length;
 const season=state.players.filter(p=>p.model==="season"),pay=state.players.filter(p=>p.model==="game");
 const due=rows.filter(x=>x.attended&&!x.guest&&player(x.playerId)?.model==="game"&&!x.paid).length;
 const att=p=>{const a=state.games.flatMap(x=>x.participants||[]).filter(x=>!x.guest&&x.playerId===p.id);return a.length?a.filter(x=>x.attended).length/a.length*100:0;};
 const all=state.players.length?state.players.reduce((a,p)=>a+att(p),0)/state.players.length:0;
 const payAvg=pay.length?pay.reduce((a,p)=>a+att(p),0)/pay.length:0;
 const completed=state.games.filter(x=>(x.participants||[]).some(p=>p.attended)).length;
 const total=state.games.reduce((a,x)=>a+(x.participants||[]).filter(p=>p.attended).length,0);
 const avg=completed?total/completed:0;
 const paid=state.games.reduce((a,x)=>a+(x.participants||[]).filter(p=>p.attended&&!p.guest&&player(p.playerId)?.model==="game"&&p.paid).length,0);
 const payable=state.games.reduce((a,x)=>a+(x.participants||[]).filter(p=>p.attended&&!p.guest&&player(p.playerId)?.model==="game").length,0);
 const collection=payable?paid/payable*100:0;
 const leaders=[...state.players].sort((a,b)=>att(b)-att(a)).slice(0,5);
 return '<section class="hero"><div class="hero-pitch"></div><div class="hero-copy"><div class="eyebrow light">NEXT FRIDAY</div><h1>'+dateText(g.date)+'</h1><p>⚽ '+esc(g.time)+' · '+esc(g.location)+'</p><div class="hero-actions">'+(can("players.manage")&&can("attendance.manage")?'<button class="btn btn-light" data-a="add-player">+ Player</button>':"")+(can("attendance.manage")?'<button class="btn btn-ghost" data-a="guest">+ Guest</button>':"")+'</div></div><div class="hero-ball">⚽</div></section>'+
 '<div class="stats"><div class="stat"><div class="stat-icon">⚽</div><div><small>PLAYING FRIDAY</small><strong>'+playing+'</strong></div></div><div class="stat"><div class="stat-icon">✓</div><div><small>PRESENT FRIDAY</small><strong>'+present+'</strong></div></div><div class="stat"><div class="stat-icon">🎟</div><div><small>SEASON TICKETS</small><strong>'+season.length+'</strong></div></div><div class="stat"><div class="stat-icon">€</div><div><small>PAYMENTS DUE</small><strong>'+due+'</strong></div></div></div>'+
 '<section class="analytics-grid"><div class="card analytics-card"><div class="card-title"><div><h3>Attendance overview</h3><p>Average attendance across recorded appearances.</p></div></div><div class="metric-row"><div><small>ALL PLAYERS</small><strong>'+all.toFixed(0)+'%</strong></div><div><small>PAY PER GAME</small><strong>'+payAvg.toFixed(0)+'%</strong></div><div><small>AVG PRESENT / GAME</small><strong>'+avg.toFixed(1)+'</strong></div></div></div>'+
 '<div class="card analytics-card"><div class="card-title"><div><h3>Payments</h3><p>Collection performance.</p></div></div><div class="progress-value"><strong>'+collection.toFixed(0)+'%</strong><span>'+paid+' of '+payable+' game payments collected</span></div><div class="progress"><i style="width:'+collection+'%"></i></div><div class="mini-stats"><span>Season tickets paid <b>'+season.filter(p=>p.seasonPaid).length+'/'+season.length+'</b></span><span>Games with attendance <b>'+completed+'</b></span></div></div></section>'+
 '<section class="section"><div class="section-head"><div><h2>Attendance leaders</h2><p>Top players by attendance rate.</p></div><button class="btn btn-secondary" data-view="players">View players →</button></div><div class="card leaders">'+leaders.map(p=>'<div class="leader-row"><div class="who"><span class="avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</span><div><b>'+esc(p.name)+'</b><small>'+((p.model==="season")?"🎟 Season ticket":"Per game")+'</small></div></div><strong>'+att(p).toFixed(0)+'%</strong></div>').join("")+'</div></section>'+
 '<section class="section"><div class="section-head"><div><h2>Friday squad</h2><p>Manage attendance and payment for this match.</p></div></div><div class="squad card">'+rows.map(x=>{
  const p=x.guest?null:player(x.playerId),name=x.guest?x.name:(p?.name||"Player"),type=x.guest?"Guest":p?.model==="season"?"🎟 Season":"Per game";
  const payLabel=x.guest?(x.paid?"Paid":"Due"):(p?.model==="season"?(p.seasonPaid?"Season paid":"Season unpaid"):(x.paid?"Paid":"Mark paid"));
  const pc=x.guest||p?.model==="season"?(x.paid||p?.seasonPaid?"green":"amber"):(x.paid?"green":"red");
  return '<div class="squad-row"><div class="who"><span class="avatar">'+esc(name).slice(0,1).toUpperCase()+'</span><div><b>'+esc(name)+'</b><small>'+type+'</small></div></div>'+(can("attendance.manage")?'<label class="toggle"><input type="checkbox" data-t="playing" data-id="'+x.rowId+'" '+(x.playing?"checked":"")+'><span>Playing</span></label><label class="toggle"><input type="checkbox" data-t="attended" data-id="'+x.rowId+'" '+(x.attended?"checked":"")+'><span>Present</span></label>':'<span>'+badge(x.playing?"Playing":"Not playing",x.playing?"green":"slate")+'</span>')+(can("payments.manage")&&(!x.guest&&p?.model==="game" || x.guest)?'<label class="toggle payment-toggle"><input type="checkbox" data-t="paid" data-id="'+x.rowId+'" '+(x.paid?"checked":"")+'><span>Paid</span></label>':'<span>'+badge(payLabel,pc)+'</span>')+(can("attendance.manage")?'<button class="remove" data-a="remove" data-id="'+x.rowId+'">×</button>':"")+'</div>';
 }).join("")+'</div></section>';
}
function players(){
 return '<div class="page-head"><div><div class="eyebrow">ROSTER</div><h1 class="title">Players</h1><p class="muted">Payment model and season-ticket status.</p></div>'+(can("players.manage")?'<button class="btn btn-primary" data-a="new-player">+ Add player</button>':"")+'</div>'+
 '<div class="card table-card"><table><thead><tr><th>Player</th><th>Payment model</th><th>Season ticket</th><th></th></tr></thead><tbody>'+
 state.players.map(p=>{
   const actions='<button class="btn btn-secondary" data-a="history" data-id="'+p.id+'">Attendance</button>'+
     (can("players.manage")?'<button class="btn btn-secondary" data-a="edit" data-id="'+p.id+'">Edit</button>':"")+
     (can("players.manage")&&can("attendance.manage")?'<button class="btn btn-secondary" data-a="delete-player" data-id="'+p.id+'">Delete</button>':"");
   return '<tr><td><div class="who"><span class="avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</span><b>'+esc(p.name)+'</b></div></td><td>'+
     badge(p.model==="season"?"🎟 Season ticket":"Per game",p.model==="season"?"green":"slate")+'</td><td>'+
     (p.model==="season"?(p.seasonPaid?badge("✓ Paid","green"):badge("Unpaid","red")):"—")+
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
 return '<div class="page-head"><div><div class="eyebrow">FRIDAY OVERVIEW</div><h1 class="title">Who is playing?</h1><p class="muted">A quick view of every Friday, who is playing, who attended and which guests joined.</p></div>'+(can("games.manage")?'<button class="btn btn-primary" data-a="new-game">+ New Friday</button>':"")+'</div>'+
   '<section class="game-overview-hero card">'+
     '<div><div class="eyebrow">NEXT FRIDAY</div><h2>'+esc(next?dateText(next.date):"No upcoming Friday")+'</h2><p>'+esc(next?next.time+" · "+next.location:"Create a game to get started")+'</p></div>'+
     '<div class="next-count"><strong>'+((next?.participants||[]).filter(x=>x.playing).length)+'</strong><span>playing</span></div>'+
     (next&&can("games.view")?'<button class="btn btn-primary" data-game="'+next.id+'">Open squad →</button>':"")+
   '</section>'+
   '<div class="game-filter-bar">'+filterButton("upcoming","Upcoming",upcoming.length)+filterButton("past","Played",past.length)+filterButton("all","All Fridays",state.games.length)+'</div>'+
   '<div class="game-overview-list">'+(list.length?list.map(g=>gameOverviewCard(g,today)).join(""):'<section class="card empty"><h2>No Fridays here</h2><p>Try another filter.</p></section>')+'</div>';
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
  if(!confirm("Remove "+label+" from this Friday squad?"))return;
  game().participants=game().participants.filter(x=>x.rowId!==id);
  save().then(()=>loadRemote()).then(render).catch(err=>alert(err.message||"Could not remove squad member."));
  return;
}
 if(a==="delete-player"){if(!can("players.manage")||!can("attendance.manage"))return;const p=player(id);if(!p||!confirm("Delete "+p.name+"? This also removes their Friday records."))return;state.players=state.players.filter(x=>x.id!==id);state.games.forEach(g=>g.participants=g.participants.filter(x=>x.playerId!==id));save().then(render);return;}
 if(a==="delete-game"){if(!can("games.manage")||!can("attendance.manage")||!can("payments.manage"))return;const t=state.games.find(x=>x.id===id);if(!t||state.games.length<=1)return alert("You must keep at least one Friday game.");if(!confirm("Delete "+dateText(t.date)+"? Attendance and payment records will also be removed."))return;state.games=state.games.filter(x=>x.id!==id);gameId=state.games[0]?.id;save().then(render);return;}
 if(a==="new-game"){return modal("New Friday",'<form id="game-form"><label>Date<input name="date" type="date" value="'+friday()+'" required></label><label>Kickoff<input name="time" type="time" value="19:30"></label><label>Location<input name="location" value="Castellón"></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Create Friday</button></div></form>');}
 if(a==="new-player"||a==="edit"){const p=a==="edit"?player(id):null;return modal(p?"Edit player":"Add player",'<form id="player-form" data-id="'+(p?.id||"")+'"><label>Name<input name="name" value="'+esc(p?.name||"")+'" required></label><label>Payment model<select name="model"><option value="game" '+(p?.model==="game"?"selected":"")+'>Pay per game</option><option value="season" '+(p?.model==="season"?"selected":"")+'>Season ticket</option></select></label><label class="checkline"><input name="seasonPaid" type="checkbox" '+(p?.seasonPaid?"checked":"")+'> Season ticket paid</label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save player</button></div></form>');}
 if(a==="history"){
  const p=player(id);
  if(!p)return;
  const attended=state.games.filter(g=>(g.participants||[]).some(x=>!x.guest&&x.playerId===p.id&&x.attended)).sort((a,b)=>b.date.localeCompare(a.date));
  const body=attended.length
    ? '<div class="history-list">'+attended.map(g=>{
        const x=(g.participants||[]).find(x=>!x.guest&&x.playerId===p.id&&x.attended);
        return '<div class="history-row"><div><b>'+esc(dateText(g.date))+'</b><small>⚽ '+esc(g.time)+' · '+esc(g.location)+'</small></div><span>'+badge(x?.paid?"Paid":"Attended",x?.paid?"green":"slate")+'</span></div>';
      }).join("")+'</div>'
    : '<p class="muted">No attended Fridays recorded yet.</p>';
  return modal("Attendance history — "+esc(p.name),body+'<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Close</button></div>');
}
if(a==="add-player"){const used=new Set(game().participants.filter(x=>!x.guest).map(x=>x.playerId)),av=state.players.filter(p=>!used.has(p.id));return modal("Add player to Friday",'<form id="pick-form"><label>Player<select name="id">'+av.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join("")+'</select></label>'+(av.length?'':'<p class="notice">Everyone on the roster is already assigned to this Friday.</p>')+'<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" '+(!av.length?"disabled":"")+'>Add player</button></div></form>');}
 if(a==="guest")return modal("Add guest",'<form id="guest-form"><label>Guest name<input name="name" required autofocus></label><p class="notice">Guest payment is tracked for this Friday only.</p><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Add guest</button></div></form>');
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
 app.innerHTML=previewBanner()+(view==="dashboard"?dashboard():view==="players"?players():view==="games"?games():view==="admin"?admin():dashboard());
 document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
 document.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>act(b.dataset.a,b.dataset.id));
 document.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>{gameId=b.dataset.game;view="dashboard";render();});
 document.querySelectorAll("[data-game-filter]").forEach(b=>b.onclick=()=>{gameFilter=b.dataset.gameFilter;render();});
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
document.addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.target);
 if(e.target.id==="member-form"){const x=await sb.rpc("admin_upsert_access",{p_email:f.get("email").trim().toLowerCase(),p_display_name:f.get("display_name").trim(),p_role:f.get("role"),p_active:f.has("active")});if(x.error){alert(x.error.message);return;}await loadAccess();document.getElementById("modal-root").innerHTML="";render();return;}
 if(e.target.id==="game-form"){const date=f.get("date"),summer=[6,7].includes(new Date(date+"T12:00:00").getMonth()),start=summer?"20:00":f.get("time"),end=summer?"22:00":(()=>{const z=start.split(":").map(Number);return String(z[0]+2).padStart(2,"0")+":"+String(z[1]).padStart(2,"0")})();const g={id:crypto.randomUUID(),date,startTime:start,endTime:end,time:start+"–"+end,location:f.get("location"),participants:[]};state.games.push(g);gameId=g.id;}
 if(e.target.id==="player-form"){let p=player(e.target.dataset.id);if(!p){p={id:crypto.randomUUID()};state.players.push(p);}p.name=f.get("name").trim();p.model=f.get("model");p.seasonPaid=f.has("seasonPaid");}
 if(e.target.id==="pick-form"){
   const g=game(),pid=f.get("id"),p=player(pid);
   if(!g||!pid)return alert("No Friday or player selected.");
   if(!p)return alert("The selected player is not available in the current roster. Refresh the page and try again.");
   const local=g.participants.find(x=>!x.guest&&x.playerId===pid);
   if(local){document.getElementById("modal-root").innerHTML="";render();return;}
   const q=await sb.from("game_players").select("*").eq("game_id",g.id).eq("player_id",pid);
   if(q.error){alert("Could not check the Friday squad: "+q.error.message);return;}
   if(q.data?.length){
     const x=q.data[0];
     g.participants.push({rowId:x.id,playerId:x.player_id,guest:false,name:p.name,playing:!!x.playing,attended:!!x.attended,paid:!!x.paid});
     document.getElementById("modal-root").innerHTML="";render();return;
   }
   const row={rowId:crypto.randomUUID(),playerId:p.id,guest:false,name:p.name,playing:true,attended:false,paid:false};
   // Do not chain .select() to the INSERT: with RLS, INSERT may be allowed while
   // the post-insert SELECT is denied, which makes a successful assignment look failed.
   const x=await sb.from("game_players").insert({id:row.rowId,game_id:g.id,player_id:p.id,guest_name:null,playing:true,attended:false,paid:false});
   if(x.error){alert("Could not add player to Friday: "+x.error.message);return;}
   g.participants.push(row);
   document.getElementById("modal-root").innerHTML="";render();
   return;
 }
 if(e.target.id==="guest-form"){
   const g=game(),name=f.get("name").trim(),row={rowId:crypto.randomUUID(),playerId:null,guest:true,name,playing:true,attended:false,paid:false};
   if(!g||!name)return alert("No Friday or guest name supplied.");
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
 document.getElementById("app").innerHTML='<section class="auth-card card"><div class="ball-logo">⚽</div><div class="eyebrow">ADMIN ACCESS</div><h1>Friday Football</h1><p class="muted">Sign in with your Google account.</p><button id="google-login" class="btn btn-primary">Continue with Google</button><p id="auth-error" class="auth-error"></p></section>';
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