"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

export default function DashboardHeader({ instagramAccounts }: { instagramAccounts: InstagramAccount[] }) {
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const connected = instagramAccounts.filter((account) => account.isConnected);

  return (
    <>
      <header className="daira-home__header">
        <button className="daira-home__instagram" type="button" aria-label="افزودن یا مدیریت اکانت اینستاگرام" onClick={() => setAccountModalOpen(true)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><defs><linearGradient id="instagramGradient" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop stopColor="#FEDA75"/><stop offset=".35" stopColor="#FA7E1E"/><stop offset=".65" stopColor="#D62976"/><stop offset="1" stopColor="#4F5BD5"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="5" stroke="url(#instagramGradient)" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="url(#instagramGradient)" strokeWidth="2"/><circle cx="17.5" cy="6.8" r="1.2" fill="#D62976"/></svg>
        </button>
        <Link href="/dashboard" className="daira-home__brand" aria-label="دایرا - خانه">
          <span className="daira-home__brand-mark">D</span>
          <span className="daira-home__brand-copy"><strong>دایرا</strong><small>اتوماسیون اینستاگرام</small></span>
        </Link>
        <span className="daira-home__header-spacer" aria-hidden="true" />
      </header>

      {accountModalOpen ? (
        <div className="daira-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccountModalOpen(false); }}>
          <section className="daira-account-modal" role="dialog" aria-modal="true" aria-labelledby="daira-account-title">
            <button className="daira-account-modal__close" type="button" aria-label="بستن" onClick={() => setAccountModalOpen(false)}><X size={20} /></button>
            <div className="daira-account-modal__icon"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/></svg></div>
            <h2 id="daira-account-title">اکانت‌های اینستاگرام</h2>
            <p className="daira-account-modal__description">پیج متصل رو مدیریت کن یا یک پیج جدید اضافه کن.</p>
            {connected.length ? <div className="daira-account-modal__accounts">{connected.map((account) => <div className="daira-account-modal__account" key={account.id}><span className="daira-account-modal__avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/></svg></span><span dir="ltr">@{account.igUsername}</span><span className="daira-account-modal__connected">متصل</span></div>)}</div> : <p className="daira-account-modal__empty">هنوز پیجی متصل نکردی.</p>}
            <Link className="daira-account-modal__add" href="/api/instagram/connect" onClick={() => setAccountModalOpen(false)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/></svg> افزودن اکانت اینستاگرام</Link>
          </section>
        </div>
      ) : null}

      <style jsx global>{`
        .daira-home__header { direction:ltr;display:grid;grid-template-columns:48px minmax(0,1fr) 48px;align-items:center;gap:8px;min-height:94px;padding:12px 18px;border-radius:26px;background:linear-gradient(115deg,#DCE7FF 0%,#E5EDFF 55%,#EAF0FF 100%);margin:clamp(7px,1.5vw,18px) clamp(7px,2vw,24px) 18px; }
        .daira-home__instagram { width:44px;height:44px;border:0;background:transparent;color:#D946EF;display:grid;place-items:center;cursor:pointer;border-radius:14px;transition:background .2s,transform .2s; }
        .daira-home__instagram:hover { background:#FFFFFFA8;transform:translateY(-1px); }
        .daira-home__brand { direction:rtl;display:flex;justify-content:center;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:0; }
        .daira-home__brand-mark { display:grid;place-items:center;width:62px;height:62px;border-radius:20px;background:linear-gradient(145deg,#249BFF,#5261F8 56%,#D946EF);color:white;font-size:40px;font-weight:900;font-style:italic;line-height:1;box-shadow:0 8px 18px #5577F533; }
        .daira-home__brand-copy { display:flex;flex-direction:column;line-height:1.2; }
        .daira-home__brand-copy strong { font-size:clamp(24px,3vw,36px);font-weight:900;letter-spacing:-1px; }
        .daira-home__brand-copy small { margin-top:5px;font-size:11px;color:#63769D;font-weight:600; }
        .daira-home__header-spacer { width:44px; }
        .daira-modal-backdrop { position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:18px;background:rgba(24,35,60,.28);backdrop-filter:blur(5px); }
        .daira-account-modal { position:relative;width:min(100%,410px);max-height:min(85dvh,600px);overflow:auto;padding:28px 22px 22px;border:1px solid var(--daira-border);border-radius:26px;background:white;box-shadow:0 24px 80px rgba(22,54,110,.2);text-align:center; }
        .daira-account-modal__close { position:absolute;top:13px;left:13px;width:36px;height:36px;border:0;border-radius:12px;background:#F1F5F9;color:#64748B;display:grid;place-items:center;cursor:pointer; }
        .daira-account-modal__icon { width:54px;height:54px;display:grid;place-items:center;margin:0 auto 12px;border-radius:17px;background:#FCE7F3;color:#C026D3; }
        .daira-account-modal h2 { margin:0;font-size:18px;font-weight:850;color:var(--daira-heading); }
        .daira-account-modal__description { margin:8px 0 18px;color:var(--daira-text);font-size:12px;line-height:1.8; }
        .daira-account-modal__accounts { display:grid;gap:8px;margin-bottom:16px;text-align:right; }
        .daira-account-modal__account { display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--daira-border);border-radius:15px;font-size:12px;font-weight:700; }
        .daira-account-modal__avatar { width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#EFF6FF;color:var(--daira-primary); }
        .daira-account-modal__connected { margin-right:auto;color:#059669;font-size:10px; }
        .daira-account-modal__empty { margin:0 0 16px;padding:14px;border-radius:14px;background:#F8FAFC;color:var(--daira-text);font-size:12px; }
        .daira-account-modal__add { display:flex;justify-content:center;align-items:center;gap:8px;width:100%;min-height:48px;border-radius:15px;background:var(--daira-primary);color:white;text-decoration:none;font-size:13px;font-weight:800;transition:background .2s; }
        .daira-account-modal__add:hover { background:var(--daira-primary-hover); }
        @media(max-width:900px) { .daira-home__header { min-height:68px;padding:7px 10px;margin-bottom:8px;border-radius:18px;grid-template-columns:40px minmax(0,1fr) 40px; } .daira-home__brand-mark { width:43px;height:43px;border-radius:14px;font-size:29px; } .daira-home__brand { gap:8px; } .daira-home__brand-copy strong { font-size:23px; } .daira-home__brand-copy small { margin-top:2px;font-size:9px; } .daira-home__instagram { width:38px;height:38px; } .daira-home__header-spacer { width:38px; } }
        @media(max-width:520px) { .daira-home__header { min-height:64px;padding:6px 8px;border-radius:21px;grid-template-columns:38px minmax(0,1fr) 38px;gap:4px; } .daira-home__instagram { width:38px;height:38px; } .daira-home__brand { gap:8px; } .daira-home__brand-mark { width:47px;height:47px;border-radius:15px;font-size:31px; } .daira-home__brand-copy strong { font-size:26px; } .daira-home__brand-copy small { font-size:9px; } .daira-home__header-spacer { width:38px; } }
      `}</style>
    </>
  );
}
