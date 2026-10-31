(() => {
  'use strict';
  if(!window.footballPreviewActive)return;
  document.body.classList.add('member-preview');
  window.isFootballPreview=()=>true;
  const exit='/#office/members';
  const names={super_admin:'Club owner',admin:'Club board',attendance:'Match organiser',finance:'Treasurer',viewer:'Read-only member',player:'Player'};
  window.footballPreviewUrl=value=>{
    const url=new URL(value,location.href);
    if(url.origin===location.origin&&['/','/index.html','/office.html'].includes(url.pathname))url.searchParams.set('view_as',window.footballPreviewKey);
    return url.href;
  };
  const banner=document.createElement('div');banner.className='member-preview-banner';banner.id='member-preview-banner';banner.setAttribute('role','region');banner.setAttribute('aria-label','Member preview');
  banner.innerHTML='<div><strong id="member-preview-title">Member preview</strong><span id="member-preview-subtitle">Loading the selected member’s view…</span></div><div class="member-preview-actions"><span class="member-preview-lock">Read-only preview</span><a class="btn btn-primary btn-small" data-leave-member-preview href="'+exit+'">Exit preview</a></div>';
  document.body.prepend(banner);
  const resize=()=>document.documentElement.style.setProperty('--member-preview-height',banner.offsetHeight+'px');
  if(window.ResizeObserver)new ResizeObserver(resize).observe(banner);else window.addEventListener('resize',resize);
  const safeActions=new Set(['refresh','player','calendar','logout']);
  function decorate(){
    const info=window.footballPreviewInfo;
    if(info){
      const title='Viewing as '+info.name+' · '+(names[info.role]||info.role),subtitle='Their pages, bookings and payments. Your owner session stays signed in.';
      const heading=document.getElementById('member-preview-title'),sub=document.getElementById('member-preview-subtitle');
      if(heading.textContent!==title)heading.textContent=title;
      if(sub.textContent!==subtitle)sub.textContent=subtitle;
    }
    document.querySelectorAll('a[href]').forEach(a=>{if(a.hasAttribute('data-leave-member-preview'))return;const href=a.getAttribute('href');if(!href||href.startsWith('#'))return;const url=new URL(href,location.href);if(url.origin===location.origin&&['/','/index.html','/office.html'].includes(url.pathname)){const next=window.footballPreviewUrl(href);if(a.href!==next)a.href=next;}});
    document.querySelectorAll('button').forEach(b=>{
      const action=b.dataset.action,a=b.dataset.a,access=b.dataset.accessAction;
      const mutation=(action&&!safeActions.has(action))||(a&&!['history','exit-preview'].includes(a))||(access&&!['select-role','reload'].includes(access))||b.matches('[data-office-action],[data-pv-action],[data-fin-ticket],[data-fin-due-ticket],[data-fin-due-game],[data-fin-expense],[data-auto-teams],[data-select-teams],[data-select-bibs],button[type="submit"]')||(b.closest('form')&&!b.matches('[data-close],[data-pv-close],[data-team-close]'))||b.id==='newGame';
      if(mutation){b.disabled=true;b.title='Read-only preview. Exit preview to make changes.';}
    });
    document.querySelectorAll('input,textarea,select').forEach(input=>{
      if(input.type==='search'||input.matches('#squad-sort,#archive-season,#finance-season-select,#access-role-filter'))return;
      if(input.closest('form')||input.matches('[type="checkbox"],[type="radio"],[data-t],[data-perm-role],[data-fin-due-game],#vote-player')){input.disabled=true;input.title='Read-only member preview';}
    });
    document.querySelectorAll('[data-action="logout"],#office-signout,[data-user-action="signout"]').forEach(b=>{b.setAttribute('aria-label','Exit member preview');b.title='Return to your owner account';if(/^sign\s*out$/i.test(b.textContent.trim()))b.textContent='Exit preview';});
    resize();
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-action="logout"],#office-signout,[data-user-action="signout"],[data-a="exit-preview"]')){e.preventDefault();e.stopImmediatePropagation();location.href=exit;}},true);
  document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('football:member-preview',decorate);
  decorate();
})();
