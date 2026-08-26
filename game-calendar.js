(() => {
  "use strict";

  function isGamesPage() {
    return !!document.querySelector('.nav-item.active[data-view="games"]');
  }

  const pad = value => String(value).padStart(2, "0");

  function parseCard(card) {
    const heading = card.querySelector(".game-overview-date h3");
    const details = card.querySelector(".game-overview-date p");
    if (!heading || !details) return null;

    const dateMatch = heading.textContent.trim().match(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\s+([A-Za-z]+)/i);
    const timeMatch = details.textContent.match(/(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})\s*[·•]\s*(.+)$/);
    if (!dateMatch || !timeMatch) return null;

    const months = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
    const month = months[dateMatch[2].toLowerCase()];
    if (month === undefined) return null;

    const year = month >= 8 ? 2026 : 2027;
    return {
      date: `${year}-${pad(month + 1)}-${pad(Number(dateMatch[1]))}`,
      start: timeMatch[1],
      end: timeMatch[2],
      location: timeMatch[3].trim()
    };
  }

  function googleCalendarUrl(game) {
    const [y,m,d] = game.date.split("-").map(Number);
    const start = game.start.replace(":", "") + "00";
    const end = game.end.replace(":", "") + "00";
    const dates = `${y}${pad(m)}${pad(d)}T${start}/${y}${pad(m)}${pad(d)}T${end}`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: "Football game",
      dates,
      location: game.location || "Castellón"
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function addLinks() {
    if (!isGamesPage()) return;
    document.querySelectorAll(".game-overview-card").forEach(card => {
      if (card.querySelector("[data-google-calendar]")) return;
      const game = parseCard(card);
      if (!game) return;

      let actions = card.querySelector(".game-overview-actions") || card.querySelector(".game-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "game-overview-actions";
        actions.style.display = "flex";
        actions.style.gap = "8px";
        actions.style.marginTop = "12px";
        card.appendChild(actions);
      }

      const link = document.createElement("a");
      link.className = "btn btn-secondary";
      link.href = googleCalendarUrl(game);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.dataset.googleCalendar = "true";
      link.textContent = "Add to Google Calendar";
      actions.appendChild(link);
    });
  }

  function schedule() {
    clearTimeout(window.__googleCalendarTimer);
    window.__googleCalendarTimer = setTimeout(addLinks, 50);
  }

  schedule();
  const app = document.getElementById("app");
  if (app) new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
})();
