(() => {
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',squad:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',shirt:'<path d="m8 3-5 3-2 5 4 2 2-3v11h10V10l2 3 4-2-2-5-5-3c-1 4-7 4-8 0Z"/>',office:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-11 0v3h4v-3"/>',chevron:'<path d="m9 5 7 7-7 7"/>',wallet:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z"/>'};
  const icon=n=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.office}</svg>`;
  const header=document.querySelector('header.topbar'),main=document.querySelector('main.container'),nav=main.querySelector('.nav');
  main.id='content';main.classList.add('content','office-content');
  const workspace=document.createElement('div');workspace.className='workspace';header.before(workspace);workspace.append(header,main);
  const sidebar=document.createElement('aside');sidebar.className='sidebar';sidebar.innerHTML=`<a class="identity" href="/#clubhouse"><img src="club-crest.svg" alt="FC Castellón crest"><div><strong>FC Castellón</strong><small>THE CLUBHOUSE</small></div></a><div class="nav-label">Your club</div><nav class="nav-links" aria-label="Club navigation">${[['clubhouse','Clubhouse','home'],['matches','Matches','calendar'],['squad','Squad','squad'],['myclub','My Club','shirt'],['office','Club Office','office']].map(([id,label,ico])=>`<a href="/#${id}" ${id==='office'?'class="active" aria-current="page"':''}>${icon(ico)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="club-motto"><p>Good football.<br>Better company.</p><small>CASTELLÓN · SPAIN</small></div><div class="account" id="office-account"><span class="initials">FC</span><div><strong>Club member</strong><small>Club Office</small></div></div><button class="signout" id="office-signout">Sign out</button></div>`;workspace.before(sidebar);
  const skip=document.createElement('a');skip.className='skip-link';skip.href='#content';skip.textContent='Skip to content';document.body.prepend(skip);
  const environment=location.hostname==='dev.castellon.futbol'?'DEV · LIVE DATA':['localhost','127.0.0.1'].includes(location.hostname)?'LOCAL · SAMPLE DATA':'';
  header.querySelector('.brand-wrap').outerHTML=`<div class="crumb">FC Castellón ${icon('chevron')} <a href="/#office">Club Office</a> ${icon('chevron')} <b id="office-current-page">Management</b></div><a class="mobile-brand" href="/#clubhouse"><img src="club-crest.svg" alt="">FC Castellón</a>`;
  if(environment){const badge=document.createElement('span');badge.className='environment';badge.textContent=environment;header.querySelector('.top-actions').prepend(badge);}
  const labels={dashboard:['Match squad','shirt'],players:['Player records','squad'],games:['Fixtures','calendar'],finance:['Finances','wallet'],admin:['Members & permissions','office']};
  nav.setAttribute('aria-label','Club Office tools');
  for(const button of nav.querySelectorAll('[data-view]')){const label=labels[button.dataset.view];if(label){button.innerHTML=icon(label[1])+`<span>${label[0]}</span>`;button.title=label[0];}}
  const caption=document.createElement('div');caption.className='office-section-caption';caption.textContent='Club Office · Management';nav.before(caption);
  const footer=document.createElement('footer');footer.className='club-footer';footer.innerHTML='<span>FC Castellón · Good football. Better company.</span><span>Club Office · Authorised members only</span>';main.append(footer);
  document.title='Club Office · FC Castellón';
  document.getElementById('office-signout').onclick=async()=>{try{await window.api.post('/api/auth/logout.php',{});location.href='/';}catch(e){alert(e.message);}};
  let financeAccess=null;
  window.api.get('/api/auth/access.php').then(access=>{
    const profile=access.profile;if(!profile)return;
    if(!['dashboard.view','players.view','games.manage','attendance.view','payments.view','access.manage'].some(p=>access.permissions[p]===true)){location.replace(access.permissions['clubhouse.manage']?'/#office':'/#myclub');return;}
    financeAccess=access.permissions['payments.view']===true;
    document.body.dataset.financeAccess=String(financeAccess);
    const displayName=profile.display_name||'Club member',initials=displayName.split(/\s+/).slice(0,2).map(s=>s[0]).join('');
    const roles={super_admin:'Club owner',admin:'Club board',attendance:'Match organiser',finance:'Treasurer',viewer:'Read-only member',player:'Player'};
    document.getElementById('office-account').innerHTML=`<span class="initials">${esc(initials)}</span><div><strong>${esc(displayName)}</strong><small>${esc(roles[profile.role]||'Club member')}</small></div>`;
    for(const [id,permission] of [['clubhouse','clubhouse.view'],['matches','games.view'],['squad','squad.view']])if(access.permissions[permission]===false)sidebar.querySelector(`a[href="/#${id}"]`)?.remove();
    update();
  }).catch(()=>{});
  function update(){
    if(document.getElementById('google-login')){location.replace('/');return;}
    const active=nav.querySelector('[data-view].active'),label=labels[active?.dataset.view]?.[0]||'Management',crumb=document.getElementById('office-current-page');
    if(crumb.textContent!==label){crumb.textContent=label;document.title=label+' · FC Castellón';}
    if(active&&document.getElementById('app').children.length&&!window.__memberView){const url=new URL(location.href);if(url.searchParams.get('view')!==active.dataset.view){url.searchParams.set('view',active.dataset.view);history.replaceState(history.state,'',url);}}
    nav.querySelectorAll('.nav-item').forEach(b=>{if(b.classList.contains('active'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    const userMenu=document.querySelector('.member-user-trigger');if(userMenu)userMenu.setAttribute('aria-label','Account menu for '+(document.querySelector('.member-user-name')?.textContent||'club member'));
    // Long management tables scroll inside their card, not across the whole page.
    main.querySelectorAll('table').forEach(table=>{const holder=table.parentElement;if(!holder.classList.contains('office-table-scroll')){const scroll=document.createElement('div');scroll.className='office-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',(table.closest('section')?.querySelector('h2,h3')?.textContent||'Club records')+' table. Scroll horizontally for more columns.');holder.insertBefore(scroll,table);scroll.append(table);}});
    if(financeAccess===false){
      main.querySelectorAll('.stat').forEach(stat=>{if(/PAYMENTS|PAYMENT|BALANCE|INCOME|EXPENSES/.test(stat.querySelector('small')?.textContent||''))stat.hidden=true;});
      main.querySelectorAll('.analytics-card').forEach(card=>{if(card.querySelector('h3')?.textContent==='Payments')card.hidden=true;});
    }
  }
  new MutationObserver(update).observe(document.getElementById('app'),{childList:true,subtree:true});update();
  let previousFocus=null,currentModal=null;
  new MutationObserver(()=>{
    const modal=document.querySelector('#modal-root .modal');if(modal===currentModal)return;
    if(!modal){currentModal=null;document.body.classList.remove('office-modal-open');previousFocus?.focus?.();return;}
    currentModal=modal;previousFocus=document.activeElement;document.body.classList.add('office-modal-open');
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');const title=modal.querySelector('h2');if(title){title.id='office-modal-title';modal.setAttribute('aria-labelledby',title.id);}
    const closer=modal.querySelector('.remove');if(closer)closer.setAttribute('aria-label','Close dialog');
    modal.querySelector('input:not([type="hidden"]),select,textarea,button')?.focus();
  }).observe(document.getElementById('modal-root'),{childList:true,subtree:true});
  document.addEventListener('keydown',event=>{
    if(!currentModal)return;
    if(event.key==='Escape'){event.preventDefault();document.getElementById('modal-root').innerHTML='';return;}
    if(event.key!=='Tab')return;
    const elements=[...currentModal.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(e=>!e.disabled&&e.getClientRects().length),first=elements[0],last=elements.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
})();
