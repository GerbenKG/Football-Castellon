(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));

  const money = value => {
    if (value === null || value === undefined || value === "") return "—";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(amount);
  };

  const date = value => {
    if (!value) return "—";
    const d = new Date(String(value) + "T12:00:00");
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  function previewEmail() {
    const banner = document.querySelector(".preview-banner");
    if (!banner) return null;
    const text = banner.querySelector(":scope > div")?.textContent?.trim() || "";
    const match = text.match(/^Preview mode\s*·\s*Viewing the site as (.+?)\s*\((.+)\)$/);
    if (!match) return null;
    return match[1].trim();
  }

  async function loadHistory() {
    const email = previewEmail();
    if (email) {
      const result = await sb.rpc("admin_preview_member_payment_history", { p_email: email });
      if (result.error) throw result.error;
      return result.data || { summary: {}, items: [] };
    }

    const result = await sb.rpc("member_payment_history");
    if (result.error) throw result.error;
    return result.data || { summary: {}, items: [] };
  }

  function render(history) {
    const profileCard = document.querySelector(".profile-card");
    if (!profileCard || document.querySelector(".member-payment-card")) return;

    const summary = history.summary || {};
    const items = Array.isArray(history.items) ? history.items : [];
    const total = Number(summary.total || 0);
    const paid = Number(summary.paid || 0);
    const open = Number(summary.open || 0);
    const outstanding = Number(summary.outstanding || 0);

    const card = document.createElement("section");
    card.className = "card member-payment-card";

    const summaryClass = open > 0 ? "has-open" : "all-paid";
    const summaryText = open > 0
      ? `${open} payment${open === 1 ? "" : "s"} still open`
      : total > 0 ? "All payments are paid" : "No payments recorded yet";

    const rows = items.length
      ? items.map(item => `
          <div class="payment-history-row">
            <div class="payment-history-main">
              <div class="payment-history-icon ${item.type === "season" ? "season" : "game"}">${item.type === "season" ? "S" : "⚽"}</div>
              <div class="payment-history-details">
                <strong>${esc(item.label)}</strong>
                <span>${date(item.date)}${item.paid_on ? ` · Paid ${date(item.paid_on)}` : ""}</span>
              </div>
            </div>
            <div class="payment-history-amount">${money(item.amount)}</div>
            <span class="payment-status ${item.paid ? "paid" : "open"}">${item.paid ? "Paid" : "Open"}</span>
          </div>`).join("")
      : '<div class="payment-history-empty"><strong>No payment history yet</strong><span>Payments will appear here once a season ticket or game payment is recorded.</span></div>';

    card.innerHTML = `
      <div class="member-payment-head">
        <div>
          <div class="eyebrow">PAYMENTS</div>
          <h2>Payment history</h2>
          <p class="muted">A clear overview of your season tickets and game payments.</p>
        </div>
        <div class="payment-summary ${summaryClass}">
          <strong>${esc(summaryText)}</strong>
          ${open > 0 ? `<span>${money(outstanding)} outstanding</span>` : total > 0 ? `<span>${paid} of ${total} paid</span>` : ""}
        </div>
      </div>
      <div class="payment-history-summary">
        <div><span>Total</span><strong>${total}</strong></div>
        <div><span>Paid</span><strong>${paid}</strong></div>
        <div><span>Open</span><strong>${open}</strong></div>
        <div><span>Outstanding</span><strong>${money(outstanding)}</strong></div>
      </div>
      <div class="payment-history-list">${rows}</div>`;

    profileCard.insertAdjacentElement("afterend", card);
  }

  async function mount() {
    if (!document.querySelector(".profile-card") || document.querySelector(".member-payment-card")) return;
    try {
      const history = await loadHistory();
      render(history);
    } catch (error) {
      const profileCard = document.querySelector(".profile-card");
      if (!profileCard || document.querySelector(".member-payment-card")) return;
      const card = document.createElement("section");
      card.className = "card member-payment-card payment-error";
      card.innerHTML = '<div><div class="eyebrow">PAYMENTS</div><h2>Payment history</h2><p class="muted">Payment history could not be loaded right now.</p></div>';
      profileCard.insertAdjacentElement("afterend", card);
      console.error("Could not load member payment history", error);
    }
  }

  const observer = new MutationObserver(() => mount());
  observer.observe(document.body, { childList: true, subtree: true });
  mount();
})();
