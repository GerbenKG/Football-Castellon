(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let currentKey = "";
  let loading = false;

  function identity() {
    const banner = document.querySelector(".preview-banner");
    const text = banner?.querySelector(":scope > div")?.textContent?.trim() || "";
    const match = text.match(/^Preview mode\s*·\s*Viewing the site as (.+?)\s*\((.+)\)$/);
    return match ? { name: match[1].trim(), role: match[2].trim() } : null;
  }

  async function apply() {
    const target = identity();
    const key = target ? target.name + "|" + target.role : "";
    if (!target || key === currentKey || loading) return;
    loading = true;
    try {
      const members = await sb.rpc("admin_list_access");
      if (members.error) return;
      const member = (members.data || []).find(m =>
        String(m.display_name || m.name || m.player_name || "").trim().toLowerCase() === target.name.toLowerCase() &&
        String(m.role || "").trim().toLowerCase() === target.role.toLowerCase()
      );
      if (!member?.email) return;

      const profile = await sb.rpc("admin_preview_member_profile", { p_email: member.email });
      if (profile.error || !profile.data?.avatar_path) return;
      const signed = await sb.storage.from("player-avatars").createSignedUrl(profile.data.avatar_path, 3600);
      const url = signed.data?.signedUrl;
      if (!url) return;

      const trigger = document.querySelector("#member-user-menu .member-user-trigger");
      const avatar = trigger?.querySelector(".member-user-avatar");
      if (!avatar || avatar.tagName === "IMG") return;

      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.className = avatar.className;
      image.loading = "lazy";
      image.style.objectFit = "cover";
      avatar.replaceWith(image);
      currentKey = key;
    } finally {
      loading = false;
    }
  }

  const observer = new MutationObserver(() => setTimeout(apply, 0));
  observer.observe(document.body, { childList: true, subtree: true });
  apply();
})();
