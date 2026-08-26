(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let timer;
  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[c]));

  async function enhanceMemberForm() {
    const form = document.getElementById("member-form");
    if (!form) return;
    const roleSelect = form.querySelector('select[name="role"]');
    if (!roleSelect) return;

    if (!roleSelect.querySelector('option[value="player"]')) {
      const option = document.createElement("option");
      option.value = "player";
      option.textContent = "Player";
      roleSelect.appendChild(option);
    }

    let wrapper = document.getElementById("player-member-link-field");
    if (!wrapper) {
      wrapper = document.createElement("label");
      wrapper.id = "player-member-link-field";
      wrapper.innerHTML = '<span>Player</span><select name="player_id"><option value="">Select player…</option></select>';
      roleSelect.closest("label")?.after(wrapper);
    }

    const select = wrapper.querySelector('select[name="player_id"]');
    if (!select.dataset.loaded) {
      const [playersResult, membersResult] = await Promise.all([
        sb.from("players").select("id,name").is("archived_at", null).order("name"),
        sb.rpc("admin_list_access")
      ]);
      const players = playersResult.data || [];
      const memberEmail = form.dataset.email || form.querySelector('input[name="email"]')?.value?.trim().toLowerCase();
      const member = (membersResult.data || []).find(x => String(x.email).toLowerCase() === String(memberEmail || "").toLowerCase());
      const usedByOther = new Set((membersResult.data || [])
        .filter(x => x.email !== memberEmail && x.player_id)
        .map(x => x.player_id));
      select.innerHTML = '<option value="">Select player…</option>' + players
        .filter(p => !usedByOther.has(p.id) || p.id === member?.player_id)
        .map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>')
        .join("");
      if (member?.player_id) select.value = member.player_id;
      select.dataset.loaded = "true";
    }

    wrapper.style.display = roleSelect.value === "player" ? "" : "none";
    if (!roleSelect.dataset.playerLinkBound) {
      roleSelect.addEventListener("change", () => {
        wrapper.style.display = roleSelect.value === "player" ? "" : "none";
        if (roleSelect.value === "player") select.required = true;
        else { select.required = false; select.value = ""; }
      });
      roleSelect.dataset.playerLinkBound = "true";
    }
    select.required = roleSelect.value === "player";
  }

  function observe() {
    clearTimeout(timer);
    timer = setTimeout(() => { enhanceMemberForm().catch(console.error); }, 30);
  }

  const observer = new MutationObserver(observe);
  observer.observe(document.body, { childList: true, subtree: true });
  observe();
})();
