(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let canManagePayments = false;
  let permissionLoaded = false;
  let busy = false;
  let observerTimer = null;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;"
  }[c]));

  function dateText(date) {
    return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }

  async function loadPermission() {
    if (permissionLoaded) return canManagePayments;
    permissionLoaded = true;
    try {
      const result = await sb.rpc("get_my_access");
      canManagePayments = result.data?.allowed === true && result.data?.permissions?.["payments.manage"] === true;
    } catch (error) {
      console.warn("[Football] Could not check finance payment permission", error);
      canManagePayments = false;
    }
    return canManagePayments;
  }

  function financeDueTable() {
    const heading = [...document.querySelectorAll("h3")].find(h => h.textContent.trim() === "Who still needs to pay?");
    return heading?.closest(".card")?.querySelector("table") || null;
  }

  function addStyles() {
    if (document.getElementById("finance-due-payment-actions-style")) return;
    const style = document.createElement("style");
    style.id = "finance-due-payment-actions-style";
    style.textContent = `
      .finance-due-paid { display:inline-flex; align-items:center; gap:7px; font-size:13px; white-space:nowrap; cursor:pointer; }
      .finance-due-paid input { width:16px; height:16px; margin:0; cursor:pointer; }
      .finance-due-paid.is-busy { opacity:.55; pointer-events:none; }
      .finance-due-paid .label { font-weight:600; }
      .finance-due-enhancing { visibility:hidden; }
    `;
    document.head.appendChild(style);
  }

  async function findPlayerId(name) {
    const { data, error } = await sb.from("players").select("id").eq("name", name).limit(1);
    if (error) throw error;
    return data?.[0]?.id || null;
  }

  async function markSeasonTicketPaid(name) {
    const seasonId = document.getElementById("finance-season-select")?.value;
    if (!seasonId) throw new Error("No finance season is selected.");

    const playerId = await findPlayerId(name);
    if (!playerId) throw new Error("Player could not be found: " + name);

    const { data: season, error: seasonError } = await sb
      .from("finance_seasons")
      .select("season_ticket_amount")
      .eq("id", seasonId)
      .single();
    if (seasonError) throw seasonError;

    const { data: existing, error: existingError } = await sb
      .from("finance_season_tickets")
      .select("id")
      .eq("season_id", seasonId)
      .eq("player_id", playerId)
      .limit(1);
    if (existingError) throw existingError;

    const payload = {
      season_id: seasonId,
      player_id: playerId,
      amount: Number(season?.season_ticket_amount || 0),
      paid: true,
      paid_on: new Date().toISOString().slice(0, 10)
    };

    if (existing?.[0]?.id) {
      const { error } = await sb.from("finance_season_tickets").update(payload).eq("id", existing[0].id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("finance_season_tickets").insert(payload);
      if (error) throw error;
    }
  }

  async function findGameByLabel(label) {
    const { data, error } = await sb.from("games").select("id,game_date").order("game_date");
    if (error) throw error;
    return (data || []).find(game => dateText(game.game_date) === label) || null;
  }

  async function markGamePaid(name, gameLabel) {
    const targetGame = await findGameByLabel(gameLabel);
    if (!targetGame) throw new Error("Game could not be found: " + gameLabel);

    const { data: rows, error } = await sb
      .from("game_players")
      .select("id,player_id,guest_name,players(name)")
      .eq("game_id", targetGame.id);
    if (error) throw error;

    const row = (rows || []).find(item => item.guest_name === name || item.players?.name === name);
    if (!row) throw new Error("Game-squad payment record could not be found for " + name);

    const { error: updateError } = await sb
      .from("game_players")
      .update({ paid: true })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }

  async function markPaid(label) {
    if (busy) return;
    const row = label.closest("tr");
    const cells = row?.querySelectorAll("td");
    if (!cells || cells.length < 2) return;

    const name = cells[0].textContent.trim();
    const forLabel = cells[1].textContent.trim();
    busy = true;
    label.classList.add("is-busy");
    label.querySelector(".label")?.replaceChildren(document.createTextNode("Saving…"));

    try {
      if (forLabel === "Season ticket" || forLabel.startsWith("Season ticket")) await markSeasonTicketPaid(name);
      else await markGamePaid(name, forLabel);
      row.remove();
    } catch (error) {
      console.warn("[Football] Could not mark finance payment as paid", error);
      label.querySelector(".label")?.replaceChildren(document.createTextNode("Paid"));
      const checkbox = label.querySelector("input");
      if (checkbox) checkbox.checked = false;
      window.alert("Could not mark payment as paid: " + (error.message || "Unknown error"));
    } finally {
      busy = false;
      label.classList.remove("is-busy");
    }
  }

  function enhanceTable() {
    if (!canManagePayments) return;
    const table = financeDueTable();
    if (!table || table.dataset.financeDueEnhanced === "true") return;
    addStyles();
    table.classList.add("finance-due-enhancing");

    const headRow = table.tHead?.rows?.[0];
    if (headRow && !headRow.querySelector("[data-finance-due-actions]")) {
      const th = document.createElement("th");
      th.dataset.financeDueActions = "true";
      th.textContent = "Paid";
      headRow.appendChild(th);
    }

    table.tBodies?.[0]?.querySelectorAll("tr").forEach(row => {
      if (row.querySelector("[data-finance-due-paid]")) return;
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return;

      const actionCell = document.createElement("td");
      const label = document.createElement("label");
      label.className = "finance-due-paid";
      label.dataset.financeDuePaid = "true";
      label.title = "Mark this outstanding payment as paid";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", "Mark payment as paid");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) markPaid(label);
      });

      const text = document.createElement("span");
      text.className = "label";
      text.textContent = "Paid";
      label.append(checkbox, text);
      actionCell.appendChild(label);
      row.appendChild(actionCell);
    });

    table.dataset.financeDueEnhanced = "true";
    table.classList.remove("finance-due-enhancing");
  }

  function schedule() {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(async () => {
      await loadPermission();
      enhanceTable();
    }, 250);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });

  loadPermission().then(enhanceTable);
})();
