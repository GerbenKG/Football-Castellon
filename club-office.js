(() => {
 'use strict';
 let lastFinanceRoute='',d=null,h=null,financeSeason='',financeTab='payments',paymentFilter='open',expenseFilter='unpaid',matchFilter='upcoming',peopleFilter='active',peopleSearch='';
 const can=p=>d?.permissions[p]===true;
 const esc=s=>h.esc(s),money=v=>h.money(v),date=v=>h.date(v),rows=id=>window.ClubModel.squad(d,id);
 const action=(label,a,id='',extra='')=>`<button type="button" class="btn btn-outline btn-small" data-office-action="${a}" data-id="${esc(id)}" ${extra}>${label}</button>`;
 const route=()=>window.OfficeRoutes.parse(location.hash);
 const href=(section,id='')=>'#office/'+section+(id?'/'+id:'');
 const empty=(title,copy)=>`<div class="empty"><strong>${esc(title)}</strong>${esc(copy)}</div>`;
 const field=(label,name,value='',type='text',extra='')=>`<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
 const write=(table,values,id)=>window.api.post('/api/data.php?table='+table,{action:id?'update':'insert',data:values,...(id?{filters:[{column:'id',operator:'eq',value:id}]}:{})});
 const panel=(title,body,buttons='',copy='')=>h.section(title,`<div class="panel">${body}</div>`,buttons,copy);
 const navLink=(title,section,ico,description)=>`<a class="office-destination" href="${href(section)}"><span class="office-destination-icon">${h.icon(ico,23)}</span><span><strong>${title}</strong><small>${description}</small></span>${h.icon('chevron',16)}</a>`;
 function nav(section){
  const active=section==='match'?'matches':section==='members'?'people':section;
  const entries=[['overview','Overview','home'],...(can('games.view')?[['matches','Matches','calendar']]:[]),...(can('payments.view')?[['finance','Finances','wallet']]:[]),...(can('players.view')||can('access.manage')?[['people','People','squad']]:[])];
  return `<nav class="office-workspace-nav" aria-label="Club Office sections">${entries.map(([id,label,ico])=>`<a href="${href(id)}" ${id===active?'class="active" aria-current="page"':''}>${h.icon(ico,17)}<span>${label}</span></a>`).join('')}</nav>`;
 }
 function overview(){
  const next=d.games.find(g=>!window.ClubModel.started(g)),f=d.finance,pending=d.payment_reports.filter(p=>p.status==='pending').length,unpaid=f?.expenses.filter(e=>!e.paid)||[];
  const tasks=[];
  if(next&&can('games.view'))tasks.push(`<a class="office-task" href="${href('match',next.id)}"><span class="office-task-icon">${h.icon('calendar',21)}</span><span><strong>${esc(h.fullDate(next.game_date))}</strong><small>${esc(next.start_time.slice(0,5))} · ${esc(next.location)} · ${rows(next.id).length} players signed up</small></span><b>Open match ${h.icon('arrow',14)}</b></a>`);
  if(pending&&f)tasks.push(`<a class="office-task" href="${href('finance','reported')}"><span class="office-task-icon">${h.icon('wallet',21)}</span><span><strong>${pending} transfer${pending===1?'':'s'} to check</strong><small>Members have reported a payment. Confirm receipt in Finances.</small></span>${h.pill('Needs attention','amber')}</a>`);
  if(f?.due.length)tasks.push(`<a class="office-task" href="${href('finance','payments')}"><span class="office-task-icon">${h.icon('clock',21)}</span><span><strong>${money(f.due.reduce((n,p)=>n+p.amount,0))} in open fees</strong><small>${f.due.length} payment items need following up.</small></span>${h.icon('chevron',16)}</a>`);
  if(unpaid.length&&f)tasks.push(`<a class="office-task" href="${href('finance','expenses')}"><span class="office-task-icon">${h.icon('office',21)}</span><span><strong>${unpaid.length} unpaid club expense${unpaid.length===1?'':'s'}</strong><small>Check due dates and record expenses once they have been paid.</small></span>${h.icon('chevron',16)}</a>`);
  return h.heading('The board’s workspace','Club Office','Arrange the football, keep finances clear and look after your members.',can('clubhouse.manage')?h.btn('Post club update','announcement','','outline'):'')+
   `<div class="office-overview-layout"><section>${h.section('What needs attention',`<div class="panel">${tasks.join('')||empty('Nothing waiting for you','Use the sections below to manage your club.')}</div>`)}<div class="office-destinations">${can('games.view')?navLink('Matches','matches','calendar','Fixtures, playing lists, teams and results.'):''}${can('payments.view')?navLink('Finances','finance','wallet','Payments, season tickets and expenses.'):''}${can('players.view')||can('access.manage')?navLink('People','people','squad','Player records, member accounts and access.'):''}</div></section><aside>${f?`<div class="panel panel-pad"><div class="eyebrow">${esc(f.season?.name||'Club finances')}</div><h2 style="margin:12px 0 5px">${money(f.balance)}</h2><p class="muted" style="font-size:12px">Recorded balance</p><div class="office-totals"><span>Confirmed income <b>${money(f.income)}</b></span><span>Paid expenses <b>${money(f.expenses_paid)}</b></span></div><p class="office-footnote">Recorded income less paid expenses; this is not a bank reconciliation.</p><a class="text-link" href="${href('finance')}">Open finances ${h.icon('arrow',14)}</a></div>`:`<div class="panel panel-pad"><h3>Your club responsibilities</h3><p class="muted" style="font-size:12px;margin-top:10px">The sections above show the tools included in your profile. Your personal payments are in My Club.</p></div>`}</aside></div>`;
 }
 function matches(){
  let games=d.games.filter(g=>matchFilter==='past'?window.ClubModel.started(g):!window.ClubModel.started(g));if(matchFilter==='past')games=[...games].reverse();
  return h.heading('Club Office · Matches','Matches','Choose a match to manage its players, teams and result.',can('games.manage')?h.btn('+ New match','fixture'):'')+
  `<div class="filters" aria-label="Match list">${[['upcoming','Upcoming'],['past','Past matches']].map(([id,t])=>`<button type="button" data-office-filter="matches" data-value="${id}" class="${matchFilter===id?'active':''}" aria-pressed="${matchFilter===id}">${t}</button>`).join('')}</div><div class="panel">${games.map(g=>{const m=d.matches[g.id]||{};return `<a class="office-match-row" href="${href('match',g.id)}"><span class="fixture-date"><span>${esc(h.date(g.game_date,{month:'short'}))}</span><b>${new Date(g.game_date+'T12:00:00').getDate()}</b></span><span class="office-row-main"><strong>${esc(h.fullDate(g.game_date))}</strong><small>${esc(g.start_time.slice(0,5))}–${esc(g.end_time.slice(0,5))} · ${esc(g.location)}</small></span><span class="office-match-status">${m.score_a!==undefined&&m.teams?.length!==3?h.pill(m.score_a+' : '+m.score_b):h.pill(rows(g.id).length+' players','neutral')}<span>Manage match ${h.icon('arrow',14)}</span></span></a>`;}).join('')||empty('No matches here yet','Create a fixture to start taking signups.')}</div>`;
 }
 function paymentRows(){
  const f=d.finance;if(!f?.season)return empty('No season yet','Create a season to record tickets and match fees.');
  let payments=paymentFilter==='open'?f.due.map(p=>({...p,paid:false})):[...f.tickets.map(t=>({id:t.id,type:'season',name:t.name,amount:Number(t.amount),date:f.season.starts_on,label:'Season ticket',paid:t.paid})),...f.game_payments];
  const reports=d.payment_reports.filter(r=>r.status==='pending'),reported=new Set(reports.map(r=>r.type+':'+r.id));
  if(paymentFilter==='reported')payments=payments.filter(p=>reported.has(p.type+':'+p.id));
  payments.sort((a,b)=>Number(b.date<=d.server_date)-Number(a.date<=d.server_date)||String(a.name||'').localeCompare(String(b.name||''))||b.date.localeCompare(a.date));
  return payments.map(p=>`<div class="payment-row"><div><h3>${esc(p.name||'Guest')}</h3><p>${esc(p.label)} · ${esc(date(p.date))}${p.date>d.server_date?' · Upcoming':''}</p></div><strong>${money(p.amount)}</strong><div class="actions">${h.pill(p.paid?'Confirmed':reported.has(p.type+':'+p.id)?'Transfer reported':p.date>d.server_date?'Upcoming':'Open',p.paid?'':reported.has(p.type+':'+p.id)?'amber':'neutral')}${can('payments.manage')?(p.paid?action('Reopen','reopen-payment',p.id,`data-type="${p.type}"`):`<button type="button" class="btn btn-outline btn-small" data-action="confirm-payment" data-id="${p.id}" data-type="${p.type}">Confirm received</button>`):''}</div></div>`).join('')||empty(paymentFilter==='reported'?'No transfers waiting':'No payment items here',paymentFilter==='open'?'There are no open fees recorded for this season.':'Choose another filter to see more records.');
 }
 function finances(){
  const requested=route().id;if(requested!==lastFinanceRoute){financeTab=['tickets','expenses'].includes(requested)?requested:'payments';if(requested==='reported')paymentFilter='reported';else if(lastFinanceRoute==='reported')paymentFilter='open';lastFinanceRoute=requested;}
  const f=d.finance;if(!f)return h.heading('Club Office','Finances','Your profile does not include club finance access.');
  const tabs=[['payments','Payments'],['tickets','Season tickets'],['expenses','Expenses']];
  let body='',buttons='';
  if(financeTab==='payments')body=`<div class="office-list-toolbar"><p>Check transfers and confirm payments after the club receives them.</p><label>Show<select data-office-filter="payments"><option value="open" ${paymentFilter==='open'?'selected':''}>Open fees</option><option value="reported" ${paymentFilter==='reported'?'selected':''}>Reported transfers</option><option value="all" ${paymentFilter==='all'?'selected':''}>All payments</option></select></label></div><div class="panel">${paymentRows()}</div>`;
  if(financeTab==='tickets'){
   buttons=can('payments.manage')&&f.season?action('+ Assign ticket','assign-ticket'):'';
   body=`<div class="office-list-toolbar"><p>Tickets cover the season shown above. Amounts belong to each player’s ticket.</p>${buttons}</div><div class="panel">${f.tickets.map(t=>`<div class="payment-row"><div><h3>${esc(t.name)}</h3><p>${t.paid_on?'Confirmed '+esc(date(t.paid_on)):'Season ticket'}</p></div><strong>${money(t.amount)}</strong><div class="actions">${h.pill(t.paid?'Confirmed':'Open',t.paid?'':'amber')}${can('payments.manage')?action('Edit ticket','edit-ticket',t.id):''}</div></div>`).join('')||empty('No season tickets yet','Assign a ticket to an existing player.')}</div>`;
  }
  if(financeTab==='expenses')body=`<div class="office-list-toolbar"><label>Show<select data-office-filter="expenses"><option value="unpaid" ${expenseFilter==='unpaid'?'selected':''}>Unpaid expenses</option><option value="all" ${expenseFilter==='all'?'selected':''}>All expenses</option></select></label>${can('payments.manage')&&f.season?h.btn('+ Add expense','expense','','outline'):''}</div><div class="panel">${[...f.expenses].filter(e=>expenseFilter==='all'||!e.paid).sort((a,b)=>Number(a.paid)-Number(b.paid)||a.due_date.localeCompare(b.due_date)).map(e=>`<div class="payment-row"><div><h3>${esc(e.description)}</h3><p>${esc(e.category)} · Due ${esc(date(e.due_date))}</p></div><strong>${money(e.amount)}</strong><div class="actions">${h.pill(e.paid?'Paid':e.due_date<d.server_date?'Overdue':'Unpaid',e.paid?'':'amber')}${!e.paid&&can('payments.manage')?h.btn('Mark paid','pay-expense',e.id,'outline'):''}</div></div>`).join('')||empty('No expenses here',expenseFilter==='unpaid'?'No unpaid expenses are recorded for this season.':'Record pitch hire, equipment or reimbursements here.')}</div>`;
  return h.heading('Club Office · Finances','Finances','Season tickets, match fees and club expenses, in one place.',can('payments.manage')?action('Season settings','season-settings'):'')+
   `<div class="office-season-toolbar"><label>Season<select id="office-season-select" data-office-filter="season">${d.seasons.map(s=>`<option value="${s.id}" ${f.season?.id===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><p>${f.season?esc(date(f.season.starts_on))+' – '+esc(date(f.season.ends_on)):'No season configured'}</p>${can('payments.manage')?action('+ New season','new-season'):''}</div>`+
   `<div class="stats-grid">${h.metric('Confirmed income',money(f.income),'Recorded payments','wallet')}${h.metric('Paid expenses',money(f.expenses_paid),'Recorded club costs','office')}${h.metric('Recorded balance',money(f.balance),'Income less paid expenses','chart')}${h.metric('Open fees',money(f.due.reduce((n,p)=>n+p.amount,0)),f.due.length+' payment items','clock')}</div><div class="office-subtabs" aria-label="Finance records">${tabs.map(([id,t])=>`<button type="button" data-office-filter="finance-tab" data-value="${id}" class="${financeTab===id?'active':''}" aria-pressed="${financeTab===id}">${t}</button>`).join('')}</div>${body}<p class="office-footnote">These are club records, not a reconciled bank balance. Confirmation records receipt; it does not transfer money.</p>`;
 }
 function playerRows(){
  const records=(d.player_records||[]).filter(p=>(peopleFilter==='archived'?p.archived_at:!p.archived_at)&&[p.name,p.email,p.phone].some(s=>String(s||'').toLowerCase().includes(peopleSearch.toLowerCase())));
  return records.map(p=>{const member=(d.member_accounts||[]).find(m=>m.player_id===p.id);return `<article class="office-person-row">${h.initials(p.name,false,p.id)}<div class="office-row-main"><strong>${esc(p.name)}</strong><small>${esc(p.email||'No email recorded')}${p.phone?' · '+esc(p.phone):''}</small></div><div class="office-person-actions">${member?h.pill(window.ClubAccessModel.name(member.role),member.active?'neutral':'red'):''}${can('players.manage')?action('Edit player','edit-player',p.id):''}${can('access.manage')?action(member?'Member access':'Set up member','member-access',p.id):''}${member?.active?`<a class="btn btn-outline btn-small" href="/?view_as=${member.preview_key}">Log in as</a>`:''}${can('players.manage')?action(p.archived_at?'Restore':'Archive',p.archived_at?'restore-player':'archive-player',p.id):''}</div></article>`;}).join('')||empty('No players found','Try another name or switch between active and archived players.');
 }
 function people(section){
  const tabs=`<div class="office-subtabs" aria-label="People records">${can('players.view')?`<a href="${href('people')}" ${section==='people'?'class="active" aria-current="page"':''}>Player records</a>`:''}${can('access.manage')?`<a href="${href('members')}" ${section==='members'?'class="active" aria-current="page"':''}>Members & permissions</a>`:''}</div>`;
  if(section==='members')return tabs+(can('access.manage')?window.ClubAccess.view():h.heading('Club Office · People','Members & permissions','Only a Club owner can manage member access.'));
  if(!can('players.view'))return tabs+h.heading('Club Office · People','People','Use Members & permissions to manage your club accounts.');
  return h.heading('Club Office · People','People','Player records and club accounts, clearly separated.',can('players.manage')?action('+ Add player','new-player'):'')+tabs+
   `<div class="office-list-toolbar"><input type="search" class="search" id="office-people-search" placeholder="Find a player…" aria-label="Find a player" value="${esc(peopleSearch)}"><label>Show<select data-office-filter="people"><option value="active" ${peopleFilter==='active'?'selected':''}>Active players</option><option value="archived" ${peopleFilter==='archived'?'selected':''}>Archived players</option></select></label></div><div class="panel" id="office-player-list">${playerRows()}</div><p class="office-footnote">Player records hold football and contact details. Member accounts hold Google sign-in and access profiles. Archiving a player keeps their history.</p>`;
 }
 function render(){
  const r=route();const allowed=r.section==='finance'?can('payments.view'):['matches','match'].includes(r.section)?can('games.view'):r.section==='members'?can('access.manage'):r.section==='people'?(can('players.view')||can('access.manage')):true;
  if(!allowed)return `<div class="native-office">${nav(r.section)}${h.heading('Club Office','This section isn’t in your profile','Choose one of the available Club Office sections.')}</div>`;
  return `<div class="native-office">${nav(r.section)}${r.section==='matches'?matches():r.section==='match'?h.matchDetail(r.id):r.section==='finance'?finances():['people','members'].includes(r.section)?people(r.section):overview()}</div>`;
 }
 async function perform(a,id,b){
  if(window.footballPreviewActive)throw new Error('Member preview is read-only. Exit preview to make changes.');
  const f=d.finance,record=d.player_records?.find(p=>p.id===id),game=d.games.find(g=>g.id===id);
  if(a==='member-access'){await window.ClubAccess.editPlayer(record);return;}
  if(a==='new-player'||a==='edit-player'){
   h.showDialog(record?'Edit player':'Add player','Player contact details stay in the board’s records.',field('Name','name',record?.name||'','text','required maxlength="160"')+field('Email','email',record?.email||'','email','maxlength="254"')+field('Phone','phone',record?.phone||'','tel','maxlength="64"'),fd=>write('players',{name:fd.get('name').trim(),email:fd.get('email').trim()||null,phone:fd.get('phone').trim()||null},record?.id));return;
  }
  if(a==='archive-player'||a==='restore-player'){
   h.showDialog(a==='archive-player'?'Archive '+record.name+'?':'Restore '+record.name+'?',a==='archive-player'?'Past matches and payments stay recorded. This player will no longer be available for new signups.':'The player will be available for new signups again.','',()=>write('players',{archived_at:a==='archive-player'?new Date().toISOString().slice(0,19).replace('T',' '):null},id),a==='archive-player'?'Archive player':'Restore player');return;
  }
  if(a==='new-season'||a==='season-settings'){
   const s=a==='new-season'?null:f?.season;
   h.showDialog(s?'Season settings':'Create a season','Set the season dates and default ticket and match prices.',field('Season name','name',s?.name||'','text','required maxlength="120"')+`<div class="form-grid">${field('Starts','starts_on',s?.starts_on||d.server_date,'date','required')}${field('Ends','ends_on',s?.ends_on||'','date','required')}</div><div class="form-grid">${field('Default season ticket (€)','season_ticket_amount',s?.season_ticket_amount||0,'number','required min="0" max="999999.99" step="0.01"')}${field('Match fee (€)','pay_per_game_amount',s?.pay_per_game_amount||0,'number','required min="0" max="999999.99" step="0.01"')}</div><p class="notice">Changing the default season ticket price does not change amounts on tickets already assigned.</p>`,async fd=>{if(fd.get('ends_on')<=fd.get('starts_on'))throw new Error('Season end must be after the start.');const saved=await write('finance_seasons',{name:fd.get('name').trim(),starts_on:fd.get('starts_on'),ends_on:fd.get('ends_on'),season_ticket_amount:Number(fd.get('season_ticket_amount')),pay_per_game_amount:Number(fd.get('pay_per_game_amount'))},s?.id);financeSeason=s?.id||saved.data[0].id;});return;
  }
  if(a==='assign-ticket'||a==='edit-ticket'){
   const ticket=f.tickets.find(t=>t.id===id),available=d.players.filter(p=>!p.archived_at&&!f.tickets.some(t=>t.player_id===p.id));
   h.showDialog(ticket?'Edit '+ticket.name+'’s ticket':'Assign a season ticket',f.season.name,(ticket?'':`<label class="field">Player<select name="player_id" required><option value="">Choose a player…</option>${available.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>`)+field('Ticket amount (€)','amount',ticket?.amount??f.season.season_ticket_amount,'number','required min="0" max="999999.99" step="0.01"')+`<label class="checkbox"><input name="paid" type="checkbox" ${ticket?.paid?'checked':''}> The club has received this payment</label><p class="notice">A season ticket covers match fees in this season. Existing game payment records are kept.</p>`,fd=>{const paid=fd.has('paid');return write('finance_season_tickets',{...(ticket?{}:{season_id:f.season.id,player_id:fd.get('player_id')}),amount:Number(fd.get('amount')),paid,paid_on:paid?(ticket?.paid_on||d.server_date):null},ticket?.id);},'Save ticket');return;
  }
  if(a==='reopen-payment'){
   const type=b.dataset.type;h.showDialog('Mark this payment unpaid?','Only use this to correct the club’s records. This does not issue a refund.','',()=>write(type==='season'?'finance_season_tickets':'game_players',{paid:false,...(type==='season'?{paid_on:null}:{})},id),'Reopen payment');return;
  }
  if(a==='add-player'){
   const used=new Set(rows(id).map(r=>r.player_id)),waiting=new Set(d.waiting.filter(w=>w.game_id===id).map(w=>w.player_id));
   const available=d.players.filter(p=>!p.archived_at&&!used.has(p.id)&&!waiting.has(p.id));
   h.showDialog('Add a player',h.fullDate(game.game_date),`<label class="field">Player<select name="player_id" required><option value="">Choose a player…</option>${available.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><p class="notice">If an upcoming match is full, the player joins its waiting list.</p>`,fd=>window.api.post('/api/club.php',{action:'squad_add',game_id:id,player_id:fd.get('player_id')}),'Add player');return;
  }
  if(a==='add-guest'){h.showDialog('Add a guest',h.fullDate(game.game_date),field('Guest name','name','','text','required maxlength="160"'),fd=>window.api.post('/api/club.php',{action:'squad_guest',game_id:id,name:fd.get('name')}),'Add guest');return;}
  if(a==='remove-player'){
   const row=d.signups.find(r=>r.id===id),p=d.players.find(p=>p.id===row.player_id);
   h.showDialog('Remove '+(p?.name||row.guest_name||'this player')+' from the squad?','Their previous payment records are kept. An available place may go to the next waiting player.','',()=>window.api.post('/api/club.php',{action:'squad_remove',game_id:row.game_id,id}),'Remove from squad');return;
  }
  if(a==='bibs-auto'){const assigned=await window.api.post('/api/club.php',{action:'bibs_auto',game_id:id});await h.refresh();h.toast(assigned.unchanged?'Bibs already assigned to '+assigned.name+'.':assigned.name+' will wash the bibs after this match.');return;}
  if(a==='bibs'){
   const eligible=rows(id).filter(r=>r.player_id);
   h.showDialog('Who washes the bibs after this match?',h.fullDate(game.game_date),`<label class="field">Player<select name="row_id" required>${eligible.map(r=>`<option value="${r.id}" ${r.took_bibs?'selected':''}>${esc(d.players.find(p=>p.id===r.player_id)?.name||'Player')} · ${Number(d.players.find(p=>p.id===r.player_id)?.bibs_taken_count||0)} bib washes</option>`).join('')}</select></label>`,fd=>window.api.post('/api/rpc.php',{name:'set_game_bib_taker',p_game_player_id:fd.get('row_id')}),'Assign bib duty');return;
  }
 }
 document.addEventListener('click',async e=>{
  const filter=e.target.closest('button[data-office-filter]');if(filter){const kind=filter.dataset.officeFilter;if(kind==='matches')matchFilter=filter.dataset.value;if(kind==='finance-tab'){location.hash=href('finance',filter.dataset.value);return;}h.render();return;}
  const b=e.target.closest('[data-office-action]');if(!b||b.disabled||!d)return;b.disabled=true;try{await perform(b.dataset.officeAction,b.dataset.id,b);}catch(error){h.toast(error.message);}finally{if(b.isConnected)b.disabled=false;}
 });
 document.addEventListener('change',async e=>{
  const kind=e.target.dataset.officeFilter;if(!kind)return;
  if(kind==='season'){financeSeason=e.target.value;try{await h.refresh();}catch(error){h.toast(error.message);}return;}
  if(kind==='payments')paymentFilter=e.target.value;if(kind==='expenses')expenseFilter=e.target.value;if(kind==='people')peopleFilter=e.target.value;h.render();
 });
 document.addEventListener('input',e=>{if(e.target.id==='office-people-search'){peopleSearch=e.target.value;document.getElementById('office-player-list').innerHTML=playerRows();}});
 window.addEventListener('football:member-access-saved',()=>h?.refresh().catch(e=>h.toast(e.message)));
 window.ClubOffice={setContext(data,helpers){d=data;h=helpers;},render,query:()=>financeSeason?'?finance_season='+encodeURIComponent(financeSeason):'',matchHref:id=>href('match',id),recordsHref:()=>href('people'),membersHref:()=>href('members')};
})();
