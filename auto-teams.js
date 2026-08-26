(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let busy = false;
  let timer = null;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;"
  }[c]));

  function isDashboard() {
    return document.querySelector('.nav-item.active[data-view="dashboard"]');
  }

  function currentGameTitle() {
    return document.querySelector(".hero h1")?.textContent?.trim() || "";
  }

  async function currentGame() {
    const title = currentGameTitle();
    if (!title) return null;
    const { data, error } = await sb.from("games").select("id,game_date").order("game_date");
    if (error) throw error;
    const format = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    return (data || []).find(g => format(g.game_date) === title) || null;
  }

  function addButton() {
    if (!isDashboard()) return;
    const actions = document.querySelector(".hero .hero-actions");
    if (!actions || actions.querySelector("[data-auto-teams]")) return;

    const button = document.createElement("button");
    button.className = "btn btn-ghost";
    button.type = "button";
    button.dataset.autoTeams = "true";
    button.textContent = "⚽ Teams";
    button.addEventListener("click", chooseTeamCount);
    actions.appendChild(button);
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }

  function chooseTeamCount() {
    if (busy) return;
    const root = document.getElementById("modal-root");
    if (!root) return;

    root.innerHTML = '<div class="modal-bg"><div class="modal" style="max-width:460px"><div class="modal-head"><div><h2>Create teams</h2><p class="muted">How many teams do you want to create?</p></div><button class="remove" data-team-close type="button">×</button></div>' +
      '<div style="display:flex;gap:12px;justify-content:center;padding:20px 0 8px">' +
      '<button class="btn btn-primary" type="button" data-team-count="2" style="min-width:110px;font-size:18px">2 Teams</button>' +
      '<button class="btn btn-primary" type="button" data-team-count="3" style="min-width:110px;font-size:18px">3 Teams</button>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn btn-secondary" type="button" data-team-close>Cancel</button></div></div></div>';

    root.querySelectorAll("[data-team-close]").forEach(button => button.addEventListener("click", closeModal));
    root.querySelectorAll("[data-team-count]").forEach(button => {
      button.addEventListener("click", async () => {
        const count = Number(button.dataset.teamCount);
        closeModal();
        busy = true;
        try {
          const teams = await generateTeams(count);
          showTeams(teams, count);
        } catch (error) {
          console.warn("[Football] Team generation failed", error);
          window.alert("Could not generate teams: " + (error.message || "Unknown error"));
        } finally {
          busy = false;
        }
      });
    });
  }

  async function generateTeams(teamCount) {
    const game = await currentGame();
    if (!game) throw new Error("Current game could not be identified.");

    const { data: squad, error: squadError } = await sb
      .from("game_players")
      .select("id,player_id,guest_name,players(id,name,skill_level)")
      .eq("game_id", game.id);
    if (squadError) throw squadError;

    // Include both registered players and guests. Guests have no skill level,
    // so they are treated as average skill (3).
    const players = (squad || [])
      .filter(row => row.player_id || row.guest_name)
      .map((row, index) => ({
        id: row.player_id || `guest-${row.id || index}`,
        name: row.player_id ? (row.players?.name || "Player") : (row.guest_name || "Guest"),
        skill: row.player_id ? Number(row.players?.skill_level || 3) : 3,
        guest: !row.player_id
      }))
      .filter(player => Number.isFinite(player.skill) && player.skill >= 1 && player.skill <= 5);

    if (players.length < teamCount) {
      throw new Error("There are not enough players in the Game Squad for " + teamCount + " teams.");
    }

    players.sort((a, b) => b.skill - a.skill || a.name.localeCompare(b.name));

    const teams = Array.from({ length: teamCount }, (_, i) => ({
      name: "Team " + String.fromCharCode(65 + i),
      players: [],
      total: 0
    }));

    players.forEach(player => {
      teams.sort((a, b) => a.total - b.total || a.players.length - b.players.length || a.name.localeCompare(b.name));
      teams[0].players.push(player);
      teams[0].total += player.skill;
    });

    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }

  function showTeams(teams, count) {
    const root = document.getElementById("modal-root");
    if (!root) return;

    const average = teams.map(team => team.total / team.players.length);
    root.innerHTML = '<div class="modal-bg"><div class="modal" style="max-width:760px"><div class="modal-head"><div><h2>Suggested teams</h2><p class="muted">Balanced across the current Game Squad. Players without a skill level, including guests, are treated as 3.</p></div><button class="remove" data-team-close type="button">×</button></div>' +
      '<div class="analytics-grid" style="grid-template-columns:repeat(' + count + ',minmax(0,1fr))">' +
      teams.map((team, index) => '<section class="card analytics-card"><div class="card-title"><div><h3>' + esc(team.name) + '</h3><p>Average skill ' + average[index].toFixed(2) + '</p></div></div><div class="history-list">' +
        team.players.map(player => '<div class="history-row"><div><b>' + esc(player.name) + '</b><small>' + (player.guest ? "Guest · " : "") + 'Skill ' + player.skill + '</small></div><span class="badge badge-slate">' + player.skill + '</span></div>').join("") +
      '</div></section>').join("") +
      '</div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-team-close>Close</button></div></div></div>';

    root.querySelectorAll("[data-team-close]").forEach(button => button.addEventListener("click", closeModal));
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(addButton, 100);
  }

  new MutationObserver(schedule).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  schedule();
})();
