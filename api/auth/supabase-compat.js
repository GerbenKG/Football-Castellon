(() => {
  "use strict";

  if (!window.api) return;

  const unsupportedWrite = () => ({
    data: null,
    error: new Error("MariaDB write migration is not enabled for this action yet.")
  });

  function from(table) {
    const query = {
      _filters: [],
      select() { return this; },
      order() { return this; },
      eq(column, value) { this._filters.push({ column, value, operator: "eq" }); return this; },
      neq(column, value) { this._filters.push({ column, value, operator: "neq" }); return this; },
      then(resolve, reject) {
        const load = async () => {
          let data = [];
          if (table === "players") data = (await window.api.get("/api/players.php")).players || [];
          else if (table === "games") data = (await window.api.get("/api/games.php")).games || [];
          else if (table === "game_players") data = (await window.api.get("/api/game-players.php")).game_players || [];
          return { data, error: null };
        };
        return load().then(resolve, reject);
      },
      upsert() { return Promise.resolve(unsupportedWrite()); },
      insert() { return Promise.resolve(unsupportedWrite()); },
      update() { return Promise.resolve(unsupportedWrite()); },
      delete() { return Promise.resolve(unsupportedWrite()); },
      single() { return Promise.resolve(unsupportedWrite()); }
    };
    return query;
  }

  window.supabaseClient = {
    auth: {
      async getSession() {
        try {
          const data = await window.api.get("/api/auth/me.php");
          if (!data.authenticated) return { data: { session: null }, error: null };
          return { data: { session: { user: { id: data.user.id, email: data.user.email, user_metadata: { full_name: data.user.display_name } } } }, error: null };
        } catch (error) {
          if (error.status === 401) return { data: { session: null }, error: null };
          return { data: { session: null }, error };
        }
      },
      async signInWithOAuth() {
        window.location.href = "/api/auth/google.php";
        return { data: null, error: null };
      },
      async signOut() {
        await window.api.get("/api/auth/logout.php");
        return { error: null };
      }
    },
    rpc() {
      return Promise.resolve({ data: null, error: new Error("Access RPC adapter not initialized") });
    },
    from
  };
})();
