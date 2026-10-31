const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname,"..");

function app(initial,permissions) {
  const calls=[];
  let failure=null;
  const client={from(table) {
    let action="select",payload,filter;
    const query={
      update(data){action="update";payload=data;return query},
      upsert(data){action="upsert";payload=data;return query},
      delete(){action="delete";return query},
      eq(column,value){filter=[column,value];return query},
      then(resolve){calls.push({table,action,payload,filter});return Promise.resolve({error:failure,data:[]}).then(resolve)}
    };
    return query;
  }};
  const ctx=vm.createContext({window:{footballClient:client},Intl,Date});
  const source=fs.readFileSync(path.join(root,"app.js"),"utf8");
  const prefix=source.slice(0,source.indexOf('document.addEventListener("click",e=>'));
  vm.runInContext(prefix+`
window.harness={
  save,finance,dashboard,
  initialize(s,p){state=s;access.permissions=p;currentUser={id:"test"};rememberRemote();},
  edit(fn){fn(state);},
  deleting(table,id,permission){pendingDeletes.push({table,id,permission});},
  setFinance(data){financeData=data;financeLoaded=true;financeSeasonId=data.seasons[0].id;},
  preview(){actingAs={role:"admin"};}
};})();`,ctx);
  ctx.window.harness.initialize(initial,permissions);
  return {api:ctx.window.harness,calls,fail(message){failure={message}}};
}
const squad=()=>({players:[{id:"p",name:"Player"}],games:[{id:"g",date:"2026-01-01",startTime:"19:30",endTime:"21:30",location:"Pitch",participants:[{rowId:"r",playerId:"p",playing:true,paid:false}]}]});

test("ordinary saves never scan or delete remote records absent from the cache",async()=>{
  const {api,calls}=app(squad(),{"players.manage":true,"games.manage":true,"attendance.manage":true,"payments.manage":true});
  await api.save();
  assert.equal(calls.length,0);
  api.edit(s=>s.players[0].phone="123");
  await api.save();
  assert.equal(calls.length,1);
  assert.equal(calls[0].table,"players");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload)),{phone:"123"});
});
test("finance-only payment change updates the squad source of truth",async()=>{
  const {api,calls}=app(squad(),{"payments.manage":true});
  api.edit(s=>s.games[0].participants[0].paid=true);
  await api.save();
  assert.equal(calls.length,1);
  assert.equal(calls[0].table,"game_players");
  assert.equal(calls[0].action,"update");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload)),{paid:true});
  assert.deepEqual(calls[0].filter,["id","r"]);
});
test("attendance changes cannot overwrite payment state",async()=>{
  const {api,calls}=app(squad(),{"attendance.manage":true});
  api.edit(s=>{s.games[0].participants[0].playing=false;s.games[0].participants[0].paid=true;});
  await api.save();
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload)),{playing:false});
});
test("only explicit deletion is sent, with its exact ID",async()=>{
  const {api,calls}=app(squad(),{"attendance.manage":true});
  api.edit(s=>s.games[0].participants=[]);
  api.deleting("game_players","r","attendance.manage");
  await api.save();
  assert.equal(calls.length,1);
  assert.equal(calls[0].action,"delete");
  assert.deepEqual(calls[0].filter,["id","r"]);
});
test("failed changes remain retryable and preview cannot write",async()=>{
  const state=squad();
  const {api,calls,fail}=app(state,{"payments.manage":true});
  api.edit(s=>s.games[0].participants[0].paid=true);
  fail("offline");
  await assert.rejects(api.save(),/offline/);
  await assert.rejects(api.save(),/offline/);
  assert.equal(calls.length,2);
  api.preview();
  await assert.rejects(api.save(),/read-only/);
  assert.equal(calls.length,2);
});
test("finance counts paid regular players and lists unpaid players without legacy model",()=>{
  const state=squad();
  state.players.push({id:"unpaid",name:"Unpaid"});
  state.games[0].participants[0].paid=true;
  state.games[0].participants.push({rowId:"u",playerId:"unpaid",playing:true,paid:false});
  const {api}=app(state,{"payments.view":true});
  api.setFinance({seasons:[{id:"s",name:"Season",starts_on:"2026-01-01",ends_on:"2026-12-31",pay_per_game_amount:10,season_ticket_amount:100}],tickets:[],expenses:[]});
  const html=api.finance();
  assert(html.includes('<small>CURRENT BALANCE</small><strong>€10.00</strong>'));
  assert(html.includes("<td>Unpaid</td>"));
});
test("season ticket debt uses each ticket's amount",()=>{
  const state=squad();
  state.games=[];
  const {api}=app(state,{"payments.view":true});
  api.setFinance({seasons:[{id:"s",name:"Season",starts_on:"2026-01-01",ends_on:"2026-12-31",pay_per_game_amount:10,season_ticket_amount:100}],tickets:[{id:"t",season_id:"s",player_id:"p",amount:60,paid:false}],expenses:[]});
  const html=api.finance();
  assert(html.includes('<small>EXPECTED INCOME</small><strong>€60.00</strong>'));
});
test("teams query excludes withdrawn squad members",async()=>{
  const sb={from(table) {
    let rows=table==="games"?[{id:"g",game_date:"2026-10-30"}]:table==="game_players"?[
      {id:"1",player_id:"p1",playing:true,players:{name:"First",skill_level:3}},
      {id:"2",player_id:"p2",playing:true,players:{name:"Second",skill_level:3}},
      {id:"3",player_id:"p3",playing:false,players:{name:"Withdrawn",skill_level:3}}
    ]:[];
    const q={select(){return q},order(){return q},in(){return q},eq(column,value){if(column==="playing")rows=rows.filter(r=>r.playing===value);return q},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve)}};
    return q;
  }};
  const ctx=vm.createContext({window:{footballClient:sb},document:{querySelector:()=>({textContent:new Date("2026-10-30T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})})}});
  const source=fs.readFileSync(path.join(root,"auto-teams.js"),"utf8");
  vm.runInContext(source.slice(0,source.indexOf("  new MutationObserver"))+"window.generate=generateTeams;})();",ctx);
  const result=await ctx.window.generate(2);
  assert.equal(result.teams.flatMap(t=>t.players).length,2);
  assert(!result.teams.some(t=>t.players.some(p=>p.name==="Withdrawn")));
});
test("payment badge skips signed-out requests and does not rewrite an unchanged count",async()=>{
  let requests=0,writes=0,scheduled;
  const badge={setAttribute(){},remove(){}};
  Object.defineProperty(badge,"textContent",{get:()=>"3",set:()=>writes++});
  const item={style:{},querySelector:()=>badge};
  const sb={auth:{getSession:async()=>({data:{session:null}})},rpc:async()=>{requests++;return {data:{summary:{open:3}}}}};
  const ctx=vm.createContext({
    window:{footballClient:sb,addEventListener(){}},document:{body:{},querySelector:()=>item},
    MutationObserver:class {observe(){}},setTimeout:callback=>{scheduled=callback},clearTimeout(){},console
  });
  vm.runInContext(fs.readFileSync(path.join(root,"member-payments-badge.js"),"utf8"),ctx);
  await scheduled();
  assert.equal(requests,0);
  sb.auth.getSession=async()=>({data:{session:{}}});
  await scheduled();
  assert.equal(requests,1);
  assert.equal(writes,0);
});
