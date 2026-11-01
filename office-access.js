(() => {
  'use strict';
  const model=window.ClubAccessModel,api=window.api;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let access=null,players=[],loading=null,error='',role='player',draft=null,dirty=false,query='',roleFilter='all',saving=false,message='';
  const owner=()=>access?.profile.role==='super_admin';
  const root=()=>document.getElementById('club-access-root');
  async function load(){
    const a=await api.get('/api/auth/access.php');access=a;
    if(owner())players=await api.get('/api/auth/access.php?action=admin_list_players_for_linking');
    if(!dirty)draft=model.forRole(a.rolePermissions,role);
  }
  function draw(){const target=root();if(target)target.innerHTML=content();}
  function view(){
    if(!access&&!loading){loading=load().catch(e=>{error=e.message;}).finally(()=>{loading=null;draw();});}
    queueMicrotask(draw);
    return '<div id="club-access-root" aria-busy="false"></div>';
  }
  function members(){
    const list=access.members.filter(m=>(roleFilter==='all'||m.role===roleFilter)&&[m.display_name,m.email,players.find(p=>p.id===m.player_id)?.name].some(s=>String(s||'').toLowerCase().includes(query.toLowerCase())));
    return list.map(m=>`<article class="access-member">${window.ClubAvatar.render(m)}<div class="access-member-name"><h3>${window.ClubFavorites.label(players.find(p=>p.id===m.player_id)?.name||m.display_name||'Unlinked member',m.player_id,m)}</h3><p>${esc(m.email)}</p><small>${m.player_id?'Linked to a player':'Player link needed'} · ${m.user_id?'Has signed in':'Awaiting first sign-in'}</small></div><div class="access-member-status"><span class="pill ${m.role==='super_admin'?'':'neutral'}">${esc(model.name(m.role))}</span><span class="pill ${m.active?'':'red'}">${m.active?'Active':'Disabled'}</span></div><div class="access-member-actions">${m.active&&m.preview_key?`<a class="btn btn-outline btn-small" href="/?view_as=${esc(m.preview_key)}" title="View ${esc(m.display_name||m.email)} in a read-only preview">Log in as</a>`:''}<button class="btn btn-outline btn-small" data-access-action="edit-member" data-email="${esc(m.email)}">Edit access</button></div></article>`).join('')||'<div class="empty"><strong>No matching members</strong>Try another name, email or profile.</div>';
  }
  function matrix(){
    const fixed=role==='super_admin',values=draft||model.forRole(access.rolePermissions,role);
    return `<form id="access-role-form"><div class="access-profile-heading"><div><div class="eyebrow">Profile permissions</div><h2>${esc(model.name(role))}</h2><p>${esc(model.roles.find(r=>r.id===role).description)}</p></div><span class="pill ${fixed?'':'neutral'}">${access.members.filter(m=>m.role===role).length} assigned members</span></div><div class="access-page-list">${model.pages.map(p=>{const level=model.level(values,p);return `<div class="access-page-row"><div><h3>${p.name}</h3><p>${p.description}</p><small>${p.editNote}</small></div><label><span class="sr-only">${p.name} access for ${esc(model.name(role))}</span><select name="${p.id}" data-access-page="${p.id}" ${fixed?'disabled':''}><option value="none" ${level==='none'?'selected':''}>No access</option><option value="read" ${level==='read'?'selected':''}>Read only</option><option value="edit" ${level==='edit'?'selected':''}>Can edit</option></select></label></div>`;}).join('')}<div class="access-page-row"><div><h3>My Club</h3><p>Own details, match bookings and personal payments.</p><small>Members can report their own transfers. Only a treasurer confirms receipt.</small></div><span class="pill">Own information only</span></div><div class="access-page-row"><div><h3>Members & permissions</h3><p>Invite accounts, assign profiles, enable access and change profile permissions.</p><small>Club owner access is protected against accidental lockout.</small></div><span class="pill ${fixed?'':'neutral'}">${fixed?'Can edit':'Club owner only'}</span></div></div>${!fixed?`<div class="access-save-bar"><p>${dirty?'Unsaved changes. Saving updates everyone assigned to this profile.':'Changes apply to all members with this profile.'}</p><button class="btn btn-primary" type="submit" ${!dirty||saving?'disabled':''}>${saving?'Saving…':'Save profile permissions'}</button></div>`:'<div class="notice" style="margin-top:20px">The Club owner profile always has full access. Create another Club owner only when that person should manage membership and permissions.</div>'}</form>`;
  }
  function content(){
    if(error&&!access)return `<div class="panel panel-pad"><h2>Permissions couldn’t load</h2><p class="form-error">${esc(error)}</p><button class="btn btn-outline" data-access-action="reload">Try again</button></div>`;
    if(!access)return '<section class="panel panel-pad"><h2>Opening members & permissions…</h2><p class="muted">Loading your club’s current access settings.</p></section>';
    if(!owner())return '<div class="page-head"><div><div class="eyebrow">Protected area</div><h1 class="title">Members & permissions</h1><p class="muted">Only a Club owner can assign profiles or change access. Your other Club Office tools remain available above.</p></div></div>';
    return `<div class="page-head"><div><div class="eyebrow">Your club, clearly organised</div><h1 class="title">Members & permissions</h1><p class="muted">Choose who belongs to the club and what each profile can see or change.</p></div><button class="btn btn-primary" data-access-action="new-member">+ Add member</button></div><div class="actions" style="margin-bottom:20px"><button type="button" class="btn btn-outline" data-email-settings>Email sign-in settings</button></div>${message?`<p class="notice" role="status" style="margin-bottom:20px">${esc(message)}</p>`:''}${error?`<p class="form-error" role="alert">${esc(error)}</p>`:''}<div class="access-summary"><div><strong>${access.members.filter(m=>m.active).length}</strong><span>Active members</span></div><div><strong>${access.members.filter(m=>['super_admin','admin','attendance','finance'].includes(m.role)&&m.active).length}</strong><span>Board & organisers</span></div><div><strong>${access.members.filter(m=>m.role==='player'&&m.active).length}</strong><span>Player accounts</span></div></div><section style="margin-bottom:30px"><div class="section-title"><div><h2>Club members</h2><p>Members sign in with Google or an email code and are linked to a player.</p></div></div><div class="access-member-tools"><input type="search" id="access-member-search" class="search" aria-label="Search members" placeholder="Find a name or email…" value="${esc(query)}"><label class="access-filter">Profile<select id="access-role-filter"><option value="all">All profiles</option>${model.roles.map(r=>`<option value="${r.id}" ${roleFilter===r.id?'selected':''}>${r.name}</option>`).join('')}</select></label></div><div class="panel" id="access-members">${members()}</div></section><section><div class="section-title"><div><h2>What each profile can do</h2><p>Select a profile, set access page by page, then save.</p></div></div><div class="access-role-tabs" aria-label="Choose a permission profile">${model.roles.map(r=>`<button class="access-role-tab ${r.id===role?'active':''}" data-access-action="select-role" data-role="${r.id}" aria-pressed="${r.id===role}"><strong>${r.name}</strong><span>${access.members.filter(m=>m.role===r.id).length} members</span></button>`).join('')}</div><div class="panel panel-pad" id="access-matrix">${matrix()}</div><p class="muted" style="font-size:11px;margin-top:15px">Read only allows viewing without changing records. Can edit enables the page’s management actions. Private player contacts and club finances require their own access. Disabled members cannot sign in.</p></section>`;
  }
  function dialog(member,selectedPlayer=null){
    const isSelf=member?.email.toLowerCase()===access.profile.email.toLowerCase(),linkedElsewhere=new Set(access.members.filter(m=>m.email!==member?.email).map(m=>m.player_id));
    const options=players.map(p=>`<option value="${p.id}" ${p.id===(member?.player_id||selectedPlayer?.id)?'selected':''} ${linkedElsewhere.has(p.id)?'disabled':''}>${esc(p.name)}${linkedElsewhere.has(p.id)?' (already linked)':''}</option>`).join('');
    document.getElementById('modal-root').innerHTML=`<div class="modal-bg"><div class="modal"><div class="modal-head"><div><h2>${member?'Edit member access':'Welcome someone to the club'}</h2><p>Link their Google account to an existing player.</p></div><button type="button" class="remove" data-close aria-label="Close dialog">×</button></div><form id="access-member-form" data-existing="${esc(member?.email||'')}"><label>Google account email<input name="email" type="email" value="${esc(member?.email||selectedPlayer?.email||'')}" maxlength="254" required ${member?'readonly':''}><small class="muted">They must sign in with this Google account.</small></label><label>Player<select name="player_id" required><option value="">Choose a player…</option>${options}</select></label><label>Access profile<select name="role" id="access-member-role" ${isSelf?'disabled':''}>${[...model.roles].reverse().map(r=>`<option value="${r.id}" ${(member?.role||'player')===r.id?'selected':''}>${r.name}</option>`).join('')}</select></label><div class="notice" id="access-member-description">${esc(model.roles.find(r=>r.id===(member?.role||'player')).description)}</div><p class="access-profile-preview" id="access-member-preview">${preview(member?.role||'player')}</p><label class="checkline"><input name="active" type="checkbox" ${!member||member.active?'checked':''} ${isSelf?'disabled':''}> Active — allow this member to sign in</label>${isSelf?'<p class="muted small">Your own Club owner access cannot be disabled or downgraded.</p>':''}<p id="access-member-error" class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save member access</button></div></form></div></div>`;
    const native=document.getElementById('member-access-dialog');
    if(native){native.innerHTML=document.querySelector('#modal-root .modal').innerHTML;document.getElementById('modal-root').innerHTML='';native.showModal();}
  }
  function closeMemberDialog(){document.getElementById('member-access-dialog')?.close();document.getElementById('modal-root').innerHTML='';}
  document.addEventListener('click',e=>{if(e.target.closest('[data-close]')&&document.getElementById('member-access-dialog')?.open)closeMemberDialog();});
  function preview(role){const values=model.forRole(access.rolePermissions,role);return model.pages.map(p=>`${esc(p.name)}: <b>${{none:'No access',read:'Read only',edit:'Can edit'}[model.level(values,p)]}</b>`).join('<br>')+`<br>Members & permissions: <b>${role==='super_admin'?'Can edit':'Club owner only'}</b>`;}
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-access-action]');if(!button||!root())return;
    if(button.dataset.accessAction==='select-role'){
      if(dirty&&!confirm('Discard the unsaved permission changes for this profile?'))return;
      role=button.dataset.role;draft=model.forRole(access.rolePermissions,role);dirty=false;message='';error='';draw();return;
    }
    if(button.dataset.accessAction==='edit-member')dialog(access.members.find(m=>m.email===button.dataset.email));
    if(button.dataset.accessAction==='new-member')dialog(null);
    if(button.dataset.accessAction==='reload'){error='';try{await load();}catch(e){error=e.message;}draw();}
  });
  document.addEventListener('input',event=>{if(event.target.id==='access-member-search'){query=event.target.value;document.getElementById('access-members').innerHTML=members();}});
  document.addEventListener('change',event=>{
    if(event.target.dataset.accessPage){draft=model.setLevel(draft,event.target.dataset.accessPage,event.target.value);dirty=true;document.getElementById('access-matrix').innerHTML=matrix();}
    if(event.target.id==='access-role-filter'){roleFilter=event.target.value;document.getElementById('access-members').innerHTML=members();}
    if(event.target.id==='access-member-role'){document.getElementById('access-member-description').textContent=model.roles.find(r=>r.id===event.target.value).description;document.getElementById('access-member-preview').innerHTML=preview(event.target.value);}
  });
  document.addEventListener('submit',async event=>{
    if(!['access-role-form','access-member-form'].includes(event.target.id))return;
    event.preventDefault();event.stopImmediatePropagation();if(saving||!owner())return;
    const form=event.target,button=event.submitter;saving=true;button.disabled=true;error='';message='';
    try{
      if(form.id==='access-role-form'){
        await api.post('/api/auth/access.php',{action:'admin_set_role_permissions',role,permissions:draft});dirty=false;await load();message=model.name(role)+' permissions saved for all assigned members.';
      }else{
        const f=new FormData(form),existing=access.members.find(m=>m.email===form.dataset.existing),self=existing?.email.toLowerCase()===access.profile.email.toLowerCase(),pid=f.get('player_id');
        await api.post('/api/auth/access.php',{action:'admin_upsert_access',p_email:String(f.get('email')).trim().toLowerCase(),p_player_id:pid,p_display_name:players.find(p=>p.id===pid)?.name||'',p_role:self?'super_admin':f.get('role'),p_active:self||f.has('active')});
        closeMemberDialog();await load();window.dispatchEvent(new Event('football:member-access-saved'));if(!root()){if(!document.getElementById('club-app'))location.reload();return;}message='Member access saved. Existing football and payment records are unchanged.';
      }
      draw();
    }catch(e){if(form.id==='access-member-form'&&document.getElementById('access-member-error'))document.getElementById('access-member-error').textContent=e.message;else{error=e.message;draw();}}finally{saving=false;if(form.id==='access-role-form')draw();if(button.isConnected)button.disabled=false;}
  },true);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  window.ClubAccess={view,hasUnsaved:()=>dirty,async editPlayer(player){if(!access)await load();if(!owner())throw new Error('Only a Club owner can assign profiles');dialog(access.members.find(m=>m.player_id===player.id)||null,player);}};
})();
