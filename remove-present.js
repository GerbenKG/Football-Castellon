(() => {
  "use strict";

  // Game Squad no longer tracks a separate "Present" state.
  // A player/guest in the squad is the recorded participation.
  const stripAttended = value => {
    if (Array.isArray(value)) return value.map(stripAttended);
    if (!value || typeof value !== "object") return value;
    const out = { ...value };
    delete out.attended;
    return out;
  };

  const sb = window.supabaseClient;
  if (sb && typeof sb.from === "function") {
    const originalFrom = sb.from.bind(sb);
    sb.from = table => {
      const builder = originalFrom(table);
      if (table !== "game_players") return builder;

      return new Proxy(builder, {
        get(target, prop, receiver) {
          if (prop === "insert" || prop === "upsert") {
            return value => Reflect.get(target, prop, receiver)(stripAttended(value));
          }
          if (prop === "then") {
            return (resolve, reject) => target.then(result => {
              if (result?.data && Array.isArray(result.data)) {
                result.data = result.data.map(row => ({ ...row, attended: true }));
              } else if (result?.data && typeof result.data === "object") {
                result.data = { ...result.data, attended: true };
              }
              return resolve ? resolve(result) : result;
            }, reject);
          }
          return Reflect.get(target, prop, receiver);
        }
      });
    };
  }

  const removePresentUi = () => {
    document.querySelectorAll("label.toggle").forEach(label => {
      if (/\bPresent\b/i.test(label.textContent || "")) label.remove();
    });

    document.querySelectorAll(".stat").forEach(stat => {
      const label = stat.querySelector("small");
      if (label && /^PRESENT$/i.test(label.textContent.trim())) stat.remove();
    });

    document.querySelectorAll(".game-overview-stats > div").forEach(item => {
      if (/^Present$/i.test(item.textContent.trim().replace(/\s+/g, " "))) item.remove();
    });
  };

  removePresentUi();
  new MutationObserver(removePresentUi).observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });
})();
