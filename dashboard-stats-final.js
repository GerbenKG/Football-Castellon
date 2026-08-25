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
    const [seasons,tickets]=await Promise.all([
      sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on",{ascending:false}),
      sb.from("finance_season_tickets").select("id,season_id")
    ]);
    if(seasons.error||tickets.error)return 0;
    const today=new Date().toISOString().slice(0,10);
    const season=(seasons.data||[]).find(s=>today>=s.starts_on&&today<=s.ends_on)||(seasons.data||[])[0];
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
