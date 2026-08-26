(() => {
  "use strict";

  function isGamesPage() {
    return document.querySelector('.nav-item.active[data-view="games"]');
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function googleCalendarUrl(date, start, end, location) {
    const [y, m, d] = date.split("-").map(Number);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startUtc = new Date(Date.UTC(y, m - 1, d, sh - 2, sm));
    const endUtc = new Date(Date.UTC(y, m - 1, d, eh - 2, em));
    const fmt = dt => dt.getUTCFullYear() + pad(dt.getUTCMonth() + 1) + pad(dt.getUTCDate()) + "T" + pad(dt.getUTCHours()) + pad(dt.getUTCMinutes()) + "00Z";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: "Football game",
      dates: fmt(startUtc) + "/" + fmt(endUtc),
      location: location || "Castellón"
    });
    return "https://calendar.google.com/calendar/render?" + params.toString();
  }

  function addLinks() {
    if (!isGamesPage()) return;
    document.querySelectorAll(".game-overview-card").forEach(card => {
      if (card.querySelector("[data-google-calendar]")) return;

      const game = card.__footballGame;
      if (!game) return;

      const actions = card.querySelector(".game-overview-actions") || card.querySelector(".game-actions");
      if (!actions) return;

      const link = document.createElement("a");
      link.className = "btn btn-secondary";
      link.href = googleCalendarUrl(game.date, game.startTime, game.endTime, game.location);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.dataset.googleCalendar = "true";
      link.textContent = "Add to Google Calendar";
      actions.appendChild(link);
    });
  }

  function patchCards() {
    if (!isGamesPage() || !window.state?.games) return;
    const cards = [...document.querySelectorAll(".game-overview-card")];
    const games = window.state.games || [];
    cards.forEach((card, index) => {
      if (!card.__footballGame) card.__footballGame = games[index] || null;
    });
    addLinks();
  }

  function schedule() {
    clearTimeout(window.__calendarTimer);
    window.__calendarTimer = setTimeout(patchCards, 50);
  }

  schedule();
  new MutationObserver(schedule).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
})();
