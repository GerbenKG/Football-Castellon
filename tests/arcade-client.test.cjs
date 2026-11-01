const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const escape=s=>String(s).replace(/[<>"&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(snapshot,route='#games'){
 const listeners={},el={innerHTML:''},dialogs=[],posts=[],messages=[],location={hash:route};
 const window={api:{async get(){return structuredClone(snapshot);},async post(path,body){posts.push(body);if(body.action==='predict'){const f=snapshot.rounds[0].fixtures.find(f=>f.id===body.fixture_id);f.my_prediction={home:body.home,away:body.away};}return {ok:true};}},ClubFavorites:{label:escape},ClubAvatar:{render:()=>''}};
 const document={getElementById:id=>id==='games-page'?el:null,addEventListener:(name,handler)=>listeners[name]=handler};
 const context={heading:()=>'',icon:()=>'',toast:s=>messages.push(s),showDialog:(...args)=>dialogs.push(args)};
 const sandbox=vm.createContext({window,document,location,Date,Intl,Map,FormData:class{constructor(form){this.form=form;}get(k){return this.form.values[k]??null;}},setTimeout,Promise});
 vm.runInContext(fs.readFileSync(__dirname+'/../club-games.js','utf8'),sandbox);
 const page=()=>{el.innerHTML=window.ClubGames.page({user:{id:'me'}},context);window.ClubGames.mount();};
 const click=async(action,id)=>{const b={dataset:{arcade:action,id},disabled:false,isConnected:true};await listeners.click({target:{closest:()=>b}});};
 const form=(id,home,away)=>({dataset:{round:'round',fixture:id},values:{home,away},querySelector:()=>({textContent:''})});
 const input=form=>listeners.input({target:{closest:()=>form}});
 const submit=form=>listeners.submit({target:{closest:()=>form},preventDefault(){},submitter:{disabled:false,isConnected:true}});
 return {window,el,page,click,input,submit,form,location,dialogs,posts,messages};
}
function state(){return {joined:['predictions','quiz'],people:[{id:'me',name:'Me'},{id:'rival',name:'Rival <script>'}],quiz_members:['me','rival'],prediction_members:2,can_manage:true,leaderboard:[{user_id:'me',played:0,exact:0,points:0}],challenges:[],rounds:[{id:'round',title:'Weekend <football>',fixtures:['first','second'].map(id=>({id,home:'Home <club>',away:'Away',kickoff:'2027-01-01T15:00:00Z',status:'scheduled',locked:false,my_prediction:null,predictions:[]}))}]};}
(async()=>{
 const h=harness(state());h.page();await tick();assert.match(h.el.innerHTML,/Prediction League/);assert.match(h.el.innerHTML,/Challenge a teammate/);assert.match(h.el.innerHTML,/#games\/predictions/);
 h.location.hash='#games/predictions';h.page();assert.match(h.el.innerHTML,/Weekend &lt;football&gt;/);assert.doesNotMatch(h.el.innerHTML,/<football>/);assert.match(h.el.innerHTML,/New prediction round/);
 const a=h.form('first','2','1'),b=h.form('second','4','3');h.input(a);h.input(b);assert.equal(h.window.ClubGames.hasDraft(),true);
 await h.submit(a);assert.equal(h.posts[0].home,2);assert.match(h.el.innerHTML,/name="home"[^>]*value="4"/,'Saving one fixture must retain another fixture’s draft');assert.equal(h.window.ClubGames.hasDraft(),true);
 await h.submit(b);assert.equal(h.window.ClubGames.hasDraft(),false);
 const quiz=state();quiz.challenges=[{id:'challenge',challenger:'me',opponent:'rival',status:'active',my_submitted:false,other_submitted:false,expires_at:'2027-01-01T15:00:00Z',questions:Array.from({length:5},(_,i)=>({text:'Question '+i,options:['A','B','C','D']}))}];
 const q=harness(quiz,'#games/quiz');q.page();await tick();await q.click('play','challenge');const dialog=q.dialogs[0];assert.equal(dialog[0],'Your five questions');assert.match(dialog[2],/name="q4"/);assert.doesNotMatch(dialog[2],/quiz-correct|Correct answer:/);assert.equal(dialog[4],'Submit my answers');
 await dialog[3]({get:k=>Number(k.slice(1))%4});assert.equal(q.posts[0].action,'quiz_submit');assert.deepEqual(Array.from(q.posts[0].answers),[0,1,2,3,0]);
 const result=state();result.can_manage=false;const locked=result.rounds[0].fixtures[0];locked.locked=true;locked.status='final';locked.home_score=2;locked.away_score=1;locked.my_prediction={home:2,away:1,points:3};
 const r=harness(result,'#games/predictions');r.page();await tick();assert.match(r.el.innerHTML,/3 points/);assert.doesNotMatch(r.el.innerHTML,/Manage result/);assert.doesNotMatch(r.el.innerHTML,/New prediction round/);
 console.log('PASS Games navigation, escaped content, independent unsaved predictions, quiz play/submission and board-only result controls');
})().catch(e=>{console.error(e);process.exitCode=1;});
