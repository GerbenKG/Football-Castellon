(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  let refreshTimer = null;
  let lastGameKey = "";
  let lastPreviousGameKey = "";
  let previousBibsRenderPromise = null;

  function currentGameTitle() { return document.querySelector(".hero h1")?.textContent?.trim() || ""; }

  async function findCurrentGame() {
    const title = currentGameTitle();
    if (!title) return null;
    const { data, error } = await sb.from("games").select("id,game_date").order("game_date");
    if (error) return null;
    const format = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    return (data || []).find(game => format(game.game_date) === title) || null;
  }

  function isGameSquadVisible() { return [...document.querySelectorAll(".section h2")].some(h => h.textContent.trim() === "Game squad"); }

  function addAutoSelectButton() {
    const heading = [...document.querySelectorAll(".section h2")].find(h => h.textContent.trim() === "Game squad");
    const head = heading?.closest(".section-head");
    if (!head || head.querySelector("[data-auto-bibs]")) return;
    const button = document.createElement("button");
    button.className = "btn btn-secondary";
    button.dataset.autoBibs = "true";
    button.type = "button";
    button.textContent = "🎽 Auto-select bibs";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const currentGame = await findCurrentGame();
        if (!currentGame) return;
        const { data: currentPlayers, error: currentError } = await sb.from("game_players").select("id,player_id,guest_name,players(name)").eq("game_id", currentGame.id);
        if (currentError) throw currentError;
        const candidates = (currentPlayers || []).filter(x => x.player_id);
        if (!candidates.length) { alert("No players are available for bib selection."); return; }
        const { data: history, error: historyError } = await sb.from("game_players").select("game_id,player_id,took_bibs").eq("took_bibs", true).not("player_id", "is", null).neq("game_id", currentGame.id);
        if (historyError) throw historyError;
        const counts = new Map();
        (history || []).forEach(row => counts.set(row.player_id, (counts.get(row.player_id) || 0) + 1));
        const minCount = Math.min(...candidates.map(x => counts.get(x.player_id) || 0));
        const eligible = candidates.filter(x => (counts.get(x.player_id) || 0) === minCount);
        const selected = eligible[Math.floor(Math.random() * eligible.length)];
        const selectedName = selected.players?.name || selected.guest_name || "Player";
        const result = await sb.rpc("set_game_bib_taker", { p_game_player_id: selected.id });
        if (result.error) throw result.error;
        document.querySelectorAll("[data-bibs-row]").forEach(input => { input.checked = input.dataset.bibsRow === selected.id; });
        lastGameKey = "";
        button.textContent = "✓ " + selectedName + " selected";
        setTimeout(() => { button.textContent = "🎽 Auto-select bibs"; }, 1400);
      } catch (error) { console.warn("[Football] Auto-select bibs failed", error); alert("Could not automatically select bibs: " + (error.message || "Unknown error")); }
      finally { button.disabled = false; }
    });
    head.appendChild(button);
  }

  async function renderPreviousBibs(currentGame) {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    if (currentGame.id === lastPreviousGameKey && hero.querySelector("[data-previous-bibs]")) return;
    if (previousBibsRenderPromise) return previousBibsRenderPromise;

    previousBibsRenderPromise = (async () => {
      hero.querySelectorAll("[data-previous-bibs]").forEach(node => node.remove());
      const { data: previousGames, error: gamesError } = await sb.from("games").select("id,game_date").lt("game_date", currentGame.game_date).order("game_date", { ascending: false }).limit(1);
      if (gamesError) return;
      const previous = previousGames?.[0];
      if (!previous) { lastPreviousGameKey = currentGame.id; return; }
      const { data: bibRows, error: bibError } = await sb.from("game_players").select("player_id,players(name)").eq("game_id", previous.id).eq("took_bibs", true).not("player_id", "is", null);
      if (bibError) return;
      const names = (bibRows || []).map(row => row.players?.name).filter(Boolean);
      const label = names.length ? names.join(", ") : "Nobody recorded";
      const date = new Date(previous.game_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
      const banner = document.createElement("div");
      banner.className = "previous-bibs-banner";
      banner.dataset.previousBibs = "true";
      banner.innerHTML = "🦺 Previous game bibs (" + esc(date) + "): <strong>" + esc(label) + "</strong>";
      const gameNav = hero.querySelector(".game-nav");
      if (gameNav) gameNav.insertAdjacentElement("afterend", banner); else hero.querySelector(".hero-copy")?.prepend(banner);
      lastPreviousGameKey = currentGame.id;
    })();

    try { await previousBibsRenderPromise; }
    finally { previousBibsRenderPromise = null; }
  }

  async function renderBibControls() {
    if (!isGameSquadVisible()) return;
    addAutoSelectButton();
    const currentGame = await findCurrentGame();
    if (!currentGame) return;
    await renderPreviousBibs(currentGame);
    const rows = [...document.querySelectorAll(".squad-row")];
    if (!rows.length) return;
    const gameKey = currentGame.id + ":" + rows.length + ":" + rows.map(r => r.querySelector(".who b")?.textContent?.trim()).join("|");
    if (gameKey === lastGameKey && rows.every(r => r.querySelector("[data-bibs-control]"))) return;
    lastGameKey = gameKey;
    const { data: gamePlayers, error } = await sb.from("game_players").select("id,player_id,took_bibs,players(name)").eq("game_id", currentGame.id);
    if (error) return;
    const byName = new Map((gamePlayers || []).filter(x => x.player_id && x.players?.name).map(x => [x.players.name.trim().toLowerCase(), x]));
    rows.forEach(row => {
      if (row.querySelector("[data-bibs-control]")) return;
      const name = row.querySelector(".who b")?.textContent?.trim() || "";
      const record = byName.get(name.toLowerCase());
      if (!record) return;
      const label = document.createElement("label");
      label.className = "toggle bib-toggle";
      label.setAttribute("data-bibs-control", "true");
      label.innerHTML = '<input type="checkbox" data-bibs-row="' + esc(record.id) + '"' + (record.took_bibs ? " checked" : "") + '> <span>Took bibs</span>';
      const paymentToggle = row.querySelector(".toggle");
      if (paymentToggle) paymentToggle.insertAdjacentElement("afterend", label); else row.querySelector(".who")?.insertAdjacentElement("afterend", label);
      label.querySelector("input")?.addEventListener("change", async event => {
        const checked = event.target.checked;
        event.target.disabled = true;
        const result = checked ? await sb.rpc("set_game_bib_taker", { p_game_player_id: record.id }) : await sb.from("game_players").update({ took_bibs: false }).eq("id", record.id);
        if (result.error) { event.target.checked = !checked; alert("Could not save bibs status: " + result.error.message); }
        else if (checked) rows.forEach(otherRow => { const otherInput = otherRow.querySelector("[data-bibs-row]"); if (otherInput && otherInput !== event.target) otherInput.checked = false; });
        event.target.disabled = false;
      });
    });
  }

  function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { renderBibControls().catch(() => {}); }, 80); }
  new MutationObserver(scheduleRefresh).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  scheduleRefresh();
})();
