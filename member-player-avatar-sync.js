(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let avatarMap = new Map();
  let loading = false;
  let scheduled = false;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));

  async function loadAvatarMap() {
    if (loading) return;
    loading = true;
    try {
      const result = await sb.rpc("list_player_avatars");
      if (result.error) return;

      const next = new Map();
      const rows = result.data || [];
      await Promise.all(rows.map(async row => {
        if (!row.player_id || !row.avatar_path) return;
        const signed = await sb.storage.from("player-avatars").createSignedUrl(row.avatar_path, 3600);
        if (!signed.error && signed.data?.signedUrl) {
          next.set(String(row.player_id), signed.data.signedUrl);
        }
      }));
      avatarMap = next;
      applyAvatars();
    } finally {
      loading = false;
    }
  }

  function playerNameFromWho(who) {
    return who?.querySelector("b")?.textContent?.trim() || "";
  }

  function replaceAvatar(element, url, name) {
    if (!url || !element || element.dataset.avatarUrl === url) return;
    element.dataset.avatarUrl = url;
    const image = document.createElement("img");
    image.src = url;
    image.alt = name ? name + " profile picture" : "Profile picture";
    image.className = element.className;
    image.style.objectFit = "cover";
    image.loading = "lazy";
    element.replaceWith(image);
  }

  function applyAvatars() {
    if (!avatarMap.size) return;

    // Standard avatar components used by dashboard, Players, squad and
    // Admin & Access. The adjacent <b> is the canonical Player name.
    document.querySelectorAll(".avatar").forEach(avatar => {
      if (avatar.tagName === "IMG") return;
      const who = avatar.closest(".who");
      const name = playerNameFromWho(who);
      if (!name) return;
      const player = [...document.querySelectorAll(".who")].find(x => playerNameFromWho(x) === name);
      if (!player) return;
      // Resolve the player id from the rendered player name. Names are the
      // system-wide identity for a Member/Player, as established by access.
      const row = [...avatarMap.keys()].find(id => {
        const matches = document.querySelectorAll('[data-avatar-player-id="' + CSS.escape(id) + '"]');
        return matches.length > 0;
      });
      if (row) replaceAvatar(avatar, avatarMap.get(row), name);
    });

    // Player chips on the Games overview use <i> rather than .avatar.
    document.querySelectorAll(".player-chip:not(.guest)").forEach(chip => {
      const icon = chip.querySelector("i");
      if (!icon || icon.tagName === "IMG") return;
      const clone = chip.cloneNode(true);
      clone.querySelector("i")?.remove();
      clone.querySelector("em")?.remove();
      clone.querySelector("b")?.remove();
      const name = clone.textContent.trim();
      const player = [...document.querySelectorAll(".who")].find(x => playerNameFromWho(x) === name);
      if (!player) return;
      const avatar = [...avatarMap.entries()].find(([id]) => document.querySelector('[data-avatar-player-id="' + CSS.escape(id) + '"]'));
      if (!avatar) return;
      const image = document.createElement("img");
      image.src = avatar[1];
      image.alt = name + " profile picture";
      image.width = 24;
      image.height = 24;
      image.style.objectFit = "cover";
      image.style.borderRadius = "50%";
      icon.replaceWith(image);
    });
  }

  // The main app is rendered from JS, so make sure every render gets the
  // shared avatar treatment without interfering with application state.
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyAvatars();
    });
  }

  function markPlayerElements() {
    // Build a name -> player id index from the player rows rendered by app.js.
    // This is deliberately done after the app has rendered, keeping the core
    // application model unchanged.
    const names = new Map();
    document.querySelectorAll(".who").forEach(who => {
      const name = playerNameFromWho(who);
      if (name) names.set(name.toLowerCase(), who);
    });

    // The Players table exposes data-id on its action buttons. Use that as the
    // stable player identifier and mark the corresponding row avatar.
    document.querySelectorAll('[data-a="edit"][data-id]').forEach(button => {
      const row = button.closest("tr");
      const avatar = row?.querySelector(".who .avatar");
      const name = playerNameFromWho(row?.querySelector(".who"));
      if (avatar && name) avatar.dataset.avatarPlayerId = button.dataset.id;
    });

    // Dashboard/game rows do not expose IDs, so match their names against the
    // Players table when both are present. This covers the admin dashboard.
    const playerRows = [...document.querySelectorAll('button[data-a="edit"][data-id]')];
    const idByName = new Map();
    playerRows.forEach(button => {
      const row = button.closest("tr");
      const name = playerNameFromWho(row?.querySelector(".who"));
      if (name) idByName.set(name.toLowerCase(), button.dataset.id);
    });
    document.querySelectorAll(".who .avatar").forEach(avatar => {
      const name = playerNameFromWho(avatar.closest(".who"));
      const id = idByName.get(name.toLowerCase());
      if (id) avatar.dataset.avatarPlayerId = id;
    });
  }

  async function init() {
    await loadAvatarMap();
    markPlayerElements();
    applyAvatars();

    const observer = new MutationObserver(() => {
      markPlayerElements();
      scheduleApply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
