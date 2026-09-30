"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Check,
  ChevronDown,
  Loader2,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EntryPointFlowBuilder from "./EntryPointFlowBuilder";

type Account = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type Item = {
  id?: string;
  label: string;
  automationId: string | null;
  type: "postback" | "web_url";
  url: string;
};

type ServerItem = {
  id: string;
  question?: string;
  title?: string;
  automationId?: string | null;
  payload?: string;
  type?: "postback" | "web_url";
  url?: string | null;
};

type Props = {
  accounts: Account[];
  kind: "ice-breaker" | "persistent-menu";
};

const config = {
  "ice-breaker": {
    title: "سؤال‌های شروع گفتگو",
    shortTitle: "سؤال",
    addLabel: "سؤال جدید",
    emptyTitle: "هنوز سؤال شروع گفتگویی ندارید",
    emptyText: "با «سؤال جدید» اولین سؤال را بسازید و پاسخ آن را تنظیم کنید.",
    searchPlaceholder: "جستجو بر اساس متن سؤال...",
    max: 4,
    maxLength: 80,
    placeholder: "مثلاً: محصولات شما را ببینم",
    api: "/api/instagram/ice-breakers",
    saveText: "ذخیره سؤال‌ها",
  },
  "persistent-menu": {
    title: "منوی دایرکت",
    shortTitle: "گزینه",
    addLabel: "گزینه جدید",
    emptyTitle: "هنوز گزینه‌ای برای منوی دایرکت ندارید",
    emptyText: "با «گزینه جدید» اولین گزینه را بسازید و پاسخ آن را تنظیم کنید.",
    searchPlaceholder: "جستجو بر اساس عنوان گزینه...",
    max: 20,
    maxLength: 30,
    placeholder: "مثلاً: مشاهده محصولات",
    api: "/api/instagram/persistent-menu",
    saveText: "ذخیره منو",
  },
} as const;

export default function EntryPointManager({ accounts, kind }: Props) {
  const c = config[kind];
  const account = useMemo(
    () => accounts.find((item) => item.isConnected) ?? null,
    [accounts],
  );

  const [items, setItems] = useState<Item[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function readResult(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("پاسخ نامعتبر از سرور دریافت شد.");
    }
  }

  async function load() {
    if (!account) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `${c.api}?instagramAccountId=${encodeURIComponent(account.id)}`,
        { cache: "no-store", credentials: "include" },
      );
      const result = await readResult(response);

      if (!response.ok || result.success !== true) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "دریافت تنظیمات ناموفق بود.",
        );
      }

      if (kind === "ice-breaker") {
        const data = Array.isArray(result.data) ? result.data : [];
        setItems(
          data.map((item) => {
            const value = item as ServerItem;
            return {
              id: value.id,
              label: value.question ?? "",
              automationId: value.automationId ?? null,
            };
          }),
        );
        setEnabled(data.length > 0);
      } else {
        const menu =
          result.data && typeof result.data === "object"
            ? (result.data as { enabled?: boolean; items?: ServerItem[] })
            : null;
        const data = Array.isArray(menu?.items) ? menu.items : [];
        setEnabled(Boolean(menu?.enabled));
        setItems(
          data.map((item) => ({
            id: item.id,
            label: item.title ?? "",
            automationId: item.automationId ?? null,
          })),
        );
      }

      setSelectedIds([]);
      setOpenId(null);
    } catch (requestError) {
      setItems([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "دریافت تنظیمات ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [account?.id, kind]);

  function addItem() {
    if (items.length >= c.max) return;
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((current) => [
      ...current,
      { id, label: "", automationId: null, type: "postback", url: "" },
    ]);
    setOpenId(id);
    setSuccess(false);
  }

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    setSuccess(false);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.label.toLowerCase().includes(query));
  }, [items, search]);

  const allSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => item.id && selectedIds.includes(item.id));

  function toggleSelectAll() {
    const ids = filteredItems.map((item) => item.id).filter(Boolean) as string[];
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    );
  }

  function validateItems() {
    if (!items.length) return;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.label.trim()) {
        throw new Error(`${c.shortTitle} ${index + 1} را وارد کنید.`);
      }
      if (item.label.trim().length > c.maxLength) {
        throw new Error(
          `${c.shortTitle} ${index + 1} نباید بیشتر از ${c.maxLength} کاراکتر باشد.`,
        );
      }
      if (kind === "persistent-menu" && item.type === "web_url") {
        if (!item.url.trim()) {
          throw new Error(`لینک گزینه ${index + 1} را وارد کنید.`);
        }
        try {
          const url = new URL(item.url.trim());
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          throw new Error(`لینک گزینه ${index + 1} معتبر نیست.`);
        }
      } else if (!item.automationId) {
        throw new Error(
          `پاسخ ${c.shortTitle} ${index + 1} هنوز ذخیره نشده است.`,
        );
      }
    }
  }

  async function save() {
    if (!account) return;
    try {
      validateItems();
      setSaving(true);
      setError("");
      setSuccess(false);

      const response = await fetch(c.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          kind === "ice-breaker"
            ? {
                instagramAccountId: account.id,
                items: items.map((item) => ({
                  question: item.label.trim(),
                  automationId: item.automationId,
                })),
              }
            : {
                instagramAccountId: account.id,
                enabled: enabled && items.length > 0,
                items: items.map((item) => ({
                  title: item.label.trim(),
                  type: item.type,
                  automationId: item.type === "web_url" ? null : item.automationId,
                  url: item.type === "web_url" ? item.url.trim() : null,
                })),
              },
        ),
      });

      const result = await readResult(response);
      if (!response.ok || result.success !== true) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : `ذخیره ${c.title} ناموفق بود.`,
        );
      }

      setSuccess(true);
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "ذخیره ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: Item) {
    if (!account) return;
    const remaining = items.filter((current) => current.id !== item.id);

    try {
      setSaving(true);
      setError("");
      setDeleteTarget(null);

      const response = await fetch(c.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          kind === "ice-breaker"
            ? {
                instagramAccountId: account.id,
                items: remaining.map((current) => ({
                  question: current.label.trim(),
                  automationId: current.automationId,
                })),
              }
            : {
                instagramAccountId: account.id,
                enabled: enabled && remaining.length > 0,
                items: remaining.map((current) => ({
                  title: current.label.trim(),
                  automationId: current.automationId,
                })),
              },
        ),
      });

      const result = await readResult(response);
      if (!response.ok || result.success !== true) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "حذف ناموفق بود.",
        );
      }

      if (item.automationId) {
        await fetch(`/api/automations/${encodeURIComponent(item.automationId)}`, {
          method: "DELETE",
          credentials: "include",
        }).catch(() => undefined);
      }

      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "حذف ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function bulkDelete() {
    const targets = items.filter(
      (item) => item.id && selectedIds.includes(item.id),
    );
    if (!targets.length) return;

    setSaving(true);
    setError("");
    try {
      const targetIds = new Set(targets.map((item) => item.id));
      const remaining = items.filter((item) => !targetIds.has(item.id));

      const response = await fetch(c.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          kind === "ice-breaker"
            ? {
                instagramAccountId: account?.id,
                items: remaining.map((item) => ({
                  question: item.label.trim(),
                  automationId: item.automationId,
                })),
              }
            : {
                instagramAccountId: account?.id,
                enabled: enabled && remaining.length > 0,
                items: remaining.map((item) => ({
                  title: item.label.trim(),
                  automationId: item.automationId,
                })),
              },
        ),
      });
      const result = await readResult(response);
      if (!response.ok || result.success !== true) {
        throw new Error(
          typeof result.error === "string" ? result.error : "حذف ناموفق بود.",
        );
      }

      await Promise.all(
        targets
          .map((item) => item.automationId)
          .filter(Boolean)
          .map((automationId) =>
            fetch(`/api/automations/${encodeURIComponent(automationId!)}`, {
              method: "DELETE",
              credentials: "include",
            }).catch(() => undefined),
          ),
      );

      setSelectedIds([]);
      setBulkDeleteOpen(false);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "حذف ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    if (!account) return;
    try {
      setSaving(true);
      setError("");
      const response = await fetch(
        `${c.api}?instagramAccountId=${encodeURIComponent(account.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      const result = await readResult(response);
      if (!response.ok || result.success !== true) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "غیرفعال‌سازی ناموفق بود.",
        );
      }
      const automationIds = items
        .map((item) => item.automationId)
        .filter(Boolean) as string[];

      await Promise.all(
        automationIds.map((automationId) =>
          fetch(`/api/automations/${encodeURIComponent(automationId)}`, {
            method: "DELETE",
            credentials: "include",
          }).catch(() => undefined),
        ),
      );

      setItems([]);
      setSelectedIds([]);
      setEnabled(false);
      setOpenId(null);
      setSuccess(true);
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "غیرفعال‌سازی ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="w-full space-y-4">
      <section className="rounded-3xl border border-border/80 bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">{c.title}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {c.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {kind === "ice-breaker"
                  ? "سؤال‌هایی که کاربر هنگام شروع گفتگو می‌تواند انتخاب کند."
                  : "گزینه‌هایی که کاربر می‌تواند همیشه از منوی دایرکت انتخاب کند."}
              </p>
            </div>
            <Button
              type="button"
              onClick={addItem}
              disabled={!account || items.length >= c.max}
              className="min-h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Plus size={16} />
              {c.addLabel}
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={c.searchPlaceholder}
                className="h-11 rounded-xl pr-10"
              />
            </div>
            {selectedIds.length > 0 && (
              <Button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
              >
                پاک کردن {selectedIds.length} مورد
              </Button>
            )}
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/70 pt-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex min-h-9 items-center gap-2 text-xs font-semibold"
              >
                <span
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-md border transition",
                    allSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background",
                  ].join(" ")}
                >
                  {allSelected && <Check size={13} strokeWidth={3} />}
                </span>
                انتخاب همه
              </button>
              <span className="text-xs text-muted-foreground">
                {filteredItems.length} مورد
              </span>
            </div>
          )}
        </div>
      </section>

      {!account ? (
        <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Bot className="mx-auto text-muted-foreground" size={24} />
          <h2 className="mt-4 text-base font-bold">ابتدا یک پیج اینستاگرام متصل کنید</h2>
        </section>
      ) : loading ? (
        <section className="overflow-hidden rounded-3xl border border-border/80 bg-card">
          <div className="divide-y divide-border/70">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-3 p-4">
                <div className="h-5 w-5 rounded-md bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
                <div className="h-9 w-20 rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </section>
      ) : filteredItems.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-20 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Bot size={21} />
          </div>
          <h2 className="mt-4 text-sm font-bold">
            {search ? "موردی با این عبارت پیدا نشد" : c.emptyTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
            {search ? "عبارت دیگری را امتحان کنید." : c.emptyText}
          </p>
          {!search && (
            <Button
              type="button"
              onClick={addItem}
              className="mt-5 rounded-xl"
              disabled={items.length >= c.max}
            >
              <Plus size={16} />
              {c.addLabel}
            </Button>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm">
          <div className="divide-y divide-border/70">
            {filteredItems.map((item, index) => {
              const id = item.id!;
              const selected = selectedIds.includes(id);
              const open = openId === id;
              return (
                <div key={id} className="bg-card">
                  <div className="flex items-center gap-3 p-3 sm:p-4">
                    <button
                      type="button"
                      aria-label="انتخاب"
                      onClick={() => toggleSelected(id)}
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background",
                      ].join(" ")}
                    >
                      {selected && <Check size={13} strokeWidth={3} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-right"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        {kind === "ice-breaker" ? <MessageSquare size={18} /> : <Menu size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.label || `بدون ${c.shortTitle}`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.automationId ? "پاسخ تنظیم شده" : "پاسخ تنظیم نشده"}
                        </p>
                      </div>
                      <ChevronDown
                        size={18}
                        className={open ? "rotate-180 transition-transform" : "transition-transform"}
                      />
                    </button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDeleteTarget(item)}
                      className="shrink-0 rounded-lg px-3 text-xs"
                    >
                      پاک کردن
                    </Button>
                  </div>

                  {open && (
                    <div className="border-t border-border/70 bg-muted/10 p-4 sm:p-6">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <label className="mb-2 block text-xs font-semibold text-muted-foreground">
                            {c.shortTitle}
                          </label>
                          <Input
                            value={item.label}
                            maxLength={c.maxLength}
                            placeholder={c.placeholder}
                            onChange={(event) =>
                              updateItem(id, { label: event.target.value })
                            }
                            className="h-11 rounded-xl bg-background"
                          />
                          <div className="mt-1 text-left text-[10px] text-muted-foreground">
                            {item.label.length}/{c.maxLength}
                          </div>
                        </div>
                      </div>

                      <EntryPointFlowBuilder
                        accountId={account.id}
                        automationId={item.automationId}
                        onAutomationReady={(automationId) =>
                          updateItem(id, { automationId })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5">
          {kind === "persistent-menu" && (
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-muted/50 p-4">
              <div>
                <p className="text-sm font-semibold">فعال بودن منو</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  منو در چت اینستاگرام نمایش داده شود.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((value) => !value)}
                className={[
                  "relative h-6 w-11 rounded-full transition",
                  enabled ? "bg-primary" : "bg-muted",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-1 h-4 w-4 rounded-full bg-background shadow-sm transition-all",
                    enabled ? "right-1" : "right-6",
                  ].join(" ")}
                />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={addItem}
              disabled={items.length >= c.max}
              variant="outline"
              className="min-h-11 rounded-xl"
            >
              <Plus size={16} />
              {c.addLabel}
            </Button>

            {kind === "persistent-menu" && (
              <Button
                type="button"
                onClick={disable}
                disabled={saving}
                variant="outline"
                className="min-h-11 rounded-xl"
              >
                غیرفعال کردن
              </Button>
            )}

            <Button
              type="button"
              onClick={save}
              disabled={saving}
              className="min-h-11 rounded-xl sm:mr-auto"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {c.saveText}
            </Button>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
          تغییرات با موفقیت ذخیره شد.
        </div>
      )}

      {(deleteTarget || bulkDeleteOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 size={20} />
            </div>
            <h3 className="mt-4 text-center text-base font-bold">مطمئنید می‌خواهید پاک کنید؟</h3>
            <p className="mt-2 text-center text-xs leading-6 text-muted-foreground">
              این تغییر از تنظیمات اینستاگرام هم حذف می‌شود.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  setBulkDeleteOpen(false);
                }}
                className="min-h-11 flex-1 rounded-xl"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onClick={() =>
                  deleteTarget ? void deleteItem(deleteTarget) : void bulkDelete()
                }
                disabled={saving}
                className="min-h-11 flex-1 rounded-xl bg-red-600 text-white hover:bg-red-700"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                پاک کردن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
