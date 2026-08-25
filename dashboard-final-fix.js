(() => {
  "use strict";

  const sb = window.supabaseClient;
  const app = document.getElementById("app");
  if (!sb || !app) return;

  // Compatibility with the current game_players schema: Present/playing are
  // no longer database fields. Keep the existing app code from sending them.
  const originalFrom = sb.from.bind(sb);
  sb.from = table => {
    const query = originalFrom(table);
    if (table === "game_players") {
      return new Proxy(query, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (prop === "insert" || prop === "upsert") {
            return (payload, ...args) => {
              const clean = row => {
                if (!row || typeof row !== "object") return row;
                const copy = { ...row };
                delete copy.playing;
                delete copy.attended;
                return copy;
              };
              return value.call(target, Array.isArray(payload) ? payload.map(clean) : clean(payload), ...args);
            };
          }
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
    }
    if (table === "payments") {
      return new Proxy(query, {
        get(target, prop, receiver) {
          if (prop === "delete" || prop === "insert" || prop === "upsert") {
            return () => ({
              then: resolve => resolve({ data: null, error: null }),
              catch: () => Promise.resolve({ data: null, error: null })
            });
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
    }
    return query;
  };

  const esc = value => String(value ?? "").replace(/[&<>"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));
  const dateText = date => new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  });
  const card = (icon, label, value) =>
    `<div class="stat"><div class="stat-icon">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`;

  let syncing = false;
  let lastKey = "";

  async function sync() {
    const stats = app.querySelector(".hero + .stats");
    const hero = app.querySelector(".hero .game-nav");
    const rows = [...app.querySelectorAll(".squad .squad-row")];
    if (!stats || !hero || !rows.length) return;
    if (syncing) return;

    stats.style.visibility = "hidden";
    syncing = true;
    try {
      const heroDate = hero.querySelector("h1")?.textContent?.trim() || "";
      const heroMeta = hero.querySelector("p")?.textContent?.trim() || "";

      const [gamesResult, seasonsResult, ticketsResult, squadResult, playersResult] = await Promise.all([
        sb.from("games").select("id,game_date,start_time,location"),
        sb.from("finance_seasons").select("id,starts_on,ends_on").order("starts_on", { ascending: false }),
        sb.from("finance_season_tickets").select("id,season_id,player_id,paid,amount"),
        sb.from("game_players").select("id,game_id,player_id,guest_name,paid"),
        sb.from("players").select("id,name,model")
      ]);

      const error = gamesResult.error || seasonsResult.error || ticketsResult.error || squadResult.error || playersResult.error;
      if (error) throw error;

      const games = gamesResult.data || [];
      const selectedGame = games.find(g => {
        const sameDate = dateText(g.game_date) === heroDate;
        const time = String(g.start_time || "").slice(0, 5);
        return sameDate && (!time || heroMeta.includes(time));
      });
      if (!selectedGame) return;

      const seasons = seasonsResult.data || [];
      const season = seasons.find(s => selectedGame.game_date >= s.starts_on && selectedGame.game_date <= s.ends_on) || seasons[0];
      if (!season) return;

      const tickets = (ticketsResult.data || []).filter(t => t.season_id === season.id);
      const ticketByPlayer = new Map(tickets.map(t => [t.player_id, t]));
      const players = playersResult.data || [];
      const playerById = new Map(players.map(p => [p.id, p]));
      const squad = (squadResult.data || []).filter(x => x.game_id === selectedGame.id);

      const due = squad.filter(row => {
        if (!row.player_id) return !row.paid;
        const ticket = ticketByPlayer.get(row.player_id);
        return ticket ? !ticket.paid : !row.paid;
      }).length;

      const key = [
        selectedGame.id,
        season.id,
        tickets.map(t => `${t.player_id}:${t.paid ? 1 : 0}`).join(","),
        squad.map(x => `${x.id}:${x.paid ? 1 : 0}`).join(",")
      ].join("|");

      // Keep the dashboard completely deterministic: one render from one data snapshot.
      if (key !== lastKey) {
        lastKey = key;
        const count = squad.length;
        stats.innerHTML =
          card("⚽", "THIS GAME · PLAYING", count) +
          card("✓", "THIS GAME · PRESENT", count) +
          card("🎟", "THIS SEASON · SEASON TICKETS", tickets.length) +
          card("€", "THIS GAME · PAYMENTS DUE", due);
      }

      // Finance is the source of truth for the payment status shown in Game Squad.
      rows.forEach(row => {
        const name = row.querySelector(".who b")?.textContent?.trim() || "";
        const playerId = squad.find(x => x.id === row.querySelector('[data-t="paid"]')?.dataset.id || row.querySelector(".remove")?.dataset.id)?.player_id;
        const p = playerId ? playerById.get(playerId) : players.find(x => x.name === name);
        if (!p) return;

        const ticket = ticketByPlayer.get(p.id);
        const type = row.querySelector(".who small");
        if (type) type.textContent = ticket ? "🎟 Season ticket" : "Per game";

        const badge = row.querySelector(".badge");
        if (ticket) {
          if (badge) {
            badge.textContent = ticket.paid ? "Season paid" : "Season unpaid";
            badge.className = "badge badge-" + (ticket.paid ? "green" : "amber");
          }
          row.querySelector('.payment-toggle')?.remove();
        } else {
          const payment = squad.find(x => x.player_id === p.id);
          const control = row.querySelector('input[data-t="paid"]');
          if (control && payment) control.checked = !!payment.paid;
        }
      });

      // Present is no longer an editable Game Squad field. Remove it entirely.
      app.querySelectorAll('.squad input[data-t="attended"]').forEach(input => input.closest("label")?.remove());
    } catch (error) {
      console.warn("[Football] Dashboard/game status sync failed:", error);
    } finally {
      syncing = false;
      stats.style.visibility = "visible";
    }
  }

  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => sync(), 30);
  };

  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
})();
