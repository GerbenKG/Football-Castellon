(() => {
  "use strict";

  // The Payments navigation item has accumulated a few legacy label/count
  // implementations over time. Keep exactly one visible label and let the
  // current red notification badge remain untouched.
  function isNotificationBadge(node) {
    if (!(node instanceof HTMLElement)) return false;

    const className = String(node.className || "").toLowerCase();
    if (/(^|[-_])(badge|notification|notify|unread)([-_]|$)/.test(className)) return true;

    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const bg = style.backgroundColor || "";
    const isRedBackground = /rgba?\(\s*(?:[12]\d{2}|[89]\d)\s*,\s*(?:[0-9]|[12]\d)\s*,\s*(?:[0-9]|[12]\d)\s*(?:,\s*1)?\s*\)/.test(bg);
    const rounded = style.borderRadius === "50%" || style.borderRadius === "999px";
    const compact = rect.width > 0 && rect.width <= 28 && rect.height > 0 && rect.height <= 28;
    const positioned = style.position === "absolute" || style.position === "fixed";

    return isRedBackground || (compact && rounded && positioned);
  }

  function cleanPaymentItem(item) {
    if (!item) return;

    // Remove numeric suffixes from direct text nodes, e.g. "Payments1" or a
    // separate text node containing only "1". This does not touch the badge.
    [...item.childNodes].forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const value = node.nodeValue || "";
      if (/^\s*\d+\s*$/.test(value)) {
        node.remove();
      } else if (/Payments\s*\d+\s*$/i.test(value)) {
        node.nodeValue = value.replace(/\s*\d+\s*$/i, "");
      }
    });

    // Some older versions wrapped the duplicate number in a span. Remove
    // those standalone numeric wrappers unless they are the current badge.
    [...item.querySelectorAll("span, strong, b, em")].forEach(node => {
      if (isNotificationBadge(node)) return;
      const text = (node.textContent || "").trim();
      if (/^\d+$/.test(text)) node.remove();

      if (/^Payments\s*\d+$/i.test(text)) {
        node.textContent = text.replace(/\s*\d+$/i, "");
      }
    });
  }

  function fixPaymentLabel() {
    document
      .querySelectorAll('.nav-item[data-view="finance"], .nav-item[data-view="payments"]')
      .forEach(cleanPaymentItem);
  }

  function start() {
    fixPaymentLabel();

    const nav = document.querySelector(".nav");
    if (nav) {
      new MutationObserver(fixPaymentLabel).observe(nav, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    window.addEventListener("hashchange", fixPaymentLabel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
