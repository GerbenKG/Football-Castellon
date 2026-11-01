(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.ClubActivityModel=model;})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 function lastSignIn(value){
  if(!value)return 'Not recorded yet';const d=new Date(value);if(!Number.isFinite(d.getTime()))return 'Not recorded yet';
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
 }
 function tracker(){let previous=null;return {
  reset(){previous=null;},
  observe(members,self){const current=new Map(members.map(p=>[p.id,p.online_key]));const arrivals=previous===null?[]:members.filter(p=>p.id!==self&&previous.get(p.id)!==p.online_key);previous=current;return arrivals;}
 };}
 return {lastSignIn,tracker};
});
