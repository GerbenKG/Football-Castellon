(() => {
  "use strict";
  const KEY = "football-castellon-v5";
  const friday = () => {
    const d = new Date();
    const add = ((5 - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + add);
    return d.toISOString().slice(0, 10);
  };
  const seed = {
    players: [
      {id:"p1",name:"João Silva",model:"season",seasonPaid:true},
      {id:"p2",name:"Marco Ruiz",model:"game",seasonPaid:false},
      {id:"p3",name:"David Costa",model:"game",seasonPaid:false},
      {id:"p4",name:"Luis Martín",model:"season",seasonPaid:true}
    ],
    games: [{
      id:"g1",date:friday(),time:"20:00",location:"Castellón",
      participants:[
        {playerId:"p1",playing:true,attended:true,paid:false},
        {playerId:"p2",playing:true,attended:true,paid:true},
        {playerId:"p3",playing:true,attended:false,paid:false},
        {playerId:"p4",playing:false,attended:false,paid:false},
        {playerId:"guest1",guest:true,name:"Carlos",playing:true,attended:true,paid:true}
      ]
    }]
  };
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || "null") || seed; } catch(e) { state = seed; }
  if (!state.players || !state.games || !state.games.length) state = seed;
  let view = "dashboard";
  let gameId = state.games[0].id;
  let month = new Date();

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
    const season = state.players.filter(p=>p.model==="season" && p.seasonPaid).length;
    return '<section class="hero"><div class="hero-pitch"></div><div class="hero-copy"><div class="eyebrow light">NEXT FRIDAY</div><h1>'+dateText(g.date)+'</h1><p>⚽ '+esc(g.time)+' &nbsp; · &nbsp; '+esc(g.location)+'</p><div class="hero-actions"><button class="btn btn-light" data-a="add-player">+ Player</button><button class="btn btn-ghost" data-a="guest">+ Guest</button></div></div><div class="hero-ball">⚽</div></section>'+
      '<div class="stats"><div class="stat"><div class="stat-icon">⚽</div><div><small>PLAYING</small><strong>'+playing+'</strong></div></div><div class="stat"><div class="stat-icon">✓</div><div><small>PRESENT</small><strong>'+present+'</strong></div></div><div class="stat"><div class="stat-icon">€</div><div><small>PAYMENTS DUE</small><strong>'+due+'</strong></div></div><div class="stat"><div class="stat-icon">🎟</div><div><small>SEASON TICKETS</small><strong>'+season+'</strong></div></div></div>'+
      '<section class="section"><div class="section-head"><div><h2>Friday squad</h2><p>Manage attendance and payment for this match.</p></div><button class="btn btn-secondary" data-view="calendar">Open calendar →</button></div>'+
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
    return '<div class="page-head"><div><div class="eyebrow">ROSTER</div><h1 class="title">Players</h1><p class="muted">Payment model and season-ticket status.</p></div><button class="btn btn-primary" data-a="new-player">+ Add player</button></div><div class="card table-card"><table><thead><tr><th>Player</th><th>Payment model</th><th>Season ticket</th><th></th></tr></thead><tbody>'+state.players.map(p=>'<tr><td><div class="who"><span class="avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</span><b>'+esc(p.name)+'</b></div></td><td>'+badge(p.model==="season"?"🎟 Season ticket":"Per game",p.model==="season"?"green":"slate")+'</td><td>'+(p.model==="season"?(p.seasonPaid?badge("✓ Paid","green"):badge("Unpaid","red")):"—")+'</td><td><button class="btn btn-secondary" data-a="edit" data-id="'+p.id+'">Edit</button></td></tr>').join("")+'</tbody></table></div>';
  }

  function games() {
    return '<div class="page-head"><div><div class="eyebrow">HISTORY</div><h1 class="title">Friday games</h1><p class="muted">A simple record of every match.</p></div><button class="btn btn-primary" data-a="new-game">+ New Friday</button></div><div class="game-list">'+state.games.map(g=>'<div class="card game-item"><div><div class="eyebrow">'+esc(g.date)+'</div><h3>⚽ Friday Football</h3><p>'+esc(g.time)+' · '+esc(g.location)+'</p></div><button class="btn btn-primary" data-game="'+g.id+'">Open →</button></div>').join("")+'</div>';
  }

  function modal(title,body){document.getElementById("modal-root").innerHTML='<div class="modal-bg" data-close><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><h2>'+title+'</h2><button class="remove" data-close>×</button></div>'+body+'</div></div>';}

  function act(a,id){
    if(a==="prev"){month.setMonth(month.getMonth()-1);return render();}
    if(a==="next"){month.setMonth(month.getMonth()+1);return render();}
    if(a==="remove"){game().participants=game().participants.filter(x=>x.playerId!==id);save();return render();}
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

  document.addEventListener("submit",e=>{
    e.preventDefault();const f=new FormData(e.target);
    if(e.target.id==="game-form"){const g={id:Date.now().toString(36),date:f.get("date"),time:f.get("time"),location:f.get("location"),participants:[]};state.games.push(g);gameId=g.id;}
    if(e.target.id==="player-form"){let p=player(e.target.dataset.id);if(!p){p={id:Date.now().toString(36)};state.players.push(p);}p.name=f.get("name").trim();p.model=f.get("model");p.seasonPaid=f.has("seasonPaid");}
    if(e.target.id==="pick-form")game().participants.push({playerId:f.get("id"),playing:true,attended:false,paid:false});
    if(e.target.id==="guest-form")game().participants.push({playerId:Date.now().toString(36),guest:true,name:f.get("name").trim(),playing:true,attended:false,paid:false});
    save();document.getElementById("modal-root").innerHTML="";render();
  });

  document.getElementById("newGame").onclick=()=>act("new-game");
  render();
})();