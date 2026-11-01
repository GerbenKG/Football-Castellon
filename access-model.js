(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.ClubAccessModel=model;})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  const permissions=['arcade.view','arcade.manage','clubhouse.view','clubhouse.manage','squad.view','dashboard.view','players.view','players.manage','games.view','games.manage','attendance.view','attendance.manage','payments.view','payments.manage','access.manage'];
  const roles=[
    {id:'super_admin',name:'Club owner',description:'Full access, including members and permissions. This profile is protected.'},
    {id:'admin',name:'Club board',description:'The board’s main working profile. Configure its access below.'},
    {id:'attendance',name:'Match organiser',description:'For the people arranging fixtures, squads and the football.'},
    {id:'finance',name:'Treasurer',description:'For the people overseeing tickets, payments and expenses.'},
    {id:'viewer',name:'Read-only member',description:'For someone who needs to follow club operations without making changes.'},
    {id:'player',name:'Player',description:'For squad members managing their own football and payments.'}
  ];
  const pages=[
    {id:'arcade',name:'Games',description:'Prediction League and teammate quizzes. Read access includes joining and playing for yourself.',read:['arcade.view'],edit:['arcade.manage'],editNote:'Publish prediction rounds and record or correct professional match results.'},
    {id:'clubhouse',name:'Clubhouse',description:'Club updates, the next match and season statistics.',read:['clubhouse.view'],edit:['clubhouse.manage'],editNote:'Publish and remove club announcements.'},
    {id:'matches',name:'Matches',description:'Fixtures, match centres, results and published teams.',read:['games.view'],edit:['games.manage'],editNote:'Create or change fixtures, teams and results.'},
    {id:'match-management',name:'Match squad management',description:'Board tools for playing lists, guests and bib duties.',read:['dashboard.view','attendance.view','games.view'],edit:['attendance.manage'],editNote:'Add or remove players and manage attendance.'},
    {id:'squad',name:'Squad',description:'Shared player cards and football statistics.',read:['squad.view'],edit:['players.manage'],editNote:'Manage player records, including contact details.'},
    {id:'records',name:'Player records',description:'Private board records, including player contact details.',read:['players.view'],edit:['players.manage'],editNote:'Create, edit, archive or restore players.'},
    {id:'finance',name:'Club finances',description:'Other members’ payment records, season pricing and club expenses.',read:['payments.view'],edit:['payments.manage'],editNote:'Confirm payments, edit prices and record expenses.'}
  ];
  function forRole(rows,role){const out=Object.fromEntries(permissions.map(p=>[p,role==='super_admin'||rows.some(r=>r.role===role&&r.permission===p&&r.enabled)]));out['access.manage']=role==='super_admin';return out;}
  function level(values,page){if(!page.read.every(p=>values[p]))return 'none';return page.edit.every(p=>values[p])?'edit':'read';}
  function setLevel(current,id,value){
    const next={...current},page=pages.find(p=>p.id===id);if(!page||!['none','read','edit'].includes(value))return next;
    for(const p of page.read)next[p]=value!=='none';for(const p of page.edit)next[p]=value==='edit';
    if(value==='edit'&&['squad','records'].includes(id)){next['squad.view']=true;next['players.view']=true;}
    if(id==='matches'&&value==='none'){next['attendance.manage']=false;next['attendance.view']=false;next['dashboard.view']=false;}
    if(value==='edit'&&id==='match-management')next['games.view']=true;
    next['access.manage']=false;return next;
  }
  const name=role=>roles.find(r=>r.id===role)?.name||role;
  const isBoard=role=>['super_admin','admin','finance'].includes(role);
  return {permissions,roles,pages,forRole,level,setLevel,name,isBoard};
});
