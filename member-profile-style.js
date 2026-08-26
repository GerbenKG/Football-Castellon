(() => {
  "use strict";
  const style = document.createElement("style");
  style.textContent = `
    .profile-shell{max-width:900px;margin:0 auto}
    .profile-head{margin-bottom:28px}
    .profile-card{padding:32px}
    .profile-hero{display:flex;align-items:center;gap:28px;padding-bottom:28px;border-bottom:1px solid rgba(18,49,32,.10)}
    .profile-avatar-wrap{flex:0 0 auto}
    .profile-avatar{width:128px;height:128px;border-radius:50%;object-fit:cover;display:block;box-shadow:0 10px 30px rgba(0,0,0,.08)}
    .profile-avatar-fallback{display:flex;align-items:center;justify-content:center;background:#dff4e7;color:#08783f;font-size:46px;font-weight:800}
    .profile-identity h2{margin:4px 0 8px;font-size:30px}
    .profile-upload{margin-top:14px}
    .profile-form{padding-top:28px}
    .profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .profile-field{display:flex;flex-direction:column;gap:8px}
    .field-label{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#6b7b72}
    .profile-field input{width:100%;box-sizing:border-box}
    .profile-field input:disabled{background:#f4f6f4;color:#65716b;cursor:not-allowed}
    .readonly-field{min-height:72px;padding:14px 16px;border:1px solid #dbe6df;border-radius:12px;background:#f4f8f5;box-sizing:border-box}
    .readonly-field strong{font-size:20px;color:#17301f}
    .profile-actions{display:flex;justify-content:flex-end;margin-top:24px}
    .nav-item[data-member-profile]{white-space:nowrap}
    @media (max-width:700px){
      .profile-card{padding:22px}
      .profile-hero{align-items:flex-start;gap:18px}
      .profile-grid{grid-template-columns:1fr}
      .profile-avatar{width:96px;height:96px}
      .profile-identity h2{font-size:24px}
    }
  `;
  document.head.appendChild(style);
})();
