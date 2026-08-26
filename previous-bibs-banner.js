(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[c]));

  let renderedFor = null;
  let loadingFor = null;

  async function render() {
    const heroCopy = document.querySelector(".hero-copy");
    const title = document.querySelector(".hero h1")?.textContent?.trim();
    if (!heroCopy || !title) return;

    // Do not rebuild the banner on every DOM mutation. The previous version
    // removed and recreated it repeatedly, which caused visible flashing.
    const existing = heroCopy.querySelector("[data-previous-bibs]");
    if (existing && renderedFor === title) return;
    if (loadingFor === title) return;
    loadingFor = title;

    const { data: games, error } = await sb.from("games").select("id,game_date").order("game_date");
    if (error) {
      loadingFor = null;
      return;
    }

    const format = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long"
    });
    const current = (games || []).find(g => format(g.game_date) === title);
    if (!current) {
      loadingFor = null;
      return;
    }

    const previous = (games || [])
      .filter(g => g.game_date < current.game_date)
      .sort((a, b) => b.game_date.localeCompare(a.game_date))[0];

    let name = null;
    if (previous) {
      const { data } = await sb
        .from("game_players")
        .select("players(name)")
        .eq("game_id", previous.id)
        .eq("took_bibs", true)
        .limit(1);
      name = data?.[0]?.players?.name || null;
    }

    // The page may have changed while the request was running.
    const currentTitle = document.querySelector(".hero h1")?.textContent?.trim();
    if (currentTitle !== title) {
      loadingFor = null;
      return;
    }

    heroCopy.querySelector("[data-previous-bibs]")?.remove();
    const banner = document.createElement("div");
    banner.className = "previous-bibs-banner";
    banner.dataset.previousBibs = "true";
    banner.innerHTML = "🦺 Previous game bibs: <strong>" + esc(name || "Unknown") + "</strong>";
    heroCopy.querySelector(".game-nav")?.insertAdjacentElement("afterend", banner);

    renderedFor = title;
    loadingFor = null;
  }

  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(() => { loadingFor = null; }), 100);
  }).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });

  render().catch(() => { loadingFor = null; });
})();
