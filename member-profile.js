(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  // Existing member profile functionality.
  // This file only handles the profile page and keeps the SPA URL clean.
  let access = null;
  let previewTarget = null;
  let initialized = false;
  let rendering = false;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return null;
    access = result.data?.allowed ? result.data : null;
    return access;
  }

  function getPreviewIdentity() {
    const banner = document.querySelector(".preview-banner");
    if (!banner) return null;
    const text = banner.querySelector(":scope > div")?.textContent?.trim() || "";
    const match = text.match(/^Preview mode\s*·\s*Viewing the site as (.+?)\s*\((.+)\)$/);
    if (!match) return null;
    return { name: match[1].trim(), role: match[2].trim() };
  }

  async function loadPreviewTarget() {
    const identity = getPreviewIdentity();
    if (!identity) {
      previewTarget = null;
      return null;
    }
    const result = await sb.rpc("admin_list_access");
    if (result.error) throw result.error;
    const matches = (result.data || []).filter(member => {
      const name = String(member.display_name || member.name || member.player_name || "").trim().toLowerCase();
      const role = String(member.role || "").trim().toLowerCase();
      return name === identity.name.toLowerCase() && role === identity.role.toLowerCase();
    });
    previewTarget = matches.length === 1 ? { email: matches[0].email, ...identity } : null;
    return previewTarget;
  }

  const isMember = () => !!access?.profile?.active;
  const isPreview = () => !!previewTarget;

  function clearUrlHash() {
    if (window.location.hash) {
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    }
  }

  function setProfileNavActive() {
    const profile = document.querySelector('.nav [data-member-profile], .nav [data-player-profile]');
    if (!profile) return;
    document.querySelectorAll('.nav .nav-item').forEach(item => item.classList.remove('active'));
    profile.classList.add('active');
  }

  async function getProfile() {
    if (isPreview()) {
      const result = await sb.rpc("admin_preview_member_profile", { p_email: previewTarget.email });
      if (result.error) throw result.error;
      return result.data;
    }
    const result = await sb.rpc("member_profile");
    if (result.error) throw result.error;
    return result.data;
  }

  function renderProfile() {
    // The full profile renderer remains on the branch; this hook intentionally
    // keeps the URL clean and active state deterministic.
    clearUrlHash();
    window.__memberView = "profile";
    setProfileNavActive();
  }

  function openMemberProfile(event) {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (!isMember() && !isPreview()) return;
    clearUrlHash();
    window.__memberView = "profile";
    renderProfile();
  }

  document.addEventListener("click", event => {
    const profile = event.target.closest("[data-member-profile], [data-player-profile]");
    if (profile) openMemberProfile(event);
  }, true);

  async function init() {
    if (initialized) return;
    initialized = true;
    await loadAccess();
    await loadPreviewTarget();
  }

  init();
})();
