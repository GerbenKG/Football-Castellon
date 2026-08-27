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
    .profile-identity{min-width:0;flex:1}
    .profile-identity h2{margin:5px 0 8px;font-size:32px;line-height:1.15}
    .profile-identity .muted{margin:0;max-width:520px}
    .profile-upload{display:inline-flex;margin-top:18px;cursor:pointer}
    .profile-form{padding:28px 32px 32px}
    .profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 16px}
    .profile-field{display:flex;flex-direction:column;gap:7px;min-width:0;margin:0}
    .profile-field input{display:block;width:100%;height:46px;margin:0;padding:0 14px;border:1px solid #cbd8cf;border-radius:10px;background:#fff;color:#17301f;font-size:15px;font-weight:600;line-height:46px;outline:none;box-sizing:border-box}
    .profile-field input:focus{border-color:#16a34a;box-shadow:0 0 0 3px #16a34a18}
    .profile-field input:disabled{background:#f6f9f7;color:#52655b;opacity:1;cursor:not-allowed}
    .field-label{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#6b7b72;line-height:1.2}
    .readonly-field{min-width:0}
    .readonly-field strong{display:flex;align-items:center;height:46px;padding:0 14px;border:1px solid #dbe6df;border-radius:10px;background:#f8faf8;color:#08783f;font-size:20px;box-sizing:border-box}
    .profile-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:22px;padding-top:20px;border-top:1px solid #edf2ee}
    .profile-actions .btn{flex:none}
    .profile-actions .muted{margin:0}
    .profile-value{min-height:46px;display:flex;align-items:center;padding:0 14px;border:1px solid #dbe6df;border-radius:10px;background:#f8faf8;color:#17301f;font-size:15px;font-weight:600;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .profile-value-number{font-size:20px;color:#08783f}
    .player-profile-shell .page-head{display:flex;align-items:flex-end;justify-content:space-between}
    .player-profile-card{max-width:900px}
    .nav-item[data-player-profile],.nav-item[data-member-profile]{white-space:nowrap}
    @media (max-width:700px){
      .profile-hero{align-items:flex-start;padding:24px;gap:18px;flex-direction:column}
      .profile-card{border-radius:14px}
      .profile-form{padding:22px}
      .profile-grid{grid-template-columns:1fr}
      .profile-avatar{width:96px;height:96px}
      .profile-identity h2{font-size:25px}
    }
  `;
  document.head.appendChild(style);
})();
