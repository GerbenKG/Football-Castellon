(() => {
  "use strict";

  const enhanceLogin = () => {
    const card = document.querySelector(".auth-card:not(.access-denied)");
    const button = document.getElementById("google-login");
    if (!card || !button || card.dataset.loginEnhanced === "true") return false;

    const loginHandler = button.onclick;
    const existingError = document.getElementById("auth-error");

    // Detach the login surface from the application shell before styling it.
    // This is important because legacy ancestors may have width/transform rules.
    if (card.parentElement !== document.body) {
      document.body.appendChild(card);
    }

    document.documentElement.classList.add("auth-page");
    document.body.classList.add("auth-screen-active");

    // Remove legacy inline geometry if the original auth renderer supplied any.
    card.removeAttribute("style");
    card.style.setProperty("position", "fixed", "important");
    card.style.setProperty("inset", "0", "important");
    card.style.setProperty("width", "100vw", "important");
    card.style.setProperty("height", "100vh", "important");
    card.style.setProperty("max-width", "none", "important");
    card.style.setProperty("margin", "0", "important");
    card.style.setProperty("padding", "0", "important");

    card.dataset.loginEnhanced = "true";
    card.innerHTML = `
      <section class="auth-visual" aria-hidden="true">
        <div class="auth-visual-overlay"></div>
        <div class="auth-visual-copy">
          <div class="auth-brand-mark">⚽</div>
          <div class="auth-visual-kicker">CASTELLÓN · FOOTBALL HUB</div>
          <h2>Football</h2>
          <div class="auth-visual-rule"></div>
          <p>Manage. Organize. Win together.</p>
          <span>Your team, your games, your community.</span>
        </div>
      </section>

      <section class="auth-content">
        <div class="auth-content-inner">
          <div class="auth-logo ball-logo">⚽</div>
          <div class="eyebrow">PLAYER ACCESS</div>
          <h1>Welcome back</h1>
          <p class="muted">Sign in with your account to continue.</p>

          <button id="google-login" class="btn btn-primary auth-google" type="button">
            <span class="google-mark">G</span>
            <span>Continue with Google</span>
          </button>
          <p id="auth-error" class="auth-error" role="alert"></p>

          <div class="auth-benefits" aria-label="Access benefits">
            <div class="auth-benefit">
              <span class="benefit-icon">✓</span>
              <strong>Secure</strong>
              <span>Protected access</span>
            </div>
            <div class="auth-benefit">
              <span class="benefit-icon">♙</span>
              <strong>Organized</strong>
              <span>Your games and team in one place</span>
            </div>
            <div class="auth-benefit">
              <span class="benefit-icon">♜</span>
              <strong>Focused</strong>
              <span>Everything ready for matchday</span>
            </div>
          </div>

          <footer class="auth-footer">
            <span>Castellón Football Hub</span>
            <span>© 2026 All rights reserved.</span>
          </footer>
        </div>
      </section>
    `;

    const newButton = document.getElementById("google-login");
    if (newButton && loginHandler) newButton.onclick = loginHandler;

    if (existingError?.textContent) {
      const newError = document.getElementById("auth-error");
      if (newError) newError.textContent = existingError.textContent;
    }

    return true;
  };

  if (enhanceLogin()) return;

  const observer = new MutationObserver(() => {
    if (enhanceLogin()) observer.disconnect();
  });
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
})();
