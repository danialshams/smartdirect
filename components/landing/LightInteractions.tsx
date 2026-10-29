"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpLeft, CalendarDays, Check, CheckCircle2, ChevronDown,
  Clock3, Menu, MessageCircle, MessagesSquare, Play, RotateCcw, Send, X,
} from "lucide-react";

const nav = [
  { href: "#features", label: "امکانات" },
  { href: "#demo", label: "پاسخ‌های خودکار" },
  { href: "#inbox", label: "صندوق دایرکت" },
  { href: "#how", label: "چطور کار می‌کند؟" },
  { href: "#faq", label: "سؤالات متداول" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !drawer.current) return;
      const items = [...drawer.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
      trigger.current?.focus();
    };
  }, [open]);

  return (
    <header className={"hl-header" + (scrolled ? " hl-header--scrolled" : "")}>
      <div className="hl-container hl-header__inner">
        <button type="button" ref={trigger} className="hl-mobile-toggle" aria-label={open ? "بستن منو" : "باز کردن منو"} aria-expanded={open} aria-controls="hl-mobile-drawer" onClick={() => setOpen(v => !v)}><Menu size={23} aria-hidden="true"/></button>
        <Link className="hl-brand" href="/" aria-label="دایرا، صفحه اصلی"><Image src="/daira-header-logo-hd.webp" alt="" width={90} height={90} sizes="48px" priority/><span>دایرا</span></Link>
        <nav className="hl-header__nav" aria-label="منوی اصلی">{nav.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <div className="hl-header__actions"><Link className="hl-header__login" href="/login">ورود</Link><Link className="hl-btn hl-btn--primary hl-header__cta" href="/login">شروع استفاده <ArrowUpLeft size={16} aria-hidden="true"/></Link></div>
      </div>
      <div className={"hl-mobile-overlay" + (open ? " hl-mobile-overlay--open" : "")} aria-hidden={!open} onClick={() => setOpen(false)} />
      <div id="hl-mobile-drawer" ref={drawer} className={"hl-mobile-drawer" + (open ? " hl-mobile-drawer--open" : "")} aria-hidden={!open} inert={!open}>
        <div className="hl-mobile-drawer__top"><span>منوی دایرا</span><button type="button" ref={close} aria-label="بستن منو" onClick={() => setOpen(false)}><X size={23} /></button></div>
        <nav aria-label="منوی موبایل">{nav.map((item,i) => <a key={item.href} href={item.href} style={{ transitionDelay: open ? String(50 + i * 45) + "ms" : "0ms" }} onClick={() => setOpen(false)}>{item.label}<ArrowLeft size={18}/></a>)}</nav>
        <div className="hl-mobile-drawer__bottom"><Link href="/login" className="hl-btn hl-btn--primary" onClick={() => setOpen(false)}>شروع استفاده <ArrowUpLeft size={18}/></Link><Link href="/privacy-policy" onClick={() => setOpen(false)}>حریم خصوصی</Link><Link href="/data-deletion" onClick={() => setOpen(false)}>حذف اطلاعات</Link></div>
      </div>
    </header>
  );
}

export function LandingReveal() {
  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>(".hl-reveal")];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      nodes.forEach(node => node.classList.add("hl-visible"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("hl-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -35px 0px" });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return null;
}

const states = [
  { tag: "کامنت کاربر", text: "قیمت این محصول چنده؟", kind: "incoming" },
  { tag: "پاسخ زیر کامنت", text: "سلام! جزئیات رو برات فرستادم 💙", kind: "reply" },
  { tag: "پیام نمونه در دایرکت", text: "سلام! اینجا می‌تونی اطلاعات محصول رو ببینی.", kind: "message" },
] as const;

export function CommentFlowDemo() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      setStep(current => {
        if (current >= 2) { setPlaying(false); return current; }
        return current + 1;
      });
    }, 1150);
    return () => window.clearTimeout(id);
  }, [playing, step]);
  const play = () => { setStep(0); setPlaying(true); };
  return (
    <div className="hl-flow-demo hl-reveal">
      <div className="hl-preview-top"><span><MessageCircle size={18}/> سناریوی پاسخ به کامنت</span><span className="hl-demo-pill">دموی تعاملی</span></div>
      <div className="hl-flow-demo__canvas">
        {states.map((state,i) => (
          <div key={state.kind} className={"hl-flow-step" + (i <= step ? " hl-flow-step--shown" : "") + (i === step ? " hl-flow-step--active" : "")}>
            <div className="hl-flow-step__icon">{i === 0 ? <MessageCircle size={18}/> : i === 1 ? <Check size={18}/> : <Send size={18}/>}</div>
            <div className="hl-flow-step__copy"><span>{state.tag}</span><b>{i <= step ? state.text : "پاسخ بعدی در این مرحله نمایش داده می‌شود"}</b></div>
            {i <= step && <CheckCircle2 size={18} className="hl-flow-step__check" aria-label="مرحله نمایش داده شد"/>}
          </div>
        ))}
      </div>
      <div className="hl-flow-demo__footer">
        <div className="hl-flow-progress" aria-label={"مرحله " + (step + 1) + " از ۳"}>{states.map((s,i)=><span key={s.kind} className={i <= step ? "hl-flow-progress__active" : ""}/>)}</div>
        <button type="button" className="hl-btn hl-btn--soft" onClick={play} disabled={playing}>{playing ? "در حال نمایش..." : step === 2 ? "اجرای مجدد" : "اجرای دمو"} {step === 2 ? <RotateCcw size={17}/> : <Play size={17}/>}</button>
      </div>
      <p className="hl-demo-disclaimer">نمونه نمایشی است؛ ارسال واقعی پیام تابع تنظیمات شما و مجوزهای Meta خواهد بود.</p>
    </div>
  );
}

const inboxChats = [
  { key: "unread", name: "سارا", last: "سلام، درباره محصول سؤال داشتم", message: "سلام! درباره محصول سؤال داشتم.", status: "خوانده‌نشده" },
  { key: "read", name: "امیر", last: "ممنون، اطلاعات کامل بود 🙏", message: "ممنون، اطلاعات کامل بود 🙏", status: "خوانده‌شده" },
  { key: "read", name: "نازنین", last: "زمان ارسال محتوا مشخص شد؟", message: "زمان ارسال محتوا مشخص شد؟", status: "خوانده‌شده" },
] as const;

export function InboxPreview() {
  const [tab, setTab] = useState<"all" | "unread" | "read">("all");
  const [selected, setSelected] = useState(0);
  const visible = inboxChats.map((chat,index)=>({ ...chat, index })).filter(chat=>tab==="all" || chat.key===tab);
  const current = inboxChats[selected];
  const chooseTab = (value: typeof tab) => {
    setTab(value);
    if (value === "unread") setSelected(0);
    else if (value === "read") setSelected(1);
  };
  return (
    <div className="hl-inbox-preview hl-reveal">
      <div className="hl-preview-top"><span><MessagesSquare size={18}/> صندوق دایرکت</span><span className="hl-demo-pill">پیام‌های نمونه</span></div>
      <div className="hl-inbox-tabs" role="group" aria-label="فیلتر گفتگوهای نمونه">{([{key:"all",label:"همه"},{key:"unread",label:"خوانده‌نشده"},{key:"read",label:"خوانده"}] as const).map(t=><button type="button" key={t.key} className={tab===t.key?"hl-is-active":""} onClick={()=>chooseTab(t.key)} aria-pressed={tab===t.key}>{t.label}</button>)}</div>
      <div className="hl-inbox-columns">
        <div className="hl-inbox-list">{visible.map(chat=><button key={chat.index} type="button" onClick={()=>setSelected(chat.index)} className={"hl-inbox-person" + (selected===chat.index?" hl-inbox-person--selected":"")}><span className="hl-avatar">{chat.name[0]}</span><span><b>{chat.name}</b><small>{chat.last}</small></span>{chat.key==="unread"&&<i className="hl-unread-dot" aria-label="خوانده‌نشده"/>}</button>)}</div>
        <div className="hl-inbox-conversation" aria-live="polite"><div className="hl-inbox-conversation__head"><span className="hl-avatar">{current.name[0]}</span><span><b>{current.name}</b><small>{current.status}</small></span></div><div className="hl-inbox-chat-bubble">{current.message}</div><div className="hl-inbox-chat-reply">سلام! ممنون از پیامت 💙</div><span className="hl-inbox-composer">نوشتن پیام...</span></div>
      </div>
      <p className="hl-demo-disclaimer">محتوای این پیش‌نمایش ساختگی است؛ به حساب واقعی متصل نیست.</p>
    </div>
  );
}

const formats = [
  { name:"پست",description:"تصویر و توضیحات پست" },
  { name:"ریلز",description:"ویدیو و توضیحات ریلز" },
  { name:"استوری",description:"محتوای استوری" },
  { name:"پست اسلایدی",description:"چند اسلاید در یک محتوا" },
] as const;
export function PublishingPreview() {
  const [format, setFormat] = useState(0);
  return (
    <div className="hl-publish-preview hl-reveal">
      <div className="hl-preview-top"><span><CalendarDays size={18}/> انتشار محتوا</span><span className="hl-demo-pill">نمای نمونه</span></div>
      <div className="hl-format-tabs" role="group" aria-label="انتخاب نوع محتوای نمایشی">{formats.map((f,i)=><button type="button" key={f.name} aria-pressed={format===i} className={format===i?"hl-is-active":""} onClick={()=>setFormat(i)}>{f.name}</button>)}</div>
      <div className="hl-publish-preview__body">
        <div className="hl-publish-media"><Image src="/dashboard-art/publishing.webp" alt="" width={125} height={125} sizes="125px"/><span>{formats[format].name}</span></div>
        <div className="hl-publish-details" aria-live="polite"><b>{formats[format].description}</b><span>انتشار مطابق زمان انتخابی شما</span><div className="hl-schedule-row"><Clock3 size={17}/><span>زمان‌بندی دلخواه</span><CheckCircle2 size={17}/></div><span className="hl-publish-muted">پیش‌نمایش؛ هیچ محتوایی ارسال نمی‌شود</span></div>
      </div>
    </div>
  );
}

export function DirectExperienceDemo() {
  const [mode, setMode] = useState<"menu" | "starter">("menu");
  const [sheet, setSheet] = useState(false);
  const [choice, setChoice] = useState("");
  return (
    <div className="hl-direct-preview hl-reveal">
      <div className="hl-preview-top"><span><MessageCircle size={18}/> تجربه دایرکت</span><span className="hl-demo-pill">نمای تعاملی</span></div>
      <div className="hl-direct-tabs" role="group" aria-label="نوع تعامل"><button type="button" aria-pressed={mode==="menu"} className={mode==="menu"?"hl-is-active":""} onClick={()=>{setMode("menu");setSheet(false);setChoice("");}}>منوی دایرکت</button><button type="button" aria-pressed={mode==="starter"} className={mode==="starter"?"hl-is-active":""} onClick={()=>{setMode("starter");setSheet(false);setChoice("");}}>پیام شروع گفتگو</button></div>
      <div className="hl-direct-phone">
        <div className="hl-direct-phone__top"><span className="hl-avatar">د</span><strong>دایرا • نمونه</strong><button type="button" aria-label="باز کردن منوی دایرکت" onClick={()=>setSheet(v=>!v)} disabled={mode!=="menu"}><Menu size={21}/></button></div>
        <div className="hl-direct-phone__inner">
          {mode==="menu" ? <><p className="hl-direct-hint">روی آیکون سه‌خط بالای گفتگو بزن.</p><div className="hl-direct-chat">سلام! چطور می‌تونیم کمکت کنیم؟</div></> : <><p className="hl-direct-hint">یک گزینه را برای شروع گفتگو انتخاب کن.</p><div className="hl-icebreakers">{["اطلاعات محصول","پیگیری سفارش","سؤال دیگر"].map(v=><button type="button" key={v} onClick={()=>setChoice(v)}>{v}</button>)}</div>{choice&&<div className="hl-direct-chat">انتخاب شما: {choice}</div>}</>}
        </div>
        {mode==="menu"&&<div className={"hl-direct-sheet"+(sheet?" hl-direct-sheet--open":"")} aria-hidden={!sheet} inert={!sheet}><span className="hl-sheet-grip"/><strong>منوی گفتگو</strong>{["محصولات","پشتیبانی","سؤالات متداول"].map(v=><button key={v} type="button" onClick={()=>{setChoice(v);setSheet(false);}}>{v}<ArrowLeft size={16}/></button>)}</div>}
      </div>
      <p className="hl-demo-disclaimer">{choice?"گزینه انتخاب‌شده: "+choice:"این دمو، ساختار تعامل را نشان می‌دهد و پیام واقعی ارسال نمی‌کند."}</p>
    </div>
  );
}
