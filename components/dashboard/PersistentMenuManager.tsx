"use client";

import { Button, Input } from "@/components/dashboard/DashboardUI";
import { CheckCircle2, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EntryPointFlowBuilder from "./EntryPointFlowBuilder";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type MenuItem = {
  id?: string;
  label: string;
  automationId: string | null;
};

type ServerMenuItem = {
  id: string;
  title?: string;
  automationId?: string | null;
};

export default function PersistentMenuManager({
  accounts,
}: {
  accounts: InstagramAccount[];
}) {
  const account = useMemo(
    () => accounts.find((item) => item.isConnected) ?? null,
    [accounts],
  );

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editAutomationId, setEditAutomationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

  async function readResult(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("پاسخ نامعتبر از سرور دریافت شد.");
    }
  }

  async function loadMenuItems() {
    if (!account) {
      setMenuItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `/api/instagram/persistent-menu?instagramAccountId=${encodeURIComponent(account.id)}`,
        { cache: "no-store", credentials: "include" },
      );
      const result = await readResult(response);

      if (!response.ok || result.success !== true) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "دریافت گزینه‌های منوی دایرکت ناموفق بود.",
        );
      }

      const menu = result.data && typeof result.data === "object" ? (result.data as { items?: ServerMenuItem[] }) : null;
      const data = Array.isArray(menu?.items) ? menu.items : [];
      setMenuItems(
        data.map((item) => {
          const value = item as ServerMenuItem;
          return {
            id: value.id,
            label: value.title ?? "",
            automationId: value.automationId ?? null,
          };
        }),
      );
    } catch (requestError) {
      setMenuItems([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "دریافت گزینه‌های منوی دایرکت ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMenuItems();
  }, [account?.id]);

  function startEdit(menuItem: MenuItem) {
    setEditingId(menuItem.id ?? null);
    setEditDraft(menuItem.label);
    setEditAutomationId(menuItem.automationId);
    setSuccess(false);
    setError("");
  }

  async function saveMenuItem(
    labelOverride: string,
    editingIdOverride: string | null,
    automationIdOverride?: string,
  ) {
    if (!account) return;

    const label = labelOverride.trim();
    if (!label) {
      setError("عنوان گزینه را وارد کنید.");
      return;
    }
    if (label.length > 30) {
      setError("عنوان گزینه نباید بیشتر از ۳۰ کاراکتر باشد.");
      return;
    }
    const resolvedAutomationId = automationIdOverride;
    if (!resolvedAutomationId) {
      setError("ابتدا پاسخ گزینه را تنظیم و ذخیره کنید.");
      return;
    }

    const nextMenuItems = editingIdOverride
      ? menuItems.map((menuItem) =>
          menuItem.id === editingIdOverride
            ? { ...menuItem, label, automationId: resolvedAutomationId }
            : menuItem,
        )
      : [...menuItems, { label, automationId: resolvedAutomationId }];

    if (nextMenuItems.length > 20) {
      setError("حداکثر ۲۰ گزینه برای منوی دایرکت می‌توانید بسازید.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess(false);

      const response = await fetch("/api/instagram/persistent-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          enabled: nextMenuItems.length > 0,
          items: nextMenuItems.map((menuItem) => ({
            title: menuItem.label.trim(),
            type: "postback",
            automationId: menuItem.automationId,
            url: null,
          })),
        }),
      });

      const result = await readResult(response);
      if (!response.ok || result.success !== true) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "ذخیره گزینه منوی دایرکت ناموفق بود.",
        );
      }

      setSuccess(true);
      setEditingId(null);
      setDraft("");
      setEditDraft("");
      setEditAutomationId(null);
      await loadMenuItems();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "ذخیره گزینه منوی دایرکت ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMenuItem(menuItem: MenuItem) {
    if (!account) return;

    try {
      setSaving(true);
      setError("");

      const remaining = menuItems.filter((item) => item.id !== menuItem.id);
      const response = await fetch("/api/instagram/persistent-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          enabled: remaining.length > 0,
          items: remaining.map((item) => ({
            title: item.label.trim(),
            type: "postback",
            automationId: item.automationId,
            url: null,
          })),
        }),
      });

      const result = await readResult(response);
      if (!response.ok || result.success !== true) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "حذف گزینه منوی دایرکت ناموفق بود.",
        );
      }

      if (menuItem.automationId) {
        await fetch(
          `/api/automations/${encodeURIComponent(menuItem.automationId)}`,
          { method: "DELETE", credentials: "include" },
        ).catch(() => undefined);
      }

      if (editingId === menuItem.id) {
        setEditingId(null);
        setDraft("");
      }

      await loadMenuItems();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "حذف گزینه منوی دایرکت ناموفق بود.",
      );
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
    <div dir="rtl" className="bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            منوی دایرکت
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">
            گزینه‌هایی بساز که کاربر بتواند از منوی دایرکت انتخاب کند و برای هر گزینه پاسخ اختصاصی تنظیم کن.
          </p>
        </div>

        {!account ? (
          <section className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-16 text-center">
            <MessageSquare className="mx-auto text-[#94A3B8]" size={24} />
            <h2 className="mt-4 text-base font-bold text-[#0F172A]">
              ابتدا یک پیج اینستاگرام متصل کنید
            </h2>
          </section>
        ) : (
          <div className="space-y-5">
            <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">
                  ۱
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0F172A]">عنوان گزینه</h2>
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
                    متنی بنویس که کاربر بتواند با یک لمس انتخابش کند.
                  </p>
                </div>
              </div>

              <Input
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSuccess(false);
                  setError("");
                }}
                maxLength={30}
                placeholder="مثلاً: مشاهده محصولات"
                className="h-12 rounded-xl border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-base text-[#0F172A] focus:border-[#2563EB] focus:bg-white"
                style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }}
              />

              <div className="mt-2 flex items-center justify-between text-[10px] text-[#64748B]">
                <span>حداکثر ۳۰ کاراکتر</span>
                <span>{draft.length.toLocaleString("fa-IR")} / ۳۰</span>
              </div>
            </section>

            <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">
                  ۲
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0F172A]">پاسخ گزینه</h2>
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
                    نوع و محتوای پاسخ این گزینه را مشخص کن.
                  </p>
                </div>
              </div>

              <EntryPointFlowBuilder
                accountId={account.id}
                automationId={null}
                hideVideo
                responseTypeTitle="نوع پاسخ گزینه"
                responseTypeDescription="نوع و محتوای پاسخی را که بعد از انتخاب این گزینه ارسال می‌شود مشخص کن."
                textPlaceholder="متنی که به‌عنوان پاسخ گزینه منوی دایرکت برای کاربر ارسال می‌شود..."
                finalSaveLabel="ساخت پاسخ گزینه"
                finalSaveLoadingLabel="در حال ساخت پاسخ گزینه..."
                onAutomationReady={(automationId) => {
                  void saveMenuItem(draft, null, automationId);
                }}
              />
            </section>

            {error && (
              <div className="mx-auto w-full max-w-2xl rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium leading-5 text-[#B91C1C]" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3 text-xs font-medium text-[#15803D]">
                <CheckCircle2 size={16} />
                گزینه منوی دایرکت با موفقیت ذخیره شد.
              </div>
            )}

            <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">
                  ۳
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0F172A]">گزینه‌های ساخته‌شده</h2>
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
                    گزینه‌هایی که قبلاً ساخته‌ای را از اینجا مشاهده، ویرایش یا حذف کن.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-24 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2563EB]/20 border-t-[#2563EB]" />
                </div>
              ) : menuItems.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 text-center text-xs font-medium text-[#94A3B8]">
                  هنوز گزینه‌ای برای منوی دایرکت ساخته نشده است.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {menuItems.map((menuItem, index) => (
                    <div key={menuItem.id ?? `menuItem-${index}`}>
                    <div
                      className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 transition hover:border-[#BFDBFE] hover:bg-[#F8FBFF] sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                          <MessageSquare size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words whitespace-pre-wrap text-sm font-bold leading-6 text-[#0F172A]">
                            {menuItem.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex w-full shrink-0 items-center gap-2 border-t border-[#E2E8F0] pt-2 sm:w-auto sm:border-0 sm:pt-0">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => startEdit(menuItem)}
                          className="h-9 flex-1 rounded-lg border-[#BFDBFE] bg-white px-2.5 text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF] sm:flex-none"
                          aria-label="ویرایش گزینه"
                        >
                          <Pencil size={14} />
                          <span className="hidden sm:inline">ویرایش</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDeleteTarget(menuItem)}
                          disabled={saving}
                          className="h-9 flex-1 rounded-lg border-[#FECACA] bg-white px-2.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] sm:flex-none"
                          aria-label="حذف گزینه"
                        >
                          <Trash2 size={14} className="text-[#DC2626]" />
                          <span className="hidden sm:inline text-[#DC2626]">حذف</span>
                        </Button>
                      </div>
                    </div>
                    {editingId === menuItem.id && (
                      <div className="mt-3 rounded-2xl border border-[#BFDBFE] bg-white p-4 shadow-sm sm:p-5">
                        <div className="mb-5 flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[10px] font-bold text-[#2563EB]">
                            ویرایش
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-[#0F172A]">ویرایش گزینه منوی دایرکت</h3>
                            <p className="mt-1 text-xs leading-5 text-[#64748B]">
                              عنوان و پاسخ این گزینه را در همین بخش ویرایش کن.
                            </p>
                          </div>
                        </div>

                        <Input
                          value={editDraft}
                          onChange={(event) => {
                            setEditDraft(event.target.value);
                            setSuccess(false);
                            setError("");
                          }}
                          maxLength={30}
                          placeholder="مثلاً: مشاهده محصولات"
                          className="h-12 rounded-xl border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-base text-[#0F172A] focus:border-[#2563EB] focus:bg-white"
                          style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }}
                        />

                        <div className="mt-2 flex items-center justify-between text-[10px] text-[#64748B]">
                          <span>حداکثر ۳۰ کاراکتر</span>
                          <span>{editDraft.length.toLocaleString("fa-IR")} / ۳۰</span>
                        </div>

                        <div className="mt-5">
                          <EntryPointFlowBuilder
                            accountId={account.id}
                            automationId={editAutomationId}
                            hideVideo
                            responseTypeTitle="نوع پاسخ گزینه"
                            responseTypeDescription="نوع و محتوای پاسخی را که بعد از انتخاب این گزینه ارسال می‌شود مشخص کن."
                            textPlaceholder="متنی که به‌عنوان پاسخ گزینه منوی دایرکت برای کاربر ارسال می‌شود..."
                            finalSaveLabel="ذخیره پاسخ"
                            finalSaveLoadingLabel="در حال ذخیره پاسخ..."
                            onAutomationReady={(automationId) => {
                              void saveMenuItem(editDraft, editingId, automationId);
                            }}
                          />
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft("");
                              setEditAutomationId(null);
                              setError("");
                            }}
                            className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#F1F5F9] px-4 text-sm font-bold text-[#475569] transition hover:bg-[#E2E8F0] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            انصراف
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-4 text-[10px] text-[#64748B]">
                <span>حداکثر ۲۰ گزینه</span>
                <span>{menuItems.length.toLocaleString("fa-IR")} / ۲۰</span>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setDeleteTarget(null);
          }}
        >
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-message-title"
            className="w-full max-w-sm rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xl"
          >
            <h3 id="delete-message-title" className="text-base font-bold text-[#0F172A]">
              مطمئنی می‌خوای این مورد رو پاک کنی؟
            </h3>
            <p className="mt-2 break-words text-sm leading-6 text-[#64748B]">
              گزینه «{deleteTarget.label}» حذف می‌شود و تنظیم پاسخ آن هم دیگر به این گزینه متصل نخواهد بود.
            </p>
            <div className="mt-5 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}
                className="h-10 flex-1 rounded-xl border-[#E2E8F0] bg-white text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]">
                انصراف
              </Button>
              <Button type="button" variant="outline" onClick={() => void deleteMenuItem(deleteTarget)} disabled={saving}
                className="h-10 flex-1 rounded-xl border-[#FECACA] bg-[#FEF2F2] text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2]">
                {saving ? "در حال حذف..." : "بله، حذف شود"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
