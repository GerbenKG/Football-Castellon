(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  let timer = null;
  let lastKey = "";

  const formatDate = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  async function currentGame() {
    const title = document.querySelector(".hero h1")?.textContent?.trim();
    if (!title) return null;
    const result = await sb.from("games").select("id,game_date").order("game_date");
    if (result.error) return null;
    return (result.data || []).find(g => formatDate(g.game_date) === title) || null;
  }

  function squadRows() {
    return [...document.querySelectorAll(".squad-row")];
  }

  async function updateBib(recordId, checked, allIds) {
    if (checked) {
      const clear = await sb.from("game_players").update({ took_bibs: false }).eq("game_id", allIds.gameId);
      if (clear.error) return clear;
    }
    return sb.from("game_players").update({ took_bibs: checked }).eq("id", recordId);
  }

  async function render() {
    const heading = [...document.querySelectorAll(".section h2")].find(h => h.textContent.trim() === "Game squad");
    if (!heading) return;
    const game = await currentGame();
    if (!game) return;

    const rows = squadRows();
    if (!rows.length) return;
    const key = game.id + ":" + rows.map(r => r.querySelector(".who b")?.textContent?.trim()).join("|");
    if (key === lastKey && rows.every(r => r.querySelector("[data-mysql-bibs]"))) return;
    lastKey = key;

    const gp = await sb.from("game_players").select("id,player_id,guest_name,took_bibs").eq("game_id", game.id);
    if (gp.error) return;
    const players = await sb.from("players").select("id,name").order("name");
    if (players.error) return;

    const byPlayerId = new Map((players.data || []).map(p => [p.id, p.name]));
    const byName = new Map((gp.data || []).filter(r => r.player_id).map(r => [String(byPlayerId.get(r.player_id) || "").trim().toLowerCase(), r]));
    const records = gp.data || [];

    rows.forEach(row => {
      if (row.querySelector("[data-mysql-bibs]")) return;
      const name = row.querySelector(".who b")?.textContent?.trim() || "";
      const record = byName.get(name.toLowerCase());
      if (!record) return;

      const label = document.createElement("label");
      label.className = "toggle bib-toggle";
      label.dataset.mysqlBibs = "true";
      label.innerHTML = '<input type="checkbox" data-bibs-row="' + esc(record.id) + '"' + (record.took_bibs ? " checked" : "") + '> <span>Took bibs</span>';

      const paymentToggle = row.querySelector(".payment-toggle");
      if (paymentToggle) paymentToggle.insertAdjacentElement("afterend", label);
      else row.querySelector(".who")?.insertAdjacentElement("afterend", label);

      label.querySelector("input").addEventListener("change", async event => {
        const input = event.target;
        const checked = input.checked;
        input.disabled = true;
        const result = await updateBib(record.id, checked, { gameId: game.id });
        if (result.error) {
          input.checked = !checked;
          alert("Could not save bibs status: " + (result.error.message || "Unknown error"));
        } else if (checked) {
          document.querySelectorAll("[data-bibs-row]").forEach(other => {
            if (other !== input) other.checked = false;
          });
        }
        input.disabled = false;
      });
    });

    // Keep the existing auto-select button but make it work without Supabase RPCs.
    const head = heading.closest(".section-head");
    if (head && !head.querySelector("[data-mysql-auto-bibs]")) {
      const button = document.createElement("button");
      button.className = "btn btn-secondary";
      button.type = "button";
      button.dataset.mysqlAutoBibs = "true";
      button.textContent = "🎽 Auto-select bibs";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const candidates = records.filter(r => r.player_id);
          if (!candidates.length) return;
          const history = await sb.from("game_players").select("game_id,player_id,took_bibs").eq("took_bibs", true).neq("game_id", game.id);
          if (history.error) throw history.error;
          const counts = new Map();
          (history.data || []).forEach(r => counts.set(r.player_id, (counts.get(r.player_id) || 0) + 1));
          const min = Math.min(...candidates.map(r => counts.get(r.player_id) || 0));
          const eligible = candidates.filter(r => (counts.get(r.player_id) || 0) === min);
          const selected = eligible[Math.floor(Math.random() * eligible.length)];
          const result = await updateBib(selected.id, true, { gameId: game.id });
          if (result.error) throw result.error;
          document.querySelectorAll("[data-bibs-row]").forEach(input => { input.checked = input.dataset.bibsRow === selected.id; });
          button.textContent = "✓ " + (byPlayerId.get(selected.player_id) || selected.guest_name || "Player") + " selected";
          setTimeout(() => { button.textContent = "🎽 Auto-select bibs"; }, 1400);
        } catch (error) {
          alert("Could not automatically select bibs: " + (error.message || "Unknown error"));
        } finally {
          button.disabled = false;
        }
      });
      head.appendChild(button);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(() => {}), 120);
  }

  new MutationObserver(schedule).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  schedule();
})();
