"use client";

import GlassModalPresence from "./GlassModalPresence";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleCheck, Lightbulb, MessageCircleQuestion, MessageSquareText, Pencil, Plus, Trash2, X } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import EntryPointFlowBuilder from "./EntryPointFlowBuilder";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type Question = { id: string; label: string; automationId: string | null };
type Draft = { id: string | null; label: string; automationId: string | null };
type ServerQuestion = { id: string; question?: string; automationId?: string | null };
type IceBreakerResult = { success?: boolean; error?: string; data?: ServerQuestion[] };

const MAX_QUESTIONS = 4;
const MAX_LENGTH = 80;
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
      <Lightbulb size={18} className="mt-0.5 shrink-0" style={{ color: dairaPalette.guide.icon }} aria-hidden="true" />
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

function IceBreakerSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5"
      role="status" aria-label="در حال دریافت پیام‌های شروع گفتگو">
      <span className="sr-only">در حال دریافت پیام‌های شروع گفتگو...</span>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="daira-skeleton__bar h-4 w-40" />
          <div className="daira-skeleton__bar h-3 w-28" />
        </div>
        <div className="daira-skeleton__bar h-10 w-32 rounded-xl" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--daira-border)] p-3">
            <div className="daira-skeleton__bar h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="daira-skeleton__bar h-3.5 w-52 max-w-full" />
              <div className="daira-skeleton__bar h-3 w-28" />
            </div>
            <div className="daira-skeleton__bar h-9 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function readResult(response: Response): Promise<IceBreakerResult> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error("پاسخی از سرور دریافت نشد.");
  try {
    return JSON.parse(raw) as IceBreakerResult;
  } catch {
    throw new Error("پاسخ نامعتبر از سرور دریافت شد.");
  }
}

export default function IceBreakerManager({
  accounts,
  accountsLoading = false,
}: {
  accounts: InstagramAccount[];
  accountsLoading?: boolean;
}) {
  const account = useMemo(() => accounts.find((item) => item.isConnected) ?? null, [accounts]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editor, setEditor] = useState<Draft | null>(null);
  const [responseDirty, setResponseDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const loadVersion = useRef(0);

  const loadQuestions = useCallback(async (quiet = false) => {
    const version = ++loadVersion.current;
    if (!account) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(
        "/api/instagram/ice-breakers?instagramAccountId=" + encodeURIComponent(account.id),
        { cache: "no-store", credentials: "include" },
      );
      const result = await readResult(response);
      if (!response.ok || !result.success || !Array.isArray(result.data))
        throw new Error(result.error || "دریافت پیام‌های شروع گفتگو ناموفق بود.");
      if (version === loadVersion.current) {
        setQuestions(result.data.map((item) => ({
          id: item.id,
          label: item.question ?? "",
          automationId: item.automationId ?? null,
        })));
        setError("");
      }
    } catch (loadError) {
      if (version === loadVersion.current)
        setError(loadError instanceof Error ? loadError.message : "دریافت پیام‌های شروع گفتگو ناموفق بود.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [account?.id]);

  useEffect(() => {
    setEditor(null);
    setResponseDirty(false);
    setNotice("");
    void loadQuestions();
    return () => { loadVersion.current += 1; };
  }, [loadQuestions]);

  function openEditor(question?: Question) {
    setError("");
    setNotice("");
    setResponseDirty(false);
    setEditor(question ? {
      id: question.id, label: question.label, automationId: question.automationId,
    } : {
      id: null, label: "", automationId: null,
    });
    window.requestAnimationFrame(() => {
      document.getElementById("ice-breaker-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeEditor() {
    if (saving) return;
    setEditor(null);
    setResponseDirty(false);
    setError("");
  }

  async function saveQuestion(draft: Draft, automationId: string) {
    if (!account || saving) return;
    const original = draft.id ? questions.find((item) => item.id === draft.id) : null;
    if (original && original.label.trim() === draft.label.trim() && !responseDirty) return;

    const label = draft.label.trim();
    if (!label || label.length > MAX_LENGTH) {
      setError("متن پیام باید بین ۱ تا ۸۰ کاراکتر باشد.");
      return;
    }
    if (!automationId) {
      setError("پاسخ خودکار این پیام را تنظیم کن.");
      return;
    }

    const updated = draft.id
      ? questions.map((item) => item.id === draft.id ? { ...item, label, automationId } : item)
      : [...questions, { id: "", label, automationId }];

    if (updated.length > MAX_QUESTIONS) {
      setError("حداکثر ۴ پیام شروع گفتگو می‌توانی بسازی.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/instagram/ice-breakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          items: updated.map((item) => ({
            question: item.label.trim(),
            automationId: item.automationId,
          })),
        }),
      });
      const result = await readResult(response);
      if (!response.ok || !result.success)
        throw new Error(result.error || "ذخیره پیام شروع گفتگو ناموفق بود.");

      setEditor(null);
      setResponseDirty(false);
      setNotice(draft.id ? "تغییرات پیام ذخیره شد." : "پیام جدید به پیام‌های شروع گفتگو اضافه شد.");
      await loadQuestions(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ذخیره پیام شروع گفتگو ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion() {
    if (!account || !deleteTarget || saving) return;
    const removed = deleteTarget;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const remaining = questions.filter((item) => item.id !== removed.id);
      const response = await fetch("/api/instagram/ice-breakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          items: remaining.map((item) => ({
            question: item.label.trim(),
            automationId: item.automationId,
          })),
        }),
      });
      const result = await readResult(response);
      if (!response.ok || !result.success)
        throw new Error(result.error || "حذف پیام شروع گفتگو ناموفق بود.");
      // A response automation may be reused elsewhere; removing an ice breaker
      // must only detach the question, not delete the automation itself.
      if (editor?.id === removed.id) setEditor(null);
      setResponseDirty(false);
      setNotice("پیام از فهرست شروع گفتگو حذف شد.");
      await loadQuestions(true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "حذف پیام شروع گفتگو ناموفق بود.");
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  const savedQuestion = editor?.id ? questions.find((item) => item.id === editor.id) : null;
  const labelChanged = Boolean(savedQuestion && editor && editor.label.trim() !== savedQuestion.label.trim());
  const canSaveChanges = !editor?.id || labelChanged || responseDirty;
  const draftReady = Boolean(editor?.label.trim()) && (editor?.label.trim().length ?? 0) <= MAX_LENGTH;
  const canCreate = questions.length < MAX_QUESTIONS && !saving;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-5xl px-1 py-2 sm:px-2 sm:py-4">
      <section aria-labelledby="ice-breaker-heading" className="mb-5 flex items-start gap-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--daira-surface-hover)] text-[var(--daira-primary)]">
          <MessageCircleQuestion size={23} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="ice-breaker-heading" className="text-lg font-extrabold text-[var(--daira-heading)]">پیام‌های شروع گفتگو</h1>
          <p className="mt-1 text-xs leading-6 text-[var(--daira-text)]">
            پیام‌هایی که مخاطب هنگام شروع یک گفتگوی جدید می‌بیند را بساز و پاسخ هرکدام را تنظیم کن.
          </p>
        </div>
      </section>

      {error && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} className="shrink-0" aria-label="بستن خطا"><X size={17} /></button>
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          <CircleCheck size={17} />{notice}
        </div>
      )}

      {(accountsLoading || loading) && !editor ? <IceBreakerSkeleton /> : !account ? (
        <section className="daira-empty-state rounded-2xl border border-dashed border-[var(--daira-border)] bg-white px-5 py-14 text-center">
          <MessageCircleQuestion size={30} className="mx-auto text-[var(--daira-text)]" />
          <p className="mt-4 text-sm font-bold text-[var(--daira-heading)]">هیچ پیج اینستاگرامی متصل نیست</p>
          <p className="mt-2 text-xs leading-6 text-[var(--daira-text)]">برای ساخت پیام‌های شروع گفتگو ابتدا پیج را متصل کن.</p>
        </section>
      ) : (
        <>
          <section className="min-w-0 rounded-2xl border border-[var(--daira-border)] bg-white p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-[var(--daira-heading)]">پیام‌های ساخته‌شده</h2>
                <p className="mt-1 text-[11px] leading-5 text-[var(--daira-text)]">
                  {number(questions.length)} از {number(MAX_QUESTIONS)} پیام ساخته شده
                </p>
              </div>
              <button type="button" onClick={() => openEditor()} disabled={!canCreate}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--daira-primary)] px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                پیام جدید <Plus size={17} aria-hidden="true" />
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="daira-empty-state flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-4 text-center">
                <MessageSquareText size={26} className="text-[var(--daira-text)]" />
                <p className="mt-3 text-sm font-bold text-[var(--daira-heading)]">هنوز پیامی ساخته نشده</p>
                <p className="mt-1.5 text-xs leading-6 text-[var(--daira-text)]">با «پیام جدید» اولین پیام شروع گفتگو را بساز.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <div key={question.id} className={"flex min-w-0 items-center gap-2 rounded-xl border p-2.5 transition sm:gap-3 sm:p-3 " +
                    (editor?.id === question.id ? "border-blue-300 bg-blue-50/50" : "border-[var(--daira-border)] hover:bg-[var(--daira-surface-hover)]")}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--daira-surface-hover)] text-[11px] font-bold text-[var(--daira-primary)]">{number(index + 1)}</span>
                    <span className="min-w-0 flex-1">
                      <strong className="block break-words text-[13px] font-bold leading-6 text-[var(--daira-heading)]">{question.label}</strong>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--daira-text)]">
                        <MessageSquareText size={13} className="shrink-0" /> پاسخ خودکار
                      </span>
                    </span>
                    <button type="button" onClick={() => openEditor(question)} disabled={saving}
                      aria-label={"ویرایش " + question.label}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--daira-primary)] transition hover:bg-blue-100 disabled:opacity-40">
                      <Pencil size={17} />
                    </button>
                    <button type="button" onClick={() => { setDeleteTarget(question); setError(""); }} disabled={saving}
                      aria-label={"حذف " + question.label}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-600 transition hover:bg-red-50 disabled:opacity-40">
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-[11px] leading-6 text-[var(--daira-text)]">
              این پیام‌ها فقط برای مخاطبی نمایش داده می‌شوند که هنوز گفتگویی با پیج نداشته است.
            </p>
          </section>

          {editor && (
            <section id="ice-breaker-editor" className="mt-6 scroll-mt-28">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-[var(--daira-heading)]">{editor.id ? "ویرایش پیام شروع گفتگو" : "ساخت پیام جدید"}</h2>
                <button type="button" onClick={closeEditor} disabled={saving}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--daira-border)] bg-white px-3 text-xs font-bold text-[var(--daira-text)] disabled:opacity-50">
                  <X size={16} /> انصراف
                </button>
              </div>

              <Guide numberText={1} title="متن پیام" description="متن کوتاهی بنویس که مخاطب هنگام شروع گفتگو انتخاب می‌کند." />
              <div className="mb-5 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                <label htmlFor="ice-breaker-text" className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">متن پیام</label>
                <input id="ice-breaker-text" type="text" maxLength={MAX_LENGTH}
                  value={editor.label}
                  onChange={(event) => { setEditor((current) => current ? { ...current, label: event.target.value } : null); setError(""); setNotice(""); }}
                  placeholder="مثلاً محصولات شما را ببینم"
                  className="h-12 w-full min-w-0 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3 text-base text-[var(--daira-heading)] outline-none transition focus:border-[var(--daira-primary)] focus:bg-white"
                  style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }} />
                <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--daira-text)]">
                  <span>حداکثر ۸۰ کاراکتر</span>
                  <span>{number(editor.label.length)} / {number(MAX_LENGTH)}</span>
                </div>
              </div>

              <Guide numberText={2} title="پاسخ پیام" description="نوع پاسخی که بعد از انتخاب این پیام ارسال می‌شود را مشخص کن." />
              <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                <EntryPointFlowBuilder
                  key={editor.id || "create"}
                  accountId={account.id}
                  automationId={editor.automationId}
                  modernResponseFlow
                  canSave={draftReady && !saving}
                  dirty={canSaveChanges}
                  onResponseDirtyChange={setResponseDirty}
                  responseTypeTitle="نوع پاسخ"
                  responseTypeDescription="متن، عکس، ویدیو، وویس، ویترین یا فرم چندمرحله‌ای را انتخاب کن."
                  textPlaceholder="متنی که بعد از انتخاب این پیام برای مخاطب ارسال می‌شود..."
                  finalSaveLabel={editor.id ? "ذخیره تغییرات" : "ساخت پیام"}
                  finalSaveLoadingLabel="در حال ذخیره..."
                  onAutomationReady={(automationId) => saveQuestion(editor, automationId)}
                />
              </div>
            </section>
          )}
        </>
      )}

      <GlassModalPresence open={Boolean(deleteTarget)} onEscape={() => { if (!saving) setDeleteTarget(null); }}>
      {deleteTarget && (
        <div role="presentation" className="daira-glass-overlay fixed inset-0 z-[2500] flex items-center justify-center px-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDeleteTarget(null); }}>
          <div dir="rtl" role="dialog" aria-modal="true" aria-labelledby="ice-breaker-delete-title" className="daira-glass-dialog daira-glass-dialog--danger w-full max-w-sm rounded-2xl p-5">
            <h3 id="ice-breaker-delete-title" className="text-base font-extrabold text-[var(--daira-heading)]">حذف پیام شروع گفتگو</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--daira-text)]">
              پیام «{deleteTarget.label}» از فهرست شروع گفتگو حذف می‌شود. پاسخ‌های دیگر بدون تغییر باقی می‌مانند.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={saving}
                className="min-h-11 rounded-xl border border-[var(--daira-border)] bg-white text-xs font-bold text-[var(--daira-heading)] disabled:opacity-50">انصراف</button>
              <button type="button" onClick={() => void deleteQuestion()} disabled={saving}
                className="min-h-11 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 disabled:opacity-50">
                {saving ? "در حال حذف..." : "حذف پیام"}
              </button>
            </div>
          </div>
        </div>
      )}
      </GlassModalPresence>
    </div>
  );
}
