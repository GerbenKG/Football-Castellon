(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;
  let timer = null;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[c]));

  const isPlayer = () => access?.profile?.role === "player" && access?.profile?.active === true;

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return null;
    access = result.data?.allowed ? result.data : null;
    return access;
  }

  function nav() {
    return document.querySelector(".nav");
  }

  function addProfileNav() {
    if (!isPlayer()) return;
    const n = nav();
    if (!n) return;
    let item = n.querySelector("[data-player-profile]");
    if (!item) {
      item = document.createElement("button");
      item.className = "nav-item";
      item.type = "button";
      item.dataset.playerProfile = "true";
      item.textContent = "Profile";
      n.appendChild(item);
    }

    // Profile is intentionally hidden from the primary nav. The member profile
    // module owns the profile page and also exposes it through the user menu.
    item.style.display = "none";
    item.classList.remove("active");

    n.querySelectorAll(".nav-item[data-view]").forEach(button => {
      const view = button.dataset.view;
      const keep = view === "games";
      button.style.display = keep ? "" : "none";
      button.classList.toggle("active", keep && window.__playerView === view);
    });

    const newGame = document.getElementById("newGame");
    if (newGame) newGame.style.display = "none";
  }

  function route(view) {
    if (!isPlayer()) return;
    window.__playerView = view;
    addProfileNav();
    if (view === "games") renderPlayerGames();
    // Profile rendering is handled exclusively by member-profile.js. Keeping a
    // second implementation here caused a race where the correct profile UI
    // briefly appeared and was then replaced by the legacy read-only version.
  }

  async function renderPlayerGames() {
    if (!isPlayer()) return;
    const result = await sb.rpc("player_list_games");
    if (result.error) {
      document.getElementById("app").innerHTML = '<section class="card error-card"><h2>Games unavailable</h2><p>' + esc(result.error.message) + '</p></section>';
      return;
    }
    const games = result.data || [];
    const dateText = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const calendarUrl = g => {
      const day = g.game_date.replaceAll("-", "");
      const start = String(g.start_time).slice(0, 5).replace(":", "") + "00";
      const end = String(g.end_time).slice(0, 5).replace(":", "") + "00";
      return "https://calendar.google.com/calendar/render?" + new URLSearchParams({ action: "TEMPLATE", text: "Football game", dates: day + "T" + start + "/" + day + "T" + end, location: g.location || "Castellón" }).toString();
    };
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("app").innerHTML =
      '<div class="page-head"><div><div class="eyebrow">GAME OVERVIEW</div><h1 class="title">Games</h1><p class="muted">Upcoming and previous games.</p></div></div>' +
      '<div class="game-overview-list">' + games.map(g =>
        '<article class="card game-overview-card ' + (g.game_date < today ? "past" : "upcoming") + '">' +
        '<div class="game-overview-main"><div class="game-overview-date"><span class="game-day">' + esc(new Date(g.game_date + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit" })) + '</span><div><div class="eyebrow">' + (g.game_date < today ? "PLAYED" : "UP NEXT") + '</div><h3>' + esc(dateText(g.game_date)) + '</h3><p>⚽ ' + esc(String(g.start_time).slice(0, 5)) + '–' + esc(String(g.end_time).slice(0, 5)) + ' · ' + esc(g.location || "Castellón") + '</p></div></div></div>' +
        '<div class="game-overview-actions"><span class="game-status">' + (g.playing ? "I'm playing ✓" : (g.game_date < today ? "Played" : "Upcoming")) + '</span><a class="btn btn-secondary" href="' + esc(calendarUrl(g)) + '" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a></div>' +
        '</article>'
      ).join("") + '</div>';
  }

  async function addPlayerAdminControls() {
    if (!document.querySelector('.nav-item.active[data-view="admin"]')) return;
    const profileSelect = document.querySelector('#member-form select[name="role"]');
    if (!profileSelect || profileSelect.querySelector('option[value="player"]')) return;
    const option = document.createElement("option");
    option.value = "player";
    option.textContent = "Player";
    profileSelect.appendChild(option);

    const playersResult = await sb.from("players").select("id,name").is("archived_at", null).order("name");
    const players = playersResult.data || [];
    const memberEmail = document.querySelector('#member-form')?.dataset.email;
    const membersResult = await sb.rpc("admin_list_access");
    const member = (membersResult.data || []).find(m => m.email === memberEmail);
    let wrapper = document.getElementById("player-member-link-field");
    if (!wrapper) {
      wrapper = document.createElement("label");
      wrapper.id = "player-member-link-field";
      wrapper.innerHTML = '<span>Player</span><select name="player_id"><option value="">Select player…</option>' + players.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join("") + '</select>';
      profileSelect.closest("label")?.after(wrapper);
    }
    const select = wrapper.querySelector("select");
    if (member?.player_id) select.value = member.player_id;
    wrapper.style.display = profileSelect.value === "player" ? "" : "none";
    profileSelect.addEventListener("change", () => { wrapper.style.display = profileSelect.value === "player" ? "" : "none"; });
  }

  async function addPlayerPermissionColumn() {
    if (!document.querySelector('.nav-item.active[data-view="admin"]')) return;
    const head = document.querySelector(".permission-head");
    if (!head || head.querySelector("[data-player-role-col]")) return;
    const roleCell = document.createElement("b");
    roleCell.dataset.playerRoleCol = "true";
    roleCell.textContent = "Player";
    head.appendChild(roleCell);
    document.querySelectorAll(".permission-row").forEach(row => {
      const permission = row.querySelector("input[data-perm]")?.dataset.perm;
      if (!permission) return;
      const label = document.createElement("label");
      label.className = "perm-toggle";
      label.innerHTML = '<input type="checkbox" data-player-perm="' + esc(permission) + '"><span></span>';
      row.appendChild(label);
      sb.rpc("admin_list_permissions").then(result => {
        const enabled = (result.data || []).some(x => x.role === "player" && x.permission === permission && x.enabled);
        label.querySelector("input").checked = enabled;
      });
      label.querySelector("input").addEventListener("change", async event => {
        const result = await sb.rpc("admin_update_permission", { p_role: "player", p_permission: permission, p_enabled: event.target.checked });
        if (result.error) { event.target.checked = !event.target.checked; alert(result.error.message); }
      });
    });
  }

  document.addEventListener("click", event => {
    if (!isPlayer()) return;
    const profile = event.target.closest("[data-player-profile]");
    if (profile) {
      event.preventDefault();
      event.stopPropagation();
      route("profile");
      return;
    }
    const view = event.target.closest('.nav-item[data-view]');
    if (!view) return;
    const target = view.dataset.view;
    if (target !== "games") return;
    event.preventDefault();
    event.stopPropagation();
    route("games");
  }, true);

  document.addEventListener("submit", async event => {
    if (!isPlayer() && !document.querySelector('.nav-item.active[data-view="admin"]')) return;
    const form = event.target;
    if (form?.id !== "member-form") return;
    const role = form.querySelector('select[name="role"]')?.value;
    if (role !== "player") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const f = new FormData(form);
    const result = await sb.rpc("admin_upsert_access", {
      p_email: String(f.get("email") || "").trim().toLowerCase(),
      p_display_name: String(f.get("display_name") || "").trim(),
      p_role: "player",
      p_active: f.has("active"),
      p_player_id: f.get("player_id") || null
    });
    if (result.error) return alert(result.error.message);
    document.getElementById("modal-root").innerHTML = "";
    location.reload();
  }, true);

  function enforcePlayerView() {
    if (!isPlayer()) return;
    addProfileNav();
    const app = document.getElementById("app");
    if (!app) return;
    if (app.querySelector(".hero, .stats")) {
      app.innerHTML = "";
      window.__playerView = window.__playerView || "profile";
      route(window.__playerView);
    }
  }

  function apply() {
    if (!isPlayer()) return;
    window.__playerView = "profile";
    // Do not render a profile here. member-profile.js is the single owner of
    // the profile UI and its editable phone/email fields.
    addProfileNav();
  }

  async function init() {
    await loadAccess();
    if (isPlayer()) apply();
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (isPlayer()) {
          enforcePlayerView();
          if (document.querySelector('.nav-item.active[data-view="admin"]')) {
            await addPlayerAdminControls();
            await addPlayerPermissionColumn();
          }
        }
      }, 20);
    });
    observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });

    document.addEventListener("click", async event => {
      if (!access?.profile || access.profile.role !== "super_admin") return;
      if (!event.target.closest('.nav-item.active[data-view="admin"]')) return;
      setTimeout(async () => { await addPlayerAdminControls(); await addPlayerPermissionColumn(); }, 0);
    });
  }

  init();
})();
