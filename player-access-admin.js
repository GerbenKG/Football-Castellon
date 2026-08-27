(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[c]));

  let activeForm = null;
  let loading = false;

  async function loadPlayerOptions(form, select) {
    if (loading || select.dataset.loaded === "true") return;
    loading = true;
    select.disabled = true;
    select.innerHTML = '<option value="">Loading players…</option>';

    try {
      const email = String(form.querySelector('input[name="email"]')?.value || "").trim().toLowerCase();
      const [playersResult, membersResult] = await Promise.all([
        sb.rpc("admin_list_players_for_linking"),
        sb.rpc("admin_list_access")
      ]);

      if (playersResult.error) throw playersResult.error;
      if (membersResult.error) throw membersResult.error;

      const players = playersResult.data || [];
      const members = membersResult.data || [];
      const member = members.find(m => String(m.email || "").trim().toLowerCase() === email);
      const currentPlayerId = String(member?.player_id || "");
      const linkedElsewhere = new Set(
        members
          .filter(m => m.player_id && String(m.email || "").trim().toLowerCase() !== email)
          .map(m => String(m.player_id))
      );

      select.innerHTML = '<option value="">Select player…</option>' + players.map(player => {
        const id = String(player.id);
        const alreadyLinked = linkedElsewhere.has(id) && id !== currentPlayerId;
        return '<option value="' + esc(id) + '"' + (alreadyLinked ? ' disabled' : '') + '>' +
          esc(player.name) + (alreadyLinked ? ' (already linked)' : '') + '</option>';
      }).join("");

      if (currentPlayerId) select.value = currentPlayerId;
      select.dataset.loaded = "true";
    } catch (error) {
      console.error("Player linking load failed", error);
      select.innerHTML = '<option value="">Could not load players</option>';
    } finally {
      select.disabled = false;
      loading = false;
    }
  }

  function attachPlayerField(form) {
    if (!form || activeForm === form) return;
    activeForm = form;

    // A Member does not have an independent name. The linked Player is the
    // single source of truth for the person's name.
    const nameInput = form.querySelector('input[name="display_name"]');
    if (nameInput) {
      const nameLabel = nameInput.closest("label");
      if (nameLabel) nameLabel.remove();
      else nameInput.remove();
    }

    const roleSelect = form.querySelector('select[name="role"]');
    if (!roleSelect) return;

    if (!roleSelect.querySelector('option[value="player"]')) {
      const option = document.createElement("option");
      option.value = "player";
      option.textContent = "Player";
      roleSelect.appendChild(option);
    }

    let wrapper = form.querySelector("#player-member-link-field");
    if (!wrapper) {
      wrapper = document.createElement("label");
      wrapper.id = "player-member-link-field";
      wrapper.innerHTML = '<span>Player</span><select name="player_id"><option value="">Loading players…</option></select>';
      roleSelect.closest("label")?.after(wrapper);
    }

    const select = wrapper.querySelector('select[name="player_id"]');
    if (!select) return;
    wrapper.style.display = "";
    loadPlayerOptions(form, select);
  }

  function inspectModal() {
    if (!document.querySelector('.nav-item.active[data-view="admin"]')) return;
    const form = document.getElementById("member-form");
    if (!form || form === activeForm) return;
    attachPlayerField(form);
  }

  document.addEventListener("submit", async event => {
    const form = event.target;
    if (form?.id !== "member-form") return;
    if (!document.querySelector('.nav-item.active[data-view="admin"]')) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const f = new FormData(form);
    const playerId = String(f.get("player_id") || "").trim();
    const playerSelect = form.querySelector('select[name="player_id"]');
    const selectedPlayerName = playerSelect?.selectedOptions?.[0]?.textContent
      ?.replace(/\s*\(already linked\)\s*$/, "")
      ?.trim() || "";

    if (!playerId || !selectedPlayerName) {
      alert("Select the Player this Member belongs to.");
      return;
    }

    const result = await sb.rpc("admin_upsert_access", {
      p_email: String(f.get("email") || "").trim().toLowerCase(),
      p_display_name: selectedPlayerName,
      p_role: String(f.get("role") || "").trim(),
      p_active: f.has("active"),
      p_player_id: playerId
    });

    if (result.error) {
      alert(result.error.message);
      return;
    }

    document.getElementById("modal-root").innerHTML = "";
    location.reload();
  }, true);

  const observer = new MutationObserver(inspectModal);
  observer.observe(document.body, { childList: true, subtree: true });
  inspectModal();
})();
