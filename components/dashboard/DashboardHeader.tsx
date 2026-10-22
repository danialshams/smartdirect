"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { useDashboardBackNavigation } from "./DashboardBackNavigationContext";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

export default function DashboardHeader({
  instagramAccounts,
  showBackButton = false,
}: {
  instagramAccounts: InstagramAccount[];
  showBackButton?: boolean;
}) {
  const router = useRouter();
  
  const { backHandler } = useDashboardBackNavigation();
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const connected = instagramAccounts.filter((account) => account.isConnected);

  return (
    <>
      <header className="daira-home__header">
        <button className="daira-home__instagram" type="button" aria-label="افزودن یا مدیریت اکانت اینستاگرام" onClick={() => setAccountModalOpen(true)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><defs><linearGradient id="instagramGradient" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop stopColor="#FEDA75"/><stop offset=".35" stopColor="#FA7E1E"/><stop offset=".65" stopColor="#D62976"/><stop offset="1" stopColor="#4F5BD5"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="5" stroke="url(#instagramGradient)" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="url(#instagramGradient)" strokeWidth="2"/><circle cx="17.5" cy="6.8" r="1.2" fill="#D62976"/></svg>
        </button>
        <Link href="/dashboard" className="daira-home__brand" aria-label="دایرا - خانه">
          <Image src="/daira-header-logo-original.png" alt="Daira" width={1479} height={462} unoptimized priority className="daira-home__brand-image" />
        </Link>
        {showBackButton ? (
          <button
            className="daira-home__back"
            type="button"
            aria-label="بازگشت"
            title="بازگشت"
            onClick={() => {
              if (backHandler) backHandler();
              else router.back();
            }}
          >
            <ChevronRight size={25} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <span className="daira-home__header-spacer" aria-hidden="true" />
        )}
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
        .daira-home__header { position:fixed;top:max(8px,env(safe-area-inset-top, 0px));left:clamp(7px,2vw,24px);right:clamp(7px,2vw,24px);z-index:1600;isolation:isolate;opacity:1;box-sizing:border-box;direction:ltr;display:grid;grid-template-columns:48px minmax(0,1fr) 48px;align-items:center;gap:8px;min-height:94px;padding:12px 18px;border:1px solid var(--daira-border);border-radius:26px;background-color:var(--daira-header-middle);background:linear-gradient(115deg,var(--daira-header-start) 0%,var(--daira-header-middle) 55%,var(--daira-header-end) 100%);backdrop-filter:none;margin:0;box-shadow:0 6px 24px rgba(24,35,60,.07);}
        .daira-home__instagram { width:44px;height:44px;border:0;background:transparent;color:var(--daira-accent);display:grid;place-items:center;cursor:pointer;border-radius:14px;transition:background .2s,transform .2s; }
        .daira-home__instagram:hover { background:var(--daira-surface-hover);transform:translateY(-1px); }
        .daira-home__brand { direction:ltr;display:flex;justify-content:center;align-items:center;color:inherit;text-decoration:none;min-width:0; }
        .daira-home__brand-image { display:block;width:clamp(136px,16vw,174px);height:auto;max-height:60px;object-fit:contain; }
        .daira-home__page-title { direction:rtl;display:flex;align-items:center;justify-content:center;width:100%;min-width:0;overflow:hidden;color:var(--daira-heading);text-align:center; }
        .daira-home__page-title strong { display:block;max-width:100%;font-size:clamp(15px,2vw,20px);font-weight:800;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .daira-home__header-spacer { width:44px; }
        .daira-home__back { width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;border-radius:0;background:transparent;color:var(--daira-primary);cursor:pointer;transition:color .18s; }
        .daira-home__back:hover { background:transparent;color:var(--daira-primary-hover); }
        .daira-home__back:focus-visible { outline:2px solid var(--daira-primary);outline-offset:2px;border-radius:8px; }
        .daira-modal-backdrop { position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:18px;background:rgba(24,35,60,.28);backdrop-filter:blur(5px); }
        .daira-account-modal { position:relative;width:min(100%,410px);max-height:min(85dvh,600px);overflow:auto;padding:28px 22px 22px;border:1px solid var(--daira-border);border-radius:26px;background:var(--daira-surface);box-shadow:0 24px 80px rgba(22,54,110,.2);text-align:center; }
        .daira-account-modal__close { position:absolute;top:13px;left:13px;width:36px;height:36px;border:0;border-radius:12px;background:var(--daira-surface-active);color:var(--daira-text);display:grid;place-items:center;cursor:pointer; }
        .daira-account-modal__icon { width:54px;height:54px;display:grid;place-items:center;margin:0 auto 12px;border-radius:17px;background:var(--daira-pink-glow);color:var(--daira-accent-hover); }
        .daira-account-modal h2 { margin:0;font-size:18px;font-weight:850;color:var(--daira-heading); }
        .daira-account-modal__description { margin:8px 0 18px;color:var(--daira-text);font-size:12px;line-height:1.8; }
        .daira-account-modal__accounts { display:grid;gap:8px;margin-bottom:16px;text-align:right; }
        .daira-account-modal__account { display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--daira-border);border-radius:15px;font-size:12px;font-weight:700; }
        .daira-account-modal__avatar { width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:var(--daira-outline-hover-bg);color:var(--daira-primary); }
        .daira-account-modal__connected { margin-right:auto;color:var(--daira-success);font-size:10px; }
        .daira-account-modal__empty { margin:0 0 16px;padding:14px;border-radius:14px;background:var(--daira-surface-hover);color:var(--daira-text);font-size:12px; }
        .daira-account-modal__add { display:flex;justify-content:center;align-items:center;gap:8px;width:100%;min-height:48px;border-radius:15px;background:var(--daira-primary);color:var(--daira-surface);text-decoration:none;font-size:13px;font-weight:800;transition:background .2s; }
        .daira-account-modal__add:hover { background:var(--daira-primary-hover); }
        @media(max-width:900px) { .daira-home__brand-image { width:clamp(108px,15vw,132px);max-height:44px; } .daira-home__header { min-height:68px;padding:7px 10px;border-radius:20px;grid-template-columns:40px minmax(0,1fr) 40px; } .daira-home__instagram { width:38px;height:38px; } .daira-home__header-spacer { width:38px; } .daira-home__back { width:38px;height:38px; } }
        @media(max-width:520px) { .daira-home__brand-image { width:clamp(92px,27vw,110px);max-height:36px; } .daira-home__header { min-height:64px;padding:6px 8px;border-radius:20px;grid-template-columns:38px minmax(0,1fr) 38px;gap:4px; } .daira-home__instagram { width:38px;height:38px; } .daira-home__brand { gap:8px; } .daira-home__header-spacer { width:38px; } .daira-home__back { width:38px;height:38px; } }
      `}</style>
    </>
  );
}
