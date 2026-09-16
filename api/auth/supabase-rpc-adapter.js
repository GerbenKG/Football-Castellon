(() => {
  "use strict";

  const legacyClient = window.supabaseClient;

  if (!legacyClient || !window.api) return;

  async function phpAccess() {
    return window.api.get("/api/auth/access.php");
  }

  const rpc = async (name) => {
    try {
      const data = await phpAccess();

      if (name === "claim_access_profile") {
        return { data: true, error: null };
      }

      if (name === "get_my_access") {
        return {
          data: {
            allowed: !!data.allowed,
            profile: data.profile || null,
            permissions: data.permissions || {},
          },
          error: null,
        };
      }

      if (name === "admin_list_access") {
        return { data: data.members || [], error: null };
      }

      if (name === "admin_list_permissions") {
        return { data: data.rolePermissions || [], error: null };
      }

      return { data: null, error: new Error(`Unsupported RPC: ${name}`) };
    } catch (error) {
      return { data: null, error };
    }
  };

  window.supabaseClient = new Proxy(legacyClient, {
    get(target, property, receiver) {
      if (property === "rpc") return rpc;
      return Reflect.get(target, property, receiver);
    },
  });
})();
