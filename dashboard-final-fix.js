(() => {
  "use strict";
  const sb = window.supabaseClient;
  const app = document.getElementById("app");
  if (!sb || !app) return;
  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const card = (icon,label,value) => `<div class="stat"><div class="stat-icon">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`;
  let lastKey="";
  async function sync(){
    const stats=app.querySelector(".hero + .stats"), rows=[...app.querySelectorAll(".squad-row")];
    if(!stats||!rows.length)return;
    const playing=rows.length;
    let due=0;
    rows.forEach(row=>{
      const text=row.textContent||"";
      if(/Season unpaid/i.test(text)){due++;return;}
      const paid=row.querySelector('input[data-t="paid"]');
      if(paid&&!paid.checked)due++;
    });
    let seasonTickets=null;
    try{
      const {data,error}=await sb.from("finance_season_tickets").select("id,season_id,paid");
      if(!error){
        const counts=new Map();
        (data||[]).forEach(x=>counts.set(x.season_id,(counts.get(x.season_id)||0)+1));
        seasonTickets=Math.max(0,...counts.values());
      }
    }catch(_){return;}
    if(seasonTickets==null)return;
    const key=`${playing}|${seasonTickets}|${due}`;
    if(key===lastKey)return;
    lastKey=key;
    stats.innerHTML=card("⚽","THIS GAME · PLAYING",playing)+card("🎟","THIS SEASON · SEASON TICKETS",seasonTickets)+card("€","THIS GAME · PAYMENTS DUE",due);
  }
  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(sync,50);};
  new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  schedule();
})();
