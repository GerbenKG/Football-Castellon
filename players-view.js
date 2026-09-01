(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let rendered = false;
  let data = { players: [], members: [], bibs: new Map() };
  let permissions = {};
  let superAdmin = false;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const can = permission => permissions[permission] === true;
  const isPlayersPage = () => !!document.querySelector('.nav-item.active[data-view="players"]');
  const activeApp = () => document.getElementById("app");

  async function load() {
    const access = await sb.rpc("get_my_access");
    if (access.error || !access.data?.allowed) return false;
    permissions = access.data.permissions || {};
    superAdmin = access.data.profile?.role === "super_admin";

    const queries = [
      sb.from("players").select("id,name,phone,email,skill_level,archived_at").order("name"),
      sb.from("game_players").select("player_id").eq("took_bibs", true)
    ];
    if (superAdmin) queries.push(sb.rpc("admin_list_access"));

    const [playersResult, bibsResult, membersResult] = await Promise.all(queries);
    if (playersResult.error) throw playersResult.error;
    if (bibsResult.error) throw bibsResult.error;

    const bibs = new Map();
    (bibsResult.data || []).forEach(row => {
      if (row.player_id) bibs.set(row.player_id, (bibs.get(row.player_id) || 0) + 1);
    });
    data = {
      players: (playersResult.data || []).filter(p => !p.archived_at),
      archived: (playersResult.data || []).filter(p => p.archived_at),
      members: membersResult?.data || [],
      bibs
    };
    return true;
  }

  function playerRow(p) {
    const member = data.members.find(m => String(m.player_id || "") === String(p.id));
    const actions = [
      can("players.manage") ? '<button class="btn btn-secondary" data-pv-action="edit" data-id="' + esc(p.id) + '">Edit</button>' : "",
      can("players.manage") ? '<button class="btn btn-secondary" data-pv-action="archive" data-id="' + esc(p.id) + '">Archive</button>' : ""
    ].join("");
    const memberCell = superAdmin
      ? (member ? '<span class="badge badge-green">Member</span>' : '<button class="btn btn-secondary" data-pv-action="member" data-id="' + esc(p.id) + '">Create Member</button>')
      : "";
    return '<tr data-player-id="' + esc(p.id) + '">' +
      '<td><div class="who"><span class="avatar">' + esc(p.name).slice(0,1).toUpperCase() + '</span><b>' + esc(p.name) + '</b></div></td>' +
      '<td>' + esc(p.phone || "—") + '</td>' +
      '<td>' + esc(p.email || "—") + '</td>' +
      (superAdmin ? '<td data-skill-level>' + esc(p.skill_level ?? "—") + '</td>' : '') +
      '<td data-bibs-count-cell>' + esc(data.bibs.get(p.id) || 0) + '</td>' +
      (superAdmin ? '<td>' + memberCell + '</td>' : "") +
      '<td><div class="actions">' + actions + '</div></td>' +
    '</tr>';
  }

  function archiveSection() {
    if (!data.archived.length) return "";
    return '<section class="section" id="player-archive-section"><div class="page-head"><div><div class="eyebrow">ARCHIVE</div><h2 class="title">Archived players</h2><p class="muted">Players kept for historical records. They cannot be selected for new games.</p></div></div>' +
      '<div class="card table-card"><table><thead><tr><th>Player</th><th>Phone</th><th>Email</th><th>Archived</th><th></th></tr></thead><tbody>' +
      data.archived.map(p => '<tr><td><div class="who"><span class="avatar">' + esc(p.name).slice(0,1).toUpperCase() + '</span><b>' + esc(p.name) + '</b></div></td><td>' + esc(p.phone || "—") + '</td><td>' + esc(p.email || "—") + '</td><td>' + esc(new Date(p.archived_at).toLocaleDateString("en-GB")) + '</td><td><button class="btn btn-secondary" data-pv-action="restore" data-id="' + esc(p.id) + '">Restore</button></td></tr>').join("") +
      '</tbody></table></div></section>';
  }

  function render() {
    if (!isPlayersPage()) return;
    const app = activeApp();
    if (!app) return;
    rendered = true;
    const memberColumn = superAdmin ? '<th>Member</th>' : "";
    app.innerHTML = '<div class="page-head"><div><div class="eyebrow">ROSTER</div><h1 class="title">Players <span class="players-count">' + data.players.length + ' ' + (data.players.length === 1 ? 'player' : 'players') + '</span></h1><p class="muted">Roster and attendance history.</p></div>' + (can("players.manage") ? '<button class="btn btn-primary" data-pv-action="new">+ Add player</button>' : "") + '</div>' +
      '<div class="card table-card"><table class="players-roster-table"><thead><tr><th>Player</th><th>Phone</th><th>Email</th>' + (superAdmin ? '<th>Skill Level</th>' : '') + '<th>Bibs taken</th>' + memberColumn + '<th>Actions</th></tr></thead><tbody>' + (data.players.length ? data.players.map(playerRow).join("") : '<tr><td colspan="7" class="empty">No active players.</td></tr>') + '</tbody></table></div>' + archiveSection();
  }

  function modal(title, body) {
    document.getElementById("modal-root").innerHTML = '<div class="modal-bg"><div class="modal"><div class="modal-head"><h2>' + title + '</h2><button class="remove" data-pv-close type="button">×</button></div>' + body + '</div></div>';
  }

  function editForm(p) {
    modal(p ? "Edit player" : "Add player", '<form id="pv-player-form" data-id="' + esc(p?.id || "") + '">' +
      '<label>Name<input name="name" value="' + esc(p?.name || "") + '" required></label>' +
      '<label>Phone<input name="phone" type="tel" value="' + esc(p?.phone || "") + '"></label>' +
      '<label>Email<input name="email" type="email" value="' + esc(p?.email || "") + '"></label>' +
      (superAdmin ? '<label>Skill level<select name="skill_level"><option value="">Not set</option><option value="1">1 — Lowest</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 — Highest</option></select></label>' : '') +
      '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-pv-close>Cancel</button><button class="btn btn-primary">Save player</button></div></form>');
    if (superAdmin) document.querySelector('[name="skill_level"]').value = p?.skill_level ? String(p.skill_level) : "";
  }

  async function action(action, id) {
    if (action === "new") return editForm(null);
    if (action === "edit") return editForm(data.players.find(p => p.id === id));
    if (action === "archive") {
      const p = data.players.find(x => x.id === id);
      if (!p || !confirm("Archive " + p.name + "? Historical game records will be kept.")) return;
      const result = await sb.from("players").update({ archived_at: new Date().toISOString() }).eq("id", id).is("archived_at", null);
      if (result.error) return alert(result.error.message);
      await load(); render(); return;
    }
    if (action === "restore") {
      const result = await sb.from("players").update({ archived_at: null }).eq("id", id);
      if (result.error) return alert(result.error.message);
      await load(); render(); return;
    }
    if (action === "member") {
      const p = data.players.find(x => x.id === id);
      if (!p || !superAdmin) return;
      const email = String(p.email || prompt("Enter the email address for " + p.name + ":", "") || "").trim().toLowerCase();
      if (!email) return;
      if (!/^\S+@\S+\.\S+$/.test(email)) return alert("Please enter a valid email address.");
      const result = await sb.rpc("admin_upsert_access", {p_email: email,p_display_name:p.name,p_role:"player",p_active:true,p_player_id:p.id});
      if (result.error) return alert(result.error.message);
      await load(); render();
    }
  }

  document.addEventListener("click", async event => {
    if (!isPlayersPage()) return;
    const close = event.target.closest("[data-pv-close]");
    if (close) { event.preventDefault(); document.getElementById("modal-root").innerHTML = ""; return; }
    const button = event.target.closest("[data-pv-action]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try { await action(button.dataset.pvAction, button.dataset.id); } catch (error) { alert(error.message || "Could not complete action."); }
  }, true);

  document.addEventListener("submit", async event => {
    if (event.target?.id !== "pv-player-form") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.target;
    const fd = new FormData(form);
    const payload = { name:String(fd.get("name") || "").trim(), phone:String(fd.get("phone") || "").trim() || null, email:String(fd.get("email") || "").trim() || null };
    if (!payload.name) return alert("Name is required.");
    if (superAdmin) payload.skill_level = fd.get("skill_level") ? Number(fd.get("skill_level")) : null;
    const result = form.dataset.id
      ? await sb.from("players").update(payload).eq("id", form.dataset.id)
      : await sb.from("players").insert(payload);
    if (result.error) return alert(result.error.message);
    document.getElementById("modal-root").innerHTML = "";
    await load(); render();
  }, true);

  document.addEventListener("click", event => {
    const nav = event.target.closest('.nav-item[data-view="players"]');
    if (!nav) return;
    setTimeout(async () => {
      if (!isPlayersPage()) return;
      try { await load(); render(); } catch (error) { console.error("[Football] Players view failed", error); }
    }, 0);
  }, true);

  setTimeout(async () => {
    if (!isPlayersPage() || rendered) return;
    try { if (await load()) render(); } catch (error) { console.error("[Football] Players view failed", error); }
  }, 500);
})();
