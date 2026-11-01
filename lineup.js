(() => {
 'use strict';
 async function open(data,id,h){
  const rows=window.ClubModel.squad(data,id),saved=data.matches[id]||{};
  let count=saved.teams?.length===3?3:2,draft=saved.teams?{teams:saved.teams,captains:saved.captains||[],team_names:saved.team_names||['A','B','C']}:await generate(count);
  let generating=false;
  async function generate(n){return h.post({action:'lineup_draft',game_id:id,team_count:n});}
  const names=['A','B','C'];
  const controls=`<div class="actions lineup-controls"><label class="field" style="margin:0;flex:1">Number of teams<select id="lineup-count"><option value="2" ${count===2?'selected':''}>2 teams</option><option value="3" ${count===3?'selected':''} ${rows.length<3?'disabled':''}>3 teams</option></select></label><button type="button" class="btn btn-outline" id="lineup-auto">Auto-select teams</button></div><p class="office-footnote">Uses the current playing list, including guests. Balances team sizes and available player ratings; captain suggestions rotate among club players. Review before publishing.</p><div id="lineup-assignments"></div><p id="lineup-draft-error" class="form-error" role="alert"></p>`;
  function readTeams(){return Array.from({length:count},(_,i)=>rows.filter(r=>document.querySelector(`[name="team:${r.id}"]`)?.value===String(i)).map(r=>r.id));}
  h.showDialog('The team sheet','Auto-select two or three teams, make adjustments and publish to this match.',controls,async f=>{
   if(generating)throw new Error('Wait for the team selection to finish.');
   const teams=readTeams(),captains=teams.map((_,i)=>f.get('captain:'+i)||null);
   await h.post({action:'lineup',game_id:id,teams,captains});
  },'Publish line-up');
  document.getElementById('club-dialog').classList.add('lineup-dialog');
  function draw(){
   const assignments=new Map(rows.map((r,index)=>{const side=draft.teams.findIndex(t=>t.includes(r.id));return [r.id,side<0?index%count:side];}));
   document.getElementById('lineup-assignments').innerHTML=`<div class="lineup-team-groups ${count===3?'three-teams':''}">${names.slice(0,count).map((name,i)=>{
    const members=rows.filter(r=>assignments.get(r.id)===i),captain=draft.captains[i];
    return `<section class="lineup-team-group" aria-label="Team ${name}"><div class="lineup-team-heading"><h3>Team ${name}</h3><span class="pill neutral">${members.length} player${members.length===1?'':'s'}</span></div><label class="field">Captain<select name="captain:${i}" aria-label="Team ${name} captain"><option value="">No captain assigned</option>${members.filter(r=>r.player_id).map(r=>`<option value="${r.id}" ${captain===r.id?'selected':''}>${h.esc(h.name(r))}</option>`).join('')}</select></label><div class="lineup-team-members">${members.map(r=>`<label class="lineup-member"><span class="lineup-member-name">${window.ClubAvatar.render(window.ClubAvatar.resolve(h.name(r),r.player_id||r.id))}<span>${h.esc(h.name(r))}${!r.player_id?'<small>Guest</small>':''}</span></span><select name="team:${r.id}" aria-label="Move ${h.esc(h.name(r))} to a team">${names.slice(0,count).map((target,j)=>`<option value="${j}" ${i===j?'selected':''}>Team ${target}</option>`).join('')}</select></label>`).join('')||'<p class="muted">Move players here from another team.</p>'}</div></section>`;
   }).join('')}</div>`;
  }
  async function regenerate(){
   if(generating)return;generating=true;
   const button=document.getElementById('lineup-auto'),select=document.getElementById('lineup-count'),error=document.getElementById('lineup-draft-error'),submit=document.querySelector('#club-form button[type="submit"]');
   button.disabled=select.disabled=submit.disabled=true;error.textContent='';
   try{const next=Number(select.value);draft=await generate(next);count=next;draw();}catch(e){select.value=String(count);error.textContent=e.message;}finally{generating=false;button.disabled=select.disabled=submit.disabled=false;}
  }
  draw();document.getElementById('lineup-auto').onclick=regenerate;document.getElementById('lineup-count').onchange=regenerate;
  document.getElementById('lineup-assignments').onchange=()=>{draft={...draft,teams:readTeams(),captains:Array.from({length:count},(_,i)=>document.querySelector(`[name="captain:${i}"]`)?.value||null)};draw();};
 }
 window.ClubLineup={open};
})();
