const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function client(search=''){
 const calls=[],events=[],window={location:{search},dispatchEvent:e=>events.push(e)};
 const context=vm.createContext({window,URLSearchParams,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},fetch:async(path,options)=>{calls.push({path,options});return {ok:true,status:200,json:async()=>path.includes('csrf')?{csrf_token:'csrf'}:{preview:search?{name:'Selected player',role:'player',read_only:true}:null}};}});
 vm.runInContext(fs.readFileSync(__dirname+'/../api/client.js','utf8'),context);
 return {api:window.api,window,calls,events};
}
test('selected member is forwarded on reads and preview metadata is published',async()=>{const key='a'.repeat(64),c=client('?view_as='+key);await c.api.get('/api/club.php');assert.equal(c.calls[0].options.headers['X-FC-Preview'],key);assert.equal(c.window.footballPreviewInfo.name,'Selected player');assert.equal(c.events[0].type,'football:member-preview');});
test('member preview blocks writes and logout before any request is sent',async()=>{const c=client('?view_as='+'a'.repeat(64));for(const path of ['/api/club.php','/api/auth/member-profile.php','/api/auth/access.php','/api/auth/logout.php'])await assert.rejects(c.api.post(path,{}),/read-only/);assert.equal(c.calls.length,0);});
test('empty preview key stays a preview request rather than showing the owner',async()=>{const c=client('?view_as=');await c.api.get('/api/club.php');assert.equal(c.window.footballPreviewActive,true);assert.equal(c.calls[0].options.headers['X-FC-Preview'],'');});
test('normal owner tab has no preview context and retains CSRF-protected writes',async()=>{const c=client();await c.api.post('/api/club.php',{});assert.equal(c.window.footballPreviewActive,false);assert.equal(c.calls.length,2);assert.equal(c.calls[1].options.headers['X-CSRF-Token'],'csrf');assert.equal(c.calls[1].options.headers['X-FC-Preview'],undefined);});
