(() => {
  "use strict";
  const api = window.api;
  const result = async work => {
    try { return {data:await work(),error:null}; }
    catch (error) { return {data:null,error}; }
  };
  async function me() {
    try { return await api.get("/api/auth/me.php"); }
    catch (error) { if (error.status === 401) return {authenticated:false}; throw error; }
  }
  const rpc = (name,args={}) => result(async()=>{
    const routes = {
      member_profile:"member-profile.php", admin_preview_member_profile:"member-profile.php",
      member_payment_history:"member-payment-history.php",admin_preview_member_payment_history:"member-payment-history.php",
      player_list_games:"player-games.php"
    };
    if (routes[name]) {
      const preview=name.startsWith("admin_preview_") ? "?preview_email="+encodeURIComponent(args.p_email||"") : "";
      return api.get("/api/auth/"+routes[name]+preview);
    }
    if (name==="member_update_profile") return api.post("/api/auth/member-profile.php",{phone:args.p_phone,email:args.p_email,avatar_path:args.p_avatar_path});
    if (name==="member_toggle_game") return api.post("/api/auth/game-signup.php",{game_id:args.p_game_id});
    if (name==="admin_preview_toggle_game") throw new Error("Preview mode is read-only");
    if (["admin_upsert_access","admin_delete_access","admin_update_permission"].includes(name)) return api.post("/api/auth/access.php",{...args,action:name});
    if (name==="admin_list_players_for_linking") return api.get("/api/auth/access.php?action="+name);
    if (["claim_access_profile","get_my_access","admin_list_access","admin_list_permissions"].includes(name)) {
      const data=await api.get("/api/auth/access.php");
      if (name==="claim_access_profile") return true;
      if (name==="admin_list_access") return data.members;
      if (name==="admin_list_permissions") return data.rolePermissions;
      return data;
    }
    if (["list_player_avatars","player_list_game_squad"].includes(name)) {
      const params=new URLSearchParams({name,...args});
      return api.get("/api/rpc.php?"+params);
    }
    if (name==="set_game_bib_taker") return api.post("/api/rpc.php",{name,...args});
    throw new Error("Unsupported operation: "+name);
  });
  function from(name) {
    const filters=[],orders=[];
    let action=null,data=null,selection="*",maximum=null;
    const query={
      select(columns="*"){selection=columns;return query;},
      order(column,options={}){orders.push({column,ascending:options.ascending!==false});return query;},
      limit(count){maximum=count;return query;},
      eq(column,value){filters.push({column,value,operator:"eq"});return query;},
      neq(column,value){filters.push({column,value,operator:"neq"});return query;},
      lt(column,value){filters.push({column,value,operator:"lt"});return query;},
      gte(column,value){filters.push({column,value,operator:"gte"});return query;},
      in(column,value){filters.push({column,value,operator:"in"});return query;},
      is(column,value){filters.push({column,value,operator:"is"});return query;},
      not(column,operator,value){if(operator!=="is")throw new Error("Unsupported filter");filters.push({column,value,operator:"not"});return query;},
      insert(value){action="insert";data=value;return query;},
      upsert(value){action="upsert";data=value;return query;},
      update(value){action="update";data=value;return query;},
      delete(){action="delete";return query;},
      single(){return query.then(r=>({...r,data:r.data?.[0]??null,error:r.error||(!r.data?.length?new Error("No rows found"):null)}));},
      then(resolve,reject){
        return result(async()=>{
          if(action) return (await api.post("/api/data.php?table="+encodeURIComponent(name),{action,data,filters})).data;
          const params=new URLSearchParams({table:name,filters:JSON.stringify(filters),orders:JSON.stringify(orders)});
          if(maximum!==null)params.set("limit",maximum);
          if(selection.includes("players("))params.set("include_players","1");
          try{return (await api.get("/api/data.php?"+params)).data;}
          catch(error){
            // Startup loads shared tables even for restricted member roles.
            if(error.status===403&&error.message==="Permission denied")return [];
            throw error;
          }
        }).then(resolve,reject);
      }
    };
    return query;
  }
  const auth={
    getSession:()=>result(async()=>{const data=await me();return {session:data.authenticated?{user:data.user}:null};}),
    getUser:()=>result(async()=>{const data=await me();return {user:data.authenticated?data.user:null};}),
    signInWithOAuth:({provider}={})=>result(async()=>{if(provider!=="google")throw new Error("Only Google sign-in is supported");window.location.assign("/api/auth/google.php");return {provider};}),
    signOut:async()=>{const r=await result(()=>api.post("/api/auth/logout.php",{}));return {error:r.error};}
  };
  const storage={from:()=>({
    getUrl:path=>result(async()=>({signedUrl:"/api/avatars.php?path="+encodeURIComponent(path)})),
    upload:(path,file)=>result(async()=>{
      const body=new FormData();body.append("avatar",file);body.append("path",path);
      return api.request("/api/avatars.php",{method:"POST",body});
    })
  })};
  window.footballClient={auth,rpc,from,storage};
})();
