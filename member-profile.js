(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;
  let rendering = false;

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

  function ensureNav() {
    if (!isMember()) return;
    const nav = document.querySelector(".nav");
    if (!nav) return;

    let item = nav.querySelector("[data-member-profile]");
    if (!item) {
      item = nav.querySelector("[data-player-profile]");
      if (item) item.dataset.memberProfile = "true";
    }
    if (!item) {
      item = document.createElement("button");
      item.className = "nav-item";
      item.type = "button";
      item.dataset.memberProfile = "true";
      item.textContent = "Profile";
      nav.appendChild(item);
    }
    item.style.display = "";
    item.classList.toggle("active", window.__memberView === "profile");
  }

  async function getProfile() {
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
    if (app) app.innerHTML = '<section class="card empty"><h2>Loading profile…</h2></section>';
  }

  async function renderProfile() {
    if (!isMember() || rendering) return;
    rendering = true;
    try {
      renderLoading();
      const profile = await getProfile();
      const image = await signedAvatar(profile.avatar_path);
      const initial = esc(profile.name || "M").slice(0, 1).toUpperCase();
      const bibs = profile.role === "player" ? '<label>Bibs taken<input value="' + Number(profile.bibs_taken_count || 0) + '" disabled></label>' : '';

      document.getElementById("app").innerHTML =
        '<div class="page-head"><div><div class="eyebrow">PROFILE</div><h1 class="title">My Profile</h1><p class="muted">Manage your personal contact details.</p></div></div>' +
        '<section class="card" style="max-width:760px">' +
          '<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;margin-bottom:24px">' +
            (image
              ? '<img src="' + esc(image) + '" alt="Profile picture" style="width:110px;height:110px;border-radius:50%;object-fit:cover">'
              : '<div class="avatar" style="width:110px;height:110px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:42px">' + initial + '</div>') +
            '<div><h2 style="margin:0">' + esc(profile.name) + '</h2><p class="muted" style="margin:6px 0 0">Profile information</p><label class="btn btn-secondary" style="display:inline-flex;margin-top:12px;cursor:pointer">Upload picture<input id="member-avatar-input" type="file" accept="image/*" style="display:none"></label></div>' +
          '</div>' +
          '<form id="member-profile-form">' +
            '<div class="form-grid" style="grid-template-columns:1fr 1fr">' +
              '<label>Name<input value="' + esc(profile.name) + '" disabled></label>' +
              '<label>Phone<input name="phone" type="tel" value="' + esc(profile.phone || "") + '"></label>' +
              '<label>Email<input name="email" type="email" value="' + esc(profile.email || "") + '"></label>' +
              bibs +
            '</div>' +
            '<div class="modal-actions" style="margin-top:20px"><button class="btn btn-primary">Save profile</button></div>' +
          '</form>' +
        '</section>';

      document.getElementById("member-avatar-input")?.addEventListener("change", uploadAvatar);
    } catch (error) {
      document.getElementById("app").innerHTML = '<section class="card error-card"><h2>Profile unavailable</h2><p>' + esc(error.message || "Could not load your profile.") + '</p></section>';
    } finally {
      rendering = false;
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const user = await sb.auth.getUser();
    const uid = user.data?.user?.id;
    if (!uid) return alert("You are not signed in.");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = uid + "/avatar." + ext;
    const upload = await sb.storage.from("player-avatars").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg"
    });
    if (upload.error) return alert("Could not upload picture: " + upload.error.message);

    const profile = await getProfile();
    const save = await sb.rpc("member_update_profile", {
      p_phone: profile.phone || "",
      p_email: profile.email || "",
      p_avatar_path: path
    });
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
      ensureNav();
      renderProfile();
    }
  }, true);

  document.addEventListener("submit", async event => {
    if (!isMember() || event.target?.id !== "member-profile-form") return;
    event.preventDefault();
    const form = event.target;
    const f = new FormData(form);
    const result = await sb.rpc("member_update_profile", {
      p_phone: String(f.get("phone") || "").trim(),
      p_email: String(f.get("email") || "").trim(),
      p_avatar_path: null
    });
    if (result.error) return alert("Could not save profile: " + result.error.message);
    await renderProfile();
  }, true);

  async function init() {
    await loadAccess();
    if (!isMember()) return;
    ensureNav();

    if (access.profile.role === "player") {
      window.__memberView = "profile";
      await renderProfile();
    }

    const observer = new MutationObserver(() => {
      if (!isMember()) return;
      ensureNav();
    });
    observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  }

  init();
})();
