(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let busy = false;
  let lastKey = "";
  let observer;

  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

  function setFinancialVisibility(visible) {
    document.querySelectorAll(".stats .stat:nth-child(3), .stats .stat:nth-child(4)").forEach(el => {
      el.style.visibility = visible ? "visible" : "hidden";
    });
  }

  function currentGameKey() {
    const hero = document.querySelector(".hero");
    const h1 = hero?.querySelector("h1");
    const text = norm(h1?.textContent);
    if (!text) return "";
    const time = norm(hero?.querySelector("p")?.textContent || "");
    return text + "|" + time;
  }

  async function sync() {
    if (busy) return;
    const stats = document.querySelectorAll(".stats .stat");
    if (stats.length < 4) return;
    const key = currentGameKey();
    if (!key || key === lastKey) return;
    lastKey = key;
    busy = true;
    setFinancialVisibility(false);
    try {
      const [gamesQ, seasonsQ, ticketsQ, squadQ] = await Promise.all([
        sb.from("games").select("id,game_date,start_time,end_time,location").order("game_date"),
        sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on", { ascending: false }),
        sb.from("finance_season_tickets").select("season_id,player_id,paid"),
        sb.from("game_players").select("game_id,player_id,guest_name,attended,paid")
      ]);
      if (gamesQ.error || seasonsQ.error || ticketsQ.error || squadQ.error) throw gamesQ.error || seasonsQ.error || ticketsQ.error || squadQ.error;

      const games = gamesQ.data || [];
      const heroDate = norm(document.querySelector(".hero h1")?.textContent);
      const heroMeta = norm(document.querySelector(".hero p")?.textContent);
      const selected = games.find(g => {
        const d = new Date(g.game_date + "T12:00:00");
        const dateLabel = norm(d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
        const timeLabel = norm("⚽ " + String(g.start_time).slice(0,5) + "–" + String(g.end_time).slice(0,5) + " · " + (g.location || ""));
        return dateLabel === heroDate && timeLabel === heroMeta;
      }) || games.find(g => {
        const d = new Date(g.game_date + "T12:00:00");
        return norm(d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })) === heroDate;
      });
      if (!selected) throw new Error("Selected game not found");

      const season = (seasonsQ.data || []).find(s => selected.game_date >= s.starts_on && selected.game_date <= s.ends_on);
      const tickets = season ? (ticketsQ.data || []).filter(t => t.season_id === season.id) : [];
      const ticketPlayers = new Set(tickets.map(t => t.player_id));
      const squad = (squadQ.data || []).filter(x => x.game_id === selected.id && x.attended);
      const due = squad.filter(x => x.guest_name || !ticketPlayers.has(x.player_id)).filter(x => !x.paid).length;

      const seasonStrong = document.querySelector(".stats .stat:nth-child(3) strong");
      const dueStrong = document.querySelector(".stats .stat:nth-child(4) strong");
      if (seasonStrong) seasonStrong.textContent = String(tickets.length);
      if (dueStrong) dueStrong.textContent = String(due);
      setFinancialVisibility(true);
    } catch (err) {
      console.warn("[Football] Finance dashboard sync failed", err);
      const seasonStrong = document.querySelector(".stats .stat:nth-child(3) strong");
      const dueStrong = document.querySelector(".stats .stat:nth-child(4) strong");
      if (seasonStrong) seasonStrong.textContent = "—";
      if (dueStrong) dueStrong.textContent = "—";
      setFinancialVisibility(true);
    } finally {
      busy = false;
    }
  }

  observer = new MutationObserver(() => requestAnimationFrame(sync));
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  window.addEventListener("load", sync);
  setFinancialVisibility(false);
  setTimeout(sync, 0);
})();
