(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[c]));

  let profile = null;
  let avatarUrl = null;
  let initialized = false;
  let previewIdentity = null;

  async function loadProfile() {
    const result = await sb.rpc("member_profile");
    if (result.error || !result.data?.id) return null;
    return result.data;
  }

  async function loadAvatar(path) {
    if (!path) return null;
    const result = await sb.storage.from("player-avatars").createSignedUrl(path, 3600);
    return result.error ? null : result.data?.signedUrl || null;
  }

  function getPreviewIdentity() {
    const banner = document.querySelector(".preview-banner");
    if (!banner) return null;
    const text = banner.querySelector(":scope > div")?.textContent?.trim() || "";
    const match = text.match(/^Preview mode\s*·\s*Viewing the site as (.+?)\s*\((.+)\)$/);
    if (!match) return null;
    return { name: match[1].trim(), role: match[2].trim() };
  }

  function syncPreviewIdentity() {
    const next = getPreviewIdentity();
    const changed = (next?.name || null) !== (previewIdentity?.name || null) || (next?.role || null) !== (previewIdentity?.role || null);
    if (!changed) return;
    previewIdentity = next;
    render();
  }

  function closeMenu() {
    const menu = document.getElementById("member-user-menu");
    if (!menu) return;
    menu.classList.remove("open");
    menu.querySelector(".member-user-trigger")?.setAttribute("aria-expanded", "false");
  }

  function openProfile() {
    const profileItem = document.querySelector("[data-member-profile], [data-player-profile]");
    if (profileItem) {
      profileItem.click();
      return;
    }
    window.location.hash = "profile";
  }

  async function signOut() {
    const result = await sb.auth.signOut();
    if (result.error) {
      alert("Could not sign out: " + result.error.message);
      return;
    }
    window.location.reload();
  }

  function initials(name) {
    const value = String(name || "Member").trim();
    return esc(value.slice(0, 1).toUpperCase() || "M");
  }

  function render() {
    const topActions = document.querySelector(".top-actions");
    if (!topActions || !profile) return;

    let menu = document.getElementById("member-user-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "member-user-menu";
      menu.className = "member-user-menu";
      topActions.appendChild(menu);
    }

    const displayName = previewIdentity?.name || profile.name || "Member";
    const avatar = previewIdentity
      ? '<span class="member-user-avatar member-user-avatar-fallback" aria-hidden="true">' + initials(displayName) + '</span>'
      : (avatarUrl
        ? '<img src="' + esc(avatarUrl) + '" alt="" class="member-user-avatar">'
        : '<span class="member-user-avatar member-user-avatar-fallback" aria-hidden="true">' + initials(displayName) + '</span>');

    menu.innerHTML =
      '<button type="button" class="member-user-trigger" aria-expanded="false" aria-haspopup="menu">' +
        avatar +
        '<span class="member-user-name">' + esc(displayName) + '</span>' +
        '<span class="member-user-chevron" aria-hidden="true">⌄</span>' +
      '</button>' +
      '<div class="member-user-dropdown" role="menu">' +
        '<button type="button" class="member-user-option" data-user-action="profile"><span aria-hidden="true">◉</span>Profile</button>' +
        '<button type="button" class="member-user-option" data-user-action="signout"><span aria-hidden="true">↪</span>Sign Out</button>' +
      '</div>';

    menu.querySelector(".member-user-trigger")?.addEventListener("click", event => {
      event.stopPropagation();
      const open = menu.classList.toggle("open");
      event.currentTarget.setAttribute("aria-expanded", String(open));
    });

    menu.querySelector('[data-user-action="profile"]')?.addEventListener("click", event => {
      event.preventDefault();
      closeMenu();
      openProfile();
    });

    menu.querySelector('[data-user-action="signout"]')?.addEventListener("click", async event => {
      event.preventDefault();
      closeMenu();
      await signOut();
    });
  }

  function removeLegacyHeaderButtons() {
    const newGame = document.getElementById("newGame");
    if (newGame) newGame.style.display = "none";
    const signOut = document.getElementById("signOut");
    if (signOut) signOut.style.display = "none";
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    profile = await loadProfile();
    if (!profile) return;
    avatarUrl = await loadAvatar(profile.avatar_path);
    render();
    removeLegacyHeaderButtons();

    document.addEventListener("click", event => {
      if (!event.target.closest("#member-user-menu")) closeMenu();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    });

    const observer = new MutationObserver(() => {
      removeLegacyHeaderButtons();
      syncPreviewIdentity();
      if (!document.getElementById("member-user-menu")) render();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();