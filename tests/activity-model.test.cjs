const test=require('node:test'),assert=require('node:assert/strict'),M=require('../activity-model.js');
const p=(id,key=id)=>({id,online_key:key,display_name:id});
test('first online snapshot is quiet, arrivals exclude yourself and repeated polls are deduplicated',()=>{
 const t=M.tracker();assert.deepEqual(t.observe([p('me'),p('a')],'me'),[]);
 assert.deepEqual(t.observe([p('me'),p('a'),p('b')],'me').map(p=>p.id),['b']);
 assert.deepEqual(t.observe([p('me'),p('a'),p('b')],'me'),[]);
 assert.deepEqual(t.observe([p('me','new'),p('a'),p('b')],'me'),[]);
});
test('a new online spell notifies once and reconnecting establishes a quiet baseline',()=>{
 const t=M.tracker();t.observe([p('a','old')],'me');assert.equal(t.observe([p('a','new')],'me').length,1);
 assert.equal(t.observe([p('a','new')],'me').length,0);t.observe([],'me');assert.equal(t.observe([p('a','another')],'me').length,1);
 t.reset();assert.deepEqual(t.observe([p('a'),p('b')],'me'),[]);
});
test('last sign-in uses explicit Castellon summer and winter time and handles absent history',()=>{
 assert.match(M.lastSignIn('2026-07-01T17:30:00Z'),/19:30/);assert.match(M.lastSignIn('2026-12-01T17:30:00Z'),/18:30/);
 assert.equal(M.lastSignIn(null),'Not recorded yet');assert.equal(M.lastSignIn('invalid'),'Not recorded yet');
});
