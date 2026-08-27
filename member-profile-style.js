(() => {
  "use strict";
  const style = document.createElement("style");
  style.textContent = `
    .profile-shell{max-width:980px;margin:0 auto}
    .profile-head{margin-bottom:24px}
    .profile-card{padding:0;overflow:hidden}
    .profile-hero{display:flex;align-items:center;gap:28px;padding:32px;background:linear-gradient(135deg,#f7fbf8 0%,#ffffff 70%);border-bottom:1px solid #e2ebe5}
    .profile-avatar-wrap{flex:0 0 auto}
    .profile-avatar{width:132px;height:132px;border-radius:50%;object-fit:cover;display:block;border:5px solid #fff;box-shadow:0 8px 26px rgba(17,48,31,.14)}
    .profile-avatar-fallback{display:flex;align-items:center;justify-content:center;background:#dff4e7;color:#08783f;font-size:46px;font-weight:800}
    .profile-identity{min-width:0}
    .profile-identity h2{margin:5px 0 8px;font-size:32px;line-height:1.15}
    .profile-identity .muted{margin:0;max-width:520px}
    .profile-upload{margin-top:18px;cursor:pointer}
    .profile-form{padding:28px 32px 32px}
    .profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .profile-field{display:flex;flex-direction:column;gap:7px;min-width:0}
    .field-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#6b7b72}
    .profile-value{min-height:46px;display:flex;align-items:center;padding:0 14px;border:1px solid #dbe6df;border-radius:10px;background:#f8faf8;color:#17301f;font-size:15px;font-weight:600;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .profile-value-number{font-size:20px;color:#08783f}
    .player-profile-shell .page-head{display:flex;align-items:flex-end;justify-content:space-between}
    .player-profile-card{max-width:900px}
    .nav-item[data-player-profile],.nav-item[data-member-profile]{white-space:nowrap}
    @media (max-width:700px){
      .profile-hero{align-items:flex-start;padding:24px;gap:18px}
      .profile-card{border-radius:14px}
      .profile-form{padding:22px}
      .profile-grid{grid-template-columns:1fr}
      .profile-avatar{width:96px;height:96px}
      .profile-identity h2{font-size:25px}
    }
  `;
  document.head.appendChild(style);
})();
