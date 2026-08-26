(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;"
  }[c]));

  let refreshTimer = null;
  let lastGameKey = "";

  function currentGameTitle() {
    return document.querySelector(".hero h1")?.textContent?.trim() || "";
  }

  async function findCurrentGame() {
    const title = currentGameTitle();
    if (!title) return null;

    const { data, error } = await sb.from("games").select("id,game_date").order("game_date");
    if (error) {
      console.warn("[Football] Could not load games for bib tracking", error);
      return null;
    }

    const format = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
    return (data || []).find(game => format(game.game_date) === title) || null;
  }

  function isGameSquadVisible() {
    return !!document.querySelector(".section h2") &&
      [...document.querySelectorAll(".section h2")].some(h => h.textContent.trim() === "Game squad");
  }

  async function renderBibControls() {
    if (!isGameSquadVisible()) return;

    const rows = [...document.querySelectorAll(".squad-row")];
    if (!rows.length) return;

    const currentGame = await findCurrentGame();
    if (!currentGame) return;

    const gameKey = currentGame.id + ":" + rows.length + ":" + rows.map(r => r.querySelector(".who b")?.textContent?.trim()).join("|");
    if (gameKey === lastGameKey && rows.every(r => r.querySelector("[data-bibs-control]"))) return;
    lastGameKey = gameKey;

    const { data: gamePlayers, error } = await sb
      .from("game_players")
      .select("id,player_id,took_bibs,players(name)")
      .eq("game_id", currentGame.id);

    if (error) {
      console.warn("[Football] Could not load bib tracking", error);
      return;
    }

    const byName = new Map((gamePlayers || [])
      .filter(x => x.player_id && x.players?.name)
      .map(x => [x.players.name.trim().toLowerCase(), x]));

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
      if (paymentToggle) paymentToggle.insertAdjacentElement("afterend", label);
      else row.querySelector(".who")?.insertAdjacentElement("afterend", label);

      label.querySelector("input")?.addEventListener("change", async event => {
        const checked = event.target.checked;
        event.target.disabled = true;

        let result;
        if (checked) {
          // The database function clears the previous bib taker for this game
          // before assigning the bibs to this player.
          result = await sb.rpc("set_game_bib_taker", {
            p_game_player_id: record.id
          });
        } else {
          result = await sb
            .from("game_players")
            .update({ took_bibs: false })
            .eq("id", record.id);
        }

        if (result.error) {
          event.target.checked = !checked;
          alert("Could not save bibs status: " + result.error.message);
        } else if (checked) {
          // Keep the UI in sync immediately: only this checkbox remains checked.
          rows.forEach(otherRow => {
            const otherInput = otherRow.querySelector("[data-bibs-row]");
            if (otherInput && otherInput !== event.target) otherInput.checked = false;
          });
        }

        event.target.disabled = false;
      });
    });
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      renderBibControls().catch(error => console.warn("[Football] Bib tracking failed", error));
    }, 80);
  }

  new MutationObserver(scheduleRefresh).observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });

  scheduleRefresh();
})();
