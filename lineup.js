(() => {
 'use strict';
 async function open(data,id,h){
  const rows=window.ClubModel.squad(data,id),saved=data.matches[id]||{};
  let count=saved.teams?.length===3?3:2,draft=saved.teams?{teams:saved.teams,captains:saved.captains||[],team_names:saved.team_names||['Green','Gold','Blue']}:await generate(count);
  let generating=false;
  async function generate(n){return h.post({action:'lineup_draft',game_id:id,team_count:n});}
  const names=['Green','Gold','Blue'];
  const controls=`<div class="actions lineup-controls"><label class="field" style="margin:0;flex:1">Number of teams<select id="lineup-count"><option value="2" ${count===2?'selected':''}>2 teams</option><option value="3" ${count===3?'selected':''} ${rows.length<3?'disabled':''}>3 teams</option></select></label><button type="button" class="btn btn-outline" id="lineup-auto">Auto-select teams</button></div><p class="office-footnote">Uses the current playing list, including guests. Balances team sizes and available player ratings; captain suggestions rotate among club players. Review before publishing.</p><div id="lineup-assignments"></div><div id="lineup-captains" class="lineup-captains"></div><p id="lineup-draft-error" class="form-error" role="alert"></p>`;
  function readTeams(){return Array.from({length:count},(_,i)=>rows.filter(r=>document.querySelector(`[name="team:${r.id}"]`)?.value===String(i)).map(r=>r.id));}
  h.showDialog('The team sheet','Auto-select two or three teams, make adjustments and publish to this match.',controls,async f=>{
   if(generating)throw new Error('Wait for the team selection to finish.');
   const teams=readTeams(),captains=teams.map((_,i)=>f.get('captain:'+i)||null);
   await h.post({action:'lineup',game_id:id,teams,captains});
  },'Publish line-up');
  function drawCaptains(){
   const target=document.getElementById('lineup-captains'),teams=readTeams();
   const current=teams.map((_,i)=>document.querySelector(`[name="captain:${i}"]`)?.value??draft.captains[i]??'');
   target.innerHTML=`<h3>Team captains</h3><div class="lineup-summary">${teams.map((team,i)=>`<span class="pill neutral">${names[i]} · ${team.length} player${team.length===1?'':'s'}</span>`).join('')}</div>${teams.map((team,i)=>`<label class="field">Team ${names[i]} captain<select name="captain:${i}"><option value="">No captain assigned</option>${rows.filter(r=>r.player_id&&team.includes(r.id)).map(r=>`<option value="${r.id}" ${current[i]===r.id?'selected':''}>${h.esc(h.name(r))}</option>`).join('')}</select></label>`).join('')}`;
  }
  function draw(){
   document.getElementById('lineup-assignments').innerHTML=`<div class="team-editor">${rows.map((r,index)=>{const existing=draft.teams.findIndex(t=>t.includes(r.id)),side=existing<0?index%count:existing;return `<label>${h.esc(h.name(r))}<select name="team:${r.id}">${names.slice(0,count).map((name,i)=>`<option value="${i}" ${side===i?'selected':''}>${name}</option>`).join('')}</select></label>`;}).join('')}</div>`;
   document.getElementById('lineup-captains').innerHTML='';drawCaptains();
  }
  async function regenerate(){
   if(generating)return;generating=true;
   const button=document.getElementById('lineup-auto'),select=document.getElementById('lineup-count'),error=document.getElementById('lineup-draft-error'),submit=document.querySelector('#club-form button[type="submit"]');
   button.disabled=select.disabled=submit.disabled=true;error.textContent='';
   try{const next=Number(select.value);draft=await generate(next);count=next;draw();}catch(e){select.value=String(count);error.textContent=e.message;}finally{generating=false;button.disabled=select.disabled=submit.disabled=false;}
  }
  draw();document.getElementById('lineup-auto').onclick=regenerate;document.getElementById('lineup-count').onchange=regenerate;
  document.getElementById('lineup-assignments').onchange=drawCaptains;
 }
 window.ClubLineup={open};
})();
