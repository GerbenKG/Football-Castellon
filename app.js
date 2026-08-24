(() => {
  "use strict";
  const KEY = "football-castellon-v6";
  const friday = () => {
    const d = new Date();
    const add = ((5 - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + add);
    return d.toISOString().slice(0, 10);
  };
  const makeSeasonGames = () => {
    const games = [];
    const start = new Date("2026-09-04T12:00:00");
    const end = new Date("2027-08-31T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      const date = d.toISOString().slice(0,10);
      const summer = d.getMonth() === 6 || d.getMonth() === 7;
      games.push({id:crypto.randomUUID(),date,startTime:summer?"20:00":"19:30",endTime:summer?"22:00":"21:30",time:summer?"20:00–22:00":"19:30–21:30",location:"Castellón",participants:[]});
    }
    return games;
  };

  const save = async () => {
    if (!currentUser) return;
    const {data: remotePlayers} = await sb.from("players").select("id");
    const {data: remoteGames} = await sb.from("games").select("id");
    const {data: remoteRows} = await sb.from("game_players").select("id");
    const playerIds = new Set(state.players.map(p=>p.id));
    const gameIds = new Set(state.games.map(g=>g.id));
    const rowIds = new Set();
    if (state.players.length) await sb.from("players").upsert(state.players.map(p=>({id:p.id,name:p.name,model:p.model,season_paid:!!p.seasonPaid})));
    if (state.games.length) await sb.from("games").upsert(state.games.map(g=>({id:g.id,game_date:g.date,start_time:g.startTime||g.time.slice(0,5),end_time:g.endTime||g.time.slice(-5),location:g.location})));
    const rows=[];
    state.games.forEach(g=>(g.participants||[]).forEach(x=>{
      if(!x.rowId)x.rowId=crypto.randomUUID();
      rowIds.add(x.rowId);
      rows.push({id:x.rowId,game_id:g.id,player_id:x.guest?null:x.playerId,guest_name:x.guest?x.name:null,playing:!!x.playing,attended:!!x.attended,paid:!!x.paid});
    }));
    if(rows.length) await sb.from("game_players").upsert(rows);
    await sb.from("payments").delete().neq("id","00000000-0000-0000-0000-000000000000");
    const payments=[];
    state.players.filter(p=>p.model==="season"&&p.seasonPaid).forEach(p=>payments.push({id:crypto.randomUUID(),player_id:p.id,payment_type:"season",paid:true}));
    state.games.forEach(g=>(g.participants||[]).forEach(x=>{
      if(!x.guest&&x.attended&&x.paid){payments.push({id:crypto.randomUUID(),player_id:x.playerId,game_id:g.id,payment_type:"game",paid:true});}
    }));
    if(payments.length) await sb.from("payments").insert(payments);
    if(remoteRows?.length) for(const r of remoteRows) if(!rowIds.has(r.id)) await sb.from("game_players").delete().eq("id",r.id);
    if(remoteGames?.length) for(const g of remoteGames) if(!gameIds.has(g.id)) await sb.from("games").delete().eq("id",g.id);
    if(remotePlayers?.length) for(const p of remotePlayers) if(!playerIds.has(p.id)) await sb.from("players").delete().eq("id",p.id);
  };

  const loadRemote = async () => {
    const {data:players,error:pe}=await sb.from("players").select("*").order("name");
    const {data:games,error:ge}=await sb.from("games").select("*").order("game_date");
    const {data:rows,error:re}=await sb.from("game_players").select("*");
    if(pe||ge||re) throw new Error((pe||ge||re).message);
    state.players=(players||[]).map(p=>({id:p.id,name:p.name,model:p.model,seasonPaid:p.season_paid}));
    state.games=(games||[]).map(g=>({id:g.id,date:g.game_date,startTime:String(g.start_time).slice(0,5),endTime:String(g.end_time).slice(0,5),time:String(g.start_time).slice(0,5)+"–"+String(g.end_time).slice(0,5),location:g.location,participants:[]}));
    const byGame=new Map(state.games.map(g=>[g.id,g]));
    (rows||[]).forEach(r=>{const g=byGame.get(r.game_id);if(!g)return;g.participants.push({rowId:r.id,playerId:r.player_id||r.id,guest:!r.player_id,name:r.guest_name,playing:r.playing,attended:r.attended,paid:r.paid});});
    if(!state.games.length){state.games=makeSeasonGames();gameId=state.games[0]?.id;await save();}
    gameId=state.games.find(g=>g.date>=new Date().toISOString().slice(0,10))?.id || state.games[0]?.id;
  };

  const authScreen = () => {
    document.getElementById("app").innerHTML='<section class="auth-card card"><div class="ball-logo">⚽</div><div class="eyebrow">ADMIN ACCESS</div><h1>Friday Football</h1><p class="muted">Sign in to manage players, games, attendance and payments.</p><form id="login-form"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="btn btn-primary" type="submit">Sign in</button></form><p id="auth-error" class="auth-error"></p></section>';
  };

  const boot = async () => {
    const {data:{session}}=await sb.auth.getSession();
    currentUser=session?.user||null;
    if(!currentUser){document.getElementById("newGame").style.display="none";document.getElementById("signOut").style.display="none";document.querySelector(".nav").style.display="none";authScreen();return;}
    document.getElementById("newGame").style.display="";document.getElementById("signOut").style.display="";document.querySelector(".nav").style.display="";
    try{await loadRemote();render();}catch(err){document.getElementById("app").innerHTML='<section class="card error-card"><h2>Database access is not configured</h2><p>'+esc(err.message||"Unable to load Supabase data.")+'</p><p class="muted">The database is protected by Row Level Security. Run the SQL setup in <b>supabase-rls.sql</b> from the repository, then refresh.</p><button class="btn btn-primary" onclick="location.reload()">Retry</button></section>';}
  };


  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const player = id => state.players.find(p => p.id === id);
  const game = () => state.games.find(g => g.id === gameId) || state.games[0];
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const dateText = d => new Date(d+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
  const badge = (text, cls="slate") => '<span class="badge badge-'+cls+'">'+text+'</span>';

  function dashboard() {
    const g = game();
    const rows = g.participants;
    const playing = rows.filter(x=>x.playing).length;
    const present = rows.filter(x=>x.attended).length;
    const due = rows.filter(x=>x.attended && !x.guest && player(x.playerId)?.model==="game" && !x.paid).length;
    const seasonPlayers = state.players.filter(p=>p.model==="season");
    const seasonPaid = seasonPlayers.filter(p=>p.seasonPaid).length;
    const regularPlayers = state.players.filter(p=>p.model==="game");

    const attendanceFor = p => {
      const appearances = state.games.flatMap(x => x.participants || []).filter(x => !x.guest && x.playerId === p.id);
      return appearances.length ? (appearances.filter(x => x.attended).length / appearances.length) * 100 : 0;
    };
    const allAttendance = state.players.length ? state.players.reduce((sum,p)=>sum+attendanceFor(p),0) / state.players.length : 0;
    const payAttendance = regularPlayers.length ? regularPlayers.reduce((sum,p)=>sum+attendanceFor(p),0) / regularPlayers.length : 0;
    const completedGames = state.games.filter(x => (x.participants||[]).some(p => p.attended)).length;
    const totalPresent = state.games.reduce((sum,x)=>sum+(x.participants||[]).filter(p=>p.attended).length,0);
    const avgPresent = completedGames ? totalPresent / completedGames : 0;
    const paidGames = state.games.reduce((sum,x)=>sum+(x.participants||[]).filter(p=>p.attended && !p.guest && player(p.playerId)?.model==="game" && p.paid).length,0);
    const payableGames = state.games.reduce((sum,x)=>sum+(x.participants||[]).filter(p=>p.attended && !p.guest && player(p.playerId)?.model==="game").length,0);
    const collection = payableGames ? (paidGames/payableGames)*100 : 0;
    const leaders = [...state.players].sort((a,b)=>attendanceFor(b)-attendanceFor(a)).slice(0,5);

    return '<section class="hero"><div class="hero-pitch"></div><div class="hero-copy"><div class="eyebrow light">NEXT FRIDAY</div><h1>'+dateText(g.date)+'</h1><p>⚽ '+esc(g.time)+' &nbsp; · &nbsp; '+esc(g.location)+'</p><div class="hero-actions"><button class="btn btn-light" data-a="add-player">+ Player</button><button class="btn btn-ghost" data-a="guest">+ Guest</button></div></div><div class="hero-ball">⚽</div></section>'+
      '<div class="stats">'+
      '<div class="stat"><div class="stat-icon">⚽</div><div><small>PLAYING FRIDAY</small><strong>'+playing+'</strong></div></div>'+
      '<div class="stat"><div class="stat-icon">✓</div><div><small>PRESENT FRIDAY</small><strong>'+present+'</strong></div></div>'+
      '<div class="stat"><div class="stat-icon">🎟</div><div><small>SEASON TICKETS</small><strong>'+seasonPlayers.length+'</strong></div></div>'+
      '<div class="stat"><div class="stat-icon">€</div><div><small>PAYMENTS DUE</small><strong>'+due+'</strong></div></div></div>'+
      '<section class="analytics-grid">'+
        '<div class="card analytics-card"><div class="card-title"><div><h3>Attendance overview</h3><p>Based on recorded games for each player.</p></div></div><div class="metric-row"><div><small>ALL PLAYERS</small><strong>'+allAttendance.toFixed(0)+'%</strong></div><div><small>PAY PER GAME</small><strong>'+payAttendance.toFixed(0)+'%</strong></div><div><small>AVG PLAYERS / GAME</small><strong>'+avgPresent.toFixed(1)+'</strong></div></div></div>'+
        '<div class="card analytics-card"><div class="card-title"><div><h3>Payments</h3><p>Collection performance for pay-per-game players.</p></div></div><div class="progress-value"><strong>'+collection.toFixed(0)+'%</strong><span>'+paidGames+' of '+payableGames+' game payments collected</span></div><div class="progress"><i style="width:'+collection+'%"></i></div><div class="mini-stats"><span>Season tickets paid <b>'+seasonPaid+'/'+seasonPlayers.length+'</b></span><span>Games with attendance <b>'+completedGames+'</b></span></div></div>'+
      '</section>'+
      '<section class="section"><div class="section-head"><div><h2>Attendance leaders</h2><p>Top players by attendance rate.</p></div><button class="btn btn-secondary" data-view="players">View players →</button></div><div class="card leaders">'+leaders.map(p=>'<div class="leader-row"><div class="who"><span class="avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</span><div><b>'+esc(p.name)+'</b><small>'+ (p.model==="season"?"🎟 Season ticket":"Per game")+'</small></div></div><strong>'+attendanceFor(p).toFixed(0)+'%</strong></div>').join("")+'</div></section>'+
      '<section class="section"><div class="section-head"><div><h2>Friday squad</h2><p>Manage attendance and payment for this match.</p></div></div>'+
      '<div class="squad card">'+rows.map(x=>{
        const p=x.guest?null:player(x.playerId); const name=x.guest?x.name:(p?.name||"Player");
        const type=x.guest?"Guest":p?.model==="season"?"🎟 Season":"Per game";
        let pay=x.guest||p?.model==="season" ? (x.guest?(x.paid?"Paid":"Due"):(p?.seasonPaid?"Season paid":"Season unpaid")) : (x.paid?"Paid":"Mark paid");
        const pc=x.guest||p?.model==="season" ? (x.paid||p?.seasonPaid?"green":"amber") : (x.paid?"green":"red");
        return '<div class="squad-row"><div class="who"><span class="avatar">'+esc(name).slice(0,1).toUpperCase()+'</span><div><b>'+esc(name)+'</b><small>'+type+'</small></div></div><label class="toggle"><input type="checkbox" data-t="playing" data-id="'+x.playerId+'" '+(x.playing?"checked":"")+'><span>Playing</span></label><label class="toggle"><input type="checkbox" data-t="attended" data-id="'+x.playerId+'" '+(x.attended?"checked":"")+'><span>Present</span></label><span>'+badge(pay,pc)+'</span><button class="remove" data-a="remove" data-id="'+x.playerId+'">×</button></div>';
      }).join("")+'</div></section>';
  }

  function calendar() {
    const y=month.getFullYear(), m=month.getMonth(), first=new Date(y,m,1), start=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate();
    let cells="";
    for(let i=0;i<42;i++){let n=i-start+1,d=new Date(y,m,n),muted=n<1||n>days,iso=d.toISOString().slice(0,10),gs=state.games.filter(g=>g.date===iso);cells+='<div class="cal-day '+(muted?"muted":"")+'"><b>'+d.getDate()+'</b>'+gs.map(g=>'<button class="game-chip" data-game="'+g.id+'">⚽ '+esc(g.time)+'<small>'+esc(g.location)+'</small></button>').join("")+'</div>';}
    return '<div class="page-head"><div><div class="eyebrow">SCHEDULE</div><h1 class="title">Match calendar</h1><p class="muted">Friday games, attendance and match history.</p></div><div class="actions"><button class="btn btn-secondary" data-a="prev">←</button><button class="btn btn-secondary">'+month.toLocaleDateString("en-GB",{month:"long",year:"numeric"})+'</button><button class="btn btn-secondary" data-a="next">→</button><button class="btn btn-primary" data-a="new-game">+ New Friday</button></div></div><div class="calendar card"><div class="cal-head"><b>Mon</b><b>Tue</b><b>Wed</b><b>Thu</b><b>Fri</b><b>Sat</b><b>Sun</b></div><div class="cal-grid">'+cells+'</div></div>';
  }

  function players() {
    return '<div class="page-head"><div><div class="eyebrow">ROSTER</div><h1 class="title">Players</h1><p class="muted">Payment model and season-ticket status.</p></div><button class="btn btn-primary" data-a="new-player">+ Add player</button></div><div class="card table-card"><table><thead><tr><th>Player</th><th>Payment model</th><th>Season ticket</th><th></th></tr></thead><tbody>'+state.players.map(p=>'<tr><td><div class="who"><span class="avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</span><b>'+esc(p.name)+'</b></div></td><td>'+badge(p.model==="season"?"🎟 Season ticket":"Per game",p.model==="season"?"green":"slate")+'</td><td>'+(p.model==="season"?(p.seasonPaid?badge("✓ Paid","green"):badge("Unpaid","red")):"—")+'</td><td><div class="actions"><button class="btn btn-secondary" data-a="edit" data-id="'+p.id+'">Edit</button><button class="btn btn-secondary" data-a="delete-player" data-id="'+p.id+'">Delete</button></div></td></tr>').join("")+'</tbody></table></div>';
  }

  function games() {
    return '<div class="page-head"><div><div class="eyebrow">HISTORY</div><h1 class="title">Friday games</h1><p class="muted">A simple record of every match.</p></div><button class="btn btn-primary" data-a="new-game">+ New Friday</button></div><div class="game-list">'+state.games.map(g=>'<div class="card game-item"><div><div class="eyebrow">'+esc(g.date)+'</div><h3>⚽ Friday Football</h3><p>'+esc(g.time)+' · '+esc(g.location)+'</p></div><div class="actions"><button class="btn btn-primary" data-game="'+g.id+'">Open →</button><button class="btn btn-secondary" data-a="delete-game" data-id="'+g.id+'">Delete</button></div></div>').join("")+'</div>';
  }

  function modal(title,body){document.getElementById("modal-root").innerHTML='<div class="modal-bg" data-close><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><h2>'+title+'</h2><button class="remove" data-close>×</button></div>'+body+'</div></div>';}

  function act(a,id){
    if(a==="prev"){month.setMonth(month.getMonth()-1);return render();}
    if(a==="next"){month.setMonth(month.getMonth()+1);return render();}
    if(a==="remove"){game().participants=game().participants.filter(x=>x.playerId!==id);save();return render();}
    if(a==="delete-player"){
      const p=player(id);
      if(!p)return;
      if(!confirm("Delete "+p.name+"? This will also remove them from all Friday games."))return;
      state.players=state.players.filter(x=>x.id!==id);
      state.games.forEach(g=>g.participants=g.participants.filter(x=>x.playerId!==id));
      save();return render();
    }
    if(a==="delete-game"){
      if(state.games.length<=1){alert("You must keep at least one Friday game.");return;}
      const target=state.games.find(g=>g.id===id);
      if(!target)return;
      if(!confirm("Delete Friday "+dateText(target.date)+"? This will also remove its attendance and payment records."))return;
      state.games=state.games.filter(g=>g.id!==id);
      if(target.date && !state.deletedDates.includes(target.date)) state.deletedDates.push(target.date);
      gameId=state.games[0].id;
      save();return render();
    }
    if(a==="new-game")return modal("New Friday",'<form id="game-form"><label>Date<input name="date" type="date" value="'+friday()+'" required></label><label>Kickoff<input name="time" type="time" value="20:00"></label><label>Location<input name="location" value="Castellón"></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Create Friday</button></div></form>');
    if(a==="new-player"||a==="edit"){const p=a==="edit"?player(id):null;return modal(p?"Edit player":"Add player",'<form id="player-form" data-id="'+(p?.id||"")+'"><label>Name<input name="name" value="'+esc(p?.name||"")+'" required></label><label>Payment model<select name="model"><option value="game" '+(p?.model==="game"?"selected":"")+'>Pay per game</option><option value="season" '+(p?.model==="season"?"selected":"")+'>Season ticket</option></select></label><label class="checkline"><input name="seasonPaid" type="checkbox" '+(p?.seasonPaid?"checked":"")+'> Season ticket paid</label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save player</button></div></form>');}
    if(a==="add-player"){const used=new Set(game().participants.filter(x=>!x.guest).map(x=>x.playerId));const av=state.players.filter(p=>!used.has(p.id));return modal("Add player to Friday",'<form id="pick-form"><label>Player<select name="id">'+av.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join("")+'</select></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" '+(!av.length?"disabled":"")+'>Add player</button></div></form>');}
    if(a==="guest")return modal("Add guest",'<form id="guest-form"><label>Guest name<input name="name" required autofocus></label><p class="notice">Guest payment is tracked for this Friday only.</p><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Add guest</button></div></form>');
  }

  function render(){
    const app=document.getElementById("app");
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    app.innerHTML=view==="dashboard"?dashboard():view==="calendar"?calendar():view==="players"?players():games();
    document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
    document.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>act(b.dataset.a,b.dataset.id));
    document.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>{gameId=b.dataset.game;view="dashboard";render();});
    document.querySelectorAll("[data-t]").forEach(b=>b.onchange=()=>{const p=game().participants.find(x=>x.playerId===b.dataset.id);if(p){p[b.dataset.t]=b.checked;if(b.dataset.t==="attended"&&!b.checked)p.paid=false;save();render();}});
    document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById("modal-root").innerHTML="");
  }

  document.addEventListener("submit",async e=>{
    e.preventDefault();const f=new FormData(e.target);
    if(e.target.id==="login-form"){const {error}=await sb.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){document.getElementById("auth-error").textContent=error.message;return;}return boot();}
    if(e.target.id==="game-form"){const date=f.get("date");const summer=[6,7].includes(new Date(date+"T12:00:00").getMonth());const g={id:crypto.randomUUID(),date,startTime:summer?"20:00":f.get("time"),endTime:summer?"22:00":(()=>{const [h,m]=f.get("time").split(":").map(Number);return String(h+2).padStart(2,"0")+":"+String(m).padStart(2,"0")})(),time:summer?"20:00–22:00":f.get("time")+"–"+(()=>{const [h,m]=f.get("time").split(":").map(Number);return String(h+2).padStart(2,"0")+":"+String(m).padStart(2,"0")})(),location:f.get("location"),participants:[]};state.games.push(g);gameId=g.id;}
    if(e.target.id==="player-form"){let p=player(e.target.dataset.id);if(!p){p={id:crypto.randomUUID()};state.players.push(p);}p.name=f.get("name").trim();p.model=f.get("model");p.seasonPaid=f.has("seasonPaid");}
    if(e.target.id==="pick-form")game().participants.push({playerId:f.get("id"),playing:true,attended:false,paid:false});
    if(e.target.id==="guest-form")game().participants.push({rowId:crypto.randomUUID(),playerId:crypto.randomUUID(),guest:true,name:f.get("name").trim(),playing:true,attended:false,paid:false});
    await save();document.getElementById("modal-root").innerHTML="";render();
  });

  document.getElementById("newGame").onclick=()=>act("new-game");
  document.getElementById("signOut").onclick=async()=>{await sb.auth.signOut();currentUser=null;document.getElementById("newGame").style.display="none";document.getElementById("signOut").style.display="none";document.querySelector(".nav").style.display="none";authScreen();};
  boot();
})();

  document.addEventListener("click",e=>{const close=e.target.closest("[data-close]");if(close){document.getElementById("modal-root").innerHTML="";}});
