(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.ClubModel=model;})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  function madridNow(date=new Date()){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  }
  const started=(g,now=madridNow())=>`${g.game_date}T${g.start_time}`<=now;
  const ended=(g,now=madridNow())=>`${g.game_date}T${g.end_time}`<=now;
  const squad=(data,id)=>data.signups.filter(r=>r.game_id===id);
  const season=data=>data.seasons.find(s=>s.starts_on<=data.server_date&&s.ends_on>=data.server_date)||data.seasons[0]||null;
  function recordedGames(data,all=false){const s=season(data);return data.games.filter(g=>ended(g)&&squad(data,g.id).length&&(all||!s||(g.game_date>=s.starts_on&&g.game_date<=s.ends_on)));}
  function stats(data,pid,all=false){
    const games=recordedGames(data,all),appearances=games.filter(g=>squad(data,g.id).some(r=>r.player_id===pid));
    let wins=0,draws=0,losses=0,goals=0,results=0,streak=0;
    for(const g of appearances){const m=data.matches[g.id]||{};goals+=Number(m.goals?.[pid]||0);const row=squad(data,g.id).find(r=>r.player_id===pid);if(!m.teams||m.teams.length!==2||m.score_a===undefined)continue;const side=m.teams.findIndex(t=>t.includes(row.id));if(side<0)continue;results++;const own=side===0?m.score_a:m.score_b,other=side===0?m.score_b:m.score_a;if(own>other)wins++;else if(own===other)draws++;else losses++;}
    for(const g of [...games].reverse()){if(squad(data,g.id).some(r=>r.player_id===pid))streak++;else break;}
    return {appearances:appearances.length,possible:games.length,rate:games.length?Math.round(appearances.length/games.length*100):0,wins,draws,losses,goals,results,streak};
  }
  function signupState(data,gid,pid=data.user.player_id){if(squad(data,gid).some(r=>r.player_id===pid))return 'playing';if(data.waiting.some(r=>r.game_id===gid&&r.player_id===pid))return 'waiting';if((data.declined||[]).some(r=>r.game_id===gid&&r.player_id===pid))return 'out';return 'none';}
  function bibs(data,gid,now=madridNow()){
    const current=(data.bibs_assignments||[]).filter(r=>r.game_id===gid);
    const game=data.games.find(g=>g.id===gid);
    const previous=game?data.games.filter(g=>g.id!==gid&&ended(g,now)&&`${g.game_date}T${g.start_time}`<`${game.game_date}T${game.start_time}`&&(data.bibs_assignments||[]).some(r=>r.game_id===g.id)).sort((a,b)=>(b.game_date+b.start_time).localeCompare(a.game_date+a.start_time))[0]:null;
    return {assigned:current,holder:previous?(data.bibs_assignments||[]).filter(r=>r.game_id===previous.id):[],previous};
  }
  function financeForecast(finance,data,now=madridNow()){
    const cents=value=>Math.round(Number(value||0)*100);
    const open=(finance?.due||[]).reduce((sum,p)=>sum+cents(p.amount),0);
    const unpaid=(finance?.expenses||[]).filter(e=>!e.paid).reduce((sum,e)=>sum+cents(e.amount),0);
    const balance=cents(finance?.balance);
    const season=finance?.season;
    const games=(data?.games||[]).filter(g=>season&&g.game_date>=season.starts_on&&g.game_date<=season.ends_on);
    const completed=games.filter(g=>ended(g,now));
    const remaining=games.filter(g=>!started(g,now));
    const ticketPlayers=new Set((finance?.tickets||[]).map(t=>t.player_id).filter(Boolean));
    const payPerGameAppearances=completed.reduce((total,g)=>{
      const attendees=(data?.signups||[]).filter(r=>r.game_id===g.id);
      return total+attendees.filter(r=>!r.player_id||!ticketPlayers.has(r.player_id)).length;
    },0);
    const averagePlayersPerGame=completed.length?payPerGameAppearances/completed.length:0;
    const fee=cents(season?.pay_per_game_amount)/100;
    const projectedFutureIncome=cents(averagePlayersPerGame*remaining.length*fee)/100;
    const predictedOpenFees=(open/100)+projectedFutureIncome;
    return {
      openFees:open/100,
      unpaidExpenses:unpaid/100,
      seasonEnd:(balance+cents(predictedOpenFees)-unpaid)/100,
      completedGames:completed.length,
      remainingGames:remaining.length,
      payPerGameAppearances,
      averagePlayersPerGame,
      projectedFutureIncome,
      predictedOpenFees
    };
  }
  const openPayments=history=>(history?.items||[]).filter(p=>!p.paid);
  return {madridNow,started,ended,squad,season,recordedGames,stats,signupState,openPayments,bibs,financeForecast};
});
