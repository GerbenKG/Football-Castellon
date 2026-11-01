(() => {
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function membershipHelp(root,reason,email){
  const box=root.closest('.login-box')||root;document.body.classList.add('auth-help-page');box.classList.add('auth-help-box');
  box.innerHTML=`<div class="eyebrow">A place in the club</div><div class="auth-help-symbol" aria-hidden="true">⚽</div><h1>${reason==='disabled'?'Your club access is paused.':'Your email is not on the team sheet.'}</h1><p class="auth-help-intro">${reason==='disabled'?'Your membership is currently disabled. A board member can help you check your access.':'This email address is not registered as a club member yet.'}</p><div class="auth-account"><span>Membership email</span><strong>${esc(email)}</strong></div><section class="auth-board-help" aria-labelledby="board-access-title"><h2 id="board-access-title">Ask the board for access</h2><p>Access is arranged by the team managers — your club’s board members. Contact one of them and ask to have your email address added to the club.</p><p>Already a player? Ask them to link this email to your existing player profile, so your games, payments and statistics stay together.</p></section><div class="auth-help-actions"><a class="btn btn-primary" href="/">Use another email address</a><a class="btn btn-outline" href="/api/auth/google.php">Continue with Google</a></div>`;
  box.querySelector('h1').setAttribute('tabindex','-1');box.querySelector('h1').focus();
 }
 function mount(root){
  if(!root)return;let address='',step='email',busy=false,resendAt=0,timer;
  function draw(message=''){
   clearInterval(timer);
   root.innerHTML=`<div class="login-divider"><span>or sign in with email</span></div><form id="email-login-form"><label class="field" for="club-login-email">Your membership email</label><input id="club-login-email" type="email" maxlength="254" autocomplete="email" required value="${esc(address)}" ${step==='code'?'readonly':''}>${step==='code'?`<p class="email-login-help">If this address belongs to an active member, a six-digit code will arrive from <strong>login@castellon.futbol</strong>. Check spam too. It expires in 10 minutes.</p><label class="field" for="club-login-code">Sign-in code</label><input id="club-login-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required aria-describedby="email-login-status">`:''}<p id="email-login-status" role="status" aria-live="polite">${esc(message)}</p><button class="btn btn-primary" type="submit">${step==='code'?'Sign in':'Email me a code'}</button>${step==='code'?'<div class="email-login-options"><button type="button" class="text-link" id="email-login-resend">Send another code</button><button type="button" class="text-link" id="email-login-change">Use another email</button></div>':''}</form>`;
   const form=root.querySelector('form'),email=root.querySelector('#club-login-email'),code=root.querySelector('#club-login-code'),status=root.querySelector('#email-login-status');
   function availability(){const left=Math.max(0,Math.ceil((resendAt-Date.now())/1000));const resend=root.querySelector('#email-login-resend');if(resend){resend.disabled=busy||left>0;resend.textContent=left?'Send another code in '+left+'s':'Send another code';}}
   async function send(action){
    if(busy)return;busy=true;for(const b of form.querySelectorAll('button'))b.disabled=true;status.textContent=action==='verify'?'Checking your code…':'Requesting your code…';
    try{
     const response=await fetch('/api/auth/email-code.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(action==='request'?{action,email:email.value.trim()}:{action,code:code.value.trim()})});
     const result=await response.json();if(!response.ok)throw new Error(result.error||'Sign-in could not be completed. Please try again.');
     if(action==='verify'){window.location.assign('/');return;}
     if(['unknown','disabled'].includes(result.membership)){clearInterval(timer);membershipHelp(root,result.membership,email.value.trim());return;}
     address=email.value.trim();step='code';resendAt=Date.now()+result.resend_after*1000;draw('Your code is valid for 10 minutes. Only the newest code will work.');root.querySelector('#club-login-code').focus();
    }catch(e){status.textContent=e.message;}finally{busy=false;for(const b of form.querySelectorAll('button'))b.disabled=false;availability();}
   }
   form.onsubmit=e=>{e.preventDefault();if(form.reportValidity())send(step==='code'?'verify':'request');};
   if(step==='code'){
    root.querySelector('#email-login-resend').onclick=()=>send('request');
    root.querySelector('#email-login-change').onclick=()=>{address=email.value;step='email';draw();root.querySelector('input').focus();};
    timer=setInterval(()=>{if(!root.isConnected){clearInterval(timer);return;}availability();},1000);availability();
   }
  }
  draw();
 }
 async function settings(){
  const data=await window.api.get('/api/auth/email-settings.php');
  const d=document.createElement('dialog');d.className='email-settings-dialog';d.setAttribute('aria-label','Email sign-in settings');
  d.innerHTML=`<form><h2>Email sign-in</h2><p>Sender: <strong>${esc(data.sender)}</strong>. These settings apply to this site only.</p><label class="field">Sender display name<input name="sender_name" maxlength="80" required value="${esc(data.template.sender_name)}"></label><label class="field">Subject<input name="subject" maxlength="160" required value="${esc(data.template.subject)}"></label><label class="field">Email message<textarea name="body" rows="12" maxlength="4000" required>${esc(data.template.body)}</textarea></label><p class="email-login-help">Keep <strong>{code}</strong>, <strong>{minutes}</strong> and <strong>{site}</strong>; they are replaced automatically. Emails are plain text. Codes last 10 minutes.</p><p class="form-error" role="alert"></p><div class="actions"><button class="btn btn-outline" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save email settings</button></div></form>`;
  document.body.append(d);d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>d.remove();
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=d.querySelector('[type=submit]');b.disabled=true;try{await window.api.post('/api/auth/email-settings.php',Object.fromEntries(new FormData(e.target)));d.close();}catch(err){d.querySelector('[role=alert]').textContent=err.message;}finally{b.disabled=false;}};
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-email-settings]');if(!b)return;b.disabled=true;settings().catch(e=>alert(e.message)).finally(()=>b.disabled=false);});
 window.ClubEmailLogin={mount};
})();
