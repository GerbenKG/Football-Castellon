(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;
  let timer = null;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

  async function addRoleAndPlayerField() {
    if (!document.querySelector('.nav-item.active[data-view="admin"]')) return;
    const form = document.getElementById("member-form");
    const roleSelect = form?.querySelector('select[name="role"]');
    if (!form || !roleSelect) return;

    if (!roleSelect.querySelector('option[value="player"]')) {
      const option = document.createElement("option");
      option.value = "player";
      option.textContent = "Player";
      roleSelect.appendChild(option);
    }

    let wrapper = document.getElementById("player-member-link-field");
    if (wrapper) return;

    const q = await sb.from("players").select("id,name").is("archived_at", null).order("name");
    const players = q.data || [];
    const email = form.dataset.email || form.querySelector('input[name="email"]')?.value || "";
    const members = (await sb.rpc("admin_list_access")).data || [];
    const member = members.find(m => String(m.email).toLowerCase() === String(email).trim().toLowerCase());

    wrapper = document.createElement("label");
    wrapper.id = "player-member-link-field";
    wrapper.innerHTML = '<span>Linked player</span><select name="player_id" required><option value="">Select player…</option>' + players.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join("") + '</select>';
    roleSelect.closest("label")?.after(wrapper);
    if (member?.player_id) wrapper.querySelector("select").value = member.player_id;
  }

  document.addEventListener("submit", async event => {
    const form = event.target;
    if (form?.id !== "member-form") return;
    if (!document.querySelector('.nav-item.active[data-view="admin"]')) return;

    const playerId = String(new FormData(form).get("player_id") || "");
    if (!playerId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Select the Player this Member belongs to.");
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const f = new FormData(form);
    const q = await sb.rpc("admin_upsert_access", {
      p_email: String(f.get("email") || "").trim().toLowerCase(),
      p_display_name: String(f.get("display_name") || "").trim(),
      p_role: String(f.get("role") || ""),
      p_active: f.has("active"),
      p_player_id: playerId
    });
    if (q.error) {
      alert(q.error.message);
      return;
    }
    document.getElementById("modal-root").innerHTML = "";
    location.reload();
  }, true);

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(addRoleAndPlayerField, 50);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(addRoleAndPlayerField, 100);
})();
