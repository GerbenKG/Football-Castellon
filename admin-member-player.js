(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let players = [];
  let accessMembers = [];
  let loading = false;

  const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));

  async function loadPlayers() {
    if (players.length || loading) return;
    loading = true;
    try {
      const [{ data: playerRows, error: playerError }, { data: memberRows, error: memberError }] = await Promise.all([
        sb.from("players").select("id,name").order("name"),
        sb.rpc("admin_list_access")
      ]);
      if (playerError) throw playerError;
      if (memberError) throw memberError;
      players = playerRows || [];
      accessMembers = memberRows || [];
    } catch (error) {
      console.error("[Admin Access] Could not load players:", error);
    } finally {
      loading = false;
    }
  }

  async function enhanceMemberForm(form) {
    if (!form || form.dataset.playerEnhanced === "true") return;
    form.dataset.playerEnhanced = "true";

    await loadPlayers();

    const nameInput = form.querySelector('[name="display_name"]');
    const emailInput = form.querySelector('[name="email"]');
    const existingPlayerSelect = form.querySelector('[name="player_id"]');

    // The member name is always derived from the linked player.
    if (nameInput) {
      const nameLabel = nameInput.closest("label");
      if (nameLabel) nameLabel.remove();
      else nameInput.remove();
    }

    let playerSelect = existingPlayerSelect;
    if (!playerSelect) {
      playerSelect = document.createElement("select");
      playerSelect.name = "player_id";
      playerSelect.required = true;

      const label = document.createElement("label");
      label.textContent = "Player";
      label.appendChild(playerSelect);

      const roleLabel = form.querySelector('[name="role"]')?.closest("label");
      if (roleLabel) roleLabel.before(label);
      else form.insertBefore(label, form.querySelector(".checkline") || form.firstChild);
    }

    const email = emailInput?.value?.trim().toLowerCase() || form.dataset.email?.toLowerCase() || "";
    const member = accessMembers.find((item) => String(item.email || "").toLowerCase() === email);
    const currentPlayerId = member?.player_id || playerSelect.dataset.selected || "";

    playerSelect.innerHTML = '<option value="">Select player…</option>' + players.map((p) =>
      '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'
    ).join("");
    if (currentPlayerId) playerSelect.value = currentPlayerId;

    playerSelect.addEventListener("change", () => {
      playerSelect.dataset.selected = playerSelect.value;
    });
  }

  function watchModal() {
    const root = document.getElementById("modal-root");
    if (!root) return;

    const observer = new MutationObserver(() => {
      const form = root.querySelector("#member-form");
      if (form) enhanceMemberForm(form);
    });

    observer.observe(root, { childList: true, subtree: true });
    const form = root.querySelector("#member-form");
    if (form) enhanceMemberForm(form);
  }

  // Capture the member submit before app.js handles it. This ensures the
  // database always receives the selected player's id and uses that player's
  // name as display_name; there is no independent member name anymore.
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "member-form") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const playerId = String(formData.get("player_id") || "");
    const role = String(formData.get("role") || "");
    const active = formData.has("active");
    const selectedPlayer = players.find((p) => p.id === playerId);

    if (!email || !playerId || !role || !selectedPlayer) {
      alert("Please select a player before saving the member.");
      return;
    }

    const button = event.submitter;
    if (button) {
      button.disabled = true;
      button.textContent = "Saving…";
    }

    const result = await sb.rpc("admin_upsert_access", {
      p_email: email,
      p_display_name: selectedPlayer.name,
      p_role: role,
      p_active: active,
      p_player_id: playerId
    });

    if (result.error) {
      if (button) {
        button.disabled = false;
        button.textContent = "Save member";
      }
      alert(result.error.message || "Could not save member.");
      return;
    }

    // app.js keeps its access state inside its module closure, so a reload is
    // the reliable way to refresh the member list and permissions immediately.
    location.reload();
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchModal, { once: true });
  } else {
    watchModal();
  }
})();
