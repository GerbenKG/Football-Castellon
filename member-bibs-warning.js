(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;
  let renderedGameId = null;
  let timer = null;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));

  async function loadAccess() {
    if (access) return access;
    const result = await sb.rpc("get_my_access");
    if (result.error || !result.data?.allowed) return null;
    access = result.data;
    return access;
  }

  function isPlayerGamesPage() {
    const navGames = document.querySelector('.nav-item.active[data-view="games"]');
    return !!navGames && !!document.getElementById("app");
  }

  async function findBibResponsibility() {
    const currentDate = new Date().toISOString().slice(0, 10);
    const gamesResult = await sb
      .from("games")
      .select("id,game_date,start_time")
      .gte("game_date", currentDate)
      .order("game_date")
      .order("start_time")
      .limit(1);
    if (gamesResult.error || !gamesResult.data?.[0]) return null;

    const nextGame = gamesResult.data[0];
    const previousResult = await sb
      .from("games")
      .select("id,game_date")
      .lt("game_date", nextGame.game_date)
      .order("game_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(1);
    if (previousResult.error || !previousResult.data?.[0]) return null;

    const previousGame = previousResult.data[0];
    const playerId = access?.profile?.player_id;
    if (!playerId) return null;

    const bibResult = await sb
      .from("game_players")
      .select("id,took_bibs")
      .eq("game_id", previousGame.id)
      .eq("player_id", playerId)
      .eq("took_bibs", true)
      .limit(1);
    if (bibResult.error || !bibResult.data?.length) return null;

    return { nextGame, previousGame };
  }

  function ensureStyles() {
    if (document.getElementById("member-bibs-warning-style")) return;
    const style = document.createElement("style");
    style.id = "member-bibs-warning-style";
    style.textContent = `
      .member-bibs-warning {
        display:flex;
        align-items:flex-start;
        gap:12px;
        margin:0 0 16px;
        padding:14px 16px;
        border:1px solid #f1d27a;
        border-radius:14px;
        background:#fff8df;
        color:#5f4a06;
        box-shadow:0 4px 14px rgba(95,74,6,.07);
      }
      .member-bibs-warning__icon {
        width:34px;
        height:34px;
        flex:0 0 34px;
        display:grid;
        place-items:center;
        border-radius:10px;
        background:#ffe8a3;
        font-size:18px;
      }
      .member-bibs-warning__title {
        margin:0 0 3px;
        font-size:14px;
        font-weight:850;
      }
      .member-bibs-warning__text {
        margin:0;
        font-size:13px;
        line-height:1.45;
      }
      @media(max-width:720px){
        .member-bibs-warning{margin:0 0 14px;padding:13px 14px;border-radius:13px}
      }
    `;
    document.head.appendChild(style);
  }

  async function render() {
    const current = document.querySelector('.nav-item.active[data-view="games"]');
    if (!current || !isPlayerGamesPage()) return;

    const accessInfo = await loadAccess();
    if (!accessInfo?.profile?.active || accessInfo.profile.role !== "player") return;

    const answer = await findBibResponsibility();
    const existing = document.querySelector("[data-member-bibs-warning]");
    if (!answer) {
      existing?.remove();
      renderedGameId = null;
      return;
    }

    if (renderedGameId === answer.nextGame.id && existing) return;

    ensureStyles();
    existing?.remove();

    const app = document.getElementById("app");
    if (!app) return;

    const banner = document.createElement("section");
    banner.className = "member-bibs-warning";
    banner.dataset.memberBibsWarning = "true";
    banner.innerHTML = `
      <div class="member-bibs-warning__icon">🎽</div>
      <div>
        <p class="member-bibs-warning__title">Bibs reminder</p>
        <p class="member-bibs-warning__text">You took the bibs at the last game. Please bring them to the next game, or arrange with another player to bring them.</p>
      </div>`;

    app.insertBefore(banner, app.firstElementChild);
    renderedGameId = answer.nextGame.id;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(() => {}), 120);
  }

  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && !node.matches?.("[data-member-bibs-warning]")))) {
      schedule();
    }
  }).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });

  schedule();
})();
