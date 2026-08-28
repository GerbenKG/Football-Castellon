(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  let access = null;
  let previewTarget = null;
  let initialized = false;
  let rendering = false;
  let badgeRefreshInFlight = false;

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
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  function getPreviewIdentity() {
    const banner = document.querySelector(".preview-banner");
    if (!banner) return null;
    const text = banner.querySelector(":scope > div")?.textContent?.trim() || "";
    const match = text.match(/^Preview mode\s*·\s*Viewing the site as (.+?)\s*\((.+)\)$/);
    if (!match) return null;
    return { name: match[1].trim(), role: match[2].trim() };
  }

  async function loadAccess() {
    const result = await sb.rpc("get_my_access");
    if (result.error) return null;
    access = result.data?.allowed ? result.data : null;
    return access;
  }

  async function loadPreviewTarget() {
    const identity = getPreviewIdentity();
    if (!identity) {
      previewTarget = null;
      return null;
    }

    const result = await sb.rpc("admin_list_access");
    if (result.error) throw result.error;

    const matches = (result.data || []).filter(member => {
      const memberName = String(member.display_name || member.name || member.player_name || "").trim().toLowerCase();
      const memberRole = String(member.role || "").trim().toLowerCase();
      return memberName === identity.name.toLowerCase() && memberRole === identity.role.toLowerCase();
    });

    previewTarget = matches.length === 1 ? { email: matches[0].email, ...identity } : null;
    return previewTarget;
  }

  const isMember = () => !!access?.profile?.active;
  const isPreview = () => !!previewTarget;

  function ensurePaymentBadge() {
    const item = document.querySelector('.nav [data-member-payments]');
    if (!item) return null;
    let badge = item.querySelector('.member-payments-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'member-payments-badge hidden';
      badge.setAttribute('aria-hidden', 'true');
      item.appendChild(badge);
    }
    return badge;
  }

  function updatePaymentBadge(openCount) {
    const badge = ensurePaymentBadge();
    if (!badge) return;
    const count = Math.max(0, Number(openCount) || 0);
    if (count > 0 && (isMember() || isPreview())) {
      badge.textContent = String(count);
      badge.classList.remove('hidden');
      badge.setAttribute('aria-label', `${count} open payment${count === 1 ? '' : 's'}`);
    } else {
      badge.textContent = '';
      badge.classList.add('hidden');
      badge.removeAttribute('aria-label');
    }
  }

  function setNavVisibility() {
    const item = document.querySelector('.nav [data-member-payments]');
    if (!item) return;
    item.style.display = isMember() || isPreview() ? "" : "none";
    ensurePaymentBadge();
  }

  function setActiveNav(active) {
    document.querySelectorAll('.nav .nav-item').forEach(item => {
      if (item.matches('[data-member-payments]')) item.classList.toggle("active", active);
      else if (active) item.classList.remove("active");
    });
  }

  async function loadHistory() {
    if (isPreview()) {
      const result = await sb.rpc("admin_preview_member_payment_history", { p_email: previewTarget.email });
      if (result.error) throw result.error;
      return result.data || { summary: {}, items: [] };
    }

    const result = await sb.rpc("member_payment_history");
    if (result.error) throw result.error;
    return result.data || { summary: {}, items: [] };
  }

  async function refreshPaymentBadge() {
    if ((!isMember() && !isPreview()) || badgeRefreshInFlight) return;
    badgeRefreshInFlight = true;
    try {
      const history = await loadHistory();
      updatePaymentBadge(history?.summary?.open || 0);
    } catch (error) {
      console.error("Could not load open payment count", error);
    } finally {
      badgeRefreshInFlight = false;
    }
  }

  function renderLoading() {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = '<section class="card member-payments-loading"><div class="eyebrow">PAYMENTS</div><h2>Loading payments…</h2><p class="muted">Retrieving your payment history.</p></section>';
    }
  }

  function render(history) {
    const app = document.getElementById("app");
    if (!app) return;

    const summary = history.summary || {};
    const items = Array.isArray(history.items) ? history.items : [];
    const total = Number(summary.total || 0);
    const paid = Number(summary.paid || 0);
    const open = Number(summary.open || 0);
    const outstanding = Number(summary.outstanding || 0);
    updatePaymentBadge(open);

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

    const previewNote = isPreview()
      ? `<div class="payment-preview-note">Preview mode: viewing ${esc(previewTarget.name)}'s payment history.</div>`
      : "";

    app.innerHTML = `
      <div class="member-payments-shell">
        <div class="page-head member-payments-head-page">
          <div>
            <div class="eyebrow">PAYMENTS</div>
            <h1 class="title">Payments</h1>
            <p class="muted">See your season tickets, game payments and any outstanding balance.</p>
            ${previewNote}
          </div>
        </div>
        <section class="card member-payment-card member-payment-page-card">
          <div class="member-payment-head">
            <div>
              <div class="eyebrow">PAYMENT HISTORY</div>
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
          <div class="payment-history-list">${rows}</div>
        </section>
      </div>`;
  }

  async function renderPage() {
    if ((!isMember() && !isPreview()) || rendering) return;
    rendering = true;
    try {
      renderLoading();
      setActiveNav(true);
      const history = await loadHistory();
      render(history);
    } catch (error) {
      const app = document.getElementById("app");
      if (app) {
        app.innerHTML = '<section class="card error-card member-payments-error"><div class="eyebrow">PAYMENTS</div><h2>Payments unavailable</h2><p>' + esc(error.message || "Could not load your payment history.") + '</p></section>';
      }
      console.error("Could not load member payment history", error);
    } finally {
      rendering = false;
    }
  }

  function isPaymentsRoute() {
    return window.location.hash === "#payments";
  }

  function openPayments(event) {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (!isMember() && !isPreview()) return;
    window.__memberView = "payments";
    setNavVisibility();
    setActiveNav(true);
    if (window.location.hash !== "#payments") history.pushState({ memberPayments: true }, "", "#payments");
    renderPage();
  }

  document.addEventListener("click", event => {
    const item = event.target.closest('.nav [data-member-payments]');
    if (item) openPayments(event);
  }, true);

  window.addEventListener("hashchange", () => {
    if (isPaymentsRoute()) renderPage();
  });

  async function init() {
    if (initialized) return;
    initialized = true;
    await loadAccess();
    await loadPreviewTarget();
    setNavVisibility();
    await refreshPaymentBadge();
    if (isPaymentsRoute()) await renderPage();

    const observer = new MutationObserver(async () => {
      setNavVisibility();
      const identity = getPreviewIdentity();
      const current = previewTarget ? `${previewTarget.name}|${previewTarget.role}` : "";
      const next = identity ? `${identity.name}|${identity.role}` : "";
      if (current !== next) {
        await loadPreviewTarget();
        await refreshPaymentBadge();
        if (isPaymentsRoute()) renderPage();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
