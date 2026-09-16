(() => {
  "use strict";

  const api = window.api;
  if (!api) return;

  const currentSession = async () => {
    try {
      return await api.get("/api/auth/me.php");
    } catch (error) {
      if (error?.status === 401) return { authenticated: false };
      throw error;
    }
  };

  const signInWithOAuth = async ({ provider } = {}) => {
    if (provider !== "google") {
      return { data: null, error: new Error("Only Google sign-in is supported") };
    }
    window.location.href = "/api/auth/google.php";
    return { data: { provider: "google" }, error: null };
  };

  const signOut = async () => {
    try { await api.post("/api/auth/logout.php", {}); } catch (_) {}
    return { error: null };
  };

  const onAuthStateChange = async (callback) => {
    const me = await currentSession();
    callback(me.authenticated ? "SIGNED_IN" : "SIGNED_OUT", me.authenticated ? me.user : null);
    return { data: { subscription: { unsubscribe() {} } }, error: null };
  };

  const rpc = async (name) => {
    try {
      const data = await api.get("/api/auth/access.php");
      if (name === "claim_access_profile") return { data: true, error: null };
      if (name === "get_my_access") return { data: { allowed: !!data.allowed, profile: data.profile || null, permissions: data.permissions || {} }, error: null };
      if (name === "admin_list_access") return { data: data.members || [], error: null };
      if (name === "admin_list_permissions") return { data: data.rolePermissions || [], error: null };
      return { data: null, error: new Error(`Unsupported RPC: ${name}`) };
    } catch (error) {
      return { data: null, error };
    }
  };

  const readTable = async (table) => {
    if (table === "players") return (await api.get("/api/players.php")).players || [];
    if (table === "games") return (await api.get("/api/games.php")).games || [];
    if (table === "game_players" || table === "finance_seasons" || table === "finance_season_tickets" || table === "payments") return [];
    throw new Error(`Unsupported table during migration: ${table}`);
  };

  const table = (name) => {
    const runRead = async () => ({ data: await readTable(name), error: null });
    const chain = {
      select() { return chain; },
      order() { return runRead(); },
      eq() { return chain; },
      neq() { return chain; },
      then(resolve, reject) { runRead().then(resolve, reject); },
      async upsert() { return { data: null, error: null }; },
      async insert() { return { data: null, error: null }; },
      delete() { return chain; },
    };
    return chain;
  };

  const auth = {
    getSession: async () => {
      const me = await currentSession();
      return { data: { session: me.authenticated ? { user: me.user } : null }, error: null };
    },
    getUser: async () => {
      const me = await currentSession();
      return { data: { user: me.authenticated ? me.user : null }, error: null };
    },
    signInWithOAuth,
    signOut,
    onAuthStateChange,
  };

  window.supabaseClient = { auth, rpc, from: table };
})();
