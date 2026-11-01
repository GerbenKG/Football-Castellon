(function(root,factory){const clubs=factory();if(typeof module==='object'&&module.exports)module.exports=clubs;else root.ClubFavorites=clubs;})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 let snapshot={players:[],member_accounts:[],user:{}};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function badge(club,large=false){if(!club||!/^[a-f0-9]{32}$/.test(club.badge_id||''))return '';return `<img class="favorite-club-badge${large?' large':''}" src="/api/clubs.php?badge=${club.badge_id}" alt="Supports ${esc(club.name)}" title="Supports ${esc(club.name)}" loading="lazy" onerror="this.hidden=true">`;}
 function choice(name,id='',person=null){
  const player=id?snapshot.players.find(p=>p.id===id):snapshot.players.find(p=>p.name===name);
  const account=person?.email?snapshot.member_accounts.find(m=>m.email.toLowerCase()===person.email.toLowerCase()):null;
  return player?.favorite_club??person?.favorite_club??account?.favorite_club??null;
 }
 const label=(name,id='',person=null)=>esc(name)+badge(choice(name,id,person));
 function card(user){const club=user.favorite_club;return `<section class="favorite-club-card" aria-label="Your favourite football club"><div class="favorite-club-card-heading"><span class="eyebrow">Your colours</span><h3>Your favourite football club</h3><p>${club?'A little football rivalry, wherever your name appears.':'Pick your club and wear its badge around the clubhouse.'}</p></div><div class="favorite-club-card-choice">${club?badge(club,true)+`<div><strong>${esc(club.name)}</strong><small>${esc(club.country)}</small></div>`:'<span class="favorite-empty-badge" aria-hidden="true">⚽</span>'}<button type="button" class="btn btn-outline" data-action="favorite-club">${club?'Change club':'Choose your club'}</button></div></section>`;}
 async function open(data,h){
  const api=window.api,{countries}=await api.get('/api/clubs.php?countries=1');let selected=data.user.favorite_club||null,choices=[];
  h.showDialog('Who do you support?','Choose any European football club. Its badge appears beside your name.',`<div class="favorite-picker"><div id="favorite-selected"></div><label class="field">Find your club<input type="search" id="favorite-club-search" placeholder="e.g. Ajax, Barcelona, CD Castellón" maxlength="100" autocomplete="off"></label><button type="button" class="btn btn-primary" id="favorite-club-find">Search clubs</button><p class="favorite-search-status" id="favorite-club-status" role="status" aria-live="polite">Search by the club’s full name.</p><div id="favorite-club-results" class="favorite-club-results"></div><details class="favorite-custom"><summary>Can’t find your club? Add its badge</summary><p>For smaller clubs or missing catalogue entries, add the club name, country and badge.</p><label class="field">Club name<input id="favorite-custom-name" maxlength="160" placeholder="Your football club"></label><label class="field">Country<select id="favorite-custom-country"><option value="">Choose a country…</option>${countries.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label class="field">Club badge<input id="favorite-custom-badge" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP · up to 2 MB. Use the club’s badge, rather than a personal photo.</small></label><button type="button" class="btn btn-outline" id="favorite-custom-use">Use this club and badge</button></details><p class="favorite-source">Search and catalogue badges: <a href="https://www.thesportsdb.com/" target="_blank" rel="noopener noreferrer">TheSportsDB</a>.</p></div>`,()=>api.post('/api/club.php',{action:'favorite_club',club_id:selected?.id??null}),'Save favourite club');
  document.getElementById('club-dialog').classList.add('favorite-dialog');
  const selectedRoot=document.getElementById('favorite-selected'),input=document.getElementById('favorite-club-search'),find=document.getElementById('favorite-club-find'),status=document.getElementById('favorite-club-status'),results=document.getElementById('favorite-club-results');
  function drawSelected(){selectedRoot.innerHTML=selected?`<div class="favorite-selection">${badge(selected,true)}<div><strong>${esc(selected.name)}</strong><small>${esc(selected.country)}</small></div><button type="button" class="btn btn-outline btn-small" id="favorite-clear">Clear choice</button></div>`:'<div class="notice">No club selected. You can leave this blank or pick your favourite below.</div>';const clear=document.getElementById('favorite-clear');if(clear)clear.onclick=()=>{selected=null;drawSelected();};}
  async function search(){
   const q=input.value.trim();if(q.length<2){status.textContent='Enter at least two letters of your club’s name.';return;}
   find.disabled=true;status.textContent='Finding your club…';results.innerHTML='';
   try{const response=await api.get('/api/clubs.php?q='+encodeURIComponent(q));choices=response.clubs;status.textContent=choices.length?'Choose your club below.':'No match found. Try the full club name, or add its badge below.';results.innerHTML=choices.map((club,i)=>`<button type="button" class="favorite-club-result" data-club-index="${i}">${badge(club,true)}<span><strong>${esc(club.name)}</strong><small>${esc(club.country)}</small></span><span class="favorite-result-action">Choose</span></button>`).join('');}catch(e){status.textContent=e.message;}finally{find.disabled=false;}
  }
  results.onclick=e=>{const b=e.target.closest('[data-club-index]');if(!b)return;selected=choices[Number(b.dataset.clubIndex)];drawSelected();status.textContent=selected.name+' selected. Save to show its badge beside your name.';};
  find.onclick=search;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};
  document.getElementById('favorite-custom-use').onclick=async e=>{
   const name=document.getElementById('favorite-custom-name').value.trim(),country=document.getElementById('favorite-custom-country').value,file=document.getElementById('favorite-custom-badge').files[0];
   const error=document.getElementById('form-error');error.textContent='';if(!name||!country||!file){error.textContent='Add the club name, country and badge first.';return;}if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){error.textContent='Choose a JPG, PNG or WebP badge smaller than 2 MB.';return;}
   const body=new FormData();body.set('name',name);body.set('country',country);body.set('badge',file);e.target.disabled=true;
   try{const response=await api.request('/api/clubs.php',{method:'POST',body});selected=response.club;drawSelected();status.textContent=selected.name+' is ready. Save your favourite club below.';}catch(err){error.textContent=err.message;}finally{e.target.disabled=false;}
  };
  drawSelected();
 }
 return {badge,label,choice,card,open,setContext(data){snapshot={players:data.players||[],member_accounts:data.member_accounts||[],user:data.user||{}};}};
});
