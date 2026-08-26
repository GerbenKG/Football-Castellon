(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  async function getArchived() {
    const { data, error } = await sb.from("players").select("id,name,phone,email,archived_at").not("archived_at", "is", null).order("name");
    if (error) throw error;
    return data || [];
  }

  function addArchiveNav() {
    const nav = document.querySelector(".nav");
    if (!nav || nav.querySelector('[data-view="archive"]')) return;
    const b = document.createElement("button");
    b.className = "nav-item";
    b.dataset.view = "archive";
    b.textContent = "Archive";
    nav.appendChild(b);
  }

  async function renderArchive() {
    const app = document.getElementById("app");
    if (!app) return;
    try {
      const players = await getArchived();
      app.innerHTML = '<section class="page-head"><div><div class="eyebrow">PLAYERS</div><h1>Archive</h1><p class="muted">Archived players are kept here and are not deleted.</p></div></section>' +
        '<section class="card"><div class="table-wrap"><table><thead><tr><th>Player</th><th>Phone</th><th>Email</th><th>Archived</th><th></th></tr></thead><tbody>' +
        (players.length ? players.map(p => '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.phone || "—") + '</td><td>' + esc(p.email || "—") + '</td><td>' + new Date(p.archived_at).toLocaleDateString("en-GB") + '</td><td><button class="btn btn-secondary" data-restore-player="' + p.id + '">Restore</button></td></tr>').join("") : '<tr><td colspan="5" class="muted">No archived players.</td></tr>') +
        '</tbody></table></div></section>';
    } catch (e) {
      app.innerHTML = '<section class="card error-card"><h2>Could not load archive</h2><p>' + esc(e.message) + '</p></section>';
    }
  }

  async function archivePlayer(id) {
    if (!id) return;
    const { error } = await sb.from("players").update({ archived_at: new Date().toISOString() }).eq("id", id).is("archived_at", null);
    if (error) return alert(error.message);
    const row = document.querySelector('[data-player-id="' + id + '"]');
    if (row) row.remove();
  }

  async function restorePlayer(id) {
    const { error } = await sb.from("players").update({ archived_at: null }).eq("id", id);
    if (error) return alert(error.message);
    await renderArchive();
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  function addArchiveButtons() {
    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table) return;
    table.querySelectorAll("tbody tr").forEach(row => {
      const buttons = [...row.querySelectorAll("button")];
      const button = buttons.find(b => b.textContent.trim().toLowerCase() === "delete");
      if (!button || button.dataset.archivePlayer) return;
      const edit = buttons.find(b => b.textContent.trim().toLowerCase() === "edit");
      const id = row.dataset.playerId || edit?.dataset?.playerId || edit?.dataset?.id;
      if (!id) return;
      row.dataset.playerId = id;
      button.textContent = "Archive";
      button.dataset.archivePlayer = id;
    });
  }

  document.addEventListener("click", async event => {
    const archiveNav = event.target.closest('[data-view="archive"]');
    if (archiveNav) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
      archiveNav.classList.add("active");
      await renderArchive();
      return;
    }

    const restore = event.target.closest("[data-restore-player]");
    if (restore) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await restorePlayer(restore.dataset.restorePlayer);
      return;
    }

    const button = event.target.closest("button[data-archive-player]");
    if (button) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await archivePlayer(button.dataset.archivePlayer);
    }
  }, true);

  function apply() {
    addArchiveNav();
    const active = document.querySelector('.nav-item.active[data-view="players"]');
    if (active) addArchiveButtons();
  }

  apply();
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
