(() => {
  "use strict";

  /*
   * Payments navigation cleanup.
   *
   * There have been several generations of the Payments counter. Some of
   * them appended the open-payment count directly to the label, producing
   * "Payments1" while the current UI also renders the red notification
   * badge. The label must be independent from the badge.
   */

  const isBadgeElement = node => {
    if (!(node instanceof HTMLElement)) return false;

    const classes = String(node.className || "").toLowerCase();
    if (/(^|[-_])(badge|notification|notify|unread)([-_]|$)/.test(classes)) return true;
    if (/payment.*(count|badge)|open.*(count|badge)/.test(classes)) return true;
    if (node.hasAttribute("data-payment-count") || node.hasAttribute("data-open-count")) return true;

    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const bg = style.backgroundColor || "";
    const red = /^rgba?\(\s*(?:1[4-9]\d|2\d\d)\s*,\s*(?:0|[1-5]?\d)\s*,\s*(?:0|[1-5]?\d)\s*(?:,\s*1)?\s*\)$/i.test(bg);
    const circle = style.borderRadius === "50%" || style.borderRadius === "999px";
    const compact = rect.width > 0 && rect.width <= 30 && rect.height > 0 && rect.height <= 30;
    const positioned = style.position === "absolute" || style.position === "fixed";
    return red && circle && compact && positioned;
  };

  function normalizePaymentItem(item) {
    if (!item) return;

    // Preserve an actual badge element if a legacy implementation created
    // one. The current red badge is normally a pseudo-element, so there is
    // nothing to preserve in that case.
    const badgeChildren = [...item.children].filter(isBadgeElement);

    // Rebuild the label from scratch. This is intentionally stronger than
    // regex-cleaning text nodes: it removes every legacy "1" regardless of
    // whether it was a text node, span, strong, b, or another wrapper.
    item.querySelectorAll("script,style").forEach(node => node.remove());
    item.replaceChildren();

    const label = document.createElement("span");
    label.className = "payment-nav-label";
    label.textContent = "Payments";
    item.appendChild(label);

    badgeChildren.forEach(badge => item.appendChild(badge));
  }

  function normalizeAll() {
    document
      .querySelectorAll('.nav-item[data-view="finance"], .nav-item[data-view="payments"]')
      .forEach(normalizePaymentItem);
  }

  function start() {
    normalizeAll();

    // The application can rerender/replace the navigation after login,
    // access resolution, or a hash navigation. Watch the whole body so a
    // newly-created Payments button is normalized as well.
    const observer = new MutationObserver(() => {
      observer.disconnect();
      try {
        normalizeAll();
      } finally {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener("hashchange", normalizeAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
