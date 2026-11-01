"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { ArrowLeft, ArrowUpLeft, Check, CheckCircle2, Eye, EyeOff,
  Fingerprint, AtSign, KeyRound, MessageCircleMore,
  Phone, ShieldCheck, Sparkles, UserRound, WandSparkles } from "lucide-react";
import Link from "next/link";
import { asciiDigits } from "@/lib/auth/phone";
import "./auth-studio.css";

type Screen = "login" | "signup" | "forgot" | "verify";
type LoginMethod = "password" | "sms";
type Status = { type: "error" | "success" | "info"; message: string } | null;
type ApiReply = { success?: boolean; message?: string; providerConfigured?: boolean };
const headline = {
  login: ["خوش برگشتی", "دوباره به دایرا وصل شو و همه‌چیز رو یک‌جا مدیریت کن."],
  signup: ["شروع یک تجربه تازه", "حساب دایرات رو بساز. بقیه ماجرا از همین‌جا شروع می‌شه."],
  forgot: ["رمزت رو فراموش کردی؟", "بعد از فعال‌شدن پیامک، رمز جدید رو با تأیید موبایل تنظیم کن."],
  verify: ["موبایلت رو تأیید کن", "برای امنیت حساب و ورود پیامکی، کدی که دریافت کردی رو وارد کن."]
} as const;

function safeDestination(input?: string | null) {
  if (!input) return "/dashboard";
  try {
    const value = decodeURIComponent(input);
    if (value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value))
      return value;
  } catch { /* Invalid redirects fall through. */ }
  return "/dashboard";
}
function passwordValid(value: string) {
  return value.length >= 8 && value.length <= 128 &&
    /[A-Za-z\u0600-\u06ff]/.test(value) && /\d/.test(asciiDigits(value));
}
async function postJson(path: string, body: object): Promise<{ status: number; data: ApiReply }> {
  const response = await fetch(path, {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({ message: "پاسخی از سرور دریافت نشد." }));
  return { status: response.status, data };
}

function BrandMark() {
  return <div className="da-auth-brand">
    <span className="da-auth-brand__symbol" aria-hidden="true">D<span>.</span></span>
    <span>دایرا</span>
  </div>;
}

export default function AuthStudio({ callbackUrl }: { callbackUrl?: string | null }) {
  const [screen, setScreen] = useState<Screen>("login");
  const [method, setMethod] = useState<LoginMethod>("password");
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsChecked, setSmsChecked] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/otp/request", { cache: "no-store" })
      .then(r => r.json())
      .then((response: ApiReply) => { if (active) { setSmsEnabled(!!response.providerConfigured); setSmsChecked(true); } })
      .catch(() => { if (active) setSmsChecked(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown(v => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const changeScreen = (next: Screen) => {
    if (busyRef.current) return;
    setScreen(next); setCode(""); setCodeSent(false);
    setCountdown(0); setStatus(null); setShowPassword(false);
    if (next === "forgot") setPhone(identifier);
  };
  const changeMethod = (next: LoginMethod) => {
    if (busyRef.current) return;
    setMethod(next); setStatus(null); setCode(""); setCodeSent(false); setCountdown(0);
    if (next === "sms" && identifier) setPhone(identifier);
  };
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setStatus(null);
    try { await operation(); }
    catch { setStatus({ type:"error", message:"ارتباط برقرار نشد. دوباره تلاش کن." }); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const passwordLogin = async () => {
    if (!identifier.trim() || !password) {
      setStatus({type:"error",message:"شماره موبایل یا ایمیل و رمز عبور رو وارد کن."}); return;
    }
    const result = await signIn("credentials", {
      redirect:false, email:identifier.trim(), password
    });
    if (!result?.ok || result.error) {
      setStatus({type:"error",message:"اطلاعات ورود صحیح نیست یا دسترسی حساب محدود شده."}); return;
    }
    window.location.assign(safeDestination(callbackUrl));
  };
  const smsLogin = async () => {
    if (!codeSent) { await requestOtp("login"); return; }
    if (!/^\d{6}$/.test(asciiDigits(code))) {
      setStatus({type:"error",message:"کد شش‌رقمی رو کامل وارد کن."}); return;
    }
    const result = await signIn("sms", { redirect:false, phone, code:asciiDigits(code) });
    if (!result?.ok || result.error) {
      setStatus({type:"error",message:"کد معتبر نیست یا منقضی شده. دوباره تلاش کن."}); return;
    }
    window.location.assign(safeDestination(callbackUrl));
  };
  const requestOtp = async (purpose: "login" | "reset" | "verify") => {
    if (!smsEnabled) {
      setStatus({type:"info",message:"ارسال پیامک هنوز فعال نشده. فعلاً از ورود با رمز عبور استفاده کن."}); return;
    }
    if (!phone.trim()) { setStatus({type:"error",message:"شماره موبایل رو وارد کن."}); return; }
    const {status: http, data} = await postJson("/api/auth/otp/request",{phone,purpose});
    if (http >= 400) {
      setStatus({type:"error",message:data.message || "ارسال کد ناموفق بود."}); return;
    }
    setCode(""); setCodeSent(true); setCountdown(60);
    setStatus({type:"success",message:"اگر شماره تأییدشده باشد، کد برای آن ارسال می‌شود."});
  };
  const registerAccount = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setStatus({type:"error",message:"نام، نام خانوادگی و شماره موبایل الزامی است."}); return;
    }
    if (!passwordValid(password)) {
      setStatus({type:"error",message:"رمز باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد."}); return;
    }
    if (confirm !== password) {
      setStatus({type:"error",message:"تکرار رمز عبور با رمز اصلی یکسان نیست."}); return;
    }
    const {status:http,data}=await postJson("/api/auth/register",{
      firstName,lastName,phone,password,confirmPassword:confirm
    });
    if (http >= 400 || !data.success) {
      setStatus({type:"error",message:data.message || "ثبت‌نام انجام نشد."}); return;
    }
    if (smsEnabled) {
      setScreen("verify");
      await requestOtp("verify");
      return;
    }
    await finishSignup();
  };
  const finishSignup = async () => {
    const result = await signIn("credentials",{redirect:false,email:phone,password});
    if (!result?.ok || result.error) {
      setScreen("login");setIdentifier(phone);setMethod("password");
      setStatus({type:"success",message:"حساب ساخته شد. حالا وارد شو."});return;
    }
    window.location.assign(safeDestination(callbackUrl));
  };
  const verifyPhone = async () => {
    const { status:http,data }=await postJson("/api/auth/otp/verify",{
      phone,code:asciiDigits(code)
    });
    if (http>=400 || !data.success) {
      setStatus({type:"error",message:data.message || "تأیید موبایل انجام نشد."});return;
    }
    await finishSignup();
  };
  const resetPassword = async () => {
    if (!codeSent) { await requestOtp("reset"); return; }
    if (!passwordValid(newPassword) || newPassword !== confirm) {
      setStatus({type:"error",message:"رمز جدید باید حداقل ۸ کاراکتر شامل حرف و عدد باشد و تکرارش مطابقت داشته باشد."});return;
    }
    const {status:http,data}=await postJson("/api/auth/password/reset",{
      phone,code:asciiDigits(code),password:newPassword,confirmPassword:confirm
    });
    if (http >= 400) {setStatus({type:"error",message:data.message || "تغییر رمز انجام نشد."});return;}
    changeScreen("login");setMethod("password");setIdentifier(phone);
    setStatus({type:"success",message:"رمز تغییر کرد؛ با رمز جدید وارد شو."});
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(screen==="signup"?registerAccount:
      screen==="verify"?verifyPhone:screen==="forgot"?resetPassword:
      method==="sms"?smsLogin:passwordLogin);
  };
  const renderPassword = (value: string, setValue: (value: string) => void,
    label: string, complete = "current-password") => (
    <label className="da-auth-field">
      <span>{label}</span>
      <span className="da-auth-input">
        <KeyRound size={18} strokeWidth={1.9} aria-hidden="true"/>
        <input type={showPassword?"text":"password"} autoComplete={complete}
          value={value} onChange={event=>setValue(event.target.value)}
          placeholder="حداقل ۸ کاراکتر" required minLength={8} maxLength={128} dir="ltr"/>
        <button type="button" className="da-auth-show" onClick={()=>setShowPassword(v=>!v)}
          aria-label={showPassword?"پنهان‌کردن رمز":"نمایش رمز"}>
          {showPassword?<EyeOff size={18}/>:<Eye size={18}/>}
        </button>
      </span>
    </label>
  );

  return <main className="da-auth" dir="rtl">
    <div className="da-auth-grain" aria-hidden="true" />
    <div className="da-auth-shell">
      <section className="da-auth-formside">
        <header className="da-auth-header">
          <BrandMark/>
          <Link href="/" className="da-auth-home">صفحه اصلی <ArrowUpLeft size={17}/></Link>
        </header>
        <div className="da-auth-formwrap">
          <div key={screen} className="da-auth-panel">
            <div className="da-auth-eyebrow"><span className="da-auth-dot"/> فضای شخصی تو در دایرا</div>
            <h1>{headline[screen][0]}<span className="da-auth-accent">.</span></h1>
            <p className="da-auth-subheading">{headline[screen][1]}</p>
            {screen!=="forgot" && screen!=="verify" && <div className="da-auth-main-tabs" role="tablist" aria-label="ورود یا ثبت‌نام">
              <button type="button" role="tab" aria-selected={screen==="login"} className={screen==="login"?"active":""} onClick={()=>changeScreen("login")}>ورود به حساب</button>
              <button type="button" role="tab" aria-selected={screen==="signup"} className={screen==="signup"?"active":""} onClick={()=>changeScreen("signup")}>ایجاد حساب جدید</button>
            </div>}
            {screen==="login" && <div className="da-auth-methods" role="tablist" aria-label="روش ورود">
              <button type="button" role="tab" aria-selected={method==="password"} className={method==="password"?"active":""} onClick={()=>changeMethod("password")}>
                <KeyRound size={17}/> رمز عبور
              </button>
              <button type="button" role="tab" aria-selected={method==="sms"} className={method==="sms"?"active":""} onClick={()=>changeMethod("sms")}>
                <MessageCircleMore size={17}/> کد پیامکی
              </button>
            </div>}
            <form noValidate onSubmit={submit} className="da-auth-form">
              {screen==="signup" && <div className="da-auth-two">
                <label className="da-auth-field"><span>نام</span><span className="da-auth-input">
                  <UserRound size={18}/><input autoComplete="given-name" value={firstName} onChange={e=>setFirstName(e.target.value)} required placeholder="نام" maxLength={60}/>
                </span></label>
                <label className="da-auth-field"><span>نام خانوادگی</span><span className="da-auth-input">
                  <UserRound size={18}/><input autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)} required placeholder="نام خانوادگی" maxLength={60}/>
                </span></label>
              </div>}
              {screen==="login" && method==="password" && <>
                <label className="da-auth-field"><span>شماره موبایل یا ایمیل</span>
                  <span className="da-auth-input"><Phone size={18}/><input
                    autoComplete="username" inputMode="email" value={identifier} onChange={e=>setIdentifier(e.target.value)}
                    placeholder="۰۹۱۲ ... یا ایمیل قبلی" required dir="auto" /></span>
                </label>
                {renderPassword(password,setPassword,"رمز عبور")}
                <div className="da-auth-aside"><button type="button" onClick={()=>changeScreen("forgot")}>رمز عبورم رو فراموش کردم <ArrowLeft size={15}/></button></div>
              </>}
              {(screen==="signup" || screen==="forgot" || (screen==="login" && method==="sms")) && <label className="da-auth-field">
                <span>شماره موبایل</span>
                <span className="da-auth-input"><Phone size={18}/>
                  <input autoComplete="tel" type="tel" inputMode="tel" dir="ltr"
                    value={phone} onChange={e=>{setPhone(e.target.value);setCodeSent(false);}}
                    placeholder="09123456789" required /></span>
              </label>}
              {screen==="signup" && <>
                {renderPassword(password,setPassword,"رمز عبور جدید","new-password")}
                {renderPassword(confirm,setConfirm,"تکرار رمز عبور","new-password")}
                <p className="da-auth-hint"><ShieldCheck size={16}/> اطلاعاتت به‌صورت امن نگهداری می‌شه. اتصال پیج اینستاگرام بعد از ورود انجام می‌شه.</p>
              </>}
              {screen==="forgot" && <>{codeSent && <>
                <label className="da-auth-field"><span>کد تأیید شش‌رقمی</span><span className="da-auth-input">
                  <Fingerprint size={18}/><input autoComplete="one-time-code" inputMode="numeric" maxLength={6}
                    value={code} onChange={e=>setCode(asciiDigits(e.target.value).replace(/\D/g,"").slice(0,6))} placeholder="ــــــ" dir="ltr"/>
                </span></label>
                {renderPassword(newPassword,setNewPassword,"رمز عبور جدید","new-password")}
                {renderPassword(confirm,setConfirm,"تکرار رمز جدید","new-password")}
              </>}</>}
              {screen==="verify" && <label className="da-auth-field">
                <span>کد تأیید موبایل {phone}</span><span className="da-auth-input">
                  <Fingerprint size={18}/><input inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                    value={code} onChange={e=>setCode(asciiDigits(e.target.value).replace(/\\D/g,"").slice(0,6))}
                    placeholder="۶ رقم" dir="ltr" required/>
                </span>
              </label>}
              {screen==="login" && method==="sms" && codeSent && <label className="da-auth-field">
                <span>کد پیامک‌شده</span><span className="da-auth-input">
                  <Fingerprint size={18}/><input inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                    value={code} onChange={e=>setCode(asciiDigits(e.target.value).replace(/\D/g,"").slice(0,6))} placeholder="۶ رقم" dir="ltr"/>
                </span>
              </label>}
              {(screen==="forgot" || screen==="verify" || (screen==="login" && method==="sms")) && <div className="da-auth-sms-status">
                <MessageCircleMore size={17}/>
                {smsChecked && !smsEnabled ? "زیرساخت پیامک آماده است؛ اتصال سرویس ارسال هنوز فعال نشده." :
                  codeSent ? "کد تا ۲ دقیقه اعتبار داره." : "برای شماره‌های تأییدشده کد یک‌بارمصرف ارسال می‌شه."}
              </div>}
              {codeSent && (screen==="forgot" || screen==="verify" || method==="sms") && <button type="button"
                className="da-auth-resend" disabled={busy || countdown>0 || !smsEnabled}
                onClick={()=>void run(()=>requestOtp(screen==="forgot"?"reset":screen==="verify"?"verify":"login"))}>
                {countdown>0 ? `ارسال مجدد در ${countdown} ثانیه` : "ارسال مجدد کد"}
              </button>}
              {status && <div role="alert" className={`da-auth-alert da-auth-alert--${status.type}`}>
                {status.type==="success"?<CheckCircle2 size={17}/>:<ShieldCheck size={17}/>}<span>{status.message}</span>
              </div>}
              <button type="submit" className="da-auth-submit" disabled={busy || (!smsEnabled && (screen==="forgot" || screen==="verify" || (screen==="login" && method==="sms")))}>
                <span>{busy?"در حال انجام...":screen==="signup"?"ساخت حساب دایرا":screen==="verify"?"تأیید موبایل و ورود":
                  screen==="forgot"?(codeSent?"تغییر رمز عبور":"دریافت کد بازیابی"):
                  method==="sms"?(codeSent?"ورود با کد":"دریافت کد ورود"):"ورود به داشبورد"}</span>
                <ArrowLeft size={20}/>
              </button>
            </form>
            {screen==="verify" && <button className="da-auth-back" onClick={()=>void run(finishSignup)}>
              ادامه با رمز عبور و تأیید موبایل در آینده <ArrowLeft size={16}/>
            </button>}
            {screen==="forgot" && <button className="da-auth-back" onClick={()=>changeScreen("login")}>
              <ArrowLeft size={16}/> بازگشت به ورود
            </button>}
            {screen==="signup" && <div className="da-auth-bottom">قبلاً حساب ساختی؟ <button onClick={()=>changeScreen("login")}>وارد شو</button></div>}
            {screen==="login" && <div className="da-auth-bottom">هنوز عضو دایرا نیستی؟ <button onClick={()=>changeScreen("signup")}>حساب بساز</button></div>}
          </div>
        </div>
        <footer className="da-auth-foot"><span>© دایرا</span><span>سادگی، امنیت، کنترل بیشتر</span></footer>
      </section>
      <aside className="da-auth-showcase" aria-label="معرفی فضای کار دایرا">
        <div className="da-auth-showcase__glow" aria-hidden="true"/>
        <div className="da-auth-showcase__grid" aria-hidden="true"/>
        <div className="da-auth-side-top"><Sparkles size={17}/> YOUR CREATIVE SPACE <span>01 / 03</span></div>
        <div className="da-auth-orbit" aria-hidden="true"><span className="da-auth-orbit__core">D</span><span className="da-auth-orbit__ring"/></div>
        <div className="da-auth-float da-auth-float--one"><span className="da-auth-float__icon"><AtSign size={19}/></span><span><strong>اینستاگرام، متصل</strong><small>همه تعامل‌ها در یک نگاه</small></span><Check size={16}/></div>
        <div className="da-auth-float da-auth-float--two"><span className="da-auth-float__icon"><MessageCircleMore size={19}/></span><span><strong>پاسخ‌های هوشمند</strong><small>با مدیریت ساده‌تر گفتگوها</small></span><span className="da-auth-float__live"/></div>
        <div className="da-auth-side-copy"><div className="da-auth-side-line"><span/> تجربه‌ای متفاوت برای مدیریت پیج</div>
          <h2>همه‌چیز<br/>روون‌تر،<br/><em>زیباتر.</em></h2>
          <p>از اولین پیام تا آخرین تعامل؛ همه در یک فضای یکپارچه، ساده و دقیق.</p>
          <div className="da-auth-side-pill"><WandSparkles size={18}/> ساخته‌شده برای مسیر حرفه‌ای تو <ArrowUpLeft size={17}/></div>
        </div>
        <div className="da-auth-side-bottom"><ShieldCheck size={17}/> مدیریت امن حساب و پیج‌های متصل <span>DAIRA / 2026</span></div>
      </aside>
    </div>
  </main>;
}
