(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let byName = new Map();
  let loading = false;
  let scheduled = false;

  function normalise(value) {
    return String(value || "").trim().toLowerCase();
  }

  function nameFromContainer(container) {
    if (!container) return "";

    const named = container.querySelector("[data-player-name], [data-member-name]");
    if (named?.textContent?.trim()) return named.textContent.trim();

    const bold = container.querySelector("b, strong");
    if (bold?.textContent?.trim()) return bold.textContent.trim();

    // Fallback for list markup where the name is a plain text node/td.
    // Match an exact leaf-node value against the player names returned by
    // the database, avoiding accidental matches against phone/email text.
    for (const node of container.querySelectorAll("*") || []) {
      if (node.children.length === 0) {
        const text = node.textContent?.trim();
        if (text && byName.has(normalise(text))) return text;
      }
    }

    return "";
  }

  function nameForAvatar(avatar) {
    const row = avatar.closest("tr, .member-row, .player-row, .squad-row, .leader-row, .who, .player-chip");
    const rowName = nameFromContainer(row);
    if (rowName) return rowName;

    let node = avatar.parentElement;
    for (let i = 0; i < 6 && node; i += 1, node = node.parentElement) {
      const name = nameFromContainer(node);
      if (name) return name;
    }

    return "";
  }

  function replaceAvatar(element, url, name) {
    if (!element || !url) return;
    if (element.dataset.avatarUrl === url) return;
    if (element.tagName === "IMG" && element.src === url) return;

    const image = document.createElement("img");
    image.src = url;
    image.alt = name ? name + " profile picture" : "Profile picture";
    image.className = element.className;
    image.dataset.avatarUrl = url;
    image.loading = "lazy";
    image.style.objectFit = "cover";
    image.style.borderRadius = "50%";
    image.width = element.width || 32;
    image.height = element.height || 32;
    element.replaceWith(image);
  }

  async function loadAvatars() {
    if (loading) return;
    loading = true;
    try {
      const result = await sb.rpc("list_player_avatars");
      if (result.error) {
        console.error("Could not load player avatars", result.error);
        return;
      }

      const next = new Map();
      await Promise.all((result.data || []).map(async row => {
        if (!row.player_name || !row.avatar_path) return;
        const signed = await sb.storage.from("player-avatars").createSignedUrl(row.avatar_path, 3600);
        if (!signed.error && signed.data?.signedUrl) {
          next.set(normalise(row.player_name), signed.data.signedUrl);
        }
      }));

      byName = next;
      apply();
    } finally {
      loading = false;
    }
  }

  function apply() {
    if (!byName.size) return;

    document.querySelectorAll(".avatar, [class*='member-avatar'], [class*='player-avatar']").forEach(avatar => {
      if (avatar.tagName === "IMG" && avatar.dataset.avatarUrl) return;
      const name = nameForAvatar(avatar);
      const url = byName.get(normalise(name));
      if (url) replaceAvatar(avatar, url, name);
    });

    document.querySelectorAll(".player-chip:not(.guest)").forEach(chip => {
      const text = [...chip.childNodes]
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join("")
        .trim();
      const url = byName.get(normalise(text));
      if (!url) return;

      const icon = chip.querySelector("i");
      if (!icon || icon.tagName === "IMG") return;

      const image = document.createElement("img");
      image.src = url;
      image.alt = text + " profile picture";
      image.width = 24;
      image.height = 24;
      image.loading = "lazy";
      image.style.objectFit = "cover";
      image.style.borderRadius = "50%";
      image.dataset.avatarUrl = url;
      icon.replaceWith(image);
    });
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  async function init() {
    await loadAvatars();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
