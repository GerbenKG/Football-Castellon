(() => {
  "use strict";

  const STORAGE_KEY = "fc_pwa_install_status_v1";
  const LATER_KEY = "fc_pwa_install_later_until";
  const MOBILE_QUERY = "(max-width: 760px)";
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;

  let deferredPrompt = null;
  let banner;
  let help;
  let installButton;
  let confirmButton;
  let laterButton;

  const read = key => {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  };
  const write = (key, value) => {
    try { window.localStorage.setItem(key, value); } catch (_) {}
  };
  const remove = key => {
    try { window.localStorage.removeItem(key); } catch (_) {}
  };
  const permanentlyInstalled = () => read(STORAGE_KEY) === "installed";

  function markInstalled() {
    write(STORAGE_KEY, "installed");
    remove(LATER_KEY);
    if (banner) banner.hidden = true;
  }

  function shouldShow() {
    if (!isMobile() || isStandalone() || permanentlyInstalled()) return false;
    const laterUntil = Number(read(LATER_KEY) || 0);
    return !laterUntil || Date.now() >= laterUntil;
  }

  function render() {
    if (!banner) return;
    banner.hidden = !shouldShow();
    if (installButton) {
      installButton.textContent = deferredPrompt ? "Install app" : "How to install";
    }
  }

  function createBanner() {
    banner = document.createElement("section");
    banner.className = "pwa-install-banner";
    banner.setAttribute("aria-label", "Install FC Castellón");
    banner.hidden = true;
    banner.innerHTML = `
      <div class="pwa-install-copy">
        <strong>Add FC Castellón to your home screen</strong>
        <p>Open the clubhouse quickly, just like an app.</p>
      </div>
      <div class="pwa-install-actions">
        <button type="button" class="pwa-install-primary" data-pwa-install>Install app</button>
        <button type="button" class="pwa-install-secondary" data-pwa-confirm>I've installed it</button>
        <button type="button" class="pwa-install-later" data-pwa-later>Later</button>
      </div>
      <div class="pwa-install-help" data-pwa-help hidden></div>
    `;
    document.body.appendChild(banner);
    help = banner.querySelector("[data-pwa-help]");
    installButton = banner.querySelector("[data-pwa-install]");
    confirmButton = banner.querySelector("[data-pwa-confirm]");
    laterButton = banner.querySelector("[data-pwa-later]");

    installButton.addEventListener("click", installOrExplain);
    confirmButton.addEventListener("click", markInstalled);
    laterButton.addEventListener("click", () => {
      write(LATER_KEY, String(Date.now() + 14 * 24 * 60 * 60 * 1000));
      banner.hidden = true;
    });
  }

  function showInstructions() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      help.innerHTML = `
        <strong>Install on iPhone or iPad</strong>
        <ol>
          <li>Open this page in <strong>Safari</strong>.</li>
          <li>Tap the <strong>Share</strong> button.</li>
          <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong> to confirm.</li>
        </ol>
        When the FC Castellón icon appears on your home screen, tap “I've installed it”.
      `;
    } else {
      help.innerHTML = `
        <strong>Install on your phone</strong>
        <ol>
          <li>Open the browser menu (usually <strong>⋮</strong>).</li>
          <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <li>Confirm the installation.</li>
        </ol>
        When the FC Castellón icon appears on your home screen, tap “I've installed it”.
      `;
    }
    help.hidden = false;
  }

  async function installOrExplain() {
    if (!deferredPrompt) {
      showInstructions();
      return;
    }
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice && choice.outcome === "accepted") {
        // appinstalled will normally confirm this; keep the explicit confirmation
        // available until the browser reports installation.
        installButton.textContent = "Installing…";
        installButton.disabled = true;
      } else {
        render();
      }
    } catch (_) {
      showInstructions();
    }
  }

  function init() {
    if (isStandalone()) markInstalled();
    createBanner();
    render();

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredPrompt = event;
      render();
    });
    window.addEventListener("appinstalled", markInstalled);
    window.matchMedia(MOBILE_QUERY).addEventListener?.("change", render);

    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
