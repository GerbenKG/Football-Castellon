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

  const readTable = async (tableName, filters, order) => {
    const params = new URLSearchParams();
    params.set("table", tableName);
    params.set("filters", JSON.stringify(filters || []));
    if (order?.column) params.set("order", `${order.column}:${order.ascending === false ? "desc" : "asc"}`);
    const response = await api.get(`/api/data.php?${params.toString()}`);
    return response.data || [];
  };

  const runMutation = async (tableName, action, data, filters) => {
    try {
      const response = await api.post(`/api/data.php?table=${encodeURIComponent(tableName)}`, {
        action,
        data,
        filters: filters || [],
      });
      return { data: response.data ?? null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const table = (name) => {
    const chain = {
      _filters: [],
      _order: null,
      _action: null,
      _data: null,

      select() { return chain; },
      order(column, options = {}) {
        chain._order = { column, ascending: options.ascending !== false };
        return chain;
      },
      eq(column, value) {
        chain._filters.push({ column, value, operator: "eq" });
        return chain;
      },
      neq(column, value) {
        chain._filters.push({ column, value, operator: "neq" });
        return chain;
      },
      upsert(data) {
        chain._action = "upsert";
        chain._data = data;
        return chain;
      },
      insert(data) {
        chain._action = "insert";
        chain._data = data;
        return chain;
      },
      update(data) {
        chain._action = "update";
        chain._data = data;
        return chain;
      },
      delete() {
        chain._action = "delete";
        return chain;
      },
      single() {
        return chain.then(result => ({
          data: result.data?.[0] || null,
          error: result.error || (result.data?.length ? null : new Error("No rows found")),
        }));
      },
      then(resolve, reject) {
        const run = chain._action
          ? runMutation(name, chain._action, chain._data, chain._filters)
          : readTable(name, chain._filters, chain._order).then(data => ({ data, error: null }));
        return run.then(resolve, reject);
      },
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
