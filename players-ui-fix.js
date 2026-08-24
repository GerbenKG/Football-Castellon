(() => {
  "use strict";

  function isPlayersPage() {
    const title = document.querySelector(".page-head .title");
    return !!title && title.textContent.trim() === "Players";
  }

  function removeFinanceColumns() {
    if (!isPlayersPage()) return;
    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table) return;

    const headers = [...table.querySelectorAll("thead th")];
    const financeIndexes = headers
      .map((th, index) => ({ text: th.textContent.trim().toLowerCase(), index }))
      .filter(x => x.text === "payment model" || x.text === "season ticket")
      .map(x => x.index)
      .sort((a, b) => b - a);

    financeIndexes.forEach(index => {
      headers[index]?.remove();
      table.querySelectorAll("tbody tr").forEach(row => row.querySelectorAll("td")[index]?.remove());
    });
  }

  function cleanPlayersHeading() {
    if (!isPlayersPage()) return;
    const subtitle = document.querySelector(".page-head .title")?.parentElement?.querySelector(".muted");
    if (subtitle && /payment model|season-ticket status/i.test(subtitle.textContent)) {
      subtitle.textContent = "Roster and attendance history.";
    }
  }

  function addPlayerCount() {
    if (!isPlayersPage()) return;
    const table = document.querySelector(".page-head ~ .card table") || document.querySelector("table");
    if (!table) return;

    const count = table.querySelectorAll("tbody tr").length;
    let badge = document.querySelector(".page-head .players-count");
    if (!badge) {
      const title = document.querySelector(".page-head .title");
      badge = document.createElement("span");
      badge.className = "players-count";
      title.insertAdjacentElement("afterend", badge);
    }

    const nextText = `${count} ${count === 1 ? "player" : "players"}`;
    if (badge.textContent !== nextText) badge.textContent = nextText;
  }

  // The Players page no longer owns finance settings. The underlying player
  // record still needs its existing finance values preserved when a player is
  // edited, so keep them as hidden form values while removing them visually.
  function removeFinanceFieldsFromPlayerModal() {
    const form = document.getElementById("player-form");
    if (!form) return;

    if (form.dataset.financePreserved !== "1") {
      const model = form.querySelector('[name="model"]');
      const seasonPaid = form.querySelector('[name="seasonPaid"]');

      if (model) {
        const hiddenModel = document.createElement("input");
        hiddenModel.type = "hidden";
        hiddenModel.name = "model";
        hiddenModel.value = model.value || "game";
        form.appendChild(hiddenModel);
      }

      // Only add the hidden payment flag when it was actually checked. This
      // preserves the existing value without turning an unpaid ticket into paid.
      if (seasonPaid?.checked) {
        const hiddenPaid = document.createElement("input");
        hiddenPaid.type = "hidden";
        hiddenPaid.name = "seasonPaid";
        hiddenPaid.value = "on";
        form.appendChild(hiddenPaid);
      }

      form.dataset.financePreserved = "1";
    }

    [...form.querySelectorAll("label")].forEach(label => {
      const text = label.textContent.trim().toLowerCase();
      if (text.startsWith("payment model") || text.startsWith("season ticket paid")) {
        label.remove();
      }
    });
  }

  function ensureMobileNavVisible() {
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    const nav = document.querySelector(".nav");
    if (!nav) return;
    nav.style.setProperty("display", "flex", "important");
    nav.style.setProperty("position", "fixed", "important");
    nav.style.setProperty("left", "10px", "important");
    nav.style.setProperty("right", "10px", "important");
    nav.style.setProperty("bottom", "calc(10px + env(safe-area-inset-bottom))", "important");
    nav.style.setProperty("width", "auto", "important");
    nav.style.setProperty("margin", "0", "important");
    nav.style.setProperty("z-index", "1000", "important");
  }

  function apply() {
    removeFinanceColumns();
    cleanPlayersHeading();
    addPlayerCount();
    removeFinanceFieldsFromPlayerModal();
    ensureMobileNavVisible();
  }

  apply();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", apply);
})();
