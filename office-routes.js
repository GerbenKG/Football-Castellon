(function(root,factory){const routes=factory();if(typeof module==='object'&&module.exports)module.exports=routes;else root.OfficeRoutes=routes;})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  const sections=['overview','matches','match','finance','people','members'];
  function parse(hash){const parts=String(hash||'').replace(/^#/,'').split('/');return {section:sections.includes(parts[1])?parts[1]:'overview',id:parts[2]||''};}
  function legacy(value){const url=new URL(value,'https://castellon.futbol'),view=url.searchParams.get('view'),game=url.searchParams.get('game');const section={games:'matches',finance:'finance',players:'people',admin:'members',dashboard:'overview'}[view]||'overview';const query=new URLSearchParams();if(url.searchParams.has('view_as'))query.set('view_as',url.searchParams.get('view_as'));return '/'+(query.size?'?'+query.toString():'')+'#office/'+(view==='dashboard'&&game&&/^[a-f0-9-]{36}$/i.test(game)?'match/'+game:section);}
  return {parse,legacy};
});
