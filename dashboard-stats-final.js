(()=>{
  "use strict";
  const sb=window.supabaseClient, app=document.getElementById("app");
  if(!app)return;
  const esc=v=>String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const card=(icon,label,value)=>`<div class="stat"><div class="stat-icon">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`;
  let seasonTickets=null, running=false, queued=false;

  async function getSeasonContext(){
    if(!sb)return {seasonId:null,tickets:[],players:[],gamePlayers:[]};
    const heroDate=(app.querySelector(".hero h1")?.textContent||"").trim();
    const [games,seasons,tickets,players,gamePlayers]=await Promise.all([
      sb.from("games").select("id,game_date"),
      sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on",{ascending:false}),
      sb.from("finance_season_tickets").select("id,season_id,player_id,paid"),
      sb.from("players").select("id,name"),
      sb.from("game_players").select("id,game_id,player_id,guest_name,paid")
    ]);
    if(games.error||seasons.error||tickets.error||players.error||gamePlayers.error){
      return {seasonId:null,tickets:[],players:[],gamePlayers:[]};
    }
    const selectedGame=(games.data||[]).find(g=>{
      const d=new Date(g.game_date+"T12:00:00");
      const label=d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
      return label===heroDate;
    });
    if(!selectedGame)return {seasonId:null,tickets:tickets.data||[],players:players.data||[],gamePlayers:[]};
    const season=(seasons.data||[]).find(s=>selectedGame.game_date>=s.starts_on&&selectedGame.game_date<=s.ends_on);
    return {
      gameId:selectedGame.id,
      seasonId:season?.id||null,
      tickets:tickets.data||[],
      players:players.data||[],
      gamePlayers:(gamePlayers.data||[]).filter(x=>x.game_id===selectedGame.id)
    };
  }

  async function getSeasonTickets(){
    if(seasonTickets!==null)return seasonTickets;
    const ctx=await getSeasonContext();
    seasonTickets=ctx.seasonId?(ctx.tickets||[]).filter(t=>t.season_id===ctx.seasonId).length:0;
    return seasonTickets;
  }

  async function syncSeasonPaymentLabels(ctx){
    if(!ctx.seasonId)return;
    const ticketByPlayer=new Map((ctx.tickets||[]).filter(t=>t.season_id===ctx.seasonId).map(t=>[t.player_id,!!t.paid]));
    const playerById=new Map((ctx.players||[]).map(p=>[p.id,p]));
    const rowByPlayer=new Map((ctx.gamePlayers||[]).filter(x=>x.player_id).map(x=>[x.player_id,x]));

    // The Game Squad DOM rows follow the same participant order as game_players.
    const rows=[...app.querySelectorAll(".squad .squad-row")];
    (ctx.gamePlayers||[]).forEach((gp,index)=>{
      const row=rows[index];
      if(!row||!gp.player_id)return;
      if(!ticketByPlayer.has(gp.player_id))return;
      const paid=ticketByPlayer.get(gp.player_id)===true;
      const badgeEl=[...row.querySelectorAll(".badge")].find(el=>/Season (un)paid/i.test(el.textContent||""));
      if(badgeEl){
        badgeEl.textContent=paid?"Season paid":"Season unpaid";
        badgeEl.className="badge badge-"+(paid?"green":"amber");
      }
    });
  }

  async function update(){
    if(running)return;
    const stats=app.querySelector(".hero + .stats"), rows=[...app.querySelectorAll(".squad .squad-row")];
    if(!stats||!app.querySelector(".hero")||!app.querySelector(".squad"))return;
    running=true;
    try{
      const ctx=await getSeasonContext();
      await syncSeasonPaymentLabels(ctx);
      const numberOfPlayers=rows.length;
      const ticketByPlayer=new Map((ctx.tickets||[]).filter(t=>t.season_id===ctx.seasonId).map(t=>[t.player_id,!!t.paid]));
      const playerById=new Map((ctx.players||[]).map(p=>[p.id,p]));
      const paymentDue=(ctx.gamePlayers||[]).filter(gp=>{
        if(!gp.player_id)return !gp.paid;
        const p=playerById.get(gp.player_id);
        if(ticketByPlayer.has(gp.player_id))return ticketByPlayer.get(gp.player_id)!==true;
        return gp.paid!==true;
      }).length;
      const tickets=ctx.seasonId?(ctx.tickets||[]).filter(t=>t.season_id===ctx.seasonId).length:0;
      seasonTickets=tickets;
      const html=card("⚽","THIS GAME · NUMBER OF PLAYERS",numberOfPlayers)+card("€","THIS GAME · PAYMENT DUE",paymentDue)+card("🎟","THIS SEASON · NUMBER OF SEASON TICKETS",tickets);
      if(stats.innerHTML!==html)stats.innerHTML=html;
    }finally{running=false;}
  }

  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update().catch(()=>{});});};
  new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  schedule();
})();
