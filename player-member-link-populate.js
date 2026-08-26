(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  async function populate() {
    const form = document.getElementById("member-form");
    const select = form?.querySelector('select[name="player_id"]');
    if (!form || !select) return;
    if (select.dataset.loaded === "true") return;

    const result = await sb.rpc("admin_list_players_for_linking");
    if (result.error) return;
    const players = result.data || [];
    const membersResult = await sb.rpc("admin_list_access");
    const members = membersResult.data || [];
    const email = form.querySelector('input[name="email"]')?.value?.trim().toLowerCase() || "";
    const current = members.find(m => String(m.email || "").trim().toLowerCase() === email);
    const currentId = current?.player_id || "";
    const linked = new Set(members.filter(m => String(m.email || "").trim().toLowerCase() !== email && m.player_id).map(m => m.player_id));

    select.innerHTML = '<option value="">Select player…</option>' + players.map(p => {
      const disabled = linked.has(p.id) && p.id !== currentId ? " disabled" : "";
      return '<option value="' + esc(p.id) + '"' + disabled + '>' + esc(p.name) + (disabled ? ' (already linked)' : '') + '</option>';
    }).join("");
    if (currentId) select.value = currentId;
    select.dataset.loaded = "true";
  }

  const observer = new MutationObserver(() => {
    if (document.querySelector('.nav-item.active[data-view="admin"]')) populate();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(populate, 300);
})();
