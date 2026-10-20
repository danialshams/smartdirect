"use client";

import { Camera, Image as ImageIcon, Lightbulb, MessageCircle, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const PublishingStoryAutomationSetup = dynamic(() => import("./publishing/PublishingStoryAutomationSetup"), { ssr: false });
import { createEmptyMessage, normalizeMessages, validateMessages, type MessageDraft, type QuickReplyDraft, type Showcase, type FormItem } from "./automation-form-utils";
import { dairaPalette } from "../../lib/design-system/palette";
import AutomationPicker from "./AutomationPicker";
import { useDashboardBackNavigation } from "./DashboardBackNavigationContext";

type Account = { id: string; igUsername: string; igUserId: string; isConnected: boolean };
type TriggerType = "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";
type CreationMode = "new" | "existing";
type LinkButton = { title: string; url: string };
export type EditableCommentAutomation = {
  id: string;
  instagramAccountId: string;
  instagramAccount?: { id: string; igUsername: string; igUserId: string; isConnected: boolean };
  triggerType: string;
  mediaId: string | null;
  mediaIds?: string | null;
  keyword: string | null;
  keywordMatchMode?: string | null;
  commentReplyText?: string | null;
  requireFollow?: boolean;
  followGateText?: string | null;
  followGateButtonText?: string | null;
  isActive?: boolean;
  sendDm?: boolean;
  replyText?: string | null;
  messages?: unknown;
};

function readSavedLinks(raw: unknown): LinkButton[] {
  if (!raw || typeof raw !== "object") return [];
  const item = raw as Record<string, unknown>;
  if (Array.isArray(item.linkButtons) && item.linkButtons.length > 0) {
    return item.linkButtons
      .filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"))
      .map((value) => ({ title: String(value.title ?? ""), url: String(value.url ?? "") }))
      .filter((button) => button.title && button.url);
  }
  if (typeof item.linkButtonUrl === "string" && item.linkButtonUrl) {
    return [{ title: typeof item.linkButtonTitle === "string" ? item.linkButtonTitle : "", url: item.linkButtonUrl }];
  }
  return [];
}
type AutomationTemplate = { id: string; triggerType: string; keyword?: string | null; keywordMatchMode?: string | null; commentReplyText?: string | null; requireFollow?: boolean; followGateText?: string | null; followGateButtonText?: string | null; isActive?: boolean; mediaId?: string | null; messages?: unknown; };

type Props = {
  account: Account;
  mediaId?: string;
  triggerType: TriggerType;
  title: string;
  description: string;
  editAutomation?: EditableCommentAutomation;
};

function AutomationSectionGuide({ children }: { children: ReactNode }) {
  const text = typeof children === "string" ? children : "";
  const [step = "", remainder = text] = text.split(" — ");
  const match = step.match(/^([0-9۰-۹]+)\.\s*(.*)$/);
  const numberText = match?.[1] ?? "";
  const number = numberText.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const title = match?.[2] ?? step;
  const description = remainder === text ? "" : remainder;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border px-3.5 py-3"
      style={{
        background: dairaPalette.guide.background,
        borderColor: dairaPalette.guide.border,
        color: dairaPalette.guide.text,
      }}
    >
      <Lightbulb size={17} className="mt-1 shrink-0" style={{ color: dairaPalette.guide.icon }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: dairaPalette.guide.icon }}>
            {number ? new Intl.NumberFormat("fa-IR").format(Number(number)) : ""}
          </span>
          <strong className="text-sm font-extrabold leading-6">{title}</strong>
        </div>
        {description && <p className="text-xs leading-5">{description}</p>}
      </div>
    </div>
  );
}

function sortNewestFirst<T extends { timestamp?: string | null }>(items: T[]): T[] {
  return items
    .map((item, index) => {
      const parsedTimestamp = item.timestamp ? Date.parse(item.timestamp) : Number.NaN;
      return {
        item,
        index,
        timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Number.NEGATIVE_INFINITY,
      };
    })
    .sort((a, b) => (b.timestamp - a.timestamp) || (a.index - b.index))
    .map(({ item }) => item);
}

function normalizeExternalLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed.replace(/^\/+/, "");
}

function serializeQuickReplies(replies: QuickReplyDraft[]): unknown[] {
  return replies.map((reply) => ({
    id: reply.id,
    title: reply.title.trim(),
    payload: reply.payload,
    destinationType: reply.destinationType,
    destinationText: reply.destinationText.trim(),
    destinationFormId: reply.destinationFormId,
    destinationShowcaseId: reply.destinationShowcaseId,
    destinationMediaUrl: reply.destinationMediaUrl,
    destinationMediaId: reply.destinationMediaId,
    destinationQuestion: reply.destinationQuestion.trim(),
    question: reply.destinationQuestion.trim(),
    destinationQuickReplies: serializeQuickReplies(reply.destinationQuickReplies),
    nextMessageId: null,
  }));
}

export default function AutomationCreationFlow({ account, mediaId, triggerType, editAutomation }: Props) {
  const router = useRouter();
  const isEditing = Boolean(editAutomation);
  // Initialize editing directly from the fetched record; don't render a second skeleton
  // while another effect hydrates form fields.
  const initialEditState = useMemo(() => {
    if (!editAutomation) return null;
    const mediaIds = Array.from(new Set([
      ...(editAutomation.mediaId ? [editAutomation.mediaId] : []),
      ...(editAutomation.mediaIds || "").split(",").map((value) => value.trim()).filter(Boolean),
    ]));
    const rawMessages = Array.isArray(editAutomation.messages) ? editAutomation.messages : [];
    const loadedMessages = normalizeMessages(rawMessages);
    const first: MessageDraft = loadedMessages[0] ?? { ...createEmptyMessage(), text: editAutomation.replyText || "" };
    const firstLinks = readSavedLinks(rawMessages[0]);
    const extraLinks: Record<string, LinkButton[]> = {};
    loadedMessages.slice(1).forEach((item, index) => {
      extraLinks[item.id] = readSavedLinks(rawMessages[index + 1]);
    });
    return {
      mediaIds,
      keyword: editAutomation.keyword || "",
      keywordMatchMode: editAutomation.keywordMatchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" as const : "EXACT" as const,
      commentReply: editAutomation.commentReplyText || "",
      requireFollow: Boolean(editAutomation.requireFollow),
      followGateText: editAutomation.followGateText || "برای دریافت پاسخ، ابتدا پیج ما را فالو کنید.",
      followGateButtonText: editAutomation.followGateButtonText || "بررسی فالو",
      dmMode: firstLinks.length ? "TEXT_WITH_LINK" as const : "TEXT" as const,
      linkButtons: firstLinks.length ? firstLinks : [{ title: "", url: "" }],
      message: first,
      extraMessages: loadedMessages.slice(1),
      extraLinks,
    };
  }, [editAutomation]);
  const [extraMessages, setExtraMessages] = useState<MessageDraft[]>(() => initialEditState?.extraMessages ?? []);
  const [extraLinks, setExtraLinks] = useState<Record<string, LinkButton[]>>(() => initialEditState?.extraLinks ?? {});
  const [keyword, setKeyword] = useState(() => initialEditState?.keyword ?? "");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keywordMatchMode, setKeywordMatchMode] = useState<"EXACT" | "CONTAINS_ANY">(() => initialEditState?.keywordMatchMode ?? "EXACT");
  const MAX_KEYWORDS = 10;
  const MAX_LINK_BUTTONS = 3;
  const [linkButtons, setLinkButtons] = useState<LinkButton[]>(() => initialEditState?.linkButtons ?? [{ title: "", url: "" }]);
  const [mediaItems, setMediaItems] = useState<Array<{id:string; caption?:string; media_type?:string; media_product_type?:string; thumbnail_url?:string|null; media_url?:string|null; timestamp?:string}>>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(() => initialEditState?.mediaIds ?? (mediaId ? [mediaId] : []));
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [draftSelectedMediaIds, setDraftSelectedMediaIds] = useState<string[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [commentReply, setCommentReply] = useState(() => initialEditState?.commentReply ?? "");
  const [requireFollow, setRequireFollow] = useState(() => initialEditState?.requireFollow ?? false);
  const [dmMode, setDmMode] = useState<"TEXT" | "TEXT_WITH_LINK">(() => initialEditState?.dmMode ?? "TEXT");
  const [followGateText, setFollowGateText] = useState(() => initialEditState?.followGateText ?? "برای دریافت پاسخ، ابتدا پیج ما را فالو کنید.");
  const [followGateButtonText, setFollowGateButtonText] = useState(() => initialEditState?.followGateButtonText ?? "بررسی فالو");
  const [message, setMessage] = useState<MessageDraft>(() => initialEditState?.message ?? createEmptyMessage());
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [automationTemplates, setAutomationTemplates] = useState<AutomationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [creationMode, setCreationMode] = useState<CreationMode>("new");
  const [loadingResources, setLoadingResources] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const { registerBackHandler } = useDashboardBackNavigation();

  useEffect(() => {
    const handleBack = () => {
      if (mediaDialogOpen) {
        setMediaDialogOpen(false);
        return;
      }
      router.back();
    };
    registerBackHandler(handleBack);
    return () => registerBackHandler(null);
  }, [mediaDialogOpen, registerBackHandler, router]);

  useEffect(() => {
    if (!mediaDialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMediaDialogOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mediaDialogOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [showcaseResponse, formResponse, automationResponse] = await Promise.all([
          fetch("/api/showcases?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/forms?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/automations?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
        ]);
        const showcaseResult = await showcaseResponse.json();
        const formResult = await formResponse.json();
        const automationResult = await automationResponse.json();
        if (!cancelled) {
          setShowcases(Array.isArray(showcaseResult) ? showcaseResult : Array.isArray(showcaseResult?.data) ? showcaseResult.data : []);
          setForms(Array.isArray(formResult) ? formResult : Array.isArray(formResult?.data) ? formResult.data : []);
          setAutomationTemplates(
            (Array.isArray(automationResult?.data) ? automationResult.data : [])
              .filter((item: AutomationTemplate) => item.triggerType === triggerType && (item.keyword || Array.isArray(item.messages))),
          );
        }
      } catch {
        if (!cancelled) {
          setShowcases([]);
          setForms([]);
        }
      } finally {
        if (!cancelled) setLoadingResources(false);
      }
    })();
    return () => { cancelled = true; };
  }, [account.id, triggerType]);

  function applyAutomationTemplate(template: AutomationTemplate) {
    setSelectedTemplateId(template.id);
    setCreationMode("existing");
    setError("");
  }

  function startNewAutomation() {
    setSelectedTemplateId("");
    setCreationMode("new");
    setError("");
  }

  function openMediaDialog() {
    setDraftSelectedMediaIds([...selectedMediaIds]);
    setMediaDialogOpen(true);
  }

  function confirmMediaSelection() {
    setSelectedMediaIds(draftSelectedMediaIds);
    setMediaDialogOpen(false);
    setError("");
  }

  const keywords = useMemo(() => keyword.split(/[,،;؛\n]+/).map((item) => item.trim()).filter(Boolean), [keyword]);
  const formSnapshot = JSON.stringify({
    mediaIds: [...selectedMediaIds].sort(), keyword, keywordMatchMode, commentReply,
    requireFollow, followGateText, followGateButtonText, dmMode,
    linkButtons, message, extraMessages, extraLinks,
  });
  const originalSnapshot = initialEditState ? JSON.stringify({
    mediaIds: [...initialEditState.mediaIds].sort(),
    keyword: initialEditState.keyword,
    keywordMatchMode: initialEditState.keywordMatchMode,
    commentReply: initialEditState.commentReply,
    requireFollow: initialEditState.requireFollow,
    followGateText: initialEditState.followGateText,
    followGateButtonText: initialEditState.followGateButtonText,
    dmMode: initialEditState.dmMode,
    linkButtons: initialEditState.linkButtons,
    message: initialEditState.message,
    extraMessages: initialEditState.extraMessages,
    extraLinks: initialEditState.extraLinks,
  }) : "";
  const hasUnsavedEdits = isEditing && formSnapshot !== originalSnapshot;
  const enteredDm = message.messageType !== "TEXT" || Boolean(message.text.trim()) ||
    extraMessages.length > 0 || dmMode === "TEXT_WITH_LINK";
  const dmMessages = [message, ...extraMessages];
  let validDm = false;
  if (enteredDm) {
    try { validDm = validateMessages(dmMessages); } catch { validDm = false; }
  }
  const validUrl = (value: string) => {
    try { const url = new URL(normalizeExternalLink(value)); return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname); }
    catch { return false; }
  };
  const validateLinks = (items: LinkButton[]) => items.length <= MAX_LINK_BUTTONS && items.every((button) =>
    Boolean(button.title.trim()) && button.title.trim().length <= 20 && button.url.trim().length <= 2048 && validUrl(button.url));
  const mainLinksValid = dmMode !== "TEXT_WITH_LINK" || (message.messageType === "TEXT" &&
    linkButtons.length > 0 && validateLinks(linkButtons) && message.text.trim().length <= 640);
  const extraLinksValid = extraMessages.every((item) => item.messageType !== "TEXT" ||
    validateLinks(extraLinks[item.id] || []));
  const commentFormError = triggerType !== "COMMENT_KEYWORD" ? "" :
    mediaLoading || loadingResources ? "اطلاعات صفحه هنوز کامل بارگذاری نشده است." :
    selectedMediaIds.length === 0 ? "حداقل یک پست یا ریلز انتخاب کنید." :
    keywordMatchMode === "EXACT" && keywords.length === 0 ? "حداقل یک کلمه کلیدی وارد کنید." :
    keywords.length > MAX_KEYWORDS ? "حداکثر ده کلمه کلیدی مجاز است." :
    commentReply.length > 2000 ? "پاسخ زیر کامنت بیش از ۲۰۰۰ کاراکتر است." :
    enteredDm && !validDm ? "همه پیام‌های دایرکت را کامل وارد کنید." :
    enteredDm && (!mainLinksValid || !extraLinksValid) ? "عنوان و آدرس دکمه‌های لینک را کامل و معتبر وارد کنید." :
    !commentReply.trim() && !enteredDm ? "حداقل یک پاسخ زیر کامنت یا پیام دایرکت وارد کنید." :
    requireFollow && !enteredDm ? "برای فعال کردن شرط فالو، پیام دایرکت لازم است." :
    requireFollow && (!followGateText.trim() || followGateText.length > 640 ||
      !followGateButtonText.trim() || followGateButtonText.trim().length > 20) ?
      "متن درخواست فالو و عنوان دکمه بررسی فالو را کامل وارد کنید." : "";
  const canSaveComment = !saving && !commentFormError && (!isEditing || hasUnsavedEdits);
  const canAddMessage = !saving && extraMessages.length < 19 && (!isEditing || hasUnsavedEdits) &&
    enteredDm && validDm && mainLinksValid && extraLinksValid;
  const initialDmSnapshot = initialEditState ? JSON.stringify({
    message: initialEditState.message, extraMessages: initialEditState.extraMessages,
    dmMode: initialEditState.dmMode, linkButtons: initialEditState.linkButtons,
    extraLinks: initialEditState.extraLinks,
  }) : "";
  const currentDmSnapshot = JSON.stringify({ message, extraMessages, dmMode, linkButtons, extraLinks });
  const dmWasEdited = isEditing && currentDmSnapshot !== initialDmSnapshot;
  const shouldSendDm = !enteredDm ? false :
    editAutomation && !dmWasEdited ? editAutomation.sendDm !== false : true;

  useEffect(() => {
    let cancelled = false;
    const mediaEndpoint = triggerType === "COMMENT_KEYWORD" ? "/api/instagram/media?instagramAccountId=" : "/api/instagram/stories?instagramAccountId=";
    void Promise.all([
      fetch(mediaEndpoint + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }).then((response) => response.json()),
      fetch("/api/automations?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }).then((response) => response.json()),
    ])
      .then(([mediaResult, automationResult]) => {
        if (cancelled) return;
        if (!mediaResult?.success || !automationResult?.success || !Array.isArray(mediaResult?.data) || !Array.isArray(automationResult?.data)) {
          throw new Error("دریافت فهرست محتواها و پاسخ‌های خودکار ناموفق بود.");
        }
        const used = new Set<string>();
        for (const automation of automationResult.data) {
          if (automation?.triggerType !== triggerType || (isEditing && automation.id === editAutomation?.id)) continue;
          if (typeof automation.mediaId === "string" && automation.mediaId) used.add(automation.mediaId);
          if (triggerType === "COMMENT_KEYWORD" && typeof automation.mediaIds === "string") {
            automation.mediaIds.split(",").map((id: string) => id.trim()).filter(Boolean).forEach((id: string) => used.add(id));
          }
        }
        const availableMedia = triggerType === "COMMENT_KEYWORD"
          ? mediaResult.data.filter((item: { id?: unknown; media_type?: string; media_product_type?: string }) =>
              typeof item.id === "string" && !used.has(item.id) &&
              (item.media_type === "IMAGE" || item.media_type === "VIDEO" || item.media_type === "CAROUSEL_ALBUM" || item.media_product_type === "REELS"))
          : mediaResult.data.filter((item: { id?: unknown }) => typeof item.id === "string" && !used.has(item.id))
              .map((item: { id: string; mediaType?: string | null; mediaUrl?: string | null; thumbnailUrl?: string | null; timestamp?: string | null; createdAt?: string | null; created_time?: string | null }) => ({
                id: item.id,
                media_type: item.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
                media_product_type: "STORY",
                media_url: item.mediaUrl,
                thumbnail_url: item.thumbnailUrl,
                timestamp: item.timestamp ?? item.createdAt ?? item.created_time ?? undefined,
                caption: "استوری اینستاگرام",
              }));
        const availableIds = new Set<string>(availableMedia.map((item: { id: string }) => item.id));
        setMediaItems(sortNewestFirst(availableMedia));
        if (!isEditing) {
          setSelectedMediaIds((current) => current.filter((id) => availableIds.has(id)));
          setDraftSelectedMediaIds((current) => current.filter((id) => availableIds.has(id)));
        }
      })
      .catch(() => { if (!cancelled) { setMediaItems([]); setError("دریافت فهرست محتواها یا پاسخ‌های خودکار ناموفق بود. صفحه را دوباره بارگذاری کنید."); } })
      .finally(() => { if (!cancelled) setMediaLoading(false); });
    return () => { cancelled = true; };
  }, [account.id, triggerType, isEditing, editAutomation?.id]);

  function addKeyword() {
    const value = keywordDraft.trim();
    if (!value || keywords.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase()) || keywords.length >= MAX_KEYWORDS) return;
    setKeyword([...keywords, value].join(","));
    setKeywordDraft("");
  }

  async function saveAutomation(finalMessage?: MessageDraft) {
    if (saving) return;
    if (triggerType === "COMMENT_KEYWORD" && !canSaveComment) {
      setError(commentFormError || "برای ذخیره، ابتدا تغییری در پاسخ خودکار ایجاد کنید.");
      return;
    }
    const cleanKeywords = keywords;
    const currentMessage = finalMessage ?? message;
    const targetMediaIds = Array.from(new Set(selectedMediaIds.filter(Boolean)));
    const normalizedLinkButtons = linkButtons.map((button) => ({ ...button, url: normalizeExternalLink(button.url) }));

    if (isEditing && editAutomation) {
      if (!targetMediaIds.length) { setError("حداقل یک پست یا ریلز انتخاب کنید."); return; }
      if (keywordMatchMode === "EXACT" && !cleanKeywords.length) { setError("حداقل یک کلمه کلیدی وارد کنید."); return; }
      if (cleanKeywords.length > MAX_KEYWORDS) { setError("حداکثر ۱۰ کلمه کلیدی می‌توانید اضافه کنید."); return; }
      if (requireFollow && !followGateText.trim()) { setError("متن درخواست فالو را وارد کنید."); return; }
      if (requireFollow && (!followGateButtonText.trim() || followGateButtonText.trim().length > 20)) {
        setError("عنوان دکمه بررسی فالو را وارد کنید (حداکثر ۲۰ کاراکتر)."); return;
      }
      const currentLinks = currentMessage.messageType === "TEXT" && dmMode === "TEXT_WITH_LINK"
        ? normalizedLinkButtons.map((value) => ({ title: value.title.trim(), url: value.url }))
        : [];
      for (const button of currentLinks) {
        let validUrl = false;
        try { validUrl = ["http:", "https:"].includes(new URL(button.url).protocol); } catch { validUrl = false; }
        if (!button.title || button.title.length > 20 || !validUrl) {
          setError("آدرس و عنوان دکمه‌های لینک را کامل و معتبر وارد کنید."); return;
        }
      }
      if (currentMessage.messageType === "TEXT" && currentMessage.text.trim().length > (currentLinks.length ? 640 : 2000)) {
        setError("متن دایرکت از حد مجاز طولانی‌تر است."); return;
      }
      setSaving(true);
      setError("");
      try {
        const previouslySavedMessages = normalizeMessages(editAutomation.messages);
        const originalById = new Map(previouslySavedMessages.map((entry) => [entry.id, entry]));
        const allMessages = [currentMessage, ...extraMessages].map((entry, index) => ({
          ...entry,
          updateQuickReplies: !originalById.has(entry.id) ||
            JSON.stringify(originalById.get(entry.id)?.quickReplies) !== JSON.stringify(entry.quickReplies),
          linkButtons: index === 0 ? currentLinks : entry.messageType === "TEXT" ? (extraLinks[entry.id] || []).map((button) => ({
            title: button.title.trim(), url: normalizeExternalLink(button.url),
          })) : [],
        }));
        const response = await fetch("/api/automations/" + encodeURIComponent(editAutomation.id) + "/comment-edit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            keywordMatchMode,
            keyword: keywordMatchMode === "CONTAINS_ANY" ? null : cleanKeywords.join(","),
            mediaIds: targetMediaIds,
            commentReplyText: commentReply.trim(),
            requireFollow,
            followGateText: requireFollow ? followGateText.trim() : null,
            followGateButtonText: requireFollow ? followGateButtonText.trim() : null,
            isActive: editAutomation.isActive !== false,
            sendDm: shouldSendDm,
            messages: enteredDm ? allMessages : [],
          }),
        });
        const result = await response.json();
        if (!response.ok || !result?.success) throw new Error(result?.error || "ذخیره ویرایش پاسخ خودکار ناموفق بود.");
        setCompleted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ذخیره ویرایش پاسخ خودکار ناموفق بود.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (creationMode === "existing") {
      const template = automationTemplates.find((item) => item.id === selectedTemplateId);
      const targetIds = targetMediaIds;
      if (!template) { setError("ابتدا پاسخ خودکار موجود را انتخاب کنید."); return; }
      if (targetIds.length === 0) { setError(triggerType === "COMMENT_KEYWORD" ? "حداقل یک پست یا ریلز انتخاب کنید." : "یک استوری انتخاب کنید."); return; }
      if (triggerType === "STORY_REPLY_KEYWORD" && targetIds.length !== 1) { setError("برای پاسخ خودکار استوری فقط یک استوری انتخاب کنید."); return; }
      setSaving(true);
      setError("");
      try {
        const response = await fetch("/api/automations/" + encodeURIComponent(template.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            linkMediaOnly: true,
            triggerType,
            mediaId: triggerType === "COMMENT_KEYWORD" ? (targetIds.length === 1 ? targetIds[0] : null) : targetIds[0],
            mediaIds: triggerType === "COMMENT_KEYWORD" ? targetIds : [],
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.message || "اتصال پاسخ خودکار ناموفق بود.");
        setCompleted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "اتصال پاسخ خودکار ناموفق بود.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (triggerType === "COMMENT_KEYWORD" && dmMode === "TEXT_WITH_LINK" && enteredDm) {
      if (!mainLinksValid) { setError("برای هر دکمه، آدرس لینک و عنوان معتبر وارد کنید."); return; }
      if (currentMessage.text.trim().length > 640) { setError("متن دایرکت همراه دکمه حداکثر ۶۴۰ کاراکتر است."); return; }
    }
    if (selectedMediaIds.length === 0) {
      setError(triggerType === "COMMENT_KEYWORD" ? "حداقل یک پست یا ریلز انتخاب کنید." : "یک استوری انتخاب کنید.");
      return;
    }
    if (triggerType === "COMMENT_KEYWORD" && requireFollow && !followGateText.trim()) {
      setError("متن درخواست فالو را وارد کنید.");
      return;
    }
    if (triggerType === "COMMENT_KEYWORD" && requireFollow && (!followGateButtonText.trim() || followGateButtonText.trim().length > 20)) {
      setError("عنوان دکمه بررسی فالو را وارد کنید (حداکثر ۲۰ کاراکتر).");
      return;
    }
    if (keywordMatchMode !== "CONTAINS_ANY" && !cleanKeywords.length) {
      setError("حداقل یک کلمه کلیدی وارد کنید.");
      return;
    }
    if (cleanKeywords.length > MAX_KEYWORDS) {
      setError(`حداکثر ${MAX_KEYWORDS} کلمه کلیدی می‌توانید اضافه کنید.`);
      return;
    }
    if (triggerType === "STORY_REPLY_KEYWORD") {
      try { validateMessages([currentMessage]); }
      catch (e) { setError(e instanceof Error ? e.message : "پاسخ استوری ناقص است."); return; }
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          triggerType,
          mediaId: triggerType === "COMMENT_KEYWORD" ? (targetMediaIds.length === 1 ? targetMediaIds[0] : null) : targetMediaIds[0] || null,
          keyword: keywordMatchMode === "CONTAINS_ANY" ? null : cleanKeywords.join(","),
          keywordMatchMode,
          mediaIds: triggerType === "COMMENT_KEYWORD" ? targetMediaIds : [],
          commentReplyText: triggerType === "COMMENT_KEYWORD" ? commentReply.trim() || null : null,
          replyText: null,
          likeComment: false,
          sendDm: triggerType === "COMMENT_KEYWORD" ? enteredDm : true,
          likeIncomingDm: false,
          likeStoryReply: false,
          requireFollow: triggerType === "COMMENT_KEYWORD" && requireFollow,
          followGateText: triggerType === "COMMENT_KEYWORD" && requireFollow ? followGateText.trim() : null,
          followGateButtonText: triggerType === "COMMENT_KEYWORD" && requireFollow ? followGateButtonText.trim() : null,
          isActive: true,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.id) {
        throw new Error(result.error || result.message || "ذخیره پاسخ خودکار ناموفق بود.");
      }

      const automationId = result.data.id as string;
      const messagesToCreate = triggerType === "COMMENT_KEYWORD"
        ? (enteredDm ? [currentMessage, ...extraMessages] : [])
        : [currentMessage];
      for (const [index, entry] of messagesToCreate.entries()) {
        const entryLinks = triggerType === "COMMENT_KEYWORD" && entry.messageType === "TEXT"
          ? (index === 0
            ? dmMode === "TEXT_WITH_LINK" ? normalizedLinkButtons : []
            : extraLinks[entry.id] || [])
          : [];
        const messageResponse = await fetch("/api/automations/" + automationId + "/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messageType: entry.messageType,
            text: entry.text.trim() || null,
            mediaUrl: entry.mediaUrl.trim() || null,
            mediaId: entry.mediaId.trim() || null,
            showcaseId: entry.showcaseId || null,
            formId: entry.formId || null,
            order: index,
            linkButtons: entryLinks.map((button) => ({ title: button.title.trim(), url: normalizeExternalLink(button.url) })),
          }),
        });
        const messageResult = await messageResponse.json();
        if (!messageResponse.ok || !messageResult.success || !messageResult.data?.id)
          throw new Error(messageResult.error || messageResult.message || "ذخیره پیام پاسخ ناموفق بود.");
        const serverMessageId = messageResult.data.id as string;
        for (const reply of entry.quickReplies) {
          const qrResponse = await fetch("/api/automations/" + automationId + "/messages/" + serverMessageId + "/quick-replies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: reply.title.trim(),
              payload: reply.payload,
              destinationType: reply.destinationType,
              destinationText: reply.destinationText.trim(),
              destinationFormId: reply.destinationFormId,
              destinationShowcaseId: reply.destinationShowcaseId,
              destinationMediaUrl: reply.destinationMediaUrl,
              destinationMediaId: reply.destinationMediaId,
              destinationQuestion: reply.destinationQuestion.trim(),
              question: reply.destinationQuestion.trim(),
              destinationQuickReplies: serializeQuickReplies(reply.destinationQuickReplies),
              nextMessageId: null,
            }),
          });
          const qrResult = await qrResponse.json();
          if (!qrResponse.ok || !qrResult.success)
            throw new Error(qrResult.error || qrResult.message || "ذخیره گزینه‌های پاسخ ناموفق بود.");
        }
      }

      setCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره پاسخ خودکار ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  const selectedMediaCount = selectedMediaIds.length;
  const availableMediaIdSet = new Set(mediaItems.map((item) => item.id));
  const unknownMediaIds = selectedMediaIds.filter((id) => !availableMediaIdSet.has(id));
  const selectedMediaItems = mediaItems.filter((item) => selectedMediaIds.includes(item.id));

  const successOrbits = [
    { angle: 0, size: 7, duration: 3.4, delay: 0.2, pulse: 1.7, pulseDelay: 0.4 },
    { angle: 42, size: 5, duration: 4.8, delay: 1.1, pulse: 2.1, pulseDelay: 0.1 },
    { angle: 86, size: 8, duration: 3.1, delay: 2.0, pulse: 1.6, pulseDelay: 0.8 },
    { angle: 131, size: 5, duration: 5.2, delay: 0.7, pulse: 2.3, pulseDelay: 1.2 },
    { angle: 177, size: 6, duration: 3.8, delay: 1.6, pulse: 1.8, pulseDelay: 0.5 },
    { angle: 223, size: 8, duration: 4.5, delay: 2.5, pulse: 2.0, pulseDelay: 1.4 },
    { angle: 268, size: 5, duration: 3.3, delay: 0.9, pulse: 1.9, pulseDelay: 0.7 },
    { angle: 314, size: 7, duration: 5.0, delay: 1.9, pulse: 2.2, pulseDelay: 0.2 },
  ];
  const pageStyles = (
    <style jsx global>{`
      .automation-create-flow button:not(.sd-neutral-button):not(.sd-destructive-button):not(.sd-content-card):not([aria-pressed="false"]),
      .automation-create-flow button:not(.sd-neutral-button):not(.sd-destructive-button):not(.sd-content-card):not([aria-pressed="false"]) * {
        color: #fff !important;
      }
      .automation-create-flow button:not(.sd-neutral-button):not(.sd-destructive-button):not(.sd-content-card):not([aria-pressed="false"]) {
        background-color: var(--daira-primary, #2F61FD) !important;
        border-color: var(--daira-primary, #2F61FD) !important;
      }
      .automation-create-flow button:not(.sd-neutral-button):not(.sd-destructive-button):not(.sd-content-card):not([aria-pressed="false"]):hover:not(:disabled) {
        background-color: var(--daira-primary-hover, #1E4BD8) !important;
        border-color: var(--daira-primary-hover, #1E4BD8) !important;
      }
      .automation-create-flow button:not(.sd-neutral-button):not(.sd-destructive-button):not(.sd-content-card):not([aria-pressed="false"]):disabled {
        background-color: var(--daira-primary, #2F61FD) !important;
        border-color: var(--daira-primary, #2F61FD) !important;
        opacity: .48;
      }
      .sd-success-ring {
        stroke-dasharray: 183;
        stroke-dashoffset: 183;
        animation: sd-success-ring-draw 850ms cubic-bezier(.22,.7,.22,1) 100ms forwards;
      }
      .sd-success-path {
        stroke-dasharray: 48;
        stroke-dashoffset: 48;
        animation: sd-success-path-draw 650ms cubic-bezier(.22,.7,.22,1) 780ms forwards;
      }
      .sd-success-orbit {
        position: absolute;
        inset: 0;
        transform-origin: center;
      }
      .sd-success-orbit-spin {
        position: absolute;
        inset: 0;
        transform-origin: center;
        animation-name: sd-success-orbit;
        animation-timing-function: linear;
        animation-duration: var(--sd-orbit-duration, 3.5s);
        animation-delay: var(--sd-orbit-delay, 0s);
        animation-iteration-count: infinite;
      }
      .sd-success-orbit-spin.sd-success-orbit-reverse {
        animation-name: sd-success-orbit-reverse;
      }
      .sd-success-dot {
        position: absolute;
        top: 5px;
        left: 50%;
        border-radius: 9999px;
        animation: sd-success-dot-pulse var(--sd-pulse-duration, 1.8s) ease-in-out var(--sd-pulse-delay, 0s) infinite;
      }
      @keyframes sd-success-ring-draw { to { stroke-dashoffset: 0; } }
      @keyframes sd-success-path-draw { to { stroke-dashoffset: 0; } }
      @keyframes sd-success-orbit { to { transform: rotate(360deg); } }
      @keyframes sd-success-orbit-reverse { to { transform: rotate(-360deg); } }
      @keyframes sd-success-dot-pulse { 0%, 100% { opacity: .2; } 50% { opacity: .95; } }
      @media (prefers-reduced-motion: reduce) {
        .sd-success-ring, .sd-success-path, .sd-success-orbit-spin, .sd-success-dot {
          animation-duration: 1ms !important;
          animation-delay: 0ms !important;
        }
      }
    `}</style>
  );

  if (completed) {
    return (
      <div dir="rtl" className="automation-create-flow flex min-h-[65vh] w-full flex-col items-center justify-center px-4 py-12 text-center">
        {pageStyles}
        <div className="relative mb-4 flex h-32 w-32 items-center justify-center" role="img" aria-label="عملیات با موفقیت انجام شد">
          {successOrbits.map((orbit, index) => (
            <span key={index} className="sd-success-orbit" style={{ transform: `rotate(${orbit.angle}deg)` }} aria-hidden="true">
              <span className={`sd-success-orbit-spin ${index % 2 ? "sd-success-orbit-reverse" : ""}`} style={{ "--sd-orbit-duration": `${orbit.duration}s`, "--sd-orbit-delay": `-${orbit.delay}s`, "--sd-pulse-duration": `${orbit.pulse}s`, "--sd-pulse-delay": `-${orbit.pulseDelay}s` } as CSSProperties}>
                <span className="sd-success-dot" style={{ width: `${orbit.size}px`, height: `${orbit.size}px`, marginLeft: `-${orbit.size / 2}px`, backgroundColor: dairaPalette.status.success }} />
              </span>
            </span>
          ))}
          <svg viewBox="0 0 84 84" className="relative z-10 h-24 w-24 overflow-visible" fill="none" aria-hidden="true">
            <circle className="sd-success-ring" cx="42" cy="42" r="29" stroke={dairaPalette.status.success} strokeWidth="4" />
            <path className="sd-success-path" d="M25 42.5 36.5 54 59 30" stroke={dairaPalette.status.success} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-extrabold" style={{ color: dairaPalette.text.heading }}>{isEditing ? "تغییرات پاسخ خودکار با موفقیت ذخیره شد" : "عملیات با موفقیت انجام شد"}</h1>
        <button
          type="button"
          onClick={() => { window.scrollTo(0, 0); router.push(triggerType === "COMMENT_KEYWORD" ? "/dashboard/comment-automation" : "/dashboard/story-automation", { scroll: true }); }}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--daira-primary)]/30"
          style={{ background: dairaPalette.primary.main }}
        >
          بازگشت به لیست پاسخ‌ها
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="automation-create-flow mx-auto w-full max-w-4xl py-2 sm:py-4">
      {pageStyles}
      <div className="space-y-0">
        <div className="mb-2"><AutomationSectionGuide>{triggerType === "COMMENT_KEYWORD" ? "۱. انتخاب محتوا — پست یا ریلز موردنظرت را انتخاب کن." : "۱. انتخاب محتوا — استوری موردنظرت را انتخاب کن."}</AutomationSectionGuide></div>
        <section aria-labelledby="automation-content-title" className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex shrink-0 items-center gap-1">
                {selectedMediaItems.length > 0 ? selectedMediaItems.slice(0, 3).map((item) => {
                  const image = item.thumbnail_url || item.media_url;
                  return (
                    <span key={item.id} className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] text-[var(--daira-text)]">
                      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Camera size={17} />}
                    </span>
                  );
                }) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]">
                    <Camera size={19} />
                  </span>
                )}
                {selectedMediaCount > 3 && (
                  <span className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-[var(--daira-surface-hover)] px-2 text-xs font-bold text-[var(--daira-text)]">
                    +{new Intl.NumberFormat("fa-IR").format(selectedMediaCount - 3)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs leading-5 text-[var(--daira-text)]">
                  {mediaLoading ? "در حال دریافت محتوا..." : selectedMediaCount > 0 ? new Intl.NumberFormat("fa-IR").format(selectedMediaCount) + (triggerType === "COMMENT_KEYWORD" ? " محتوا انتخاب شده" : " استوری انتخاب شده") : "هنوز محتوایی انتخاب نشده"}
                  {isEditing && !mediaLoading && unknownMediaIds.length > 0 && <span className="mt-1 block text-[11px] text-[var(--daira-text)]">{new Intl.NumberFormat("fa-IR").format(unknownMediaIds.length)} محتوای قبلی پیش‌نمایش ندارد، اما انتخاب آن حفظ شده است.</span>}
                </p>
              </div>
            </div>
            <button type="button" onClick={openMediaDialog} aria-haspopup="dialog" aria-expanded={mediaDialogOpen} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--daira-primary)]/25" style={{ background: dairaPalette.primary.main }}>
              <ImageIcon size={16} aria-hidden="true" />
              {selectedMediaCount > 0 ? "تغییر انتخاب" : "انتخاب محتوا"}
            </button>
          </div>
        </section>

        {!isEditing && (<>
        <div className="mb-2 mt-6"><AutomationSectionGuide>۲. روش پاسخ — پاسخ جدید بساز یا از پاسخ قبلی استفاده کن.</AutomationSectionGuide></div>
        <section aria-label="روش پاسخ" className="space-y-2">
          <div role="radiogroup" aria-label="روش پاسخ خودکار" className="grid grid-cols-2 gap-2">
            <label className={"flex min-h-[68px] cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition " + (creationMode === "new" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)]" : "border-[var(--daira-border)] bg-white hover:border-[var(--daira-outline)]")}>
              <input type="radio" name="automation-creation-mode" value="new" checked={creationMode === "new"} onChange={startNewAutomation} className="h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
              <span className="flex min-h-10 min-w-0 flex-1 items-center justify-center"><strong className="text-center text-xs leading-5 text-[var(--daira-heading)]">ساخت پاسخ جدید</strong></span>
            </label>
            <label className={"flex min-h-[68px] cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition " + (creationMode === "existing" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)]" : "border-[var(--daira-border)] bg-white hover:border-[var(--daira-outline)]")}>
              <input type="radio" name="automation-creation-mode" value="existing" checked={creationMode === "existing"} onChange={() => { setCreationMode("existing"); setError(""); }} className="h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
              <span className="flex min-h-10 min-w-0 flex-1 items-center justify-center"><strong className="text-center text-xs leading-5 text-[var(--daira-heading)]">استفاده از پاسخ‌های قبلی</strong></span>
            </label>
          </div>
        </section>

        </>)}

        {creationMode === "existing" && !isEditing && (
          <div className="space-y-3">
            <div className="mb-2 mt-6"><AutomationSectionGuide>۳. پاسخ قبلی — پاسخ موردنظرت را انتخاب کن؛ سپس دکمه زیر فهرست را بزن.</AutomationSectionGuide></div>
            <section
                className="rounded-2xl border p-3"
                style={{ borderColor: dairaPalette.border, background: dairaPalette.background.surface }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div />
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs" style={{ background: dairaPalette.secondary.hoverBackground, color: dairaPalette.text.body }}><strong className="font-extrabold" style={{ color: dairaPalette.primary.main }}>{new Intl.NumberFormat("fa-IR").format(automationTemplates.length)}</strong><span style={{ color: dairaPalette.primary.main }}>پاسخ</span></span>
                </div>
                {loadingResources ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="در حال دریافت پاسخ‌های قبلی">
                    {[0, 1].map((item) => (
                      <div
                        key={item}
                        className="h-[76px] animate-pulse rounded-xl"
                        style={{ background: dairaPalette.background.surfaceActive }}
                      />
                    ))}
                  </div>
                ) : automationTemplates.length > 0 ? (
                  <div className="max-h-[65dvh] overflow-y-auto overscroll-contain rounded-xl pr-1 sm:max-h-[640px]">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {automationTemplates.map((template) => {
                    const previewMessages = normalizeMessages(template.messages);
                    const preview = previewMessages[0]?.messageType === "SHOWCASE" ? "ویترین" : previewMessages[0]?.messageType === "FORM" ? "فرم" : previewMessages[0]?.messageType === "IMAGE" ? "تصویر" : previewMessages[0]?.messageType === "VIDEO" ? "ویدیو" : previewMessages[0]?.messageType === "AUDIO" ? "پیام صوتی" : "";
                    const selected = selectedTemplateId === template.id;
                    return (
                      <label
                        key={template.id}
                        className="flex min-h-[72px] cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-right transition focus-within:ring-2 focus-within:ring-[color:var(--daira-primary)]/20"
                        style={{
                          borderColor: selected ? dairaPalette.primary.main : dairaPalette.border,
                          background: selected ? dairaPalette.secondary.hoverBackground : dairaPalette.background.surface,
                          boxShadow: selected ? `0 2px 8px ${dairaPalette.primary.main}20` : undefined,
                        }}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <strong className="block text-xs font-bold leading-5" style={{ color: dairaPalette.text.heading }}>
                            {(template.keyword || "").split(/[,،;؛\n]+/).filter(Boolean).slice(0, 3).join("، ") || "بدون کلمه کلیدی"}
                          </strong>
                          {preview && <span className="block text-[10px] leading-4" style={{ color: dairaPalette.text.body }}>{preview}</span>}
                        </span>
                        <input
                          type="radio"
                          name="existing-automation-template"
                          value={template.id}
                          checked={selected}
                          onChange={() => applyAutomationTemplate(template)}
                          className="mt-0 h-4 w-4 shrink-0 self-center accent-[var(--daira-primary)]"
                          aria-label={`انتخاب پاسخ ${(template.keyword || "").split(/[,،;؛\n]+/).filter(Boolean).slice(0, 3).join("، ") || "بدون کلمه کلیدی"}`}
                        />
                      </label>
                    );
                  })}
                  </div>
                  </div>
                ) : (
                  <p
                    className="rounded-xl border border-dashed px-3 py-4 text-xs leading-6"
                    style={{ borderColor: dairaPalette.form.borderHover, background: dairaPalette.background.surfaceHover, color: dairaPalette.text.body }}
                  >
                    هنوز پاسخ خودکار قبلی برای این نوع وجود ندارد. می‌توانی تنظیمات را از ابتدا وارد کنی.
                  </p>
                )}


              </section>
            <button type="button" onClick={() => { void saveAutomation(); }} disabled={!selectedTemplateId || loadingResources || mediaLoading || selectedMediaCount === 0 || saving} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition disabled:opacity-60" style={{ background: dairaPalette.primary.main }}>
              {saving ? "در حال استفاده..." : "استفاده از پاسخ انتخاب‌شده"}
            </button>
          </div>
            )}
            {(creationMode === "new" || isEditing) && (
            <div className="space-y-5">
            <div className="mb-2 mt-6"><AutomationSectionGuide>{triggerType === "COMMENT_KEYWORD" ? (isEditing ? "۲. شرط فعال‌سازی — روش فعال شدن پاسخ خودکار را ویرایش کن." : "۳. شرط فعال‌سازی — انتخاب کن پاسخ با هر کامنت فعال شود یا فقط با کلمات مشخص.") : "۳. شرط فعال‌سازی — کلمه‌ها یا عبارت‌هایی را بنویس که پاسخ استوری را فعال می‌کنند."}</AutomationSectionGuide></div>
            <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
              {triggerType === "COMMENT_KEYWORD" && (
                <div className="mb-3">
                  <div role="radiogroup" aria-label="روش فعال‌سازی پاسخ" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition " + (keywordMatchMode === "CONTAINS_ANY" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary-hover)]" : "border-[var(--daira-border)] bg-white text-[var(--daira-text)]")}>
                      <input type="radio" name="comment-keyword-match-mode" value="CONTAINS_ANY" checked={keywordMatchMode === "CONTAINS_ANY"} onChange={() => { setKeywordMatchMode("CONTAINS_ANY"); setKeyword(""); setKeywordDraft(""); }} className="mt-1 h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
                      <span className="min-w-0">
                        <strong className="mb-1 block">شامل هر کلمه</strong>
                        <span className="block leading-5">با ثبت هر کامنت زیر محتوای انتخاب‌شده، پاسخ خودکار ارسال می‌شود.</span>
                      </span>
                    </label>
                    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition " + (keywordMatchMode === "EXACT" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary-hover)]" : "border-[var(--daira-border)] bg-white text-[var(--daira-text)]")}>
                      <input type="radio" name="comment-keyword-match-mode" value="EXACT" checked={keywordMatchMode === "EXACT"} onChange={() => { setKeywordMatchMode("EXACT"); setKeyword(""); setKeywordDraft(""); }} className="mt-1 h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
                      <span className="min-w-0">
                        <strong className="mb-1 block">کلمات کلیدی مشخص</strong>
                        <span className="block leading-5">فقط وقتی کامنت با یکی از کلمات تعیین‌شده برابر باشد پاسخ ارسال می‌شود.</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}
              {keywordMatchMode !== "CONTAINS_ANY" && keywords.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {keywords.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--daira-outline-hover-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--daira-primary)]">
                      {item}
                      <button type="button" onClick={() => setKeyword(keywords.filter((value) => value !== item).join(","))} className="sd-neutral-button text-[var(--daira-text)] hover:text-[var(--daira-error-text)]" aria-label={"حذف " + item}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {keywordMatchMode !== "CONTAINS_ANY" && <div>
                <div className="mb-2 flex items-center justify-between gap-2"><label className="block text-xs text-[var(--daira-text)]">حداکثر {MAX_KEYWORDS} کلمه کلیدی</label><span className="text-[11px] text-[var(--daira-text)]">{keywords.length} از {MAX_KEYWORDS}</span></div>
                <div className="flex items-center gap-2">
                  <input value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="یک کلمه کلیدی وارد کنید" disabled={keywords.length >= MAX_KEYWORDS} className="min-w-0 flex-1 rounded-lg border border-[var(--daira-outline)] bg-white px-3 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-input-focus)] focus:ring-2 focus:ring-[color:var(--daira-primary)]/10 disabled:bg-[var(--daira-surface-active)]" style={{ fontSize: "16px" }} />
                  <button type="button" onClick={addKeyword} disabled={!keywordDraft.trim() || keywords.length >= MAX_KEYWORDS} className="min-h-11 shrink-0 rounded-lg bg-[var(--daira-primary)] px-3.5 text-xs font-semibold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:bg-[var(--daira-disabled-bg)] disabled:text-[var(--daira-disabled-text)]">افزودن</button>
                </div>
              </div>}

            </div>

            {triggerType === "COMMENT_KEYWORD" && (
              <div className="space-y-3">
              <div className="mb-2 mt-6"><AutomationSectionGuide>{isEditing ? "۳. پاسخ زیر کامنت — متن فعلی را ببین و در صورت نیاز ویرایش کن." : "۴. پاسخ زیر کامنت — متنی بنویس که زیر کامنت کاربر نمایش داده شود."}</AutomationSectionGuide></div>
              <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><MessageCircle size={15} strokeWidth={2.1} aria-hidden="true" /></span><label className="block text-sm font-bold text-[var(--daira-heading)]">پاسخ زیر کامنت <span className="text-[var(--daira-primary)]">(اختیاری)</span></label></div>
                <textarea value={commentReply} onChange={(e) => setCommentReply(e.target.value)} rows={3} maxLength={2000} placeholder="پاسخی که زیر کامنت کاربر منتشر می‌شود بنویس..." className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 !text-base leading-7 text-[var(--daira-heading)] outline-none placeholder:text-[11px] placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis focus:border-[var(--daira-input-focus)] focus:bg-white focus:ring-2 focus:ring-[color:var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75 }} />
              </div>
              </div>
            )}

              {triggerType === "COMMENT_KEYWORD" ? (
                <div className="space-y-4">
                <div className="mb-2 mt-6"><AutomationSectionGuide>{isEditing ? "۴. پیام دایرکت — پیام و دکمه‌های ذخیره‌شده را مشاهده و ویرایش کن." : "۵. پیام دایرکت — متن پیام را بنویس. اگر «متن همراه دکمه لینک» را انتخاب کنی، دکمه‌ای با عنوان و آدرس دلخواه زیر پیام نمایش داده می‌شود تا کاربر با لمس آن لینک را باز کند."}</AutomationSectionGuide></div>
                <section className="space-y-4 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                  {isEditing && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3">
                      <span className="min-w-0"><strong className="block text-sm text-[var(--daira-heading)]">ارسال پاسخ در دایرکت</strong><span className="mt-1 block text-xs text-[var(--daira-text)]">وقتی غیرفعال باشد، پیام‌های ذخیره‌شده باقی می‌مانند ولی ارسال نمی‌شوند.</span></span>
                      <input type="checkbox" role="switch" checked={sendDm} onChange={(event) => setSendDm(event.target.checked)} className="daira-form-switch -scale-x-100" aria-label="ارسال دایرکت خودکار" />
                    </label>
                  )}
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><Send size={15} strokeWidth={2.1} aria-hidden="true" /></span>
                      <h2 className="text-sm font-bold" style={{ color: dairaPalette.text.heading }}>پیام دایرکت</h2>
                    </div>
                  </div>

                  <div role="radiogroup" aria-label="نوع پیام دایرکت" className={"grid grid-cols-1 gap-2 sm:grid-cols-2 " + (isEditing && message.messageType !== "TEXT" ? "hidden" : "")}>
                    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition " + (dmMode === "TEXT" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)]" : "border-[var(--daira-border)] bg-white")}>
                      <input type="radio" name="direct-message-mode" value="TEXT" checked={dmMode === "TEXT"} onChange={() => setDmMode("TEXT")} className="mt-1 h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
                      <span className="min-w-0">
                        <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>متن ساده</strong>
                        <span className="mt-1 block leading-5" style={{ color: dairaPalette.text.body }}>ارسال پیام متنی بدون دکمه</span>
                      </span>
                    </label>
                    <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition " + (dmMode === "TEXT_WITH_LINK" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)]" : "border-[var(--daira-border)] bg-white")}>
                      <input type="radio" name="direct-message-mode" value="TEXT_WITH_LINK" checked={dmMode === "TEXT_WITH_LINK"} onChange={() => setDmMode("TEXT_WITH_LINK")} className="mt-1 h-4 w-4 shrink-0 accent-[var(--daira-primary)]" />
                      <span className="min-w-0">
                        <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>متن همراه دکمه لینک</strong>
                        <span className="mt-1 block leading-5" style={{ color: dairaPalette.text.body }}>نمایش یک دکمه برای باز کردن لینک</span>
                      </span>
                    </label>
                  </div>

                  {isEditing && (
                    <label className="sd-neutral-button flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3 text-xs font-bold text-[var(--daira-text)]">
                      <input type="checkbox" checked={advancedMessageEditor} disabled={message.messageType !== "TEXT" && advancedMessageEditor} onChange={(event) => setAdvancedMessageEditor(event.target.checked)} className="h-4 w-4 accent-[var(--daira-primary)]" />
                      نمایش و ویرایش انواع پیشرفته پیام (تصویر، ویدیو، وویس، ویترین یا فرم)
                    </label>
                  )}
                  {advancedMessageEditor && isEditing ? (
                    <PublishingStoryAutomationSetup
                      message={message}
                      showcases={showcases}
                      forms={forms}
                      loadingResources={loadingResources}
                      instagramAccountId={account.id}
                      onUpdate={(patch) => setMessage((current) => ({ ...current, ...patch }))}
                      keywordValid={true}
                      onContinue={() => undefined}
                      disabled={saving}
                      showFinalSave={false}
                      responseTypeTitle="نوع پیام ذخیره‌شده"
                      responseTypeDescription="همه مشخصات این پیام و گزینه‌های فرم قابل ویرایش هستند."
                      textPlaceholder="متن دایرکت ارسالی به کاربر..."
                    />
                  ) : (
                    <textarea value={message.text} onChange={(event) => setMessage((current) => ({ ...current, messageType: "TEXT", text: event.target.value, mediaUrl: "", mediaId: "", showcaseId: "", formId: "", quickReplies: isEditing ? current.quickReplies : [] }))} maxLength={dmMode === "TEXT_WITH_LINK" ? 640 : 2000} rows={4} placeholder="متن دایرکتی که بعد از کامنت برای کاربر ارسال می‌شود..." className="w-full rounded-xl border bg-white px-3.5 py-3 text-base leading-7 outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading, fontSize: "16px" }} />
                  )}
                  {message.messageType === "TEXT" && dmMode === "TEXT_WITH_LINK" && <p className="mb-2 text-xs leading-5" style={{ color: dairaPalette.text.body }}>حداکثر {MAX_LINK_BUTTONS} دکمه لینک می‌توانید اضافه کنید.</p>}

                  {message.messageType === "TEXT" && dmMode === "TEXT_WITH_LINK" && (
                    <div className="space-y-3">
                      {linkButtons.map((button, index) => (
                        <div key={index} className="rounded-xl border p-3" style={{ borderColor: dairaPalette.form.border }}>
                          <div className="relative mb-3 flex min-h-8 items-center justify-center">
                            <span className="text-sm font-bold" style={{ color: dairaPalette.primary.main }}>دکمه {new Intl.NumberFormat("fa-IR").format(index + 1)}</span>
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => setLinkButtons((current) => current.filter((_, i) => i !== index))}
                                title="حذف دکمه لینک"
                                aria-label={`حذف دکمه لینک ${new Intl.NumberFormat("fa-IR").format(index + 1)}`}
                                className="sd-destructive-button absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--daira-primary)]/25"
                                style={{ borderColor: dairaPalette.status.errorBorder, background: dairaPalette.status.errorBackground, color: dairaPalette.status.errorText }}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <div>
                              <label className="mb-2 block text-center text-xs font-semibold" style={{ color: dairaPalette.text.heading }}>عنوان دکمه</label>
                              <input value={button.title} onChange={(event) => setLinkButtons((current) => current.map((item, i) => i === index ? { ...item, title: event.target.value.slice(0, 20) } : item))} maxLength={20} placeholder="متن دکمه" className="w-full rounded-xl border bg-white px-3 py-3 text-base outline-none placeholder:text-xs focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading, fontSize: "16px" }} />
                            </div>
                            <div>
                              <label className="mb-2 block text-center text-xs font-semibold" style={{ color: dairaPalette.text.heading }}>آدرس لینک</label>
                              <input type="url" value={button.url} onChange={(event) => setLinkButtons((current) => current.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} onBlur={() => setLinkButtons((current) => current.map((item, i) => i === index ? { ...item, url: normalizeExternalLink(item.url) } : item))} placeholder="example.com" dir="ltr" className="w-full rounded-xl border bg-white px-3 py-3 text-base outline-none placeholder:text-xs focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading, fontSize: "16px" }} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {linkButtons.length < MAX_LINK_BUTTONS && <div className="flex justify-center pt-1"><button type="button" onClick={() => setLinkButtons((current) => [...current, { title: "", url: "" }])} className="min-h-10 rounded-lg border px-4 text-xs font-semibold" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.primary.main }}>افزودن دکمه‌های بیشتر</button></div>}
                    </div>
                  )}

                  </section>

                {isEditing && (
                  <div className="space-y-3">
                    {extraMessages.length > 0 && <div className="mb-2 mt-6"><AutomationSectionGuide>۵. پیام‌های تکمیلی — پیام‌های قبلی را جداگانه ویرایش کن؛ ترتیب ارسال آن‌ها حفظ می‌شود.</AutomationSectionGuide></div>}
                    {extraMessages.map((entry, index) => (
                      <section key={entry.id} className="space-y-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-[var(--daira-heading)]">پیام شماره {new Intl.NumberFormat("fa-IR").format(index + 2)}</h3>
                          <button type="button" onClick={() => setExtraMessages((current) => current.filter((item) => item.id !== entry.id))} disabled={saving} className="sd-destructive-button inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3 text-xs font-bold text-[var(--daira-error-text)]"><Trash2 size={15} /> حذف پیام</button>
                        </div>
                        <PublishingStoryAutomationSetup
                          message={entry}
                          showcases={showcases}
                          forms={forms}
                          loadingResources={loadingResources}
                          instagramAccountId={account.id}
                          onUpdate={(patch) => setExtraMessages((current) => current.map((item) => item.id === entry.id ? { ...item, ...patch } : item))}
                          keywordValid={true}
                          onContinue={() => undefined}
                          disabled={saving}
                          showFinalSave={false}
                          responseTypeTitle="نوع پیام"
                          responseTypeDescription="متن یا رسانه، ویترین، فرم و گزینه‌های مربوط به این پیام را ویرایش کن."
                        />
                        {entry.messageType === "TEXT" && (
                          <div className="space-y-2">
                            {(extraLinks[entry.id] || []).map((button, linkIndex) => (
                              <div key={linkIndex} className="grid gap-2 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3 sm:grid-cols-[1fr_2fr_auto]">
                                <input aria-label="عنوان دکمه" maxLength={20} value={button.title} placeholder="عنوان دکمه" onChange={(event) => setExtraLinks((current) => ({ ...current, [entry.id]: (current[entry.id] || []).map((value, i) => i === linkIndex ? { ...value, title: event.target.value } : value) }))} className="min-w-0 rounded-lg border border-[var(--daira-border)] bg-white p-2.5 text-base" />
                                <input aria-label="آدرس لینک" dir="ltr" value={button.url} placeholder="example.com" onChange={(event) => setExtraLinks((current) => ({ ...current, [entry.id]: (current[entry.id] || []).map((value, i) => i === linkIndex ? { ...value, url: event.target.value } : value) }))} onBlur={() => setExtraLinks((current) => ({ ...current, [entry.id]: (current[entry.id] || []).map((value, i) => i === linkIndex ? { ...value, url: normalizeExternalLink(value.url) } : value) }))} className="min-w-0 rounded-lg border border-[var(--daira-border)] bg-white p-2.5 text-base" />
                                <button type="button" aria-label="حذف دکمه لینک" onClick={() => setExtraLinks((current) => ({ ...current, [entry.id]: (current[entry.id] || []).filter((_, i) => i !== linkIndex) }))} className="sd-destructive-button min-h-10 rounded-lg border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3 text-[var(--daira-error-text)]"><Trash2 size={16} /></button>
                              </div>
                            ))}
                            {(extraLinks[entry.id] || []).length < 3 && (
                              <button type="button" onClick={() => setExtraLinks((current) => ({ ...current, [entry.id]: [...(current[entry.id] || []), { title: "", url: "" }] }))} className="min-h-10 rounded-xl border border-[var(--daira-border)] px-4 text-xs font-semibold">افزودن دکمه لینک</button>
                            )}
                          </div>
                        )}
                      </section>
                    ))}
                    <button type="button" onClick={() => setExtraMessages((current) => [...current, createEmptyMessage()])} disabled={saving || extraMessages.length >= 19} className="min-h-11 w-full rounded-xl border border-[var(--daira-border)] px-4 text-sm font-bold">افزودن پیام تکمیلی</button>
                  </div>
                )}

                <div className="mb-2 mt-6"><AutomationSectionGuide>{isEditing ? "۶. شرط فالو — وضعیت فعلی و متن درخواست فالو را ویرایش کن." : "۶. شرط فالو — اختیاری است؛ اگر روشنش کنی، کاربر قبل از دریافت پاسخ باید پیج را دنبال کند و درخواست بررسی فالو برایش ارسال می‌شود."}</AutomationSectionGuide></div>
                <section className="rounded-2xl bg-white p-4 sm:p-5">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3.5 transition-colors" style={{ borderColor: requireFollow ? dairaPalette.primary.main : dairaPalette.border }}>
                      <input type="checkbox" role="switch" aria-label="الزام به فالو قبل از ارسال پاسخ" aria-checked={requireFollow} checked={requireFollow} onChange={(event) => setRequireFollow(event.target.checked)} className="daira-form-switch mt-1 -scale-x-100" />
                      <span className="min-w-0">
                        <strong className="block text-sm" style={{ color: dairaPalette.text.heading }}>الزام به فالو قبل از ارسال پاسخ <span className="text-[var(--daira-primary)]">(اختیاری)</span></strong>
                      </span>
                    </label>
                    {requireFollow && (
                      <div className="mt-3">
                        <label className="mb-2 block text-sm font-semibold" style={{ color: dairaPalette.text.heading }}>متن درخواست فالو</label>
                        <textarea value={followGateText} onChange={(event) => setFollowGateText(event.target.value)} maxLength={640} rows={3} placeholder="برای دریافت پاسخ، ابتدا پیج ما را فالو کنید." className="w-full rounded-xl border bg-white px-3 py-3 text-base leading-6 outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading, fontSize: "16px" }} />
                        {!followGateText.trim() && <p className="mt-1 text-xs" style={{ color: dairaPalette.status.error }}>وارد کردن متن درخواست فالو الزامی است.</p>}
                        <div className="mt-4">
                          <label className="mb-2 block text-center text-sm font-semibold" style={{ color: dairaPalette.text.heading }}>متن دکمه بررسی فالو</label>
                          <input type="text" value={followGateButtonText} onChange={(event) => setFollowGateButtonText(event.target.value)} maxLength={20} required placeholder="مثلاً فالو کردم" className="w-full rounded-xl border bg-white px-3 py-3 text-center text-base leading-6 outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/15" style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading, fontSize: "16px" }} />
                          <p className="mt-1 text-xs text-center" style={{ color: dairaPalette.text.body }}>با زدن این دکمه، وضعیت فالو بررسی می‌شود.</p>
                        </div>
                      </div>
                    )}
                  </section>


                  {isEditing && (
                    <section className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                      <label className="flex cursor-pointer items-center justify-between gap-3">
                        <span className="min-w-0"><strong className="block text-sm text-[var(--daira-heading)]">وضعیت پاسخ خودکار</strong><span className="mt-1 block text-xs text-[var(--daira-text)]">می‌توانی پاسخ را بدون حذف کردن غیرفعال کنی.</span></span>
                        <input type="checkbox" role="switch" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="daira-form-switch -scale-x-100" aria-label="فعال بودن پاسخ خودکار" />
                      </label>
                    </section>
                  )}
                  <button type="button" onClick={() => {
                    if (isEditing) void saveAutomation();
                    else { setMessage((current) => ({ ...current, messageType: "TEXT" })); void saveAutomation({ ...message, messageType: "TEXT" }); }
                  }} disabled={saving || (isEditing && (mediaLoading || loadingResources))} className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition disabled:opacity-60" style={{ background: dairaPalette.primary.main }}>
                    {saving ? (isEditing ? "در حال ذخیره تغییرات..." : "در حال ساخت پاسخ خودکار...") : (isEditing ? "ذخیره تغییرات" : "ساخت پاسخ خودکار")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                <div className="mb-2 mt-6"><AutomationSectionGuide>۴. نوع پاسخ — مشخص کن در جواب استوری متن، عکس، ویدیو، وویس، ویترین یا فرم ارسال شود.</AutomationSectionGuide></div>
                <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                <PublishingStoryAutomationSetup
                  message={message}
                  showcases={showcases}
                  forms={forms}
                  loadingResources={loadingResources}
                  instagramAccountId={account.id}
                  onUpdate={(patch) => setMessage((current) => ({ ...current, ...patch }))}
                  keywordValid={keywords.length > 0}
                  onContinue={(nextMessage) => {
                    const next = nextMessage ?? message;
                    setMessage(next);
                    return saveAutomation(next);
                  }}
                  disabled={saving}
                  showFinalSave
                  finalSaveLabel="ساخت پاسخ خودکار"
                  finalSaveLoadingLabel="در حال ساخت پاسخ خودکار..."
                  finalSaveDisabled={saving}
                  responseTypeTitle="نوع پاسخ خودکار"
                  responseTypeDescription=""
                  textPlaceholder="متنی که در پاسخ خودکار برای کاربر ارسال می‌شود..."
                />
                </div>
                </div>
              )}
            </div>
            )}

          </div>

          {error && <div role="alert" className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium leading-6 text-[var(--daira-error-text)]">{error}</div>}


        {mediaDialogOpen && (
          <div className="fixed inset-0 z-[2200] flex items-end justify-center bg-black/45 p-5 backdrop-blur-[2px] sm:items-center sm:p-6 md:p-8" onMouseDown={(event) => { if (event.target === event.currentTarget) setMediaDialogOpen(false); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="media-dialog-title" className="flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--daira-border)] px-3 py-2.5 sm:px-4">
                <span className="shrink-0 rounded-lg bg-[var(--daira-surface-hover)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--daira-text)]">{new Intl.NumberFormat("fa-IR").format(draftSelectedMediaIds.length)} انتخاب‌شده</span>
                <button type="button" onClick={() => setMediaDialogOpen(false)} aria-label="بستن پنجره انتخاب محتوا" className="sd-neutral-button flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--daira-text)] transition hover:bg-[var(--daira-surface-hover)] hover:text-[var(--daira-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--daira-primary)]/25"><X size={17} /></button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
                {isEditing && !mediaLoading && draftSelectedMediaIds.some((id) => !availableMediaIdSet.has(id)) && (
                  <div className="mb-3 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3">
                    <p className="mb-2 text-xs font-bold text-[var(--daira-text)]">محتواهای متصل که اکنون در فهرست اینستاگرام نمایش داده نمی‌شوند:</p>
                    <div className="flex flex-wrap gap-2">
                      {draftSelectedMediaIds.filter((id) => !availableMediaIdSet.has(id)).map((id) => (
                        <button key={id} type="button" onClick={() => setDraftSelectedMediaIds((current) => current.filter((value) => value !== id))} className="sd-neutral-button inline-flex min-h-9 items-center gap-2 rounded-xl border border-[var(--daira-border)] bg-white px-3 text-xs text-[var(--daira-text)]">
                          <span dir="ltr">…{id.slice(-8)}</span><X size={14} aria-label="حذف این اتصال" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <AutomationPicker items={mediaItems} selectedIds={draftSelectedMediaIds} loading={mediaLoading} showContentFilters={triggerType === "COMMENT_KEYWORD"} onToggle={(id) => setDraftSelectedMediaIds((current) => triggerType === "COMMENT_KEYWORD" ? (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) : [id])} />
              </div>
              <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-[var(--daira-border)] bg-white px-3 py-3 sm:px-4">
                <div className="flex items-center justify-center gap-2">
                  <button type="button" onClick={() => setMediaDialogOpen(false)} className="sd-neutral-button min-h-9 rounded-xl border border-[var(--daira-border)] px-4 text-xs font-bold text-[var(--daira-text)] transition hover:bg-[var(--daira-surface-hover)]">انصراف</button>
                  <button type="button" onClick={confirmMediaSelection} disabled={mediaLoading} className="min-h-9 rounded-xl bg-[var(--daira-primary)] px-4 text-xs font-bold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">تأیید انتخاب</button>
                </div>
              </footer>
            </section>
          </div>
        )}
    </div>
  );
}
