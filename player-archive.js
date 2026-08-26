(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  async function getArchived() {
    const { data, error } = await sb.from("players").select("id,name,phone,email,archived_at").not("archived_at", "is", null).order("name");
    if (error) throw error;
    return data || [];
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  async function renderArchiveSection() {
    if (!document.querySelector('.nav-item.active[data-view="players"]')) return;
    const playersCard = document.querySelector(".page-head ~ .table-card");
    if (!playersCard) return;

    let archiveCard = document.getElementById("player-archive-card");
    const players = await getArchived();

    if (!archiveCard) {
      archiveCard = document.createElement("section");
      archiveCard.id = "player-archive-card";
      archiveCard.className = "card";
      playersCard.insertAdjacentElement("afterend", archiveCard);
    }

    archiveCard.innerHTML = '<div class="section-head"><div><div class="eyebrow">ARCHIVE</div><h2>Archived players</h2><p>Players kept for historical records. They cannot be selected for new games.</p></div></div>' +
      '<div class="table-card"><table><thead><tr><th>Player</th><th>Phone</th><th>Email</th><th>Archived</th><th></th></tr></thead><tbody>' +
      (players.length ? players.map(p => '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.phone || "—") + '</td><td>' + esc(p.email || "—") + '</td><td>' + new Date(p.archived_at).toLocaleDateString("en-GB") + '</td><td><button class="btn btn-secondary" data-restore-player="' + p.id + '">Restore</button></td></tr>').join("") : '<tr><td colspan="5" class="muted">No archived players.</td></tr>') +
      '</tbody></table></div>';
  }

  async function hideArchivedPlayers() {
    if (!document.querySelector('.nav-item.active[data-view="players"]')) return;
    const table = document.querySelector(".page-head ~ .table-card table");
    if (!table) return;

    const archived = await getArchived();
    const ids = new Set(archived.map(p => p.id));
    table.querySelectorAll("tbody tr").forEach(row => {
      const edit = row.querySelector('[data-a="edit"]');
      const id = row.dataset.playerId || edit?.dataset?.id;
      if (id) row.dataset.playerId = id;
      if (id && ids.has(id)) row.remove();
    });
  }

  async function filterGamePlayerPicker() {
    const form = document.getElementById("pick-form");
    if (!form) return;
    const select = form.querySelector('select[name="id"]');
    if (!select) return;

    const archived = await getArchived();
    const ids = new Set(archived.map(p => p.id));
    [...select.options].forEach(option => {
      if (ids.has(option.value)) option.remove();
    });

    if (!select.options.length) {
      form.querySelector(".modal-actions")?.insertAdjacentHTML("beforebegin", '<p class="notice">No active players are available for this game.</p>');
      const submit = form.querySelector("button[type=submit], button.btn-primary");
      if (submit) submit.disabled = true;
    }
  }

  async function applyPlayersPage() {
    if (!document.querySelector('.nav-item.active[data-view="players"]')) return;
    await hideArchivedPlayers();
    await renderArchiveSection();
  }

  document.addEventListener("click", async event => {
    const playersNav = event.target.closest('[data-view="players"]');
    if (playersNav) {
      setTimeout(() => applyPlayersPage().catch(() => {}), 0);
      return;
    }

    const restore = event.target.closest("[data-restore-player]");
    if (restore) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const { error } = await sb.from("players").update({ archived_at: null }).eq("id", restore.dataset.restorePlayer);
      if (error) return alert(error.message);
      await applyPlayersPage();
      return;
    }

    const archive = event.target.closest("button[data-archive-player]");
    if (archive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const { error } = await sb.from("players").update({ archived_at: new Date().toISOString() }).eq("id", archive.dataset.archivePlayer).is("archived_at", null);
      if (error) return alert(error.message);
      await applyPlayersPage();
      return;
    }

    if (event.target.closest('[data-a="add-player"]')) {
      setTimeout(() => filterGamePlayerPicker().catch(() => {}), 0);
    }
  }, true);

  setTimeout(() => applyPlayersPage().catch(() => {}), 0);
})();
