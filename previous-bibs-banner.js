(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[c]));

  async function render() {
    const heroCopy = document.querySelector(".hero-copy");
    const title = document.querySelector(".hero h1")?.textContent?.trim();
    if (!heroCopy || !title) return;

    const { data: games, error } = await sb.from("games").select("id,game_date").order("game_date");
    if (error) return;
    const format = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long"
    });
    const current = (games || []).find(g => format(g.game_date) === title);
    if (!current) return;

    const previous = (games || []).filter(g => g.game_date < current.game_date).sort((a,b) => b.game_date.localeCompare(a.game_date))[0];
    heroCopy.querySelector("[data-previous-bibs]")?.remove();
    if (!previous) return;

    const { data } = await sb.from("game_players").select("players(name)").eq("game_id", previous.id).eq("took_bibs", true).limit(1);
    const name = data?.[0]?.players?.name;
    if (!name) return;

    const banner = document.createElement("div");
    banner.className = "previous-bibs-banner";
    banner.dataset.previousBibs = "true";
    banner.innerHTML = "🦺 Previous game bibs: <strong>" + esc(name) + "</strong>";
    heroCopy.querySelector(".game-nav")?.insertAdjacentElement("afterend", banner);
  }

  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(() => {}), 100);
  }).observe(document.getElementById("app") || document.body, {childList:true, subtree:true});
  render().catch(() => {});
})();
