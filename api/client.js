(() => {
  "use strict";

  let csrfTokenPromise = null;

  async function request(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      if (!csrfTokenPromise) {
        csrfTokenPromise = fetch("/api/auth/csrf.php", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        })
          .then(async response => {
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.error || `CSRF request failed (${response.status})`);
            return data.csrf_token;
          })
          .catch(error => {
            csrfTokenPromise = null;
            throw error;
          });
      }
      headers["X-CSRF-Token"] = await csrfTokenPromise;
    }

    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers,
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error || `Request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      if (response.status === 401 || response.status === 403) csrfTokenPromise = null;
      throw error;
    }

    return data;
  }

  window.api = {
    request,
    get: path => request(path),
    post: (path, body) => request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
})();
