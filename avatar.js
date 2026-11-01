(function(root,factory){const avatars=factory();if(typeof module==='object'&&module.exports)module.exports=avatars;else root.ClubAvatar=avatars;})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 let players=[],user=null;
 function seed(value){let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
 function fallback(key){
  let state=seed(key);const pick=values=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return values[state%values.length];};
  const bg=pick(['#dce9d2','#e2e9ee','#f1e5ca','#e7dfed','#d8e9e4','#f0ddd7']),skin=pick(['#f4cfb0','#dba57d','#b77751','#8e543c','#633c2b']),hair=pick(['#292921','#5d3b25','#a66b35','#c9a662','#323c40']),shirt=pick(['#123e34','#395b7b','#775363','#ac7841','#526341']),style=pick([0,1,2,3]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" aria-hidden="true"><path fill="${bg}" d="M0 0h80v80H0z"/><path fill="${shirt}" d="M12 80v-8c0-15 12-23 28-23s28 8 28 23v8"/><path stroke="#ffffff50" stroke-width="3" d="M27 59v21m26-21v21"/><path fill="${skin}" d="M34 45h12v13c-3 5-9 5-12 0z"/><ellipse cx="40" cy="32" rx="18" ry="22" fill="${skin}"/><path fill="${hair}" d="${style===0?'M22 33V24C22 4 58 4 58 24v12l-6-14c-8 6-17 5-25 2z':style===1?'M22 32C15 12 31 4 40 8c19-4 24 13 17 27l-3-17c-8 6-18 4-27 1z':style===2?'M22 30V19c3-15 32-15 36 0v12l-5-12H27z':'M23 24c0-20 34-20 34 0l-9-7-17 6z'}"/><path stroke="#372f2b" stroke-linecap="round" stroke-width="2.5" d="M33 33v2m14-2v2"/><path stroke="#764b3c" stroke-linecap="round" stroke-width="2" d="M35 43c3 3 7 3 10 0"/></svg>`;
 }
 function resolve(name,id=''){
  const p=id?players.find(p=>p.id===id):players.find(p=>p.name===name);
  return p||(user&&(id===user.player_id||name===(user.display_name||user.name))?user:{id:id||'guest:'+name,name});
 }
 function render(person={},large=false){
  const key=person.player_id||person.email?.toLowerCase()||person.id||person.name||'club-member',linked=players.find(p=>p.id===(person.player_id||person.id));
  const path=person.use_default_avatar?'':linked?.avatar_path||person.avatar_path||'';
  const safe=/^[a-f0-9-]{36}\/avatar(?:-[a-f0-9]{32})?\.(?:jpg|jpeg|png|webp)$/i.test(path);
  return `<span class="initials club-avatar${large?' large':''}" aria-hidden="true">${fallback(key)}${safe?`<img src="/api/avatars.php?path=${encodeURIComponent(path)}" alt="" loading="lazy" onerror="this.hidden=true">`:''}</span>`;
 }
 return {seed,fallback,render,resolve,setPlayers(list,currentUser){players=list||[];user=currentUser||null;}};
});
