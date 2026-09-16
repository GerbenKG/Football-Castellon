(() => {
  "use strict";

  const currentDate = new Date();
  const seasonStart = currentDate.getFullYear() + "-09-01";
  const seasonEnd = (currentDate.getFullYear() + 1) + "-08-31";
  const defaultName = currentDate.getFullYear() + "/" + String(currentDate.getFullYear() + 1).slice(-2);

  function esc(value) {
    return String(value ?? "").replace(/[&<>\"]/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;"
    }[c]));
  }

  function installEmptyFinanceAction() {
    const app = document.getElementById("app");
    if (!app) return;
    const heading = [...app.querySelectorAll("h2")].find(el => el.textContent.trim() === "No season configured");
    if (!heading || app.querySelector("[data-empty-finance-create]")) return;

    const card = heading.closest(".card");
    if (!card) return;

    const button = document.createElement("button");
    button.className = "btn btn-primary";
    button.type = "button";
    button.dataset.emptyFinanceCreate = "true";
    button.textContent = "+ Create first season";
    button.style.marginTop = "16px";
    button.addEventListener("click", openCreateSeason);
    card.appendChild(button);
  }

  function openCreateSeason() {
    const root = document.getElementById("modal-root");
    if (!root) return;

    root.innerHTML = `
      <div class="modal-bg">
        <div class="modal">
          <div class="modal-head">
            <h2>New season</h2>
            <button class="remove" type="button" data-empty-finance-close>×</button>
          </div>
          <form id="empty-finance-season-form">
            <label>Name<input name="name" required value="${esc(defaultName)}"></label>
            <div class="form-grid">
              <label>Starts<input name="starts_on" type="date" required value="${seasonStart}"></label>
              <label>Ends<input name="ends_on" type="date" required value="${seasonEnd}"></label>
            </div>
            <label>Season ticket amount<input name="season_ticket_amount" type="number" min="0" step="0.01" value="0"></label>
            <label>Pay per game amount<input name="pay_per_game_amount" type="number" min="0" step="0.01" value="0"></label>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-empty-finance-close>Cancel</button>
              <button class="btn btn-primary">Create season</button>
            </div>
            <p class="muted" id="empty-finance-error" style="margin-top:12px"></p>
          </form>
        </div>
      </div>`;

    root.querySelectorAll("[data-empty-finance-close]").forEach(button => {
      button.addEventListener("click", () => { root.innerHTML = ""; });
    });

    root.querySelector("#empty-finance-season-form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const start = String(data.get("starts_on") || "");
      const end = String(data.get("ends_on") || "");
      const error = root.querySelector("#empty-finance-error");

      if (end <= start) {
        error.textContent = "Season end must be after season start.";
        return;
      }

      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      submit.textContent = "Creating…";

      try {
        const result = await window.supabaseClient.from("finance_seasons").insert({
          name: String(data.get("name") || "").trim(),
          starts_on: start,
          ends_on: end,
          season_ticket_amount: Number(data.get("season_ticket_amount") || 0),
          pay_per_game_amount: Number(data.get("pay_per_game_amount") || 0)
        });
        if (result.error) throw result.error;
        root.innerHTML = "";
        window.location.reload();
      } catch (e) {
        submit.disabled = false;
        submit.textContent = "Create season";
        error.textContent = e?.message || "Could not create the season.";
      }
    });
  }

  const observer = new MutationObserver(installEmptyFinanceAction);
  observer.observe(document.body, { childList: true, subtree: true });
  installEmptyFinanceAction();
})();
