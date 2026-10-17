"use client";

import Image from "next/image";
import Link from "next/link";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type DashboardOverviewProps = {
  user: { name: string; email: string; role: string; createdAt: Date };
  instagramAccounts: InstagramAccount[];
};

const features = [
  { title: "پاسخ به کامنت", description: "ارسال فوری پیام در کامنت‌ها یا دایرکت", image: "/photos/پاسخ خودکار کامنت.png", href: "/dashboard/comment-automation" },
  { title: "پاسخ به استوری", description: "ارسال خودکار پیام در دایرکت و ریپلای استوری", image: "/photos/پاسخ خودکار استوری.png", href: "/dashboard/story-automation" },
  { title: "پاسخ به لایو", description: "ارسال آنی پیام و لینک خرید در حین پخش زنده", image: "/photos/پاسخ به لایو.webp", href: "/dashboard/live-automation", soon: true },
  { title: "یادآوری هوشمند", description: "پیام خودکار برای یادآوری خرید", image: "/photos/انتشار محتوا.png", href: "/dashboard/reminders", soon: true },
  { title: "انتشار محتوا", description: "از همینجا می‌تونی استوری و پست‌های امروز و فردات رو آپلود کنی", image: "/photos/انتشار محتوا.png", href: "/dashboard/publishing" },
  { title: "صندوق دایرکت", description: "از همینجا می‌تونی دایرکت‌های بی‌پاسخ رو جواب بدی", image: "/photos/صندوق دایرکت.png", href: "/dashboard/inbox" },
  { title: "منو دایرکت", description: "پاسخگویی هوشمند به سوالات متداول مشتریان شبانه‌روزی", image: "/photos/منوی دایرکت.png", href: "/dashboard/persistent-menu" },
  { title: "کامنت‌های بی‌پاسخ", description: "پاسخ به کامنت‌های غیرخودکار", image: "/photos/کامنت های بی پاسخ.png", href: "/dashboard/comments" },
  { title: "پیام شروع گفتگو", description: "برای خوش‌آمد، معرفی پیج و سوالات متداول مشتریان", image: "/photos/پیام شروع گفتگو.png", href: "/dashboard/ice-breaker" },
  { title: "آنالیز", description: "تحلیل و بررسی دقیق پیج اینستاگرام شما", image: "/photos/تحلیل پیج.png", href: "/dashboard/insights" },
];

export default function DashboardOverview({}: DashboardOverviewProps) {

  return (
    <main className="daira-home" dir="rtl">
feature.image} alt="" width={144} height={144} sizes="(max-width: 480px) 34vw, 144px" />
              </div>
              <div className="daira-home__card-copy">
                <h2>{feature.title}</h2>
                <p>{feature.description}</p>
              </div>
              {feature.soon ? <span className="daira-home__soon">به‌زودی</span> : null}
            </>
          );
          return feature.soon ? (
            <article className="daira-home__card daira-home__card--soon" key={feature.title}>{content}</article>
          ) : (
            <Link className="daira-home__card" href={feature.href} key={feature.title}>{content}</Link>
          );
        })}
      </section>

      <style jsx global>{`
        .daira-home { width:100%; min-height:100%; padding:clamp(12px,2.6vw,28px); padding-bottom:24px; color:var(--daira-heading); font-family:inherit; }
        .daira-home__header { direction:ltr;display:grid; grid-template-columns:48px minmax(0,1fr) 48px; align-items:center; gap:8px; min-height:94px; padding:12px 18px; border-radius:26px; background:linear-gradient(115deg,#DCE7FF 0%,#E5EDFF 55%,#EAF0FF 100%); margin-bottom:18px; }
        .daira-home__instagram { width:44px;height:44px;border:0;background:transparent;color:#D946EF;display:grid;place-items:center;cursor:pointer;border-radius:14px;transition:background .2s,transform .2s; }
        .daira-home__instagram:hover { background:#FFFFFFA8;transform:translateY(-1px); }
        .daira-home__brand { direction:rtl;display:flex;justify-content:center;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:0; }
        .daira-home__brand-mark { display:grid;place-items:center;width:62px;height:62px;border-radius:20px;background:linear-gradient(145deg,#249BFF,#5261F8 56%,#D946EF);color:white;font-size:40px;font-weight:900;font-style:italic;line-height:1;box-shadow:0 8px 18px #5577F533; }
        .daira-home__brand-copy { display:flex;flex-direction:column;line-height:1.2; }
        .daira-home__brand-copy strong { font-size:clamp(24px,3vw,36px);font-weight:900;letter-spacing:-1px; }
        .daira-home__brand-copy small { margin-top:5px;font-size:11px;color:#63769D;font-weight:600; }
        .daira-home__header-spacer { width:44px; }
        .daira-home__welcome { padding:3px 4px 16px;text-align:right; }
        .daira-home__welcome p { margin:0;color:var(--daira-heading);font-size:clamp(17px,2vw,22px);font-weight:800; }
        .daira-home__welcome span { display:block;margin-top:4px;color:var(--daira-text);font-size:13px; }
        .daira-home__grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px; }
        .daira-home__card { position:relative;display:flex;align-items:center;gap:clamp(8px,1.8vw,18px);min-width:0;min-height:156px;padding:clamp(12px,2vw,20px);border:1px solid #FFFFFF;border-radius:23px;background:var(--daira-surface);box-shadow:0 4px 20px rgba(22,54,110,.05);color:inherit;text-decoration:none;overflow:hidden;transition:transform .2s,box-shadow .2s,background .2s; }
        .daira-home__card:hover { background:var(--daira-surface-hover);box-shadow:0 12px 30px rgba(22,54,110,.12);transform:translateY(-2px); }
        .daira-home__card:focus-visible,.daira-home__instagram:focus-visible { outline:3px solid #2F61FD55;outline-offset:3px; }
        .daira-home__card-art { flex:0 0 49%;max-width:200px;display:grid;place-items:center;min-width:0; }
        .daira-home__card-art :global(img) { display:block;width:100%;height:auto;max-height:205px;object-fit:contain;filter:drop-shadow(0 7px 9px #2F61FD12); }
        .daira-home__card-copy { min-width:0;flex:1;text-align:right; }
        .daira-home__card-copy h2 { margin:0 0 7px;font-size:clamp(13px,1.45vw,17px);font-weight:800;line-height:1.65;color:var(--daira-heading); }
        .daira-home__card-copy p { margin:0;color:var(--daira-text);font-size:clamp(10px,1.12vw,13px);line-height:1.85;font-weight:500; }
        .daira-home__card--soon { cursor:default; }
        .daira-home__card--soon:hover { transform:none; }
        .daira-home__soon { position:absolute;top:9px;left:10px;padding:3px 7px;border-radius:20px;background:#FCE7F3;color:#A21CAF;font-size:9px;font-weight:800; }
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
        @media (min-width:900px) { .daira-home { max-width:1120px;margin:0 auto;padding-top:26px; } .daira-home__grid { gap:18px; } .daira-home__card { min-height:180px; } }
        @media (max-width:900px) { .daira-home { padding:7px 8px 8px; } .daira-home__header { min-height:68px;padding:7px 10px;margin-bottom:8px;border-radius:18px;grid-template-columns:40px minmax(0,1fr) 40px; } .daira-home__brand-mark { width:43px;height:43px;border-radius:14px;font-size:29px; } .daira-home__brand { gap:8px; } .daira-home__brand-copy strong { font-size:23px; } .daira-home__brand-copy small { margin-top:2px;font-size:9px; } .daira-home__instagram { width:38px;height:38px; } .daira-home__header-spacer { width:38px; } .daira-home__grid { gap:7px; } .daira-home__card { min-height:112px;padding:8px 7px;gap:6px;border-radius:14px; } .daira-home__card-art { flex:0 0 48%;max-width:144px; } .daira-home__card-art :global(img) { max-height:160px; } .daira-home__card-copy h2 { margin-bottom:0;font-size:clamp(11px,1.65vw,14px);line-height:1.55; } .daira-home__card-copy p { display:block;font-size:clamp(9px,1.25vw,12px);line-height:1.55;margin-top:3px; } .daira-home__soon { top:3px;left:4px;padding:2px 4px;font-size:8px; } }
        @media (max-width:520px) { .daira-home { padding:7px 6px 8px; } .daira-home__header { min-height:64px;padding:6px 8px;border-radius:21px;grid-template-columns:38px minmax(0,1fr) 38px;gap:4px; } .daira-home__instagram { width:38px;height:38px; } .daira-home__brand { gap:8px; } .daira-home__brand-mark { width:47px;height:47px;border-radius:15px;font-size:31px; } .daira-home__brand-copy strong { font-size:26px; } .daira-home__brand-copy small { font-size:9px; } .daira-home__header-spacer { width:38px; } .daira-home__grid { gap:7px; } .daira-home__card { min-height:112px;flex-direction:row;justify-content:space-between;align-items:center;gap:5px;padding:7px 6px;border-radius:14px;text-align:right; } .daira-home__card-art { flex:0 0 45%;width:auto;height:auto;max-width:128px; } .daira-home__card-art :global(img) { width:100%;height:auto;max-width:100%;max-height:150px; } .daira-home__card-copy { flex:1;width:auto;text-align:right; } .daira-home__card-copy h2 { margin-bottom:2px;font-size:clamp(11px,2.9vw,13px);line-height:1.5; } .daira-home__card-copy p { display:block;font-size:clamp(9px,2.35vw,11px);line-height:1.5;margin-top:2px; } .daira-home__soon { top:6px;left:6px;font-size:8px;padding:2px 5px; } }
        @media (max-width:360px) { .daira-home__grid { gap:5px; } .daira-home__card { min-height:108px;padding:5px 4px;gap:3px; } .daira-home__card-art { flex-basis:42%;max-width:92px; } .daira-home__card-art :global(img) { max-height:108px; } .daira-home__card-copy h2 { font-size:11px; } .daira-home__card-copy p { font-size:9px;line-height:1.4; } }
        @media (prefers-reduced-motion:reduce) { .daira-home__card,.daira-home__instagram,.daira-home__card:hover { transition:none;transform:none; } }
      `}</style>
    </main>
  );
}
