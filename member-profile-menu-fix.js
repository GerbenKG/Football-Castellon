(() => {
  "use strict";

  document.addEventListener("click", event => {
    const action = event.target.closest('#member-user-menu [data-user-action="profile"]');
    if (!action) return;

    const existing = document.querySelector("[data-member-profile], [data-player-profile]");
    if (existing) return;

    const nav = document.querySelector(".nav") || document.body;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "nav-item";
    trigger.dataset.memberProfile = "true";
    trigger.style.display = "none";
    nav.appendChild(trigger);
    trigger.click();
    setTimeout(() => trigger.remove(), 0);
  }, true);
})();
