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

    .member-payment-card{padding:0;overflow:hidden;margin-top:20px}
    .member-payment-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:26px 30px 22px;border-bottom:1px solid #e6eee8}
    .member-payment-head h2{margin:4px 0 6px;font-size:24px;line-height:1.2}
    .member-payment-head p{margin:0}
    .payment-summary{flex:0 0 auto;min-width:190px;padding:12px 14px;border-radius:12px;border:1px solid #d8e5dc;background:#f5f9f6;text-align:right}
    .payment-summary strong,.payment-summary span{display:block}
    .payment-summary strong{font-size:14px;color:#17301f}
    .payment-summary span{margin-top:3px;font-size:12px;color:#687970}
    .payment-summary.all-paid{background:#eaf9ef;border-color:#c9ecd5}
    .payment-summary.all-paid strong{color:#08783f}
    .payment-summary.has-open{background:#fff8e8;border-color:#f0dca8}
    .payment-summary.has-open strong{color:#946300}
    .payment-history-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e8eee9;border-bottom:1px solid #e8eee9}
    .payment-history-summary>div{padding:15px 20px;background:#fbfdfb}
    .payment-history-summary span{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#75837b}
    .payment-history-summary strong{display:block;margin-top:4px;font-size:20px;color:#17301f}
    .payment-history-summary>div:nth-child(2) strong{color:#08783f}
    .payment-history-summary>div:nth-child(3) strong{color:#b26a00}
    .payment-history-list{padding:0 20px}
    .payment-history-row{display:grid;grid-template-columns:minmax(0,1fr) 110px 72px;align-items:center;gap:16px;padding:15px 10px;border-bottom:1px solid #edf2ee}
    .payment-history-row:last-child{border-bottom:0}
    .payment-history-main{display:flex;align-items:center;gap:12px;min-width:0}
    .payment-history-icon{width:36px;height:36px;flex:0 0 36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#e8f6ed;color:#08783f;font-size:13px;font-weight:900}
    .payment-history-icon.game{font-size:16px}
    .payment-history-details{display:flex;flex-direction:column;min-width:0}
    .payment-history-details strong{font-size:14px;color:#17301f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .payment-history-details span{margin-top:3px;font-size:12px;color:#718078}
    .payment-history-amount{text-align:right;font-size:14px;font-weight:800;color:#17301f}
    .payment-status{justify-self:end;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:800;text-align:center}
    .payment-status.paid{background:#d9f7e4;color:#08783f}
    .payment-status.open{background:#fff0c9;color:#946300}
    .payment-history-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:34px 20px;color:#687970}
    .payment-history-empty strong{color:#17301f}
    .payment-history-empty span{margin-top:5px;font-size:13px}
    .payment-error{padding:24px 30px}

    @media (max-width:700px){
      .profile-hero{align-items:flex-start;padding:24px;gap:18px;flex-direction:column}
      .profile-card{border-radius:14px}
      .profile-form{padding:22px}
      .profile-grid{grid-template-columns:1fr}
      .profile-avatar{width:96px;height:96px}
      .profile-identity h2{font-size:25px}
      .member-payment-head{padding:22px;flex-direction:column}
      .payment-summary{width:100%;box-sizing:border-box;text-align:left;min-width:0}
      .payment-history-summary{grid-template-columns:1fr 1fr}
      .payment-history-row{grid-template-columns:minmax(0,1fr) auto;gap:10px}
      .payment-history-amount{grid-column:2;grid-row:1;text-align:right}
      .payment-status{grid-column:2;grid-row:2}
      .payment-history-main{grid-column:1;grid-row:1 / span 2}
      .payment-history-list{padding:0 12px}
    }
  `;
  document.head.appendChild(style);
})();
