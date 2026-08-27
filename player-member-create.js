(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[c]));

  let players = [];
  let members = [];
  let loaded = false;
  let busy = false;

  function isPlayersPage() {
    return !!document.querySelector('.nav-item.active[data-view="players"]');
  }

  async function loadData() {
    if (loaded || busy || !isPlayersPage()) return;
    busy = true;
    try {
      const [playersResult, membersResult] = await Promise.all([
        sb.from("players").select("id,name,email").is("archived_at", null).order("name"),
        sb.rpc("admin_list_access")
      ]);
      if (playersResult.error) throw playersResult.error;
      if (membersResult.error) throw membersResult.error;
      players = playersResult.data || [];
      members = membersResult.data || [];
      loaded = true;
      apply();
    } catch (error) {
      console.error("Could not load member links", error);
    } finally {
      busy = false;
    }
  }

  function playerForRow(row) {
    const cells = [...row.querySelectorAll("td")];
    const text = cells.map(cell => cell.textContent.trim()).join(" ");
    return players.find(p => String(p.name || "").trim() === String(cells[0]?.textContent || "").trim()) ||
      players.find(p => text.includes(String(p.name || "").trim()));
  }

  function linkedMember(playerId) {
    return members.find(m => String(m.player_id || "") === String(playerId));
  }

  function apply() {
    if (!isPlayersPage() || !loaded) return;
    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table) return;

    const head = table.querySelector("thead tr");
    if (head && !head.querySelector("[data-member-action-head]")) {
      const th = document.createElement("th");
      th.dataset.memberActionHead = "true";
      th.textContent = "Member";
      head.appendChild(th);
    }

    table.querySelectorAll("tbody tr").forEach(row => {
      // Mark the action cell so MutationObserver activity cannot append it repeatedly.
      if (row.querySelector("[data-member-action-cell]")) return;

      const player = playerForRow(row);
      if (!player) return;

      const td = document.createElement("td");
      td.dataset.memberActionCell = "true";
      const member = linkedMember(player.id);
      if (member) {
        td.innerHTML = '<span class="badge badge-green">Member</span>';
      } else {
        td.innerHTML = '<button type="button" class="btn btn-secondary" data-create-member="' + esc(player.id) + '">Create Member</button>';
      }
      row.appendChild(td);
    });
  }

  async function createMember(playerId, button) {
    const player = players.find(p => String(p.id) === String(playerId));
    if (!player) return;

    const existing = linkedMember(player.id);
    if (existing) {
      alert(player.name + " already has a Member account.");
      return;
    }

    let email = String(player.email || "").trim().toLowerCase();
    if (!email) {
      email = String(prompt("Enter the email address for " + player.name + ":", "") || "").trim().toLowerCase();
      if (!email) return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    button.disabled = true;
    button.textContent = "Creating…";

    const result = await sb.rpc("admin_upsert_access", {
      p_email: email,
      p_display_name: player.name,
      p_role: "player",
      p_active: true,
      p_player_id: player.id
    });

    if (result.error) {
      button.disabled = false;
      button.textContent = "Create Member";
      alert(result.error.message);
      return;
    }

    members.push({ player_id: player.id, email, display_name: player.name, role: "player", active: true });
    apply();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-create-member]");
    if (!button || !isPlayersPage()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    createMember(button.dataset.createMember, button);
  }, true);

  const observer = new MutationObserver(() => {
    if (isPlayersPage()) {
      loadData();
      apply();
    } else {
      loaded = false;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  loadData();
})();
