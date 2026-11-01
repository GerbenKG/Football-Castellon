const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
require('node:dns').setDefaultResultOrder('ipv4first');
const base='http://localhost:3002',php=process.env.PHP_BIN||'C:/Program Files/php-8.4.12/php.exe';
function fixture(data){return execFileSync(php,['-d','extension=pdo_mysql',__dirname+'/arcade-fixtures.php'],{input:JSON.stringify(data),encoding:'utf8'});}
function session(){const jar=new Map();return {csrf:null,async request(path,body,expected=200,extra={}){const headers={...extra,Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')};if(body!==undefined){headers['Content-Type']='application/json';if(this.csrf)headers['X-CSRF-Token']=this.csrf;}const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});for(const c of r.headers.getSetCookie()){const[k,v]=c.split(';')[0].split('=');jar.set(k,v);}const raw=await r.text();assert.equal(r.status,expected,path+' '+raw.slice(0,350));return JSON.parse(raw);},async login(role){const r=await fetch(base+'/api/auth/google.php',{redirect:'manual'});for(const c of r.headers.getSetCookie()){const[k,v]=c.split(';')[0].split('=');jar.set(k,v);}const html=await r.text();assert.match(html,/Local test sign-in/,'LOCAL sample server required');const token=html.match(/name="token" value="([^"]+)"/)[1];const l=await fetch(base+'/api/auth/google.php',{method:'POST',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({role,token}),redirect:'manual'});assert.equal(l.status,303);for(const c of l.headers.getSetCookie()){const[k,v]=c.split(';')[0].split('=');jar.set(k,v);}this.csrf=(await this.request('/api/auth/csrf.php')).csrf_token;this.id=(await this.request('/api/auth/me.php')).user.id;return this;},get(){return this.request('/api/arcade.php');},post(body,status=200){return this.request('/api/arcade.php',body,status);}};}
(async()=>{
 const anon=session();await anon.request('/api/arcade.php',undefined,401);
 const owner=await session().login('super_admin'),member=await session().login('player'),rival=await session().login('finance'),outsider=await session().login('viewer');
 const members={},rounds=[],challenges=[];
 for(const s of [owner,member,rival,outsider])members[s.id]=(await s.get()).joined;
 try{
  const token=member.csrf;member.csrf=null;await member.post({action:'join',game:'quiz'},403);member.csrf=token;
  const access=await owner.request('/api/auth/access.php'),preview=access.members.find(m=>m.role==='player').preview_key;
  await owner.request('/api/arcade.php',{action:'join',game:'quiz'},403,{'X-FC-Preview':preview});
  assert.deepEqual((await owner.request('/api/arcade.php',undefined,200,{'X-FC-Preview':preview})).joined,(await member.get()).joined);
  await member.post({action:'round_create',title:'No permission',fixtures:[]},403);
  const kickoff=new Date(Date.now()+86400000).toISOString().slice(0,16)+':00Z';
  const round=(await owner.post({action:'round_create',title:'LOCAL ARCADE TEST '+Date.now(),fixtures:[{home:'Home Club',away:'Away Club',kickoff},{home:'Second Club',away:'Third Club',kickoff}]})).id;rounds.push(round);
  await owner.post({action:'round_create',title:'Bad date',fixtures:[{home:'A',away:'B',kickoff:'2027-02-30T12:00:00Z'}]},422);
  let r=(await owner.get()).rounds.find(r=>r.id===round),f=r.fixtures[0],second=r.fixtures[1];
  await member.post({action:'leave',game:'predictions'});await member.post({action:'predict',round_id:round,fixture_id:f.id,home:2,away:1},403);
  for(const s of [member,rival])await s.post({action:'join',game:'predictions'});
  await member.post({action:'join',game:'predictions'});
  await member.post({action:'predict',round_id:round,fixture_id:f.id,home:1.5,away:1},422);
  await member.post({action:'predict',round_id:round,fixture_id:f.id,home:1,away:0,user_id:rival.id});
  await member.post({action:'predict',round_id:round,fixture_id:f.id,home:2,away:1});
  await rival.post({action:'predict',round_id:round,fixture_id:f.id,home:1,away:0});
  let own=(await member.get()).rounds.find(r=>r.id===round).fixtures[0];assert.equal(own.my_prediction.home,2);assert.equal(own.predictions.length,0);
  assert.equal((await owner.get()).rounds.find(r=>r.id===round).fixtures[0].my_prediction,null);
  await owner.post({action:'fixture_result',round_id:round,fixture_id:second.id,status:'final',home:2,away:1},422);
  fixture({action:'past',id:round});
  await member.post({action:'predict',round_id:round,fixture_id:f.id,home:4,away:1},422);
  await member.post({action:'fixture_result',round_id:round,fixture_id:f.id,status:'final',home:2,away:1},403);
  const baseline=(await member.get()).leaderboard.find(x=>x.user_id===member.id)?.points||0;
  await owner.post({action:'fixture_result',round_id:round,fixture_id:f.id,status:'final',home:2,away:1});
  let live=await member.get();assert.equal(live.leaderboard.find(x=>x.user_id===member.id).points,baseline+3);assert.equal(live.rounds.find(r=>r.id===round).fixtures[0].predictions.length,2);
  await owner.post({action:'fixture_result',round_id:round,fixture_id:f.id,status:'final',home:0,away:2});
  assert.equal((await member.get()).leaderboard.find(x=>x.user_id===member.id).points,baseline);
  await owner.post({action:'fixture_result',round_id:round,fixture_id:f.id,status:'void'});assert.equal((await member.get()).rounds.find(r=>r.id===round).fixtures[0].my_prediction.points,0);
  console.log('PASS authentication, CSRF, preview protection, board permissions, opt-ins, private predictions, kickoff locks and corrected/voided scoring');
  for(const s of [member,rival])await s.post({action:'join',game:'quiz'});
  await member.post({action:'challenge',opponent:member.id},422);
  await outsider.post({action:'leave',game:'quiz'});await member.post({action:'challenge',opponent:outsider.id},403);
  const id=(await member.post({action:'challenge',opponent:rival.id})).id;challenges.push(id);
  await rival.post({action:'challenge',opponent:member.id},422);
  let c=(await member.get()).challenges.find(x=>x.id===id),other=(await rival.get()).challenges.find(x=>x.id===id);
  assert.equal(c.questions.length,5);assert.deepEqual(c.questions,other.questions);assert.ok(c.questions.every(q=>!('correct' in q)));assert.ok(!('challenger_score' in c));
  assert.ok(!(await outsider.get()).challenges.some(x=>x.id===id));await outsider.post({action:'quiz_submit',id,answers:[0,0,0,0,0]},403);
  await member.post({action:'quiz_submit',id,answers:[0,0]},422);await member.post({action:'quiz_submit',id,answers:[0,0,0,0,4]},422);
  await member.post({action:'quiz_submit',id,answers:[0,0,0,0,0],challenger_score:5});await member.post({action:'quiz_submit',id,answers:[1,1,1,1,1]},422);
  c=(await member.get()).challenges.find(x=>x.id===id);assert.equal(c.questions.length,0);assert.ok(!('challenger_score' in c));
  other=(await rival.get()).challenges.find(x=>x.id===id);assert.equal(other.other_submitted,true);assert.ok(other.questions.every(q=>!('correct' in q)));
  await rival.post({action:'quiz_submit',id,answers:[1,1,1,1,1]});
  c=(await member.get()).challenges.find(x=>x.id===id);assert.equal(c.status,'complete');assert.equal(c.questions.length,5);assert.equal(c.challenger_score,c.questions.filter(q=>q.correct===0).length);assert.ok(c.questions.every(q=>'correct' in q));
  const declined=(await member.post({action:'challenge',opponent:rival.id})).id;challenges.push(declined);await member.post({action:'decline',id:declined},403);await rival.post({action:'decline',id:declined});await rival.post({action:'quiz_submit',id:declined,answers:[0,0,0,0,0]},422);
  const expired=(await member.post({action:'challenge',opponent:rival.id})).id;challenges.push(expired);fixture({action:'expire',id:expired});await member.post({action:'quiz_submit',id:expired,answers:[0,0,0,0,0]},422);assert.equal((await member.get()).challenges.find(x=>x.id===expired).status,'expired');
  await member.post({action:'leave',game:'quiz'});assert.ok(!(await rival.get()).quiz_members.includes(member.id));await rival.post({action:'challenge',opponent:member.id},403);
  const oldPermissions=require('../access-model.js').forRole(access.rolePermissions,'viewer');
  try{await owner.request('/api/auth/access.php',{action:'admin_set_role_permissions',role:'viewer',permissions:{...oldPermissions,'arcade.view':false,'arcade.manage':false}});await outsider.request('/api/arcade.php',undefined,403);}finally{await owner.request('/api/auth/access.php',{action:'admin_set_role_permissions',role:'viewer',permissions:oldPermissions});}
  console.log('PASS shared quiz questions, hidden answer keys/scores, single submission, server scoring, participant privacy, duplicate invitations, declines, expiry, opt-out and configurable page access');
 }finally{fixture({action:'cleanup',rounds,challenges,members});}
})().catch(e=>{console.error(e);process.exitCode=1;});
