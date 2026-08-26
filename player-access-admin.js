(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let timer = null;
  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

  async function getPlayers() {
    const q = await sb.from("players").select("id,name").is("archived_at", null).order("name");
    return q.data || [];
  }

  async function enhanceAdmin() {
    if (!document.querySelector('.nav-item.active[data-view="admin"]')) return;

    const roleSelect = document.querySelector('#member-form select[name="role"]');
    if (roleSelect && !roleSelect.querySelector('option[value="player"]')) {
      const option = document.createElement("option");
      option.value = "player";
      option.textContent = "Player";
      roleSelect.appendChild(option);
    }

    if (roleSelect && !document.getElementById("player-member-link-field")) {
      const players = await getPlayers();
      const members = (await sb.rpc("admin_list_access")).data || [];
      const member = members.find(m => m.email === document.querySelector('#member-form')?.dataset.email);
      const wrapper = document.createElement("label");
      wrapper.id = "player-member-link-field";
      wrapper.innerHTML = '<span>Player</span><select name="player_id"><option value="">Select player…</option>' + players.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join("") + '</select>';
      roleSelect.closest("label")?.after(wrapper);
      if (member?.player_id) wrapper.querySelector("select").value = member.player_id;
      const sync = () => { wrapper.style.display = roleSelect.value === "player" ? "" : "none"; };
      roleSelect.addEventListener("change", sync);
      sync();
    }

    const head = document.querySelector(".permission-head");
    if (head && !head.querySelector("[data-player-role-col]")) {
      const permissions = await sb.rpc("admin_list_permissions");
      const enabled = new Set((permissions.data || []).filter(x => x.role === "player" && x.enabled).map(x => x.permission));
      const cell = document.createElement("b");
      cell.dataset.playerRoleCol = "true";
      cell.textContent = "Player";
      head.appendChild(cell);
      document.querySelectorAll(".permission-row").forEach(row => {
        const permission = row.querySelector("input[data-perm]")?.dataset.perm;
        if (!permission) return;
        const label = document.createElement("label");
        label.className = "perm-toggle";
        label.innerHTML = '<input type="checkbox" data-player-perm="' + esc(permission) + '" ' + (enabled.has(permission) ? "checked" : "") + '><span></span>';
        row.appendChild(label);
        label.querySelector("input").addEventListener("change", async e => {
          const q = await sb.rpc("admin_update_permission", { p_role: "player", p_permission: permission, p_enabled: e.target.checked });
          if (q.error) { e.target.checked = !e.target.checked; alert(q.error.message); }
        });
      });
    }

    document.querySelectorAll('.member-role .badge').forEach(badge => {
      if (badge.textContent.trim().toLowerCase() === "player") badge.textContent = "Player";
    });
  }

  document.addEventListener("submit", async event => {
    const form = event.target;
    if (form?.id !== "member-form") return;
    if (!document.querySelector('.nav-item.active[data-view="admin"]')) return;
    const role = form.querySelector('select[name="role"]')?.value;
    event.preventDefault();
    event.stopImmediatePropagation();
    const f = new FormData(form);
    if (role === "player" && !f.get("player_id")) return alert("Select the Player this Member belongs to.");
    const q = await sb.rpc("admin_upsert_access", {
      p_email: String(f.get("email") || "").trim().toLowerCase(),
      p_display_name: String(f.get("display_name") || "").trim(),
      p_role: role,
      p_active: f.has("active"),
      p_player_id: role === "player" ? f.get("player_id") : null
    });
    if (q.error) return alert(q.error.message);
    document.getElementById("modal-root").innerHTML = "";
    location.reload();
  }, true);

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(enhanceAdmin, 50);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(enhanceAdmin, 300);
})();
