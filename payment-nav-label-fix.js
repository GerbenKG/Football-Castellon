(() => {
  "use strict";

  function fixPaymentLabel() {
    const item = document.querySelector('.nav-item[data-view="finance"], .nav-item[data-view="payments"]');
    if (!item) return;

    // Keep the notification badge element/pseudo-element intact. Only remove
    // an accidental numeric suffix that was appended to the visible label.
    item.childNodes.forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const value = node.nodeValue || "";
      if (/Payments\s*\d+\s*$/.test(value)) {
        node.nodeValue = value.replace(/\s*\d+\s*$/, "");
      }
    });

    // If the label is wrapped in its own element, handle that case as well.
    item.querySelectorAll("span, strong, b").forEach(node => {
      if (node.children.length || node.querySelector("span")) return;
      const value = node.textContent || "";
      if (/^Payments\s*\d+$/.test(value.trim())) {
        node.textContent = value.replace(/\s*\d+\s*$/, "");
      }
    });
  }

  fixPaymentLabel();

  const app = document.getElementById("app");
  if (app) {
    const observer = new MutationObserver(() => fixPaymentLabel());
    observer.observe(app, { childList: true, subtree: true });
  }

  window.addEventListener("hashchange", fixPaymentLabel);
})();
