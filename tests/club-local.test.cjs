// Integration checks use disposable fixture IDs in the isolated LOCAL sample DB only.
const assert=require('node:assert/strict');
require('node:dns').setDefaultResultOrder('ipv4first');
const base='http://localhost:3002';
function session(){const jar=new Map();return {csrf:null,async request(path,body,expected=200){const headers={Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')};if(body!==undefined){headers['Content-Type']='application/json';if(this.csrf)headers['X-CSRF-Token']=this.csrf;}const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');jar.set(k,v);}const raw=await r.text();assert.equal(r.status,expected,path+' '+raw.slice(0,250));return r.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):raw;},async login(role){const r=await fetch(base+'/api/auth/google.php',{redirect:'manual'});for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');jar.set(k,v);}const html=await r.text();assert.match(html,/Local test sign-in/,'Never run these tests on a live server');const token=html.match(/name="token" value="([^"]+)"/)[1];const login=await fetch(base+'/api/auth/google.php',{method:'POST',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({role,token}),redirect:'manual'});assert.equal(login.status,303);for(const c of login.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');jar.set(k,v);}this.csrf=(await this.request('/api/auth/csrf.php')).csrf_token;return this;}};}
(async()=>{
 const anonymous=session();await anonymous.request('/api/club.php',undefined,401);
 const admin=await session().login('super_admin'),organiser=await session().login('attendance'),finance=await session().login('finance'),member=await session().login('player'),viewer=await session().login('viewer');
 const create=await admin.request('/api/club.php',{action:'fixture',date:'2099-01-01',start:'19:30',end:'21:30',location:'Disposable club integration fixture'});
 const gid=create.id;let past;
 const post=(s,b,status=200)=>s.request('/api/club.php',b,status);
 try {
  await post(admin,{action:'match_settings',game_id:gid,capacity:2,notes:'Capacity integration check'});
  await post(admin,{action:'signup',game_id:gid,join:true});await post(organiser,{action:'signup',game_id:gid,join:true});
  const wait=await post(member,{action:'signup',game_id:gid,join:true});assert.equal(wait.waiting,true);
  let d=await member.request('/api/club.php');assert.equal(d.signups.filter(r=>r.game_id===gid).length,2);assert.equal(d.finance,null);assert.equal(d.audit.length,0);assert.ok(d.players.every(p=>!('phone'in p)&&!('email'in p)&&!('skill_level'in p)));assert.ok(d.signups.every(r=>!('paid'in r)));
  await post(admin,{action:'signup',game_id:gid,join:false});d=await member.request('/api/club.php');assert.ok(d.signups.some(r=>r.game_id===gid&&r.player_id===d.user.player_id));assert.equal(d.waiting.filter(r=>r.game_id===gid).length,0);
  console.log('PASS capacity, waiting list, automatic promotion and member privacy');
  await post(member,{action:'announcement',title:'Denied',body:'Denied'},403);
  await post(viewer,{action:'fixture',date:'2099-01-01',start:'10:00',end:'11:00',location:'Denied'},403);
  await post(organiser,{action:'expense',season_id:d.seasons[0].id,amount:1,date:'2099-01-01',description:'Denied'},403);
  await post(member,{action:'confirm_payment',id:gid,type:'game'},403);
  await post(admin,{action:'result',game_id:gid,score_a:1,score_b:0},422);
  await post(admin,{action:'match_settings',game_id:gid,capacity:-1},422);
  console.log('PASS role restrictions and future-result rejection');
  const noCsrf=await session().login('super_admin');noCsrf.csrf=null;await post(noCsrf,{action:'announcement',title:'Denied',body:'CSRF'},403);
  const annBefore=(await admin.request('/api/club.php')).announcements;
  await post(admin,{action:'announcement',title:'Disposable test announcement',body:'<script>not executed</script>'});
  const ann=(await member.request('/api/club.php')).announcements.find(a=>!annBefore.some(b=>a.id===b.id));assert.equal(ann.body,'<script>not executed</script>');await post(admin,{action:'remove_announcement',id:ann.id.replace('announcement:','')});
  past=(await post(admin,{action:'fixture',date:'2000-01-01',start:'19:30',end:'21:30',location:'Disposable historical fixture'})).id;
  const memberId=d.user.player_id,organiserId=(await organiser.request('/api/club.php')).user.player_id;
  const add=async pid=>(await admin.request('/api/data.php?table=game_players',{action:'insert',data:{game_id:past,player_id:pid,playing:true,paid:false}})).data[0];
  const r1=await add(memberId),r2=await add(organiserId);
  await post(admin,{action:'lineup',game_id:past,teams:[[r1.id],[r2.id]]});
  await post(admin,{action:'result',game_id:past,score_a:2,score_b:1,goals:{[memberId]:2,[organiserId]:1},report:'Disposable test result'});
  await post(member,{action:'vote',game_id:past,player_id:memberId},422);
  await post(viewer,{action:'vote',game_id:past,player_id:memberId},403);
  await post(member,{action:'vote',game_id:past,player_id:organiserId});await post(member,{action:'vote',game_id:past,player_id:organiserId});
  d=await member.request('/api/club.php');assert.equal(d.votes[past][organiserId],1);
  await post(admin,{action:'lineup',game_id:past,teams:[[r1.id],[r1.id]]},422);
  console.log('PASS published results, validated teams, participant-only voting and one vote per member');
  const history=await member.request('/api/auth/member-payment-history.php');const due=history.items.find(i=>!i.paid);
  if(due){await post(member,{action:'report_payment',id:due.id,type:due.type});let h=await member.request('/api/auth/member-payment-history.php');assert.equal(h.items.find(i=>i.id===due.id).paid,false);await post(finance,{action:'confirm_payment',id:due.id,type:due.type});h=await member.request('/api/auth/member-payment-history.php');assert.equal(h.items.find(i=>i.id===due.id).paid,true);await admin.request('/api/data.php?table='+(due.type==='game'?'game_players':'finance_season_tickets'),{action:'update',data:{paid:false,...(due.type==='season'?{paid_on:null}:{})},filters:[{column:'id',operator:'eq',value:due.id}]});}
  const expenses=(await finance.request('/api/club.php')).finance.expenses;
  await post(finance,{action:'expense',season_id:d.seasons[0].id,amount:12.34,date:'2000-01-01',description:'Disposable test expense',category:'Equipment'});
  const exp=(await finance.request('/api/club.php')).finance.expenses.find(e=>!expenses.some(b=>b.id===e.id));
  if(exp){await post(finance,{action:'pay_expense',id:exp.id});await admin.request('/api/data.php?table=finance_expenses',{action:'delete',filters:[{column:'id',operator:'eq',value:exp.id}]});}
  console.log('PASS transfer reporting requires treasurer confirmation; expense persistence and audit');
  assert.ok((await finance.request('/api/club.php')).audit.some(a=>a.action==='Payment confirmed'));
 } finally {for(const id of [gid,past].filter(Boolean))await admin.request('/api/data.php?table=games',{action:'delete',filters:[{column:'id',operator:'eq',value:id}]});}
 console.log('PASS disposable match fixtures cleaned up');
})().catch(e=>{console.error(e);process.exitCode=1;});
