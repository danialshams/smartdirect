"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import GlassModalPresence from "./GlassModalPresence";
import { useDashboardBackNavigation } from "./DashboardBackNavigationContext";
import { useDashboardAccountSelection } from "./DashboardAccountContext";

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
  const { accountId: selectedAccountId, selectAccount } = useDashboardAccountSelection();
  const connected = instagramAccounts.filter((account) => account.isConnected);
  const [isScrolled, setIsScrolled] = useState(false);
  const closeModalRef = useRef<HTMLButtonElement>(null);
  const accountDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const openAccountModal = () => setAccountModalOpen(true);
    window.addEventListener("daira:open-account-manager", openAccountModal);
    return () => window.removeEventListener("daira:open-account-manager", openAccountModal);
  }, []);

  useEffect(() => {
    const updateScroll = () => setIsScrolled(window.scrollY > 8);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  useEffect(() => {
    if (!accountModalOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeModalRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAccountModalOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = accountDialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [accountModalOpen]);

  return (
    <>
      <div className="daira-home__header-wrap">
        <div className="daira-liquid-corner-guard daira-liquid-corner-guard--header" aria-hidden="true" />
        <div className="daira-liquid-corner-guard daira-liquid-corner-guard--header daira-liquid-corner-guard--header-top" aria-hidden="true" />
      <header className={`daira-home__header daira-home__header--liquid${isScrolled ? " is-scrolled" : ""}`}>
        <button className="daira-home__instagram" type="button" aria-label={connected.length ? "مدیریت اکانت‌های متصل اینستاگرام" : "افزودن اکانت اینستاگرام"} onClick={() => setAccountModalOpen(true)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><defs><linearGradient id="instagramGradient" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop stopColor="#FEDA75"/><stop offset=".35" stopColor="#FA7E1E"/><stop offset=".65" stopColor="#D62976"/><stop offset="1" stopColor="#4F5BD5"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="5" stroke="url(#instagramGradient)" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="url(#instagramGradient)" strokeWidth="2"/><circle cx="17.5" cy="6.8" r="1.2" fill="#D62976"/></svg>
          {connected.length > 0 ? <span className="daira-home__connection-dot" aria-hidden="true" /> : null}
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
              else if (window.history.length > 1) router.back();
              else router.push("/dashboard");
            }}
          >
            <ChevronRight size={25} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <span className="daira-home__header-spacer" aria-hidden="true" />
        )}
      </header>
      </div>

      <GlassModalPresence open={accountModalOpen}>
      {accountModalOpen ? (
        <div className="daira-modal-backdrop daira-glass-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccountModalOpen(false); }}>
          <section ref={accountDialogRef} className="daira-account-modal daira-glass-dialog" role="dialog" aria-modal="true" aria-labelledby="daira-account-title">
            <button ref={closeModalRef} className="daira-account-modal__close" type="button" aria-label="بستن" onClick={() => setAccountModalOpen(false)}><X size={20} /></button>
            <div className="daira-account-modal__icon"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/></svg></div>
            <h2 id="daira-account-title">اکانت‌های اینستاگرام</h2>
            <p className="daira-account-modal__description">پیج فعال رو انتخاب کن یا یک پیج جدید اضافه کن.</p>
            {connected.length ? (
              <div className="daira-account-modal__accounts" role="group" aria-label="انتخاب پیج فعال">
                {connected.map((account) => (
                  <button
                    type="button"
                    className={"daira-account-modal__account" + (selectedAccountId === account.id ? " is-active" : "")}
                    key={account.id}
                    aria-pressed={selectedAccountId === account.id}
                    onClick={() => {
                      selectAccount(account.id);
                      setAccountModalOpen(false);
                    }}
                  >
                    <span className="daira-account-modal__avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/></svg></span>
                    <span dir="ltr">@{account.igUsername}</span>
                    <span className="daira-account-modal__connected">{selectedAccountId === account.id ? "فعال" : "انتخاب"}</span>
                  </button>
                ))}
              </div>
            ) : <p className="daira-account-modal__empty">هنوز پیجی متصل نکردی.</p>}
            <Link className="daira-account-modal__add" href="/api/instagram/connect" onClick={() => setAccountModalOpen(false)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/></svg> افزودن اکانت اینستاگرام</Link>
          </section>
        </div>
      ) : null}
      </GlassModalPresence>

    </>
  );
}
