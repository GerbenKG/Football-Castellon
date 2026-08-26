(() => {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb) return;

  let isSuperAdmin = false;
  let loaded = false;
  let skills = new Map();

  async function loadAccess() {
    try {
      const result = await sb.rpc("get_my_access");
      isSuperAdmin = result.data?.allowed && result.data?.profile?.role === "super_admin";
    } catch (_) {
      isSuperAdmin = false;
    }
  }

  async function loadSkills() {
    const { data, error } = await sb.from("players").select("id,skill_level");
    if (error) {
      console.warn("[Football] Skill levels unavailable", error);
      return false;
    }
    skills = new Map((data || []).map(p => [p.id, p.skill_level]));
    loaded = true;
    return true;
  }

  function playersPage() {
    return document.querySelector(".page-head .title")?.textContent?.trim() === "Players";
  }

  function addColumn() {
    if (!isSuperAdmin || !playersPage()) return;
    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table || !loaded) return;
    if (table.querySelector("th[data-skill-level]") ) return;

    const head = table.querySelector("thead tr");
    if (!head) return;
    const th = document.createElement("th");
    th.dataset.skillLevel = "true";
    th.textContent = "Skill";
    head.insertBefore(th, head.lastElementChild);

    table.querySelectorAll("tbody tr").forEach(row => {
      const edit = row.querySelector('[data-a="edit"]');
      const id = edit?.dataset?.id;
      if (!id) return;
      const td = document.createElement("td");
      td.dataset.skillLevel = "true";
      td.textContent = skills.get(id) ? String(skills.get(id)) : "—";
      row.insertBefore(td, row.lastElementChild);
    });
  }

  async function enhanceEditModal() {
    if (!isSuperAdmin) return;
    const form = document.getElementById("player-form");
    if (!form || form.querySelector("[name=skill_level]")) return;
    const playerId = form.dataset.id;
    if (!playerId) return;

    const value = skills.get(playerId) ?? "";
    const label = document.createElement("label");
    label.innerHTML = '<span>Skill level</span><select name="skill_level"><option value="">Not set</option><option value="1">1 — Lowest</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 — Highest</option></select>';
    form.querySelector(".modal-actions")?.before(label) || form.appendChild(label);
    form.querySelector("[name=skill_level]").value = value ? String(value) : "";
  }

  document.addEventListener("click", event => {
    if (!isSuperAdmin) return;
    const edit = event.target.closest('[data-a="edit"]');
    if (!edit) return;
    setTimeout(enhanceEditModal, 0);
  });

  document.addEventListener("submit", async event => {
    if (!isSuperAdmin || event.target?.id !== "player-form") return;
    const field = event.target.querySelector('[name="skill_level"]');
    if (!field) return;
    const id = event.target.dataset.id;
    if (!id) return;
    const skill = field.value ? Number(field.value) : null;
    if (skill !== null && (!Number.isInteger(skill) || skill < 1 || skill > 5)) return;
    const result = await sb.from("players").update({ skill_level: skill }).eq("id", id);
    if (result.error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Could not save skill level: " + result.error.message);
      return;
    }
    skills.set(id, skill);
    setTimeout(addColumn, 0);
  }, true);

  async function apply() {
    if (!isSuperAdmin) return;
    if (!loaded) await loadSkills();
    addColumn();
    await enhanceEditModal();
  }

  (async () => {
    await loadAccess();
    await apply();
    const observer = new MutationObserver(() => {
      clearTimeout(window.__skillTimer);
      window.__skillTimer = setTimeout(apply, 50);
    });
    observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  })();
})();
