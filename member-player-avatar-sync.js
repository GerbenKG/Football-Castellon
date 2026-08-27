(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let byName = new Map();
  let loading = false;
  let scheduled = false;

  function nameFromWho(who) {
    return who?.querySelector("b")?.textContent?.trim() || "";
  }

  function replaceAvatar(element, url, name) {
    if (!element || !url || element.dataset.avatarUrl === url) return;
    const image = document.createElement("img");
    image.src = url;
    image.alt = name ? name + " profile picture" : "Profile picture";
    image.className = element.className;
    image.dataset.avatarUrl = url;
    image.loading = "lazy";
    image.style.objectFit = "cover";
    element.replaceWith(image);
  }

  async function loadAvatars() {
    if (loading) return;
    loading = true;
    try {
      const result = await sb.rpc("list_player_avatars");
      if (result.error) return;

      const next = new Map();
      await Promise.all((result.data || []).map(async row => {
        if (!row.player_name || !row.avatar_path) return;
        const signed = await sb.storage.from("player-avatars").createSignedUrl(row.avatar_path, 3600);
        if (!signed.error && signed.data?.signedUrl) {
          next.set(String(row.player_name).trim().toLowerCase(), signed.data.signedUrl);
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

    // Dashboard, squad, Players and Admin & Access all use .who + .avatar.
    document.querySelectorAll(".who .avatar").forEach(avatar => {
      const name = nameFromWho(avatar.closest(".who"));
      const url = byName.get(name.toLowerCase());
      if (url) replaceAvatar(avatar, url, name);
    });

    // Games overview uses player chips with an <i> initial instead.
    document.querySelectorAll(".player-chip:not(.guest)").forEach(chip => {
      const icon = chip.querySelector("i");
      if (!icon || icon.tagName === "IMG") return;
      const text = [...chip.childNodes]
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join("")
        .trim();
      const url = byName.get(text.toLowerCase());
      if (!url) return;
      const image = document.createElement("img");
      image.src = url;
      image.alt = text + " profile picture";
      image.width = 24;
      image.height = 24;
      image.loading = "lazy";
      image.style.objectFit = "cover";
      image.style.borderRadius = "50%";
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
