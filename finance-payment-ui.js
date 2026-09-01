(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let canManage = false;
  let checkedPermission = false;

  async function checkPermission() {
    if (checkedPermission) return canManage;
    checkedPermission = true;
    try {
      const { data } = await sb.rpc("get_my_access");
      canManage = data?.allowed === true && data?.permissions?.["payments.manage"] === true;
    } catch (error) {
      console.warn("[Football] Finance payment permission check failed", error);
    }
    return canManage;
  }

  function findCard(title) {
    const heading = [...document.querySelectorAll("h3")].find(h => h.textContent.trim() === title);
    return heading?.closest(".card") || null;
  }

  function moveDueCardFirst() {
    const dueCard = findCard("Who still needs to pay?");
    const seasonCard = findCard("Season ticket holders");
    if (!dueCard || !seasonCard || dueCard === seasonCard) return;
    if (dueCard.parentElement === seasonCard.parentElement && seasonCard.previousElementSibling !== dueCard) {
      seasonCard.parentElement.insertBefore(dueCard, seasonCard);
    }
  }

  function addPaidColumn() {
    if (!canManage) return;

    const dueCard = findCard("Who still needs to pay?");
    const table = dueCard?.querySelector("table");
    if (!table) return;

    const headRow = table.tHead?.rows?.[0];
    if (headRow && !headRow.querySelector("[data-finance-paid-head]")) {
      const th = document.createElement("th");
      th.dataset.financePaidHead = "true";
      th.textContent = "PAID";
      headRow.appendChild(th);
    }

    table.tBodies?.[0]?.querySelectorAll("tr").forEach(row => {
      if (row.querySelector("[data-finance-paid-control]")) return;

      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return;

      const cell = document.createElement("td");
      cell.className = "finance-paid-cell";

      const label = document.createElement("label");
      label.className = "finance-paid-control";
      label.dataset.financePaidControl = "true";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("aria-label", "Mark payment as paid");

      const text = document.createElement("span");
      text.textContent = "Paid";

      input.addEventListener("change", async () => {
        if (!input.checked) return;

        const name = cells[0].textContent.trim();
        const paymentFor = cells[1].textContent.trim();
        input.disabled = true;

        try {
          if (paymentFor.startsWith("Season ticket")) {
            const seasonId = document.getElementById("finance-season-select")?.value;
            if (!seasonId) throw new Error("No season selected.");

            const { data: players, error: playerError } = await sb.from("players").select("id").eq("name", name).limit(1);
            if (playerError) throw playerError;
            const playerId = players?.[0]?.id;
            if (!playerId) throw new Error(`Player not found: ${name}`);

            const { data: season, error: seasonError } = await sb.from("finance_seasons").select("season_ticket_amount").eq("id", seasonId).single();
            if (seasonError) throw seasonError;

            const { data: existing, error: existingError } = await sb.from("finance_season_tickets").select("id").eq("season_id", seasonId).eq("player_id", playerId).limit(1);
            if (existingError) throw existingError;

            const payload = { season_id: seasonId, player_id: playerId, amount: Number(season?.season_ticket_amount || 0), paid: true, paid_on: new Date().toISOString().slice(0, 10) };
            if (existing?.[0]?.id) {
              const { error } = await sb.from("finance_season_tickets").update(payload).eq("id", existing[0].id);
              if (error) throw error;
            } else {
              const { error } = await sb.from("finance_season_tickets").insert(payload);
              if (error) throw error;
            }
          } else {
            const { data: games, error: gamesError } = await sb.from("games").select("id,game_date").order("game_date");
            if (gamesError) throw gamesError;
            const game = (games || []).find(g => new Date(g.game_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) === paymentFor);
            if (!game) throw new Error(`Game not found: ${paymentFor}`);

            const { data: rows, error: rowsError } = await sb.from("game_players").select("id,guest_name,players(name)").eq("game_id", game.id);
            if (rowsError) throw rowsError;
            const paymentRow = (rows || []).find(r => r.guest_name === name || r.players?.name === name);
            if (!paymentRow) throw new Error(`Payment row not found for ${name}`);

            const { error } = await sb.from("game_players").update({ paid: true }).eq("id", paymentRow.id);
            if (error) throw error;
          }

          row.remove();
        } catch (error) {
          input.checked = false;
          input.disabled = false;
          window.alert("Could not mark payment as paid: " + (error.message || "Unknown error"));
        }
      });

      label.append(input, text);
      cell.appendChild(label);
      row.appendChild(cell);
    });
  }

  function addStyles() {
    if (document.getElementById("finance-payment-ui-style")) return;
    const style = document.createElement("style");
    style.id = "finance-payment-ui-style";
    style.textContent = `
      .finance-paid-cell { width: 110px; min-width: 110px; }
      .finance-paid-control { display:inline-flex; align-items:center; gap:8px; min-height:36px; cursor:pointer; font-weight:700; white-space:nowrap; }
      .finance-paid-control input { appearance:auto; width:18px; height:18px; margin:0; accent-color:#159447; cursor:pointer; }
      .finance-paid-control input:disabled { cursor:wait; }
      @media (max-width:720px) {
        .finance-paid-cell { width:auto; min-width:0; }
        .finance-paid-control { gap:6px; font-size:12px; }
      }
    `;
    document.head.appendChild(style);
  }

  let scheduled = false;
  function apply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      await checkPermission();
      moveDueCardFirst();
      addStyles();
      addPaidColumn();
    });
  }

  new MutationObserver(apply).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  apply();
})();
