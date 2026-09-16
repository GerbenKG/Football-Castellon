(() => {
"use strict";

function parseMoney(text) {
  const value = String(text || "").replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(value);
}

function fixProjectedEndBalance() {
  const stats = [...document.querySelectorAll(".finance-stats .stat")];
  if (stats.length < 4) return;

  const current = parseMoney(stats[0].querySelector("strong")?.textContent);
  const expected = parseMoney(stats[1].querySelector("strong")?.textContent);
  const futureCosts = parseMoney(stats[2].querySelector("strong")?.textContent);
  const projected = current + expected - futureCosts;

  const target = stats[3].querySelector("strong");
  if (target) target.textContent = formatMoney(projected);

  const outlook = [...document.querySelectorAll(".finance-outlook > div")].find((el) =>
    el.querySelector("span")?.textContent.trim() === "Projected end balance"
  );
  const outlookValue = outlook?.querySelector("b");
  if (outlookValue) outlookValue.textContent = formatMoney(projected);
}

const observer = new MutationObserver(fixProjectedEndBalance);
observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
fixProjectedEndBalance();
})();
