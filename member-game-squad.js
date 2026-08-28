(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let cachedAccess = null;
  let refreshTimer = null;
  let avatarCache = new Map();
  let avatarLoadPromise = null;
  let lastRenderKey = "";

  function isPlayerPreview() {
    return /Viewing the site as\s+.+?\s*\(player\)/i.test(document.body?.textContent || "");
  }

  function previewName() {
    const text = document.body?.textContent?.replace(/\s+/g, " ").trim() || "";
    return text.match(/Viewing the site as\s+(.+?)\s*\(player\)/i)?.[1]?.trim() || null;
  }

  async function loadAccess() {
    if (cachedAccess) return cachedAccess;
    const result = await sb.rpc("get_my_access");
    if (result.error || !result.data?.allowed) return null;
    cachedAccess = result.data;
    return cachedAccess;
  }

  async function loadAvatars() {
    if (avatarLoadPromise) return avatarLoadPromise;

    avatarLoadPromise = (async () => {
      const result = await sb.rpc("list_player_avatars");
      if (result.error) {
        console.error("Could not load player avatars", result.error);
        return avatarCache;
      }

      const next = new Map(avatarCache);
      await Promise.all((result.data || []).map(async row => {
        if (!row.player_name || !row.avatar_path) return;
        const key = String(row.player_name).trim().toLowerCase();
        if (next.has(key)) return;

        const signed = await sb.storage.from("player-avatars").createSignedUrl(row.avatar_path, 3600);
        if (!signed.error && signed.data?.signedUrl) {
          next.set(key, signed.data.signedUrl);
        }
      }));

      avatarCache = next;
      return avatarCache;
    })().finally(() => {
      avatarLoadPromise = null;
    });

    return avatarLoadPromise;
  }

  async function getNextGame() {
    const result = await sb
      .from("games")
      .select("id,game_date,start_time")
      .gte("game_date", new Date().toISOString().slice(0, 10))
      .order("game_date")
      .order("start_time")
      .limit(1);
    if (result.error) throw result.error;
    return result.data?.[0] || null;
  }

  async function getPreviewPlayerId(name) {
    if (!name) return null;
    const access = await loadAccess();
    const member = access?.members?.find(m =>
      String(m.display_name || m.name || "").trim().toLowerCase() === name.toLowerCase() &&
      m.role === "player" && m.active !== false
    );
    if (member?.player_id) return member.player_id;

    const result = await sb.rpc("admin_list_access");
    if (result.error) return null;
    return (result.data || []).find(m =>
      String(m.display_name || m.name || m.player_name || "").trim().toLowerCase() === name.toLowerCase() &&
      m.role === "player" && m.active !== false
    )?.player_id || null;
  }

  function ensureStyles() {
    if (document.getElementById("member-game-squad-styles")) return;
    const style = document.createElement("style");
    style.id = "member-game-squad-styles";
    style.textContent = `
      .member-game-squad { border-top:1px solid #e6ece8; margin:0 -24px -20px; padding:18px 24px 20px; }
      .member-game-squad__header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
      .member-game-squad__title { margin:0; font-size:13px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:#16352b; }
      .member-game-squad__count { display:inline-flex; align-items:center; justify-content:center; min-width:28px; height:24px; padding:0 8px; border-radius:999px; background:#eaf7ef; color:#087b3e; font-size:12px; font-weight:800; }
      .member-game-squad__list { display:flex; flex-wrap:wrap; gap:8px; }
      .member-game-squad__player { display:inline-flex; align-items:center; gap:7px; padding:7px 10px 7px 7px; border:1px solid #e1e9e4; border-radius:999px; background:#fff; color:#17352b; font-size:13px; font-weight:700; }
      .member-game-squad__player--self { border-color:#b9e8cb; background:#f1fbf5; }
      .member-game-squad__avatar { width:26px; height:26px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:#e4f4e9; color:#087b3e; font-size:11px; font-weight:900; flex:0 0 26px; object-fit:cover; }
      .member-game-squad__you { font-size:10px; font-weight:900; color:#087b3e; text-transform:uppercase; letter-spacing:.04em; }
      .member-game-squad__empty { margin:0; color:#66766f; font-size:13px; }
      @media (max-width:640px) {
        .member-game-squad { margin:0 -16px -16px; padding:16px; }
        .member-game-squad__player { font-size:12px; }
      }
    `;
    document.head.appendChild(style);
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.[0] || "?").toUpperCase();
  }

  function avatarMarkup(name) {
    const url = avatarCache.get(String(name || "").trim().toLowerCase());
    return url
      ? `<img class="member-game-squad__avatar" src="${escapeHtml(url)}" alt="${escapeHtml(name)} profile picture" loading="lazy">`
      : `<span class="member-game-squad__avatar">${initials(name)}</span>`;
  }

  function render(card, squad, currentPlayerId) {
    ensureStyles();
    let section = card.querySelector("[data-member-game-squad]");
    if (!section) {
      section = document.createElement("section");
      section.className = "member-game-squad";
      section.dataset.memberGameSquad = "true";
      card.appendChild(section);
    }

    const currentId = currentPlayerId ? String(currentPlayerId) : "";
    const renderKey = squad.map(player => `${player.player_id || "guest"}:${player.name || ""}`).join("|") + `|self:${currentId}`;
    if (renderKey === lastRenderKey && section.innerHTML) return;
    lastRenderKey = renderKey;

    section.innerHTML = `
      <div class="member-game-squad__header">
        <h3 class="member-game-squad__title">Players playing</h3>
        <span class="member-game-squad__count">${squad.length}</span>
      </div>
      ${squad.length ? `<div class="member-game-squad__list">${squad.map(player => {
        const self = String(player.player_id) === currentId;
        return `<span class="member-game-squad__player${self ? " member-game-squad__player--self" : ""}">
          ${avatarMarkup(player.name)}
          <span>${escapeHtml(player.name || "Player")}</span>
          ${self ? '<span class="member-game-squad__you">You</span>' : ""}
        </span>`;
      }).join("")}</div>` : '<p class="member-game-squad__empty">Nobody has signed up yet.</p>'}
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function refresh() {
    if (!document.querySelector('.nav-item.active[data-view="games"]')) return;

    const card = Array.from(document.querySelectorAll(".card")).find(c => /NEXT GAME/i.test(c.textContent || ""));
    if (!card) return;

    const access = await loadAccess();
    const preview = isPlayerPreview();
    const isRealPlayer = access?.profile?.role === "player" && access.profile.active === true;
    if (!isRealPlayer && !preview) {
      card.querySelector("[data-member-game-squad]")?.remove();
      lastRenderKey = "";
      return;
    }

    const game = await getNextGame();
    if (!game) return;

    const result = await sb.rpc("player_list_game_squad", { p_game_id: game.id });
    if (result.error) {
      console.error("Could not load game squad", result.error);
      return;
    }

    await loadAvatars();
    const currentPlayerId = preview
      ? await getPreviewPlayerId(previewName())
      : access.profile.player_id;
    render(card, result.data || [], currentPlayerId);
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh().catch(console.error), 150);
  }

  const observer = new MutationObserver(records => {
    const squadMutation = records.length > 0 && records.every(record => {
      const target = record.target?.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
      return target?.closest?.("[data-member-game-squad]");
    });
    if (!squadMutation) scheduleRefresh();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("football:game-squad-changed", scheduleRefresh);
  setTimeout(() => refresh().catch(console.error), 700);
})();
