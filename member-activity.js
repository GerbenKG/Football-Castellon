(() => {
 'use strict';
 const tracker=window.ClubActivityModel.tracker(),client=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 let identity=null,timer=null,running=false,generation=0,corner=null,notices=null,list=null,count=null,toggle=null,collapsed=false,rosterSignature='';
 const dismissals=new Set();
 function clearNotices(){for(const id of dismissals)clearTimeout(id);dismissals.clear();notices?.replaceChildren();}
 function shell(){
  if(corner)return;
  corner=document.createElement('aside');corner.className='member-activity-corner';corner.setAttribute('aria-label','Club members online');
  notices=document.createElement('div');notices.className='presence-notices';notices.setAttribute('role','status');notices.setAttribute('aria-live','polite');notices.setAttribute('aria-relevant','additions');
  const panel=document.createElement('section');panel.className='online-panel';
  toggle=document.createElement('button');toggle.type='button';toggle.className='online-toggle';toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-controls','online-member-list');
  const dot=document.createElement('i');dot.className='online-dot';dot.setAttribute('aria-hidden','true');const title=document.createElement('strong');title.textContent='Online now';count=document.createElement('span');count.className='online-count';count.textContent='…';
  const chevron=document.createElement('span');chevron.className='online-collapse';chevron.textContent='⌄';chevron.setAttribute('aria-hidden','true');toggle.append(dot,title,count,chevron);
  list=document.createElement('div');list.id='online-member-list';list.className='online-member-list';list.setAttribute('role','list');
  toggle.onclick=()=>{collapsed=!collapsed;list.hidden=collapsed;toggle.setAttribute('aria-expanded',String(!collapsed));};
  panel.append(toggle,list);corner.append(notices,panel);document.body.append(corner);
 }
 function roster(members,error=false){
  shell();const signature=JSON.stringify([error,members]);if(signature===rosterSignature)return;rosterSignature=signature;
  count.textContent=error?'…':String(members.length);const scroll=list.scrollTop;list.replaceChildren();
  if(error||!members.length){const note=document.createElement('p');note.className='online-message';note.textContent=error?'Reconnecting…':'No members online';list.append(note);return;}
  for(const person of members){
   const row=document.createElement('div');row.className='online-person';row.setAttribute('role','listitem');
   const photo=document.createElement('span');photo.setAttribute('aria-hidden','true');photo.innerHTML=window.ClubAvatar.render(person);
   const name=document.createElement('strong');name.innerHTML=window.ClubFavorites.label(person.display_name||'Club member',person.player_id,person);
   row.append(photo,name);if(person.id===identity){const you=document.createElement('small');you.textContent='You';row.append(you);}list.append(row);
  }
  list.scrollTop=scroll;
 }
 function notice(person){
  shell();while(notices.children.length>=3)notices.firstElementChild.remove();
  const item=document.createElement('div');item.className='presence-notice';
  const photo=document.createElement('span');photo.className='presence-photo';photo.setAttribute('aria-hidden','true');photo.innerHTML=window.ClubAvatar.render(person);
  const copy=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('span');
  name.innerHTML=window.ClubFavorites.label(person.display_name||'Club member',person.player_id,person);text.textContent='is now online';copy.append(name,text);item.append(photo,copy);notices.append(item);
  const timeout=setTimeout(()=>{item.remove();dismissals.delete(timeout);},5000);dismissals.add(timeout);
 }
 async function announce(person,self){
  const key='fc-online-notices:'+self,event=person.id+':'+person.online_key;
  const show=()=>{
   if(identity!==self||document.hidden)return;
   let seen={};try{seen=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
   const now=Date.now();seen=Object.fromEntries(Object.entries(seen||{}).filter(([,t])=>Number(t)>now-600000).slice(-100));
   if(seen[event])return;seen[event]=now;try{localStorage.setItem(key,JSON.stringify(seen));}catch{}
   if(identity===self&&!document.hidden)notice(person);
  };
  try{if(navigator.locks?.request)await navigator.locks.request('fc-online-notice',show);else show();}catch{show();}
 }
 async function poll(){
  if(!identity||document.hidden||running)return;
  const self=identity,version=generation;running=true;
  try{
   const result=await window.api.post('/api/auth/presence.php',{client_id:client});
   if(version!==generation||self!==identity||document.hidden)return;
   roster(result.members);for(const person of tracker.observe(result.members,self))await announce(person,self);
  }catch(error){if(version===generation){tracker.reset();if(error.status===401)stop();else roster([],true);}}
  finally{running=false;if(identity&&!document.hidden){clearTimeout(timer);timer=setTimeout(poll,10000);}}
 }
 function leave(){if(identity&&!window.footballPreviewActive)return window.api.request('/api/auth/presence.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:client,action:'leave'}),keepalive:true}).catch(()=>{});return Promise.resolve();}
 function stop(){leave();identity=null;generation++;clearTimeout(timer);tracker.reset();clearNotices();corner?.remove();corner=null;notices=null;list=null;count=null;toggle=null;collapsed=false;rosterSignature='';}
 function sync(data){
  const id=data?.user?.id;if(!id||data.preview||window.footballPreviewActive){stop();return;}
  if(identity===id)return;stop();identity=id;if(!document.hidden)poll();
 }
 document.addEventListener('visibilitychange',()=>{generation++;clearTimeout(timer);tracker.reset();clearNotices();if(document.hidden)leave();else if(identity)poll();});
 window.addEventListener('pagehide',()=>{leave();generation++;clearTimeout(timer);tracker.reset();clearNotices();});
 window.addEventListener('pageshow',e=>{if(e.persisted&&identity)poll();});
 window.ClubActivity={sync,stop,depart:leave};
})();
