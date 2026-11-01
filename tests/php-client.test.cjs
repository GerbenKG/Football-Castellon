const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
function setup() {
  const calls=[],navigation=[];
  const api={
    get:async url=>{
      calls.push({method:'GET',url});
      if(url.endsWith('me.php'))return {authenticated:true,user:{id:'member'}};
      if(url.includes('access.php'))return {allowed:true,members:[],rolePermissions:[]};
      if(url.includes('data.php'))return {data:[{id:'row'}]};
      return [];
    },
    post:async(url,body)=>{calls.push({method:'POST',url,body});return {data:[{id:'row'}]};},
    request:async(url,options)=>{calls.push({url,...options});return {path:'avatar'};}
  };
  const ctx=vm.createContext({window:{api,location:{assign:url=>navigation.push(url)}},URLSearchParams,FormData,console});
  vm.runInContext(fs.readFileSync(path.join(root,'api/app-client.js'),'utf8'),ctx);
  return {client:ctx.window.footballClient,calls,navigation};
}
test('sign-in navigates to local PHP Google login, sessions come from PHP',async()=>{
  const {client,calls,navigation}=setup();
  await client.auth.signInWithOAuth({provider:'google'});
  assert.deepEqual(navigation,['/api/auth/google.php']);
  assert.equal((await client.auth.getSession()).data.session.user.id,'member');
  assert.equal(calls.at(-1).url,'/api/auth/me.php');
  await client.auth.signOut();
  assert.equal(calls.at(-1).method,'POST');
  assert.equal(calls.at(-1).url,'/api/auth/logout.php');
});
test('queries retain multiple orderings, null/date/list filters, limits and relations',async()=>{
  const {client,calls}=setup();
  await client.from('game_players').select('id,players(name)').eq('playing',true).not('player_id','is',null).in('player_id',['a','b']).gte('game_date','2026-10-31').order('game_date').order('start_time').limit(1);
  const url=new URL(calls.at(-1).url,'https://example.test');
  assert.equal(url.pathname,'/api/data.php');
  assert.equal(url.searchParams.get('include_players'),'1');
  assert.equal(JSON.parse(url.searchParams.get('orders')).length,2);
  assert.equal(JSON.parse(url.searchParams.get('filters')).length,4);
  assert.equal(url.searchParams.get('limit'),'1');
});
test('inserts return the persisted row through single',async()=>{
  const {client,calls}=setup();
  const response=await client.from('game_players').insert({game_id:'g'}).select('*').single();
  assert.equal(response.data.id,'row');
  assert.equal(calls.at(-1).body.action,'insert');
});
test('all UI RPC operations are implemented by local routes',async()=>{
  const {client,calls}=setup();
  const names=['member_profile','admin_preview_member_profile','member_payment_history','admin_preview_member_payment_history','player_list_games','member_update_profile','member_toggle_game','admin_upsert_access','admin_delete_access','admin_update_permission','admin_list_players_for_linking','claim_access_profile','get_my_access','admin_list_access','admin_list_permissions','list_player_avatars','player_list_game_squad','set_game_bib_taker'];
  for(const name of names) assert.equal((await client.rpc(name,{p_email:'test@example.test'})).error,null,name);
  assert(calls.every(call=>call.url.startsWith('/api/')));
  const before=calls.length;
  assert.match((await client.rpc('admin_preview_toggle_game')).error.message,/read-only/);
  assert.equal(calls.length,before);
});
test('restricted reads become empty startup data but server failures remain visible',async()=>{
  const {client}=setup();
  // Use a separate context to simulate the server's permission boundary.
  const error=Object.assign(new Error('Permission denied'),{status:403});
  const ctx=vm.createContext({window:{api:{get:async()=>{throw error}}},URLSearchParams,FormData});
  vm.runInContext(fs.readFileSync(path.join(root,'api/app-client.js'),'utf8'),ctx);
  const reply=await ctx.window.footballClient.from('players').select();
  assert.equal(reply.error,null);
  assert.equal(reply.data.length,0);
  error.status=500;
  assert.equal((await ctx.window.footballClient.from('players').select()).error.status,500);
});
test('all local scripts referenced by index exist',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)) assert(fs.existsSync(path.join(root,match[1])),match[1]);
});
