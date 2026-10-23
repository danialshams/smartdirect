"use client";

import GlassModalPresence from "./GlassModalPresence";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check, CircleCheck, ExternalLink, Lightbulb, Link2,
  Menu, MessageSquareText, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import EntryPointFlowBuilder from "./EntryPointFlowBuilder";
import { normalizePersistentMenuUrl, persistentMenuItemChanged } from "@/lib/instagram/persistent-menu-url";

type Account = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type MenuItem = {
  id: string;
  label: string;
  automationId: string | null;
  type: "postback" | "web_url";
  url: string;
};

type Draft = {
  id: string | null;
  label: string;
  automationId: string | null;
  type: "postback" | "web_url";
  url: string;
};

type ServerItem = {
  id: string;
  title?: string;
  automationId?: string | null;
  payload?: string | null;
  type?: "postback" | "web_url";
  url?: string | null;
};

const MAX_MENU_ITEMS = 20;
const MAX_TITLE_LENGTH = 30;
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

function Guide({ numberText, title, description }: { numberText: number; title: string; description: string }) {
  return (
    <div
      className="daira-guide-glass mb-3 flex items-start gap-3 rounded-xl border px-3.5 py-3"
      style={{
        background: dairaPalette.guide.background,
        borderColor: dairaPalette.guide.border,
        color: dairaPalette.guide.text,
      }}
    >
      <Lightbulb className="mt-0.5 shrink-0" size={18} style={{ color: dairaPalette.guide.icon }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white"
            style={{ background: dairaPalette.guide.icon }}>{number(numberText)}</span>
          <strong className="text-sm font-extrabold">{title}</strong>
        </div>
        <p className="mt-1 text-xs leading-6">{description}</p>
      </div>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div role="status" aria-label="در حال دریافت گزینه‌های منوی دایرکت" className="w-full">
      <span className="sr-only">در حال دریافت منو...</span>
      <div className="space-y-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-2"><div className="daira-skeleton__bar h-4 w-32" /><div className="daira-skeleton__bar h-3 w-48" /></div>
          <div className="daira-skeleton__bar h-10 w-28 rounded-xl" />
        </div>
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl border border-[var(--daira-border)] p-3">
            <div className="daira-skeleton__bar h-10 w-10 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2"><div className="daira-skeleton__bar h-3.5 w-36 max-w-full" /><div className="daira-skeleton__bar h-3 w-24" /></div>
            <div className="daira-skeleton__bar h-9 w-16 rounded-lg" />
          </div>
        ))}
      </div>

    </div>
  );
}

async function readResult(response: Response): Promise<{success?: boolean; error?: string; data?: {items?: ServerItem[]}}> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error("پاسخی از سرور دریافت نشد.");
  try {
    return JSON.parse(raw) as {success?: boolean; error?: string; data?: {items?: ServerItem[]}};
  } catch {
    throw new Error("پاسخ نامعتبر از سرور دریافت شد.");
  }
}

function normalizeMenu(items: ServerItem[]): MenuItem[] {
  return items.map((item) => {
    const webUrl = item.payload?.startsWith("__web_url__:") ?? false;
    const type = item.type ?? (webUrl ? "web_url" : "postback");
    return {
      id: item.id,
      label: item.title || "",
      automationId: type === "web_url" ? null : item.automationId ?? null,
      type,
      url: item.url || (webUrl ? item.payload?.slice("__web_url__:".length) || "" : ""),
    };
  });
}


export default function PersistentMenuManager({
  accounts,
  accountsLoading = false,
}: {
  accounts: Account[];
  accountsLoading?: boolean;
}) {
  const account = useMemo(() => accounts.find((item) => item.isConnected) ?? null, [accounts]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editor, setEditor] = useState<Draft | null>(null);
  const [responseDirty, setResponseDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const loadVersion = useRef(0);

  const loadItems = useCallback(async (quiet = false) => {
    const version = ++loadVersion.current;
    if (!account) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(
        "/api/instagram/persistent-menu?instagramAccountId=" + encodeURIComponent(account.id),
        { cache: "no-store", credentials: "include" },
      );
      const result = await readResult(response);
      if (!response.ok || !result.success) throw new Error(result.error || "دریافت منوی دایرکت ناموفق بود.");
      if (version === loadVersion.current) {
        setItems(normalizeMenu(Array.isArray(result.data?.items) ? result.data.items : []));
        setError("");
      }
    } catch (err) {
      if (version === loadVersion.current) {
        setError(err instanceof Error ? err.message : "دریافت منوی دایرکت ناموفق بود.");
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [account?.id]);

  useEffect(() => {
    setEditor(null);
    setNotice("");
    void loadItems();
    return () => { loadVersion.current += 1; };
  }, [loadItems]);

  function openEditor(item?: MenuItem) {
    setResponseDirty(false);
    setError("");
    setNotice("");
    setEditor(item ? {
      id: item.id, label: item.label, type: item.type,
      url: item.url, automationId: item.automationId,
    } : {
      id: null, label: "", type: "postback", url: "", automationId: null,
    });
    window.requestAnimationFrame(() => {
      document.getElementById("persistent-menu-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function cancelEditor() {
    if (saving) return;
    setEditor(null);
    setResponseDirty(false);
    setError("");
  }

  async function saveItem(draft: Draft, automationId: string | null) {
    if (!account || saving) return;
    const original = draft.id ? items.find((item) => item.id === draft.id) ?? null : null;
    if (draft.id && !persistentMenuItemChanged(draft, original) && !responseDirty) return;
    const label = draft.label.trim();
    if (!label || label.length > MAX_TITLE_LENGTH) {
      setError("عنوان گزینه را بین ۱ تا ۳۰ کاراکتر وارد کن.");
      return;
    }
    const normalizedUrl = draft.type === "web_url" ? normalizePersistentMenuUrl(draft.url) : null;
    if (draft.type === "web_url" && !normalizedUrl) {
      setError("لینک واردشده معتبر نیست.");
      return;
    }
    if (draft.type === "postback" && !automationId) {
      setError("ابتدا پاسخ خودکار این گزینه را تنظیم کن.");
      return;
    }
    const saved: MenuItem = {
      id: draft.id || "",
      label,
      type: draft.type,
      url: draft.type === "web_url" ? normalizedUrl! : "",
      automationId: draft.type === "web_url" ? null : automationId,
    };
    const updated = draft.id
      ? items.map((item) => item.id === draft.id ? saved : item)
      : [...items, saved];

    if (updated.length > MAX_MENU_ITEMS) {
      setError("حداکثر ۲۰ گزینه برای منو قابل ثبت است.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/instagram/persistent-menu", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: account.id,
          enabled: updated.length > 0,
          items: updated.map((item) => ({
            title: item.label,
            type: item.type,
            url: item.type === "web_url" ? item.url : null,
            automationId: item.type === "postback" ? item.automationId : null,
          })),
        }),
      });
      const result = await readResult(response);
      if (!response.ok || !result.success) throw new Error(result.error || "ذخیره منو ناموفق بود.");
      setEditor(null);
      setResponseDirty(false);
      setNotice(draft.id ? "تغییرات گزینه ذخیره شد." : "گزینه جدید به منوی دایرکت اضافه شد.");
      await loadItems(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره منو ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!account || !deleteTarget || saving) return;
    const removed = deleteTarget;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const remaining = items.filter((item) => item.id !== removed.id);
      const response = await fetch("/api/instagram/persistent-menu", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: account.id,
          enabled: remaining.length > 0,
          items: remaining.map((item) => ({
            title: item.label,
            type: item.type,
            url: item.type === "web_url" ? item.url : null,
            automationId: item.type === "postback" ? item.automationId : null,
          })),
        }),
      });
      const result = await readResult(response);
      if (!response.ok || !result.success) throw new Error(result.error || "حذف گزینه ناموفق بود.");
      if (editor?.id === removed.id) setEditor(null);
      setNotice("گزینه از منوی دایرکت حذف شد.");
      await loadItems(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حذف گزینه ناموفق بود.");
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  const draftReady = Boolean(editor?.label.trim()) && (editor?.label.trim().length ?? 0) <= MAX_TITLE_LENGTH;
  const savedItem = editor?.id ? items.find((item) => item.id === editor.id) ?? null : null;
  const draftChanged = editor ? persistentMenuItemChanged(editor, savedItem) : false;
  const canSaveChanges = !editor?.id || draftChanged || responseDirty;
  const canCreate = items.length < MAX_MENU_ITEMS && !saving;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-5xl px-1 py-2 sm:px-2 sm:py-4">
      <section aria-labelledby="persistent-menu-heading" className="mb-5 flex items-start gap-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--daira-surface-hover)] text-[var(--daira-primary)]">
          <Menu size={23} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="persistent-menu-heading" className="text-lg font-extrabold text-[var(--daira-heading)]">منوی دایرکت</h1>
          <p className="mt-1 text-xs leading-6 text-[var(--daira-text)]">
            گزینه‌هایی که مخاطب در دایرکت می‌بیند را بساز و برای هرکدام پاسخ خودکار یا لینک تنظیم کن.
          </p>
        </div>
      </section>

      {error && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" className="shrink-0" onClick={() => setError("")} aria-label="بستن خطا"><X size={17} /></button>
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          <CircleCheck size={17} />{notice}
        </div>
      )}

      {(accountsLoading || loading) && !editor ? <MenuSkeleton /> : !account ? (
        <section className="daira-empty-state rounded-2xl border border-dashed border-[var(--daira-border)] bg-white px-5 py-14 text-center">
          <Menu size={30} className="mx-auto text-[var(--daira-text)]" />
          <p className="mt-4 text-sm font-bold text-[var(--daira-heading)]">هیچ پیج اینستاگرامی متصل نیست</p>
          <p className="mt-2 text-xs leading-6 text-[var(--daira-text)]">برای ساخت منوی دایرکت ابتدا پیج را متصل کن.</p>
        </section>
      ) : (
        <>
          <div className="w-full">
            <section className="min-w-0 rounded-2xl border border-[var(--daira-border)] bg-white p-3 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-[var(--daira-heading)]">گزینه‌های منو</h2>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--daira-text)]">
                    {number(items.length)} از {number(MAX_MENU_ITEMS)} گزینه ساخته شده
                  </p>
                </div>
                <button type="button" onClick={() => openEditor()} disabled={!canCreate}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--daira-primary)] px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                  گزینه جدید <Plus size={17} aria-hidden="true" />
                </button>
              </div>

              {!items.length ? (
                <div className="daira-empty-state flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-4 text-center">
                  <MessageSquareText size={26} className="text-[var(--daira-text)]" />
                  <p className="mt-3 text-sm font-bold text-[var(--daira-heading)]">هنوز گزینه‌ای ساخته نشده</p>
                  <p className="mt-1.5 text-xs leading-6 text-[var(--daira-text)]">با «گزینه جدید» اولین گزینه را بساز.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={item.id} className={"flex min-w-0 items-center gap-2 rounded-xl border p-2.5 transition sm:gap-3 sm:p-3 " +
                      (editor?.id === item.id ? "border-blue-300 bg-blue-50/50" : "border-[var(--daira-border)] hover:bg-[var(--daira-surface-hover)]")}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--daira-surface-hover)] text-[11px] font-bold text-[var(--daira-primary)]">{number(index + 1)}</span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[13px] font-bold text-[var(--daira-heading)]">{item.label}</strong>
                        <span className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[11px] text-[var(--daira-text)]">
                          {item.type === "web_url" ? <><ExternalLink size={13} className="shrink-0" />لینک</> : <><MessageSquareText size={13} className="shrink-0" />پاسخ خودکار</>}
                        </span>
                      </span>
                      <button type="button" onClick={() => openEditor(item)} disabled={saving}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--daira-primary)] transition hover:bg-blue-100 disabled:opacity-40"
                        aria-label={"ویرایش " + item.label}><Pencil size={17} /></button>
                      <button type="button" onClick={() => { setDeleteTarget(item); setError(""); }} disabled={saving}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                        aria-label={"حذف " + item.label}><Trash2 size={17} /></button>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-[11px] leading-6 text-[var(--daira-text)]">
                ترتیب نمایش گزینه‌ها در اینستاگرام مطابق ترتیب این فهرست است.
              </p>
            </section>


          </div>

          {editor && (
            <section id="persistent-menu-editor" className="mt-6 scroll-mt-28">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-[var(--daira-heading)]">{editor.id ? "ویرایش گزینه منو" : "ساخت گزینه جدید"}</h2>
                <button type="button" onClick={cancelEditor} disabled={saving} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--daira-border)] bg-white px-3 text-xs font-bold text-[var(--daira-text)] disabled:opacity-50"><X size={16}/> انصراف</button>
              </div>

              <Guide numberText={1} title="عنوان گزینه" description="نام کوتاهی بنویس که مخاطب در منوی دایرکت می‌بیند." />
              <div className="mb-5 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                <label htmlFor="persistent-menu-title" className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">عنوان</label>
                <input id="persistent-menu-title" type="text" maxLength={MAX_TITLE_LENGTH}
                  value={editor.label}
                  onChange={(event) => { setEditor((current) => current ? { ...current, label: event.target.value } : null); setError(""); setNotice(""); }}
                  placeholder="مثلاً مشاهدهٔ محصولات"
                  className="h-12 w-full min-w-0 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3 text-base text-[var(--daira-heading)] outline-none transition focus:border-[var(--daira-primary)] focus:bg-white"
                  style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }} />
                <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--daira-text)]">
                  <span>حداکثر ۳۰ کاراکتر</span><span>{number(editor.label.length)} / {number(MAX_TITLE_LENGTH)}</span>
                </div>
              </div>

              <Guide numberText={2} title="عملکرد گزینه" description="مشخص کن با انتخاب این گزینه، پاسخ خودکار ارسال شود یا لینکی باز شود." />
              <div className="mb-5 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="نوع عملکرد گزینه">
                  {([
                    { type: "postback" as const, title: "پاسخ خودکار", desc: "ارسال پیام به مخاطب", Icon: MessageSquareText },
                    { type: "web_url" as const, title: "لینک", desc: "بازکردن آدرس سایت", Icon: Link2 },
                  ]).map(({ type, title, desc, Icon }) => (
                    <button key={type} type="button" aria-pressed={editor.type === type} disabled={saving}
                      onClick={() => { setEditor((current) => current ? { ...current, type } : null); setError(""); }}
                      className={"flex min-h-[80px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition disabled:opacity-50 " +
                        (editor.type === type ? "border-blue-300 bg-blue-50 text-blue-700" : "border-[var(--daira-border)] bg-white text-[var(--daira-text)] hover:bg-[var(--daira-surface-hover)]")}>
                      <Icon size={20} aria-hidden="true" />
                      <span className="text-xs font-bold">{title}</span>
                      <span className="text-[10px] leading-4">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Guide numberText={3} title={editor.type === "web_url" ? "آدرس لینک" : "پاسخ گزینه"} description={editor.type === "web_url"
                ? "لینک مقصد این گزینه را مشخص کن."
                : "مانند پاسخ خودکار استوری، نوع پاسخ و محتوای آن را در همین صفحه تنظیم کن."} />
              <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                {editor.type === "web_url" ? (
                  <>
                    <label htmlFor="persistent-menu-url" className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">لینک مقصد</label>
                    <input id="persistent-menu-url" type="text" inputMode="url" dir="ltr"
                      value={editor.url} onChange={(event) => { setEditor((current) => current ? { ...current, url: event.target.value } : null); setError(""); }}
                      onBlur={() => setEditor((current) => current && current.type === "web_url" ? { ...current, url: normalizePersistentMenuUrl(current.url) ?? current.url } : current)}
                      placeholder="آدرس سایت"
                      className="h-12 w-full min-w-0 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)] focus:bg-white"
                      style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }} />
                    <button type="button" disabled={!draftReady || !normalizePersistentMenuUrl(editor.url) || !canSaveChanges || saving}
                      onClick={() => void saveItem(editor, null)}
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--daira-primary)] px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                      {saving ? "در حال ذخیره..." : editor.id ? "ذخیره تغییرات" : "ساخت گزینه"}
                      {!saving && <Check size={17} />}
                    </button>
                  </>
                ) : (
                  <EntryPointFlowBuilder
                    key={editor.id || "create"}
                    accountId={account.id}
                    automationId={editor.automationId}
                    modernResponseFlow
                    hideVideo
                    canSave={draftReady && !saving}
                    dirty={canSaveChanges}
                    onResponseDirtyChange={setResponseDirty}
                    responseTypeTitle="نوع پاسخ"
                    responseTypeDescription="متن، عکس، وویس، ویترین یا فرم چندمرحله‌ای را انتخاب کن."
                    textPlaceholder="متن پاسخی که بعد از انتخاب این گزینه برای مخاطب ارسال می‌شود..."
                    finalSaveLabel={editor.id ? "ذخیره تغییرات" : "ساخت گزینه"}
                    finalSaveLoadingLabel="در حال ذخیره..."
                    onAutomationReady={(automationId) => saveItem(editor, automationId)}
                  />
                )}
              </div>
            </section>
          )}
        </>
      )}

      <GlassModalPresence open={Boolean(deleteTarget)} onEscape={() => { if (!saving) setDeleteTarget(null); }}>
      {deleteTarget && (
        <div role="presentation" className="daira-glass-overlay fixed inset-0 z-[2500] flex items-center justify-center px-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDeleteTarget(null); }}>
          <div dir="rtl" role="dialog" aria-modal="true" aria-labelledby="persistent-delete-title" className="daira-glass-dialog daira-glass-dialog--danger w-full max-w-sm rounded-2xl p-5">
            <h3 id="persistent-delete-title" className="text-base font-extrabold text-[var(--daira-heading)]">حذف گزینه منو</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--daira-text)]">
              گزینه «{deleteTarget.label}» از منوی دایرکت حذف می‌شود. پاسخ‌های دیگر بدون تغییر باقی می‌مانند.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={saving}
                className="min-h-11 rounded-xl border border-[var(--daira-border)] bg-white text-xs font-bold text-[var(--daira-heading)] disabled:opacity-50">انصراف</button>
              <button type="button" onClick={() => void deleteItem()} disabled={saving}
                className="min-h-11 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 disabled:opacity-50">
                {saving ? "در حال حذف..." : "حذف گزینه"}
              </button>
            </div>
          </div>
        </div>
      )}
      </GlassModalPresence>
    </div>
  );
}
