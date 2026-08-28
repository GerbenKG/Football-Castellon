(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;
  let rendering = false;
  let previewTarget = null;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[c]));

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return null;
    access = result.data?.allowed ? result.data : null;
    return access;
  }

  const isMember = () => !!access?.profile?.active;
  const isPreview = () => !!previewTarget;

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
    const members = result.data || [];
    const name = identity.name.toLowerCase();
    const role = identity.role.toLowerCase();
    const matches = members.filter(member => {
      const memberName = String(member.display_name || member.name || member.player_name || "").trim().toLowerCase();
      const memberRole = String(member.role || "").trim().toLowerCase();
      return memberName === name && memberRole === role;
    });

    previewTarget = matches.length === 1 ? { email: matches[0].email, ...identity } : null;
    return previewTarget;
  }

  function ensureNav() {
    if (!isMember()) return;
    const nav = document.querySelector(".nav");
    if (!nav) return;

    const item = nav.querySelector("[data-member-profile], [data-player-profile]");
    if (item) item.style.removeProperty("display");
  }

  function setProfileNavActive() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const profile = nav.querySelector("[data-member-profile], [data-player-profile]");
    if (!profile) return;

    nav.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    if (getComputedStyle(profile).display !== "none") profile.classList.add("active");
  }

  async function getProfile() {
    if (isPreview()) {
      const result = await sb.rpc("admin_preview_member_profile", { p_email: previewTarget.email });
      if (result.error) throw result.error;
      if (!result.data?.id) throw new Error("Preview member profile is not available.");
      return result.data;
    }

    const result = await sb.rpc("member_profile");
    if (result.error) throw result.error;
    if (!result.data?.id) throw new Error("Member profile is not available.");
    return result.data;
  }

  async function signedAvatar(path) {
    if (!path) return null;
    const result = await sb.storage.from("player-avatars").createSignedUrl(path, 3600);
    return result.error ? null : result.data?.signedUrl || null;
  }

  function renderLoading() {
    const app = document.getElementById("app");
    if (app) app.innerHTML = '<section class="card empty" style="max-width:820px;margin:0 auto"><h2>Loading profile…</h2></section>';
  }

  async function renderProfile() {
    if (!isMember() || rendering) return;
    rendering = true;
    try {
      window.__memberView = "profile";
      renderLoading();
      const profile = await getProfile();
      const image = await signedAvatar(profile.avatar_path);
      const initial = esc(profile.name || "M").slice(0, 1).toUpperCase();
      const bibs = profile.role === "player" ? '<div class="profile-field readonly-field"><span class="field-label">Bibs taken</span><strong>' + Number(profile.bibs_taken_count || 0) + '</strong></div>' : '';
      const previewNote = isPreview() ? '<p class="muted" style="margin:8px 0 0">Preview mode: viewing ' + esc(profile.name) + '\'s profile. Editing is disabled.</p>' : '';
      const upload = isPreview() ? '' : '<label class="btn btn-secondary profile-upload">Upload picture<input id="member-avatar-input" type="file" accept="image/*" style="display:none"></label>';
      const fields = isPreview() ? ' disabled' : '';

      document.getElementById("app").innerHTML =
        '<div class="profile-shell">' +
          '<div class="page-head profile-head"><div><div class="eyebrow">PROFILE</div><h1 class="title">My Profile</h1><p class="muted">Keep your personal details and profile picture up to date.</p></div></div>' +
          '<section class="card profile-card">' +
            '<div class="profile-hero">' +
              '<div class="profile-avatar-wrap">' +
                (image
                  ? '<img class="profile-avatar" src="' + esc(image) + '" alt="Profile picture">'
                  : '<div class="profile-avatar profile-avatar-fallback">' + initial + '</div>') +
              '</div>' +
              '<div class="profile-identity"><div class="eyebrow">MEMBER PROFILE</div><h2>' + esc(profile.name) + '</h2><p class="muted">Your name is managed by the site administrator.</p>' + previewNote + upload + '</div>' +
            '</div>' +
            '<form id="member-profile-form" class="profile-form">' +
              '<div class="profile-grid">' +
                '<label class="profile-field"><span class="field-label">Name</span><input value="' + esc(profile.name) + '" disabled></label>' +
                '<label class="profile-field"><span class="field-label">Phone</span><input name="phone" type="tel" value="' + esc(profile.phone || "") + '" placeholder="Add phone number" autocomplete="tel"' + fields + '></label>' +
                '<label class="profile-field"><span class="field-label">Email</span><input name="email" type="email" value="' + esc(profile.email || "") + '" placeholder="Add email address" autocomplete="email"' + fields + '></label>' +
                bibs +
              '</div>' +
              '<div class="profile-actions">' + (isPreview() ? '<p id="member-profile-status" class="muted" role="status" aria-live="polite" style="margin:0">Preview only — no changes will be saved.</p>' : '<button id="member-profile-save" class="btn btn-primary" type="submit">Save profile</button><p id="member-profile-status" class="muted" role="status" aria-live="polite" style="margin:0"></p>') + '</div>' +
            '</form>' +
          '</section>' +
        '</div>';

      setProfileNavActive();
      document.getElementById("member-avatar-input")?.addEventListener("change", uploadAvatar);
    } catch (error) {
      document.getElementById("app").innerHTML = '<section class="card error-card" style="max-width:820px;margin:0 auto"><h2>Profile unavailable</h2><p>' + esc(error.message || "Could not load your profile.") + '</p></section>';
      setProfileNavActive();
    } finally {
      rendering = false;
    }
  }

  async function uploadAvatar(event) {
    if (isPreview()) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const user = await sb.auth.getUser();
    const uid = user.data?.user?.id;
    if (!uid) return alert("You are not signed in.");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = uid + "/avatar." + ext;
    const upload = await sb.storage.from("player-avatars").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (upload.error) return alert("Could not upload picture: " + upload.error.message);

    const profile = await getProfile();
    const save = await sb.rpc("member_update_profile", { p_phone: profile.phone || "", p_email: profile.email || "", p_avatar_path: path });
    if (save.error) return alert("Could not save profile picture: " + save.error.message);
    await renderProfile();
  }

  document.addEventListener("click", event => {
    if (!isMember()) return;
    const profile = event.target.closest("[data-member-profile], [data-player-profile]");
    if (profile) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.__memberView = "profile";
      renderProfile();
    }
  }, true);

  document.addEventListener("submit", async event => {
    if (!isMember() || isPreview() || event.target?.id !== "member-profile-form") return;
    event.preventDefault();

    const form = event.target;
    const button = form.querySelector("#member-profile-save");
    const status = form.querySelector("#member-profile-status");
    const f = new FormData(form);
    const phone = String(f.get("phone") || "").trim();
    const email = String(f.get("email") || "").trim().toLowerCase();

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      if (status) status.textContent = "Please enter a valid email address.";
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Saving…";
    }
    if (status) status.textContent = "Saving your profile…";

    const result = await sb.rpc("member_update_profile", {
      p_phone: phone,
      p_email: email,
      p_avatar_path: null
    });

    if (result.error) {
      if (button) {
        button.disabled = false;
        button.textContent = "Save profile";
      }
      if (status) status.textContent = "Could not save profile: " + result.error.message;
      return;
    }

    await renderProfile();
    const savedStatus = document.getElementById("member-profile-status");
    if (savedStatus) savedStatus.textContent = "Profile saved successfully.";
  }, true);

  async function openMemberProfile() {
    if (!isMember()) return;
    window.__memberView = "profile";
    if (window.location.hash !== "#profile") {
      history.pushState({ memberProfile: true }, "", "#profile");
    }
    await renderProfile();
  }

  async function init() {
    await loadAccess();
    if (!isMember()) return;
    ensureNav();
    await loadPreviewTarget();

    if (access.profile?.role === "player" || isPreview() || window.location.hash === "#profile") {
      await renderProfile();
    }

    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#profile") renderProfile();
    });

    const observer = new MutationObserver(() => {
      if (!isMember()) return;
      ensureNav();
      const identity = getPreviewIdentity();
      const current = previewTarget ? { name: previewTarget.name, role: previewTarget.role } : null;
      const next = identity ? { name: identity.name, role: identity.role } : null;
      if (JSON.stringify(current) !== JSON.stringify(next)) {
        loadPreviewTarget().then(() => {
          if (window.__memberView === "profile") renderProfile();
        });
      }
    });
    observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  }

  init();
})();