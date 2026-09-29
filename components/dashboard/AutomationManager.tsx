"use client";

import { Button } from "@/components/ui/button";
import {
  Bot,
  ChevronLeft,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  HelpCircle,
  Menu,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AutomationForm from "./AutomationForm";
import IceBreakerManager from "./IceBreakerManager";
import PersistentMenuManager from "./PersistentMenuManager";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

export type AutomationTriggerType =
  | "COMMENT_KEYWORD"
  | "DM"
  | "STORY_REPLY_KEYWORD";

export type Automation = {
  id: string;
  instagramAccountId: string;
  triggerType: AutomationTriggerType;
  mediaId: string | null;
  keyword: string | null;
  commentReplyText: string | null;
  replyText: string | null;
  likeComment: boolean;
  sendDm: boolean;
  likeIncomingDm: boolean;
  likeStoryReply: boolean;
  requireFollow: boolean;
  followGateText: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: unknown[];
};

type Tab = "comments" | "stories" | "ice" | "menu";

const tabs: Array<{
  id: Tab;
  label: string;
  description: string;
  icon: typeof MessageCircle;
}> = [
  { id: "comments", label: "کامنت‌ها", description: "پاسخ خودکار به کامنت‌ها", icon: MessageCircle },
  { id: "stories", label: "پاسخ استوری", description: "پاسخ به Reply استوری", icon: MessageCircle },
  { id: "ice", label: "سؤال‌های شروع گفتگو", description: "سؤال‌های آماده شروع DM", icon: HelpCircle },
  { id: "menu", label: "منوی دایرکت", description: "گزینه‌های منوی ثابت", icon: Menu },
];

function getTriggerLabel(triggerType: AutomationTriggerType) {
  switch (triggerType) {
    case "COMMENT_KEYWORD":
      return "کامنت";
    case "STORY_REPLY_KEYWORD":
      return "پاسخ استوری";
    default:
      return "پاسخ خودکار";
  }
}

function getAutomationName(automation: Automation) {
  const keyword = automation.keyword?.trim();
  if (keyword) return `پاسخ «${keyword.split(/[,،;؛\n]/)[0]?.trim() || keyword}»`;
  return getTriggerLabel(automation.triggerType);
}

function getPreview(automation: Automation) {
  if (automation.triggerType === "COMMENT_KEYWORD") {
    return automation.commentReplyText?.trim() || "Flow پاسخ آماده است";
  }
  return automation.replyText?.trim() || "Flow پاسخ آماده است";
}

export default function AutomationManager({ accounts }: { accounts: InstagramAccount[] }) {
  const connectedAccounts = useMemo(
    () => accounts.filter((account) => account.isConnected),
    [accounts],
  );

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("comments");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null);
  const [actionError, setActionError] = useState("");

  const selectedAccount = connectedAccounts.find((account) => account.id === selectedAccountId);

  useEffect(() => {
    if (!selectedAccountId && connectedAccounts[0]) {
      setSelectedAccountId(connectedAccounts[0].id);
    }
    if (selectedAccountId && !connectedAccounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(connectedAccounts[0]?.id ?? "");
    }
  }, [connectedAccounts, selectedAccountId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!selectedAccountId) {
        setAutomations([]);
        return;
      }

      try {
        setLoading(true);
        setActionError("");
        const response = await fetch(
          `/api/automations?instagramAccountId=${encodeURIComponent(selectedAccountId)}`,
          { cache: "no-store", credentials: "include" },
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || result.message || "دریافت پاسخ‌های خودکار ناموفق بود.");
        }
        if (!cancelled) setAutomations(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        if (!cancelled) {
          setAutomations([]);
          setActionError(error instanceof Error ? error.message : "دریافت پاسخ‌های خودکار ناموفق بود.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  const commentAutomations = automations.filter((item) => item.triggerType === "COMMENT_KEYWORD");
  const storyAutomations = automations.filter((item) => item.triggerType === "STORY_REPLY_KEYWORD");
  const currentAutomations = activeTab === "comments" ? commentAutomations : storyAutomations;

  async function handleToggle(automation: Automation) {
    try {
      setActionError("");
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !automation.isActive }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "تغییر وضعیت ناموفق بود.");
      }
      setAutomations((current) =>
        current.map((item) =>
          item.id === automation.id ? { ...item, isActive: !item.isActive } : item,
        ),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تغییر وضعیت ناموفق بود.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setActionError("");
      const response = await fetch(`/api/automations/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "حذف پاسخ خودکار ناموفق بود.");
      }
      setAutomations((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMenuId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "حذف پاسخ خودکار ناموفق بود.");
    }
  }

  function openCreate(triggerType: "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD") {
    setEditingAutomation({
      id: "",
      instagramAccountId: selectedAccountId,
      triggerType,
      mediaId: null,
      keyword: null,
      commentReplyText: null,
      replyText: null,
      likeComment: false,
      sendDm: false,
      likeIncomingDm: false,
      likeStoryReply: false,
      requireFollow: false,
      followGateText: null,
      isActive: true,
      createdAt: "",
      updatedAt: "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingAutomation(null);
  }

  function handleCreated(automation: Automation) {
    setAutomations((current) => [automation, ...current]);
    closeForm();
  }

  function handleUpdated(automation: Automation) {
    setAutomations((current) =>
      current.map((item) => (item.id === automation.id ? automation : item)),
    );
    closeForm();
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
        <section className="rounded-3xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">پاسخ خودکار</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                پاسخ خودکار
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                همه پاسخ‌های خودکار، سؤال‌های شروع گفتگو و منوی دایرکت را از یک صفحه مدیریت کنید.
              </p>
            </div>

            {selectedAccount && (
              <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-xs font-bold shadow-sm ring-1 ring-border/60">
                  @
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">پیج فعال</p>
                  <p className="max-w-[180px] truncate text-sm font-semibold text-foreground">
                    @{selectedAccount.igUsername}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/70 p-2 sm:p-3">
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/50 p-1.5 lg:grid-cols-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <Button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "min-h-[68px] rounded-xl px-2 py-2 text-right transition sm:min-h-[74px]",
                      active
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "bg-transparent text-muted-foreground hover:bg-background/70",
                    ].join(" ")}
                  >
                    <span className="flex w-full items-center gap-2.5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground"}`}>
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold sm:text-sm">{tab.label}</span>
                        <span className="mt-0.5 hidden truncate text-[10px] font-normal text-muted-foreground sm:block">
                          {tab.description}
                        </span>
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </section>

        {actionError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {actionError}
          </div>
        )}

        {!selectedAccount ? (
          <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Bot className="mx-auto text-muted-foreground" size={24} />
            <h2 className="mt-4 text-base font-bold">ابتدا یک پیج اینستاگرام متصل کنید</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              برای ساخت و مدیریت پاسخ‌های خودکار، حداقل یک پیج متصل لازم است.
            </p>
          </section>
        ) : activeTab === "ice" ? (
          <IceBreakerManager accounts={accounts} embedded />
        ) : activeTab === "menu" ? (
          <PersistentMenuManager accounts={accounts} embedded />
        ) : (
          <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border/70 p-4 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {activeTab === "comments" ? "پاسخ خودکار کامنت‌ها" : "پاسخ خودکار استوری"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {activeTab === "comments"
                    ? "برای هر کلمه کلیدی، فقط پاسخ متنی به کامنت و Flow متنی دایرکت را تنظیم کنید."
                    : "برای هر پاسخ استوری، می‌توانید Flow کامل شامل متن، عکس، ویدیو، وویس، ویترین و فرم بسازید."}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => openCreate(activeTab === "comments" ? "COMMENT_KEYWORD" : "STORY_REPLY_KEYWORD")}
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
              >
                <Plus size={16} />
                {activeTab === "comments" ? "پاسخ جدید" : "پاسخ جدید"}
              </Button>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" size={22} />
              </div>
            ) : currentAutomations.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Bot size={21} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-foreground">
                  {activeTab === "comments" ? "هنوز پاسخ خودکار کامنتی ندارید" : "هنوز پاسخ خودکار استوری ندارید"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
                  یک پاسخ جدید بسازید؛ بعداً همین Flow را می‌توانید کامل ویرایش یا حذف کنید.
                </p>
                <Button
                  type="button"
                  onClick={() => openCreate(activeTab === "comments" ? "COMMENT_KEYWORD" : "STORY_REPLY_KEYWORD")}
                  className="mt-5 min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
                >
                  <Plus size={16} />
                  ساخت اولین پاسخ
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {currentAutomations.map((automation) => (
                  <div key={automation.id} className="group p-4 transition hover:bg-muted/20 sm:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${automation.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {activeTab === "comments" ? <MessageCircle size={19} /> : <MessageCircle size={19} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-bold text-foreground">{getAutomationName(automation)}</h3>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${automation.isActive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                                {automation.isActive ? "فعال" : "غیرفعال"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {activeTab === "comments" ? "کلمه کلیدی:" : "کلمه / پاسخ استوری:"}{" "}
                              <span className="font-semibold text-foreground">{automation.keyword || "—"}</span>
                            </p>
                          </div>

                          <div className="relative shrink-0">
                            <Button
                              type="button"
                              onClick={() => setMenuId(menuId === automation.id ? null : automation.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg p-0 text-muted-foreground hover:bg-muted"
                              aria-label="گزینه‌ها"
                            >
                              <MoreHorizontal size={18} />
                            </Button>
                            {menuId === automation.id && (
                              <div className="absolute left-0 top-10 z-20 w-36 overflow-hidden rounded-xl border border-border bg-background p-1 shadow-lg">
                                <Button type="button" onClick={() => { setMenuId(null); setEditingAutomation(automation); setFormOpen(true); }} className="w-full justify-start rounded-lg px-3 py-2 text-xs hover:bg-muted">
                                  <Pencil size={14} /> ویرایش
                                </Button>
                                <Button type="button" onClick={() => { setMenuId(null); setDeleteTarget(automation); }} className="w-full justify-start rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                                  <Trash2 size={14} /> حذف
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border border-border/70 bg-muted/25 px-3.5 py-3">
                          <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">{getPreview(automation)}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => { setEditingAutomation(automation); setFormOpen(true); }}
                            className="min-h-9 rounded-lg bg-foreground px-3 text-xs font-semibold text-background"
                          >
                            مشاهده و ویرایش
                            <ChevronLeft size={14} />
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void handleToggle(automation)}
                            className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${automation.isActive ? "border-border bg-background text-foreground hover:bg-muted" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                          >
                            {automation.isActive ? "غیرفعال کردن" : "فعال کردن"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {formOpen && selectedAccount && editingAutomation && (
        <AutomationForm
          key={editingAutomation.id || `new-${editingAutomation.triggerType}`}
          account={selectedAccount}
          automation={editingAutomation}
          onClose={closeForm}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <h3 className="text-base font-bold text-foreground">حذف پاسخ خودکار؟</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              این پاسخ و Flow متصل به آن حذف می‌شود و قابل بازگشت نیست.
            </p>
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm">
                انصراف
              </Button>
              <Button type="button" onClick={() => void handleDelete()} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white">
                حذف
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
