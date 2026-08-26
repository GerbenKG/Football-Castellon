(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  function esc(value) {
    return String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  async function getArchived() {
    const { data, error } = await sb.from("players").select("id,name,phone,email,archived_at").not("archived_at", "is", null).order("name");
    if (error) throw error;
    return data || [];
  }

  function prepareArchiveButtons() {
    const table = document.querySelector(".page-head ~ .table-card table");
    if (!table) return;

    table.querySelectorAll("tbody tr").forEach(row => {
      const button = [...row.querySelectorAll("button")].find(b => b.textContent.trim().toLowerCase() === "delete");
      if (!button || button.dataset.archivePlayer) return;
      const edit = row.querySelector('[data-a="edit"]');
      const id = edit?.dataset?.id;
      if (!id) return;
      button.textContent = "Archive";
      button.dataset.archivePlayer = id;
    });
  }

  async function renderArchiveSection() {
    if (!document.querySelector('.nav-item.active[data-view="players"]')) return;
    const playersCard = document.querySelector(".page-head ~ .table-card");
    if (!playersCard) return;

    let archiveSection = document.getElementById("player-archive-section");
    const players = await getArchived();

    if (!archiveSection) {
      archiveSection = document.createElement("section");
      archiveSection.id = "player-archive-section";
      archiveSection.style.marginTop = "40px";
      playersCard.insertAdjacentElement("afterend", archiveSection);
    }

    const count = players.length;
    archiveSection.innerHTML =
      '<div class="page-head"><div>' +
        '<div class="eyebrow">ARCHIVE</div>' +
        '<h1 class="title">Archived players</h1>' +
        '<span class="players-count">' + count + ' ' + (count === 1 ? 'player' : 'players') + '</span>' +
        '<p class="muted">Players kept for historical records. They cannot be selected for new games.</p>' +
      '</div></div>' +
      '<div class="card table-card"><table><thead><tr><th>Player</th><th>Phone</th><th>Email</th><th>Archived</th><th></th></tr></thead><tbody>' +
      (players.length
        ? players.map(p => '<tr><td><div class="who"><span class="avatar">' + esc(p.name).slice(0,1).toUpperCase() + '</span><b>' + esc(p.name) + '</b></div></td><td>' + esc(p.phone || "—") + '</td><td>' + esc(p.email || "—") + '</td><td>' + new Date(p.archived_at).toLocaleDateString("en-GB") + '</td><td><div class="actions"><button class="btn btn-secondary" data-restore-player="' + p.id + '">Restore</button></div></td></tr>').join("")
        : '<tr><td colspan="5" class="empty">No archived players.</td></tr>') +
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
    prepareArchiveButtons();
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
