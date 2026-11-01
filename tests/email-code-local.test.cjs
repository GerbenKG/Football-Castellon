const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
require('node:dns').setDefaultResultOrder('ipv4first');
const php=process.env.PHP_BIN||'C:/Program Files/php-8.4.12/php.exe',base='http://localhost:3002',email='email-code-fixture@example.test';
function fixture(action){return execFileSync(php,['-d','extension=pdo_mysql',path.join(__dirname,'email-code-fixture.php'),action],{encoding:'utf8'}).trim();}
function code(){return JSON.parse(fs.readFileSync(path.join(__dirname,'../.local/email-outbox',crypto.createHash('sha256').update(email).digest('hex')+'.json'),'utf8')).body.match(/code is: (\d{6})/)[1];}
function client(){const jar=new Map();return {async post(body,status=200,origin=base){const r=await fetch(base+'/api/auth/email-code.php',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')},body:JSON.stringify(body)});for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');jar.set(k,v);}const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;},async me(){const r=await fetch(base+'/api/auth/me.php',{headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}});return r.json();}};}
(async()=>{
 fixture('reset');try{
 const a=client();await a.post({action:'request',email},403,'https://evil.example');await a.post({action:'request',email:'bad'},422);
 const requested=await a.post({action:'request',email});assert.equal(requested.expires_in,600);const first=code();
 await a.post({action:'request',email},429);await client().post({action:'verify',code:first},422);
 await a.post({action:'verify',code:'999999'===first?'000000':'999999'},422);
 await a.post({action:'verify',code:first,email:'local-super_admin@example.test'});const me=await a.me();assert.equal(me.user.email,email);const id=me.user.id;
 await a.post({action:'verify',code:first},422);
 assert.equal(JSON.parse(fixture('google')).id,id,'Google must link to same user');assert.equal(fixture('other-google'),'rejected');
 fixture('cooldown');const b=client();await b.post({action:'request',email});const googleCode=code();await b.post({action:'verify',code:googleCode});assert.equal((await b.me()).user.id,id,'Email must reuse Google user');
 fixture('cooldown');await b.post({action:'request',email});const old=code();fixture('cooldown');await b.post({action:'request',email});let newest=code();if(newest===old){fixture('cooldown');await b.post({action:'request',email});newest=code();}assert.notEqual(old,newest);await b.post({action:'verify',code:old},422);await b.post({action:'verify',code:newest});
 console.log('PASS email delivery fixture, browser binding, one-time use, resend invalidation, rate limit and shared Google identity');
 fixture('reset');const c=client();await c.post({action:'request',email});const limitedCode=code();for(let i=0;i<5;i++)await c.post({action:'verify',code:limitedCode==='999999'?'000000':'999999'},422);await c.post({action:'verify',code:limitedCode},422);
 fixture('reset');const d=client();await d.post({action:'request',email});const expired=code();fixture('expire');await d.post({action:'verify',code:expired},422);
 fixture('reset');const e=client();await e.post({action:'request',email});const disabled=code();fixture('disable');await e.post({action:'verify',code:disabled},422);fixture('cooldown');const paused=await e.post({action:'request',email});assert.equal(paused.membership,'disabled');assert.match(paused.message,/board member/);
 fixture('reset');const u=client();const unknown=await u.post({action:'request',email:'email-code-unknown@example.test'});assert.equal(unknown.membership,'unknown');assert.match(unknown.message,/board member/);assert.ok(!fs.existsSync(path.join(__dirname,'../.local/email-outbox',crypto.createHash('sha256').update('email-code-unknown@example.test').digest('hex')+'.json')));await u.post({action:'verify',code:'123456'},422);
 console.log('PASS five-guess lockout, expiry, disabled membership, clear unknown-member guidance and no unauthorised account creation');
 }finally{fixture('cleanup');}
})().catch(e=>{console.error(e);process.exitCode=1;});
