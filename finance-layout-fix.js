(() => {
  "use strict";

  function apply() {
    const heading = [...document.querySelectorAll("h3")].find(h => h.textContent.trim() === "Who still needs to pay?");
    const dueCard = heading?.closest(".card");
    if (!dueCard) return;

    const grid = dueCard.parentElement;
    if (!grid?.classList.contains("analytics-grid")) return;
    grid.classList.add("finance-payment-sections");

    const seasonHeading = [...grid.querySelectorAll("h3")].find(h => h.textContent.trim() === "Season ticket holders");
    const seasonCard = seasonHeading?.closest(".card");
    if (seasonCard && dueCard !== seasonCard && grid.firstElementChild !== dueCard) {
      grid.insertBefore(dueCard, seasonCard);
    }
  }

  function schedule() {
    clearTimeout(schedule.timer);
    schedule.timer = setTimeout(apply, 50);
  }

  const style = document.createElement("style");
  style.textContent = `
    .finance-payment-sections {
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:18px!important;
    }
    .finance-payment-sections > .card {
      width:100%;
      min-width:0;
    }
    .finance-payment-sections .card-title {
      margin-bottom:16px;
    }
    .finance-payment-sections h3 {
      font-size:20px;
    }
    .finance-payment-sections .table-card {
      border:1px solid #e1e9e3;
      border-radius:14px;
      overflow:hidden;
    }
  `;
  document.head.appendChild(style);

  new MutationObserver(schedule).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  schedule();
})();
