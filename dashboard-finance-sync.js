(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let busy = false;
  let lastKey = "";

  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const setVisibility = visible => document.querySelectorAll(".stats .stat:nth-child(3), .stats .stat:nth-child(4)").forEach(el => { el.style.visibility = visible ? "visible" : "hidden"; });
  const currentKey = () => {
    const hero = document.querySelector(".hero");
    return norm(hero?.querySelector("h1")?.textContent) + "|" + norm(hero?.querySelector("p")?.textContent);
  };
  const labelStats = () => {
    const stats = document.querySelectorAll(".stats .stat");
    if (stats.length < 4) return;
    const labels = ["THIS GAME · PLAYING", "THIS GAME · PRESENT", "THIS SEASON · SEASON TICKETS", "THIS GAME · PAYMENTS DUE"];
    labels.forEach((text, i) => { const el = stats[i]?.querySelector("small"); if (el) el.textContent = text; });
  };

  async function sync(force = false) {
    if (busy) return;
    const stats = document.querySelectorAll(".stats .stat");
    if (stats.length < 4) return;
    labelStats();
    const key = currentKey();
    if (!key || (!force && key === lastKey)) return;
    lastKey = key;
    busy = true;
    setVisibility(false);
    try {
      const [gamesQ, seasonsQ, ticketsQ, squadQ] = await Promise.all([
        sb.from("games").select("id,game_date,start_time,end_time,location").order("game_date"),
        sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on", { ascending: false }),
        sb.from("finance_season_tickets").select("season_id,player_id,paid"),
        sb.from("game_players").select("game_id,player_id,guest_name,attended,paid")
      ]);
      const error = gamesQ.error || seasonsQ.error || ticketsQ.error || squadQ.error;
      if (error) throw error;

      const games = gamesQ.data || [];
      const heroDate = norm(document.querySelector(".hero h1")?.textContent);
      const heroMeta = norm(document.querySelector(".hero p")?.textContent);
      const selected = games.find(g => {
        const d = new Date(g.game_date + "T12:00:00");
        const dateLabel = norm(d.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" }));
        const timeLabel = norm("⚽ " + String(g.start_time).slice(0,5) + "–" + String(g.end_time).slice(0,5) + " · " + (g.location || ""));
        return dateLabel === heroDate && timeLabel === heroMeta;
      }) || games.find(g => norm(new Date(g.game_date + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })) === heroDate);
      if (!selected) throw new Error("Selected game not found");

      const season = (seasonsQ.data || []).find(s => selected.game_date >= s.starts_on && selected.game_date <= s.ends_on);
      if (!season) throw new Error("No financial season for selected game");

      const tickets = (ticketsQ.data || []).filter(t => t.season_id === season.id);
      const ticketed = new Map(tickets.map(t => [t.player_id, t]));
      const squad = (squadQ.data || []).filter(x => x.game_id === selected.id);

      // Season tickets are a season-level obligation. Pay-per-game and guest
      // obligations only become due when the person actually attended.
      let due = 0;
      for (const row of squad) {
        if (row.player_id && ticketed.has(row.player_id)) {
          if (!ticketed.get(row.player_id).paid) due++;
        } else if (row.attended && !row.paid) {
          due++;
        }
      }

      const seasonStrong = document.querySelector(".stats .stat:nth-child(3) strong");
      const dueStrong = document.querySelector(".stats .stat:nth-child(4) strong");
      if (seasonStrong) seasonStrong.textContent = String(tickets.length);
      if (dueStrong) dueStrong.textContent = String(due);
      setVisibility(true);
    } catch (err) {
      console.warn("[Football] Finance dashboard sync failed", err);
      const seasonStrong = document.querySelector(".stats .stat:nth-child(3) strong");
      const dueStrong = document.querySelector(".stats .stat:nth-child(4) strong");
      if (seasonStrong) seasonStrong.textContent = "—";
      if (dueStrong) dueStrong.textContent = "—";
      setVisibility(true);
    } finally {
      busy = false;
    }
  }

  const app = document.getElementById("app");
  if (app) new MutationObserver(mutations => {
    // Only react to dashboard replacements, not to text/style changes made by this script.
    if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1))) requestAnimationFrame(() => sync());
  }).observe(app, { childList:true, subtree:true });

  setVisibility(false);
  setTimeout(() => sync(true), 0);
})();
