(()=>{
  "use strict";
  const sb=window.supabaseClient, app=document.getElementById("app");
  if(!app)return;
  const esc=v=>String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const card=(icon,label,value)=>`<div class="stat"><div class="stat-icon">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`;
  let seasonTickets=null, running=false, queued=false;

  async function getSeasonTickets(){
    if(seasonTickets!==null)return seasonTickets;
    if(!sb)return 0;

    const heroDate=(app.querySelector(".hero h1")?.textContent||"").trim();
    const [games,seasons,tickets]=await Promise.all([
      sb.from("games").select("id,game_date"),
      sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on",{ascending:false}),
      sb.from("finance_season_tickets").select("id,season_id")
    ]);
    if(games.error||seasons.error||tickets.error)return 0;

    // Resolve the season from the date of the game currently shown on the Dashboard,
    // rather than from today's date. This keeps the stat correct when navigating
    // between games from different seasons.
    const selectedGame=(games.data||[]).find(g=>{
      const d=new Date(g.game_date+"T12:00:00");
      const label=d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
      return label===heroDate;
    });

    if(!selectedGame)return 0;
    const gameDate=selectedGame.game_date;
    const season=(seasons.data||[]).find(s=>gameDate>=s.starts_on&&gameDate<=s.ends_on);
    seasonTickets=season?(tickets.data||[]).filter(t=>t.season_id===season.id).length:0;
    return seasonTickets;
  }

  async function update(){
    if(running)return;
    const stats=app.querySelector(".hero + .stats"), rows=[...app.querySelectorAll(".squad .squad-row")];
    if(!stats||!app.querySelector(".hero")||!app.querySelector(".squad"))return;
    running=true;
    try{
      const numberOfPlayers=rows.length;
      const paymentDue=rows.filter(r=>/Season unpaid/i.test(r.textContent||"")||(()=>{const p=r.querySelector('input[data-t="paid"]');return !!p&&!p.checked;})()).length;
      const tickets=await getSeasonTickets();
      const html=card("⚽","THIS GAME · NUMBER OF PLAYERS",numberOfPlayers)+card("€","THIS GAME · PAYMENT DUE",paymentDue)+card("🎟","THIS SEASON · NUMBER OF SEASON TICKETS",tickets);
      if(stats.innerHTML!==html)stats.innerHTML=html;
    }finally{running=false;}
  }

  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update().catch(()=>{});});};
  new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  schedule();
})();
