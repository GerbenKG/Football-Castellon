window.supabaseClient = null;
try {
  if (!window.supabase || !window.supabase.createClient) throw new Error("Supabase library did not load.");
  const client = window.supabase.createClient("https://fumawncedxswwvafecuj.supabase.co","sb_publishable_5ELVcnDfatNVXqHNM7WKjQ_wJ9qC8F4");

  // Player type and season-payment status are no longer stored on players.
  // The legacy UI still expects these transient properties, so derive them
  // from finance_season_tickets without persisting them back to players.
  const originalFrom = client.from.bind(client);
  let financeCache = null;

  const loadPlayerFinance = async () => {
    if (financeCache && Date.now() - financeCache.loadedAt < 30000) return financeCache;
    const [seasonsResult, ticketsResult] = await Promise.all([
      originalFrom("finance_seasons").select("id,starts_on,ends_on").order("starts_on", { ascending: false }),
      originalFrom("finance_season_tickets").select("id,season_id,player_id,paid")
    ]);
    if (seasonsResult.error) throw seasonsResult.error;
    if (ticketsResult.error) throw ticketsResult.error;

    const seasons = seasonsResult.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const season = seasons.find(s => today >= s.starts_on && today <= s.ends_on) || seasons[0] || null;
    const tickets = (ticketsResult.data || []).filter(t => !season || t.season_id === season.id);
    financeCache = { loadedAt: Date.now(), season, tickets };
    return financeCache;
  };

  const decoratePlayers = async result => {
    if (!result || result.error || !Array.isArray(result.data)) return result;
    try {
      const { tickets } = await loadPlayerFinance();
      const byPlayer = new Map(tickets.map(t => [t.player_id, t]));
      result.data = result.data.map(p => ({
        ...p,
        model: byPlayer.has(p.id) ? "season" : "game",
        seasonPaid: !!byPlayer.get(p.id)?.paid
      }));
    } catch (e) {
      result.data = result.data.map(p => ({ ...p, model: "game", seasonPaid: false }));
    }
    return result;
  };

  const stripFinanceFields = value => {
    const strip = row => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      const { model, season_paid, seasonPaid, ...clean } = row;
      return clean;
    };
    return Array.isArray(value) ? value.map(strip) : strip(value);
  };

  client.from = table => {
    const target = originalFrom(table);
    if (table !== "players") return target;

    let proxy;
    proxy = new Proxy(target, {
      get(obj, prop) {
        if (prop === "then") {
          return (resolve, reject) => obj.then(result => decoratePlayers(result).then(resolve), reject);
        }
        if (prop === "catch") return reject => obj.catch(reject);
        const value = obj[prop];
        if (typeof value !== "function") return value;
        return (...args) => {
          if (prop === "upsert" || prop === "insert" || prop === "update") args[0] = stripFinanceFields(args[0]);
          const result = value.apply(obj, args);
          return result === obj ? proxy : result;
        };
      }
    });
    return proxy;
  };

  window.supabaseClient = client;
} catch (e) {
  window.supabaseInitError = e;
}
