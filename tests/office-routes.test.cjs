const assert=require('node:assert/strict');const R=require('../office-routes.js');
assert.deepEqual(R.parse('#office/matches'),{section:'matches',id:''});
assert.equal(R.parse('#office/unknown').section,'overview');
for(const [view,section] of Object.entries({games:'matches',finance:'finance',players:'people',admin:'members',dashboard:'overview'}))assert.equal(R.legacy('https://dev.castellon.futbol/office.html?view='+view),'/#office/'+section);
const id='30000000-0000-4000-8000-000000000002';assert.equal(R.legacy('https://dev.castellon.futbol/office.html?view=dashboard&game='+id+'&view_as=abc'),'/?view_as=abc#office/match/'+id);
assert.equal(R.legacy('https://dev.castellon.futbol/office.html?view=dashboard&game=invalid'),'/#office/overview');
console.log('PASS office deep links, legacy destinations and preview preservation');
