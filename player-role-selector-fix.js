(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let working = false;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));

  async function fixMemberForm() {
    if (working) return;
    const form = document.getElementById("member-form");
    if (!form) return;
    const roleSelect = form.querySelector('select[name="role"]');
    if (!roleSelect) return;

    working = true;
    try {
      if (!roleSelect.querySelector('option[value="player"]')) {
        const option = document.createElement("option");
        option.value = "player";
        option.textContent = "Player";
        roleSelect.appendChild(option);
      }

      let playerLabel = document.getElementById("player-profile-link");
      if (!playerLabel) {
        playerLabel = document.createElement("label");
        playerLabel.id = "player-profile-link";
        playerLabel.innerHTML = '<span>Player</span><select name="player_id"><option value="">Select player...</option></select>';
        roleSelect.closest("label")?.after(playerLabel);
      }

      const playerSelect = playerLabel.querySelector('select[name="player_id"]');
      if (!playerSelect.dataset.loaded) {
        const [playersResult, membersResult] = await Promise.all([
          sb.from("players").select("id,name").is("archived_at", null).order("name"),
          sb.rpc("admin_list_access")
        ]);
        const players = playersResult.data || [];
        const members = membersResult.data || [];
        const memberEmail = String(form.dataset.email || form.querySelector('input[name="email"]')?.value || "").trim().toLowerCase();
        const member = members.find(m => String(m.email || "").toLowerCase() === memberEmail);
        const usedByOther = new Set(members.filter(m => String(m.email || "").toLowerCase() !== memberEmail && m.player_id).map(m => m.player_id));
        playerSelect.innerHTML = '<option value="">Select player...</option>' + players
          .filter(p => !usedByOther.has(p.id) || p.id === member?.player_id)
          .map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>')
          .join("");
        if (member?.player_id) playerSelect.value = member.player_id;
        playerSelect.dataset.loaded = "true";
      }

      const sync = () => {
        const isPlayer = roleSelect.value === "player";
        playerLabel.style.display = isPlayer ? "" : "none";
        playerSelect.required = isPlayer;
      };
      sync();
      if (!roleSelect.dataset.playerFixBound) {
        roleSelect.addEventListener("change", sync);
        roleSelect.dataset.playerFixBound = "true";
      }
    } finally {
      working = false;
    }
  }

  const observer = new MutationObserver(() => {
    fixMemberForm().catch(console.error);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  fixMemberForm().catch(console.error);
})();
