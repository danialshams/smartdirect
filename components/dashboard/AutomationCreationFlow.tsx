"use client";

import { BookOpen, Camera, Image as ImageIcon, Lightbulb, MessageCircle, Send, ShieldCheck, Trash2, X, Eye, Pencil } from "lucide-react";
import ResponseModeSwitcher from "./ResponseModeSwitcher";
import CompleteAutomationPicker, { type CompleteAutomation } from "./CompleteAutomationPicker";
import ResponseTemplateDetails from "./ResponseTemplateDetails";
import CommentReplyVariantsField from "./CommentReplyVariantsField";
import { readPublicCommentReplies, validatePublicCommentReplies, publicCommentReplyKey } from "@/lib/automation/comment-reply-variants";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const PublishingStoryAutomationSetup = dynamic(() => import("./publishing/PublishingStoryAutomationSetup"), { ssr: false });
import type { StoryFormTemplate } from "./publishing/PublishingStoryAutomationSetup";
import { createEmptyMessage, normalizeMessages, validateMessages, type MessageDraft, type QuickReplyDraft, type Showcase, type FormItem } from "./automation-form-utils";
import { dairaPalette } from "../../lib/design-system/palette";
import ContentSelectionDialog from "./ContentSelectionDialog";
import GlassModalPresence from "./GlassModalPresence";
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
  title?: string | null;
  keywordMatchMode?: string | null;
  commentReplyText?: string | null;
  likeStoryReply?: boolean;
  requireFollow?: boolean;
  followGateText?: string | null;
  followGateButtonText?: string | null;
  isActive?: boolean;
  sendDm?: boolean;
  updatedAt: string;
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
type AutomationTemplate = CompleteAutomation & { triggerType: string; mediaId?: string | null; mediaIds?: string | null; linkButtons?: LinkButton[]; likeStoryReply?: boolean; };

type Props = {
  account: Account;
  mediaId?: string;
  triggerType: TriggerType;
  title: string;
  description: string;
  editAutomation?: EditableCommentAutomation;
  editingMediaId?: string;
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
      className="daira-guide-glass flex items-start gap-3 rounded-xl border px-3.5 py-3"
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
    savedResponseId: reply.savedResponseId || null,
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

export default function AutomationCreationFlow({ account, mediaId, triggerType, editAutomation, editingMediaId }: Props) {
  const router = useRouter();
  const isEditing = Boolean(editAutomation);
  // Initialize editing directly from the fetched record; don't render a second skeleton
  // while another effect hydrates form fields.
  const initialEditState = useMemo(() => {
    if (!editAutomation) return null;
    // The list opens one media-specific edit, not a bulk edit of every linked post.
    const mediaIds = editingMediaId ? [editingMediaId] : Array.from(new Set([
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
      responseName: editAutomation.title || "",
      keyword: editAutomation.keyword || "",
      keywordMatchMode: editAutomation.keywordMatchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" as const : "EXACT" as const,
      commentReplies: (() => { const previous = readPublicCommentReplies(editAutomation.commentReplyText); return [...previous, ...Array(Math.max(0, 3 - previous.length)).fill("")]; })(),
      likeStoryReply: Boolean(editAutomation.likeStoryReply),
      isActive: editAutomation.isActive !== false,
      requireFollow: Boolean(editAutomation.requireFollow),
      followGateText: editAutomation.followGateText || "برای دریافت پاسخ، ابتدا پیج ما را فالو کنید.",
      followGateButtonText: editAutomation.followGateButtonText || "بررسی فالو",
      dmMode: firstLinks.length ? "TEXT_WITH_LINK" as const : "TEXT" as const,
      linkButtons: firstLinks.length ? firstLinks : [{ title: "", url: "" }],
      message: first,
      extraMessages: loadedMessages.slice(1),
      extraLinks,
    };
  }, [editAutomation, editingMediaId]);
  const [extraMessages, setExtraMessages] = useState<MessageDraft[]>(() => initialEditState?.extraMessages ?? []);
  const [extraLinks, setExtraLinks] = useState<Record<string, LinkButton[]>>(() => initialEditState?.extraLinks ?? {});
  const [keyword, setKeyword] = useState(() => initialEditState?.keyword ?? "");
  const [responseName, setResponseName] = useState(() => initialEditState?.responseName ?? "");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keywordMatchMode, setKeywordMatchMode] = useState<"EXACT" | "CONTAINS_ANY">(() => initialEditState?.keywordMatchMode ?? "EXACT");
  const MAX_KEYWORDS = 10;
  const MAX_LINK_BUTTONS = 3;
  const [linkButtons, setLinkButtons] = useState<LinkButton[]>(() => initialEditState?.linkButtons ?? [{ title: "", url: "" }]);
  const [linkedMediaItems, setLinkedMediaItems] = useState<Array<{id:string; caption?:string; media_type?:string; media_product_type?:string; thumbnail_url?:string|null; media_url?:string|null}>>([]);
  const [previewTemplate, setPreviewTemplate] = useState<AutomationTemplate | null>(null);
  const [editScopeOpen, setEditScopeOpen] = useState(false);
  const [editScopeIds, setEditScopeIds] = useState<string[]>([]);
  const originalMediaIds = useMemo(() => editAutomation ? Array.from(new Set([...(editAutomation.mediaId ? [editAutomation.mediaId] : []), ...(editAutomation.mediaIds || "").split(",").map((id) => id.trim()).filter(Boolean)])) : [], [editAutomation]);
  const [mediaItems, setMediaItems] = useState<Array<{id:string; caption?:string; media_type?:string; media_product_type?:string; thumbnail_url?:string|null; media_url?:string|null; timestamp?:string}>>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(() => initialEditState?.mediaIds ?? (mediaId ? [mediaId] : []));
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [draftSelectedMediaIds, setDraftSelectedMediaIds] = useState<string[]>([]);
  const [mediaLoading, setMediaLoading] = useState(triggerType === "COMMENT_KEYWORD");
  const [commentReplies, setCommentReplies] = useState<string[]>(() => initialEditState?.commentReplies ?? ["", "", ""]);
  const [requireFollow, setRequireFollow] = useState(() => initialEditState?.requireFollow ?? false);
  const [likeStoryReply, setLikeStoryReply] = useState(() => initialEditState?.likeStoryReply ?? false);
  // Preserve an existing automation status; editing no longer exposes an activation switch.
  const isActive = initialEditState?.isActive ?? true;
  const [dmMode, setDmMode] = useState<"TEXT" | "TEXT_WITH_LINK">(() => initialEditState?.dmMode ?? "TEXT");
  const [followGateText, setFollowGateText] = useState(() => initialEditState?.followGateText ?? "برای دریافت پاسخ، ابتدا پیج ما را فالو کنید.");
  const [followGateButtonText, setFollowGateButtonText] = useState(() => initialEditState?.followGateButtonText ?? "بررسی فالو");
  const [message, setMessage] = useState<MessageDraft>(() => initialEditState?.message ?? createEmptyMessage());
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [storyFormTemplates, setStoryFormTemplates] = useState<StoryFormTemplate[]>([]);
  const [automationTemplates, setAutomationTemplates] = useState<AutomationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [creationMode, setCreationMode] = useState<CreationMode>("new");
  const [editingView, setEditingView] = useState<"edit" | "replace">("edit");
  const [loadingResources, setLoadingResources] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [storyShowcaseDraftChanged, setStoryShowcaseDraftChanged] = useState(false);
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
    let cancelled = false;
    void (async () => {
      try {
        const [showcaseResponse, formResponse, automationResponse, savedResponse] = await Promise.all([
          fetch("/api/showcases?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/forms?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/automations?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
          fetch("/api/saved-responses?instagramAccountId=" + encodeURIComponent(account.id), { cache: "no-store", credentials: "include" }),
        ]);
        const [showcaseResult, formResult, automationResult, savedResult] = await Promise.all([
          showcaseResponse.json(), formResponse.json(), automationResponse.json(), savedResponse.json(),
        ]);
        if (!cancelled) {
          setShowcases(Array.isArray(showcaseResult) ? showcaseResult : Array.isArray(showcaseResult?.data) ? showcaseResult.data : []);
          setForms(Array.isArray(formResult) ? formResult : Array.isArray(formResult?.data) ? formResult.data : []);
          // Live-comment DM rules use a reserved media marker. Never present them
          // as reusable post/comment automation templates.
          const existingAutomations: AutomationTemplate[] = (Array.isArray(automationResult?.data) ? automationResult.data : [])
            .filter((item: AutomationTemplate) => item.mediaId !== "__smartdirect_live_comments_v1__");
          setAutomationTemplates(existingAutomations.filter((item) =>
            item.triggerType === triggerType &&
            item.id !== editAutomation?.id &&
            (triggerType === "COMMENT_KEYWORD"
              ? readPublicCommentReplies(item.commentReplyText).length >= 3
              : normalizeMessages(item.messages).length > 0),
          ));
          if (triggerType === "STORY_REPLY_KEYWORD") {
            const seen = new Set<string>();
            const templates: StoryFormTemplate[] = [];
            for (const automation of existingAutomations) {
              const normalized = normalizeMessages(automation.messages);
              for (const savedMessage of normalized) {
                if (savedMessage.messageType !== "FORM" || !savedMessage.text.trim() || !savedMessage.quickReplies.length) continue;
                const id = `automation:${automation.id}:${savedMessage.id}`;
                if (seen.has(id)) continue;
                seen.add(id);
                templates.push({
                  id, title: `فرم استوری — ${savedMessage.text.trim().slice(0, 48)}`,
                  text: savedMessage.text, quickReplies: savedMessage.quickReplies,
                });
              }
            }
            for (const saved of Array.isArray(savedResult?.data) ? savedResult.data : []) {
              if (!saved || saved.messageType !== "FORM" || !saved.text) continue;
              const id = `saved:${saved.id}`;
              const normalized = normalizeMessages([{ ...saved, id, messageType: "FORM" }]);
              if (!normalized[0]?.quickReplies.length || seen.has(id)) continue;
              seen.add(id);
              templates.push({
                id, title: saved.title || `فرم — ${saved.text.slice(0, 48)}`,
                text: normalized[0].text, quickReplies: normalized[0].quickReplies,
              });
            }
            setStoryFormTemplates(templates);
          }
        }
      } catch {
        if (!cancelled) {
          setShowcases([]);
          setForms([]);
          setStoryFormTemplates([]);
        }
      } finally {
        if (!cancelled) setLoadingResources(false);
      }
    })();
    return () => { cancelled = true; };
  }, [account.id, triggerType, editAutomation?.id]);

  function applyAutomationTemplate(template: AutomationTemplate) {
    setSelectedTemplateId(template.id);
    setCreationMode("existing");
    setPreviewTemplate(null);
    setError("");
  }

  function startNewAutomation() {
    setSelectedTemplateId("");
    setCreationMode("new");
    setError("");
  }

  function resetEditableResponse() {
    if (!initialEditState) return;
    setResponseName(initialEditState.responseName);
    setKeyword(initialEditState.keyword);
    setKeywordDraft("");
    setKeywordMatchMode(initialEditState.keywordMatchMode);
    setCommentReplies([...initialEditState.commentReplies]);
    setLikeStoryReply(initialEditState.likeStoryReply);
    setRequireFollow(initialEditState.requireFollow);
    setFollowGateText(initialEditState.followGateText);
    setFollowGateButtonText(initialEditState.followGateButtonText);
    setDmMode(initialEditState.dmMode);
    setLinkButtons(initialEditState.linkButtons.map((entry) => ({ ...entry })));
    setMessage(initialEditState.message);
    setExtraMessages([...initialEditState.extraMessages]);
    setExtraLinks({ ...initialEditState.extraLinks });
    setSelectedTemplateId("");
    setPreviewTemplate(null);
    setError("");
  }

  function selectReplacementTemplate(template: AutomationTemplate) {
    const raw = Array.isArray(template.messages) ? template.messages : [];
    const sourceMessages = normalizeMessages(raw);
    const messages = template.triggerType === "COMMENT_KEYWORD" && template.sendDm === false
      ? [] : sourceMessages;
    const first = messages[0] ?? createEmptyMessage();
    const firstLinks = readSavedLinks(raw[0]);
    const nextExtraLinks: Record<string, LinkButton[]> = {};
    messages.slice(1).forEach((entry, index) => {
      nextExtraLinks[entry.id] = readSavedLinks(raw[index + 1]);
    });
    setSelectedTemplateId(template.id);
    setResponseName(template.title?.trim() || initialEditState?.responseName || "");
    setKeyword(template.keyword || "");
    setKeywordMatchMode(template.keywordMatchMode === "CONTAINS_ANY" ? "CONTAINS_ANY" : "EXACT");
    setCommentReplies((() => {
      const saved = readPublicCommentReplies(template.commentReplyText);
      return [...saved, ...Array(Math.max(0, 3 - saved.length)).fill("")];
    })());
    setLikeStoryReply(Boolean(template.likeStoryReply));
    setRequireFollow(Boolean(template.requireFollow));
    setFollowGateText(template.followGateText || "برای دریافت پاسخ ابتدا پیج را دنبال کن.");
    setFollowGateButtonText(template.followGateButtonText || "بررسی فالو");
    setDmMode(firstLinks.length ? "TEXT_WITH_LINK" : "TEXT");
    setLinkButtons(firstLinks.length ? firstLinks : [{ title: "", url: "" }]);
    setMessage(first);
    setExtraMessages(messages.slice(1));
    setExtraLinks(nextExtraLinks);
    setError("");
    setEditingView("replace");
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
    mediaIds: [...selectedMediaIds].sort(), responseName, keyword, keywordMatchMode, commentReplies,
    likeStoryReply, isActive, requireFollow, followGateText, followGateButtonText, dmMode,
    linkButtons, message, extraMessages, extraLinks,
  });
  const originalSnapshot = initialEditState ? JSON.stringify({
    mediaIds: [...initialEditState.mediaIds].sort(),
    responseName: initialEditState.responseName,
    keyword: initialEditState.keyword,
    keywordMatchMode: initialEditState.keywordMatchMode,
    commentReplies: initialEditState.commentReplies,
    likeStoryReply: initialEditState.likeStoryReply,
    isActive: initialEditState.isActive,
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
  const canSaveStoryEdit = isEditing && triggerType === "STORY_REPLY_KEYWORD" &&
    !saving && !mediaLoading && !loadingResources && (hasUnsavedEdits || storyShowcaseDraftChanged);
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
    commentReplies.length < 3 || commentReplies.length > 5 || commentReplies.some((text) => !text.trim() || text.trim().length > 2000) || new Set(commentReplies.map(publicCommentReplyKey)).size !== commentReplies.length ? "سه تا پنج پاسخ متفاوت زیر کامنت را کامل وارد کنید." :
    enteredDm && !validDm ? "همه پیام‌های دایرکت را کامل وارد کنید." :
    enteredDm && (!mainLinksValid || !extraLinksValid) ? "عنوان و آدرس دکمه‌های لینک را کامل و معتبر وارد کنید." :

    requireFollow && !enteredDm ? "برای فعال کردن شرط فالو، پیام دایرکت لازم است." :
    requireFollow && (!followGateText.trim() || followGateText.length > 640 ||
      !followGateButtonText.trim() || followGateButtonText.trim().length > 20) ?
      "متن درخواست فالو و عنوان دکمه بررسی فالو را کامل وارد کنید." : "";
  const canSaveComment = !saving && !commentFormError && (!isEditing || hasUnsavedEdits);
  const initialDmSnapshot = initialEditState ? JSON.stringify({
    message: initialEditState.message, extraMessages: initialEditState.extraMessages,
    dmMode: initialEditState.dmMode, linkButtons: initialEditState.linkButtons,
    extraLinks: initialEditState.extraLinks,
  }) : "";
  const currentDmSnapshot = JSON.stringify({ message, extraMessages, dmMode, linkButtons, extraLinks });
  const dmWasEdited = isEditing && currentDmSnapshot !== initialDmSnapshot;
  const replacementTemplate = editingView === "replace"
    ? automationTemplates.find((item) => item.id === selectedTemplateId) : null;
  const shouldSendDm = !enteredDm ? false :
    replacementTemplate ? replacementTemplate.sendDm !== false :
    editAutomation && !dmWasEdited ? editAutomation.sendDm !== false : true;

  useEffect(() => {
    if (triggerType === "STORY_REPLY_KEYWORD") { setMediaLoading(false); return; }
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
        setLinkedMediaItems(mediaResult.data);
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

  async function saveAutomation(finalMessage?: MessageDraft, applyScope?: string[]) {
    if (saving) return;
    if (isEditing && editingView === "replace" && !selectedTemplateId) {
      setError("ابتدا پاسخ کامل جایگزین را انتخاب کن.");
      return;
    }
    if (isEditing && triggerType === "STORY_REPLY_KEYWORD" && editingView !== "replace" && !canSaveStoryEdit) return;
    if (triggerType === "COMMENT_KEYWORD" && (isEditing || creationMode === "new") &&
      (editingView !== "replace" && !canSaveComment || Boolean(commentFormError))) {
      setError(commentFormError || "برای ذخیره، ابتدا تغییری در پاسخ خودکار ایجاد کنید.");
      return;
    }
    
    if (isEditing && triggerType === "COMMENT_KEYWORD" && originalMediaIds.length > 1 && !applyScope) {
      setEditScopeIds([...originalMediaIds]);
      setEditScopeOpen(true);
      return;
    }
    if (applyScope && !applyScope.length) { setError("حداقل یک محتوا را برای ویرایش انتخاب کن."); return; }
    const cleanKeywords = keywords;
    const autoTitle = (triggerType === "COMMENT_KEYWORD" ? "پاسخ کامنت" : "پاسخ استوری") + " - " + (keywordMatchMode === "CONTAINS_ANY" ? "همه" : cleanKeywords.join("، ")).slice(0, 60);
    const currentMessage = finalMessage ?? message;
    const targetMediaIds = Array.from(new Set(applyScope
      ? [...applyScope, ...selectedMediaIds.filter((id) => !originalMediaIds.includes(id))]
      : selectedMediaIds.filter(Boolean)));
    const normalizedLinkButtons = linkButtons.map((button) => ({ ...button, url: normalizeExternalLink(button.url) }));

    if (isEditing && editAutomation) {
      if (triggerType === "STORY_REPLY_KEYWORD") {
        // Story rules apply to all of this account’s stories.
        if (keywordMatchMode === "EXACT" && !cleanKeywords.length) { setError("حداقل یک کلمه کلیدی وارد کنید."); return; }
        if (cleanKeywords.length > MAX_KEYWORDS) { setError("حداکثر ۱۰ کلمه کلیدی مجاز است."); return; }
        if (requireFollow && (!followGateText.trim() || followGateText.trim().length > 640)) {
          setError("متن درخواست فالو را وارد کنید (حداکثر ۶۴۰ کاراکتر)."); return;
        }
        if (requireFollow && (!followGateButtonText.trim() || followGateButtonText.trim().length > 20)) {
          setError("عنوان دکمه بررسی فالو را وارد کنید (حداکثر ۲۰ کاراکتر)."); return;
        }
        try { validateMessages([currentMessage], "STORY_REPLY_KEYWORD"); }
        catch (validationError) { setError(validationError instanceof Error ? validationError.message : "پاسخ استوری ناقص است."); return; }

        const existingMainMessage = normalizeMessages(editAutomation.messages)[0];
        setSaving(true);
        setError("");
        try {
          const response = await fetch("/api/automations/" + encodeURIComponent(editAutomation.id) + "/story-edit", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              expectedUpdatedAt: editAutomation.updatedAt,
              title: autoTitle,
              mediaId: null,
              keywordMatchMode,
              keyword: keywordMatchMode === "CONTAINS_ANY" ? null : cleanKeywords.join(","),
              likeStoryReply,
              requireFollow,
              followGateText: requireFollow ? followGateText.trim() : null,
              followGateButtonText: requireFollow ? followGateButtonText.trim() : null,
              isActive,
              message: {
                ...currentMessage,
                updateQuickReplies: !existingMainMessage ||
                  existingMainMessage.messageType !== currentMessage.messageType ||
                  JSON.stringify(existingMainMessage.quickReplies) !== JSON.stringify(currentMessage.quickReplies),
                quickReplies: currentMessage.quickReplies.map((reply) => ({
                  ...reply,
                  destinationQuickReplies: serializeQuickReplies(reply.destinationQuickReplies),
                })),
              },
            }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success)
            throw new Error(result?.error || "ذخیره ویرایش پاسخ خودکار استوری ناموفق بود.");
          setCompleted(true);
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "ذخیره پاسخ خودکار استوری ناموفق بود.");
        } finally {
          setSaving(false);
        }
        return;
      }
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
        const preparedPrimary = { ...currentMessage };
        const previouslySavedMessages = normalizeMessages(editAutomation.messages);
        const originalById = new Map(previouslySavedMessages.map((entry) => [entry.id, entry]));
        const allMessages = [preparedPrimary, ...extraMessages].map((entry, index) => ({
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
            sourceMediaId: editingMediaId || (initialEditState?.mediaIds.length === 1 ? initialEditState.mediaIds[0] : null),
            expectedUpdatedAt: editAutomation.updatedAt,
            title: autoTitle,
            commentReplyVariants: validatePublicCommentReplies(commentReplies),
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
      if (triggerType === "COMMENT_KEYWORD" && targetIds.length === 0) { setError("حداقل یک پست یا ریلز انتخاب کنید."); return; }
      
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
            mediaIds: targetIds,
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
    if (triggerType === "COMMENT_KEYWORD" && selectedMediaIds.length === 0) {
      setError("حداقل یک پست یا ریلز انتخاب کنید.");
      return;
    }
    if (requireFollow && !followGateText.trim()) {
      setError("متن درخواست فالو را وارد کنید.");
      return;
    }
    if (requireFollow && (!followGateButtonText.trim() || followGateButtonText.trim().length > 20)) {
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
      const preparedPrimary = { ...currentMessage };
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagramAccountId: account.id,
          title: autoTitle,
          triggerType,
          mediaId: triggerType === "COMMENT_KEYWORD" ? (targetMediaIds.length === 1 ? targetMediaIds[0] : null) : null,
          keyword: keywordMatchMode === "CONTAINS_ANY" ? null : cleanKeywords.join(","),
          keywordMatchMode,
          mediaIds: triggerType === "COMMENT_KEYWORD" ? targetMediaIds : [],
          commentReplyVariants: triggerType === "COMMENT_KEYWORD" ? validatePublicCommentReplies(commentReplies) : undefined,
          replyText: null,
          likeComment: false,
          sendDm: triggerType === "COMMENT_KEYWORD" ? enteredDm : true,
          likeIncomingDm: false,
          likeStoryReply: triggerType === "STORY_REPLY_KEYWORD" && likeStoryReply,
          requireFollow: requireFollow,
          followGateText: requireFollow ? followGateText.trim() : null,
          followGateButtonText: requireFollow ? followGateButtonText.trim() : null,
          isActive: true,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.id) {
        throw new Error(result.error || result.message || "ذخیره پاسخ خودکار ناموفق بود.");
      }

      const automationId = result.data.id as string;
      const messagesToCreate = triggerType === "COMMENT_KEYWORD"
        ? (enteredDm ? [preparedPrimary, ...extraMessages] : [])
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
            savedResponseId: null,
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
              savedResponseId: null,
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
      /* Only explicit submit buttons use the strong primary treatment.
         Generic button selectors previously painted every reply card, eye
         icon and active mode solid blue. */
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
        {triggerType === "COMMENT_KEYWORD" && <>
        <div className="mb-2"><AutomationSectionGuide>۱. انتخاب محتوا — پست یا ریلز موردنظرت را انتخاب کن.</AutomationSectionGuide></div>
        {isEditing ? (
          <section aria-label="محتواهای انتخاب‌شده" className="daira-content-select-panel rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="daira-keyword-field flex items-center gap-2">
                <strong className="text-sm font-bold text-[var(--daira-heading)]">{triggerType === "STORY_REPLY_KEYWORD" ? "استوری انتخاب‌شده" : "محتواهای انتخاب‌شده"}</strong>
                <span className="rounded-full bg-[var(--daira-surface-hover)] px-2.5 py-1 text-xs font-bold text-[var(--daira-text)]" aria-live="polite">{new Intl.NumberFormat("fa-IR").format(selectedMediaCount)} {triggerType === "STORY_REPLY_KEYWORD" ? "استوری" : "محتوا"}</span>
              </div>
              <button type="button" onClick={openMediaDialog} aria-haspopup="dialog" aria-expanded={mediaDialogOpen} className="daira-content-select-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white">
                <ImageIcon size={16} aria-hidden="true" /> افزودن یا تغییر محتوا
              </button>
            </div>
            {selectedMediaCount ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {selectedMediaIds.map((id) => {
                  const item = mediaItems.find((media) => media.id === id);
                  const preview = item?.thumbnail_url || item?.media_url;
                  return (
                    <div key={id} className="relative min-w-0 overflow-hidden rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)]">
                      <div className="flex aspect-square items-center justify-center overflow-hidden bg-[var(--daira-surface-active)]">
                        {preview ? <img src={preview} alt={item?.caption || "محتوای انتخابی"} className="h-full w-full object-cover" loading="lazy" /> : <Camera size={22} className="text-[var(--daira-text)]" />}
                      </div>
                      <button type="button" onClick={() => setSelectedMediaIds((current) => current.filter((value) => value !== id))}
                        aria-label={`حذف محتوا از انتخاب‌ها ${id}`}
                        title="حذف از انتخاب‌ها"
                        className="sd-destructive-button absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--daira-border)] bg-white/95 text-[var(--daira-error-text)] shadow-sm transition hover:bg-[var(--daira-error-background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--daira-primary)]">
                        <X size={16} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      <p className="truncate px-2 py-2 text-center text-[11px] font-semibold text-[var(--daira-text)]">
                        {triggerType === "STORY_REPLY_KEYWORD" ? "استوری" : item?.media_product_type === "REELS" ? "ریلز" : item?.media_type === "CAROUSEL_ALBUM" ? "پست اسلایدی" : item ? "پست" : "محتوای قبلی"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-4 py-6 text-center text-xs leading-6 text-[var(--daira-text)]">{triggerType === "STORY_REPLY_KEYWORD" ? "برای ذخیره، یک استوری انتخاب کن." : "هنوز محتوایی انتخاب نشده است. برای ذخیره حداقل یک محتوا انتخاب کنید."}</p>
            )}
            {!mediaLoading && unknownMediaIds.length > 0 && (
              <p className="mt-3 text-xs leading-6 text-[var(--daira-text)]">پیش‌نمایش {new Intl.NumberFormat("fa-IR").format(unknownMediaIds.length)} محتوای قدیمی فعلاً در دسترس نیست؛ اتصال آن‌ها حفظ شده است.</p>
            )}
          </section>
        ) : (
          <section aria-labelledby="automation-content-title" className="daira-content-select-panel rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
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
              <button type="button" onClick={openMediaDialog} aria-haspopup="dialog" aria-expanded={mediaDialogOpen} className="daira-content-select-button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white">
                <ImageIcon size={16} aria-hidden="true" />
                {selectedMediaCount > 0 ? "تغییر انتخاب" : "انتخاب محتوا"}
              </button>
            </div>
          </section>
        )}

        </>}
        {false && isEditing && (
          <section className="mt-5 space-y-3" aria-label="استفاده از پاسخ‌های قبلی">
            <button type="button" aria-expanded={editingView === "replace"}
              disabled={saving || loadingResources || automationTemplates.length === 0}
              onClick={() => {
                if (editingView === "replace") {
                  resetEditableResponse();
                  setEditingView("edit");
                } else {
                  setEditingView("replace");
                }
              }}
              className={"daira-response-library__mode flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold " + (editingView === "replace" ? "is-selected" : "")}>
              <BookOpen size={17} aria-hidden="true" /> استفاده از پاسخ‌های قبلی
            </button>
            {editingView === "replace" && (
              <div className="space-y-3">
                <CompleteAutomationPicker items={automationTemplates}
                  selected={replacementTemplate || null}
                  onSelect={selectReplacementTemplate}
                  onChange={() => { setSelectedTemplateId(""); setPreviewTemplate(null); }}
                  showcases={showcases} forms={forms} kind={triggerType} disabled={saving} />
                {replacementTemplate && <button type="button" onClick={() => { void saveAutomation(); }}
                  disabled={saving || mediaLoading || !selectedMediaIds.length}
                  className="daira-complete-reply__select min-h-12 w-full rounded-xl px-4 text-sm font-bold disabled:opacity-50">
                  {saving ? "در حال جایگزینی..." : "ذخیره پاسخ جایگزین"}
                </button>}
                <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">انتخاب پاسخ قبلی، تنظیمات را فقط برای محتوای تأییدشده جایگزین می‌کند.</p>
              </div>
            )}
          </section>
        )}

        {!isEditing && (<>
        <div className="mb-2 mt-6"><AutomationSectionGuide>۲. روش پاسخ — پاسخ جدید بساز یا از پاسخ قبلی استفاده کن.</AutomationSectionGuide></div>
        <section aria-label="روش پاسخ" className="space-y-2">
          <ResponseModeSwitcher value={creationMode}
            existingAvailable={automationTemplates.length > 0}
            loading={loadingResources}
            onChange={(next) => {
              if (next === "new") startNewAutomation();
              else if (automationTemplates.length) { setCreationMode("existing"); setError(""); }
            }} disabled={saving} />
        </section>

        </>)}

        {creationMode === "existing" && !isEditing && (
          <div className="mt-5 space-y-4">
            <div><AutomationSectionGuide>۳. پاسخ قبلی — پاسخ کامل موردنظرت را انتخاب کن؛ شرایط و مراحل آن بدون ورود دوباره اطلاعات استفاده می‌شوند.</AutomationSectionGuide></div>
            <CompleteAutomationPicker
              items={automationTemplates}
              selected={automationTemplates.find((item) => item.id === selectedTemplateId) || null}
              onSelect={applyAutomationTemplate}
              onChange={() => { setSelectedTemplateId(""); setPreviewTemplate(null); }}
              showcases={showcases}
              forms={forms}
              kind={triggerType}
              disabled={saving}
            />
            <button type="button" onClick={() => { void saveAutomation(); }}
              disabled={!selectedTemplateId || loadingResources || mediaLoading || (triggerType === "COMMENT_KEYWORD" && selectedMediaCount === 0) || saving}
              className="daira-complete-reply__select flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold disabled:opacity-50">
              {saving ? "در حال ثبت پاسخ..." : "ایجاد پاسخ مستقل"}
            </button>
          </div>
        )}
            {(creationMode === "new" && !isEditing || isEditing && editingView === "edit") && (
            <div className="mt-5 space-y-5">
            <div className="mb-2 mt-6"><AutomationSectionGuide>{triggerType === "COMMENT_KEYWORD" ? (isEditing ? "۲. شرط فعال‌سازی — روش فعال شدن پاسخ خودکار را ویرایش کن." : "۳. شرط فعال‌سازی — انتخاب کن پاسخ با هر کامنت فعال شود یا فقط با کلمات مشخص.") : (isEditing ? "۲. شرط فعال‌سازی — کلمات کلیدی ریپلای استوری را ویرایش کن." : "۳. شرط فعال‌سازی — کلمه‌ها یا عبارت‌هایی را بنویس که پاسخ استوری را فعال می‌کنند.")}</AutomationSectionGuide></div>
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
                    <span key={item} className="daira-keyword-chip inline-flex items-center gap-1.5 rounded-full bg-[var(--daira-outline-hover-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--daira-primary)]">
                      {item}
                      <button type="button" onClick={() => setKeyword(keywords.filter((value) => value !== item).join(","))} className="sd-neutral-button text-[var(--daira-text)] hover:text-[var(--daira-error-text)]" aria-label={"حذف " + item}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {keywordMatchMode !== "CONTAINS_ANY" && <div>
                <div className="mb-2 flex items-center justify-between gap-2"><label className="block text-xs text-[var(--daira-text)]">حداکثر {MAX_KEYWORDS} کلمه کلیدی</label><span className="text-[11px] text-[var(--daira-text)]">{keywords.length} از {MAX_KEYWORDS}</span></div>
                <div className="daira-keyword-field flex items-center gap-2">
                  <input value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="یک کلمه کلیدی وارد کنید" disabled={keywords.length >= MAX_KEYWORDS} className="daira-keyword-input min-w-0 flex-1 rounded-lg border border-[var(--daira-outline)] bg-white px-3 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-input-focus)] focus:ring-2 focus:ring-[color:var(--daira-primary)]/10 disabled:bg-[var(--daira-surface-active)]" style={{ fontSize: "16px" }} />
                  <button type="button" onClick={addKeyword} disabled={!keywordDraft.trim() || keywords.length >= MAX_KEYWORDS} className="min-h-11 shrink-0 rounded-lg bg-[var(--daira-primary)] px-3.5 text-xs font-semibold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:bg-[var(--daira-disabled-bg)] disabled:text-[var(--daira-disabled-text)]">افزودن</button>
                </div>
              </div>}

            </div>

            {triggerType === "COMMENT_KEYWORD" && (
              <div className="space-y-3">
              <div className="mb-2 mt-6"><AutomationSectionGuide>{isEditing ? "۳. پاسخ زیر کامنت — حداقل سه و حداکثر پنج پاسخ متفاوت تنظیم کن؛ برای کاهش تکرار پاسخ‌ها و احتمال شناسایی رفتار اسپم در اینستاگرام، بهتر است چند پاسخ متفاوت تنظیم کنی." : "۴. پاسخ زیر کامنت — سه تا پنج متن متفاوت بنویس؛ برای کاهش تکرار پاسخ‌ها و احتمال شناسایی رفتار اسپم در اینستاگرام، بهتر است چند پاسخ متفاوت تنظیم کنی."}</AutomationSectionGuide></div>
              <section aria-label="پاسخ‌های عمومی به کامنت" className="daira-comment-replies space-y-4 rounded-2xl p-4 sm:p-5">
                <CommentReplyVariantsField values={commentReplies} onChange={setCommentReplies} disabled={saving} />
              </section>
              </div>
            )}

              {triggerType === "COMMENT_KEYWORD" ? (
                <div className="space-y-4">
                <div className="mb-2 mt-6"><AutomationSectionGuide>{isEditing ? "۴. پیام دایرکت (اختیاری) — پیام و دکمه‌های ذخیره‌شده را مشاهده و ویرایش کن." : "۵. پیام دایرکت (اختیاری) — در صورت نیاز پیام دایرکت را بنویس؛ بدون پیام دایرکت هم می‌توانی پاسخ زیر کامنت را ثبت کنی."}</AutomationSectionGuide></div>
                <section className="space-y-4 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><Send size={15} strokeWidth={2.1} aria-hidden="true" /></span>
                      <h2 className="text-sm font-bold" style={{ color: dairaPalette.text.heading }}>پیام دایرکت <span className="text-[var(--daira-primary)]">(اختیاری)</span></h2>
                    </div>
                  </div>

                  <div role="radiogroup" aria-label="قالب پیام متنی دایرکت" className={"grid grid-cols-1 gap-2 sm:grid-cols-2 " + (isEditing && message.messageType !== "TEXT" ? "hidden" : "")}>
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

                  {message.messageType === "TEXT" ? (
                    <textarea
                      value={message.text}
                      onChange={(event) => setMessage((current) => ({ ...current, text: event.target.value }))}
                      maxLength={dmMode === "TEXT_WITH_LINK" ? 640 : 2000}
                      rows={4}
                      placeholder="متن دایرکتی که بعد از کامنت برای کاربر ارسال می‌شود..."
                      aria-label="متن پیام دایرکت"
                      className="w-full rounded-xl border bg-white px-3.5 py-3 text-base leading-7 outline-none focus:ring-2 focus:ring-[color:var(--daira-primary)]/15"
                      style={{ borderColor: dairaPalette.form.border, color: dairaPalette.text.heading, fontSize: "16px" }}
                    />
                  ) : (
                    <p className="rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3 text-xs leading-6 text-[var(--daira-text)]">
                      پیام قدیمی از نوع دیگری ذخیره شده است و بدون تغییر حفظ می‌شود. در پاسخ خودکار کامنت، ایجاد پیام جدید فقط به‌صورت متن ساده امکان‌پذیر است.
                    </p>
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

                {isEditing && extraMessages.length > 0 && (
                  <div className="space-y-3">
                    {extraMessages.length > 0 && <div className="mb-2 mt-6"><AutomationSectionGuide>۵. پیام‌های قبلی — پیام‌های متنی ذخیره‌شده را در صورت نیاز ویرایش کن.</AutomationSectionGuide></div>}
                    {extraMessages.map((entry, index) => (
                      <section key={entry.id} className="space-y-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-[var(--daira-heading)]">پیام شماره {new Intl.NumberFormat("fa-IR").format(index + 2)}</h3>
                          <button type="button" onClick={() => setExtraMessages((current) => current.filter((item) => item.id !== entry.id))} disabled={saving} className="sd-destructive-button inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3 text-xs font-bold text-[var(--daira-error-text)]"><Trash2 size={15} /> حذف پیام</button>
                        </div>
                        {entry.messageType === "TEXT" ? (
                          <textarea
                            aria-label={`متن پیام شماره ${new Intl.NumberFormat("fa-IR").format(index + 2)}`}
                            value={entry.text}
                            onChange={(event) => setExtraMessages((current) => current.map((item) => item.id === entry.id ? { ...item, text: event.target.value } : item))}
                            maxLength={(extraLinks[entry.id] || []).length ? 640 : 2000}
                            rows={3}
                            placeholder="متن پیام دایرکت..."
                            className="w-full rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3 py-3 text-base leading-7 text-[var(--daira-heading)] outline-none focus:border-[var(--daira-input-focus)]"
                          />
                        ) : (
                          <p className="rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3 text-xs text-[var(--daira-text)]">
                            پیام قدیمی غیِرمتنی برای حفظ اطلاعات، بدون تغییر نگه داشته می‌شود.
                          </p>
                        )}
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


                  <button type="button" onClick={() => {
                    void saveAutomation();
                  }} disabled={!canSaveComment} className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition disabled:opacity-60" style={{ background: dairaPalette.primary.main }}>
                    {saving ? (isEditing ? "در حال ذخیره تغییرات..." : "در حال ساخت پاسخ خودکار...") : (isEditing ? "ذخیره تغییرات" : "ساخت پاسخ خودکار")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                <div className="mb-2 mt-6"><AutomationSectionGuide>{isEditing ? "۳. نوع پاسخ — محتوای پاسخ استوری را ویرایش کن." : "۴. نوع پاسخ — مشخص کن در جواب استوری متن، عکس، ویدیو، وویس، ویترین یا فرم ارسال شود."}</AutomationSectionGuide></div>
                <div className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                <PublishingStoryAutomationSetup
                  message={message}
                  showcases={showcases}
                  forms={forms}
                  formTemplates={storyFormTemplates}
                  loadingResources={loadingResources}
                  instagramAccountId={account.id}
                  initialResponseName={responseName}
                  onResponseNameChange={setResponseName}
                  onUpdate={(patch) => setMessage((current) => ({ ...current, ...patch }))}
                  keywordValid={keywordMatchMode === "CONTAINS_ANY" || keywords.length > 0}
                  onContinue={(nextMessage) => {
                    const next = nextMessage ?? message;
                    setMessage(next);
                    return saveAutomation(next);
                  }}
                  disabled={saving}
                  showFinalSave
                  finalSaveLabel={isEditing ? "ذخیره تغییرات" : "ساخت پاسخ خودکار"}
                  finalSaveLoadingLabel={isEditing ? "در حال ذخیره تغییرات..." : "در حال ساخت پاسخ خودکار..."}
                  finalSaveDisabled={saving || (isEditing && !canSaveStoryEdit) || (requireFollow && (!followGateText.trim() || followGateText.trim().length > 640 || !followGateButtonText.trim() || followGateButtonText.trim().length > 20))}
                  extraSettings={
                    <div className="space-y-3 pt-2">
                      <div className="mb-2 mt-4">
                        <AutomationSectionGuide>{isEditing ? "۴. اجبار به فالو — تنظیمات فالو را ویرایش کن." : "۵. اجبار به فالو — اختیاری است؛ وقتی فعال باشد کاربر قبل از دریافت پاسخ باید پیج را فالو کند."}</AutomationSectionGuide>
                      </div>
                      <section className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                        <label className="flex cursor-pointer items-center justify-between gap-3">
                          <span className="min-w-0">
                            <strong className="block text-sm font-bold text-[var(--daira-heading)]">الزام به فالو <span className="text-[var(--daira-primary)]">(اختیاری)</span></strong>
                            <span className="mt-1 block text-xs leading-6 text-[var(--daira-text)]">برای ارسال پاسخ، ابتدا دنبال کردن پیج بررسی می‌شود.</span>
                          </span>
                          <input type="checkbox" role="switch" aria-label="اجبار به فالو برای پاسخ استوری"
                            checked={requireFollow} onChange={(event) => setRequireFollow(event.target.checked)}
                            className="daira-form-switch shrink-0 -scale-x-100" />
                        </label>
                        {requireFollow && (
                          <div className="mt-4 space-y-3 border-t border-[var(--daira-border)] pt-4">
                            <div>
                              <label htmlFor="story-follow-text" className="mb-2 block text-xs font-bold text-[var(--daira-heading)]">متن درخواست فالو <span className="text-red-600">*</span></label>
                              <textarea id="story-follow-text" rows={3} maxLength={640} value={followGateText}
                                onChange={(event) => setFollowGateText(event.target.value)}
                                placeholder="برای دریافت پاسخ، ابتدا پیج ما را فالو کن..."
                                className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)]" />
                            </div>
                            <div>
                              <label htmlFor="story-follow-button" className="mb-2 block text-xs font-bold text-[var(--daira-heading)]">عنوان دکمه بررسی فالو <span className="text-red-600">*</span></label>
                              <input id="story-follow-button" value={followGateButtonText} maxLength={20}
                                onChange={(event) => setFollowGateButtonText(event.target.value)}
                                placeholder="بررسی فالو"
                                className="w-full rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)]" />
                            </div>
                          </div>
                        )}
                      </section>
                      <div className="mb-2 mt-4">
                        <AutomationSectionGuide>{isEditing ? "۵. لایک ریپلای — لایک خودکار ریپلای استوری را تنظیم کن." : "۶. لایک ریپلای — اختیاری است؛ در صورت فعال بودن، ریپلای کاربر به استوری لایک می‌شود."}</AutomationSectionGuide>
                      </div>
                      <section className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                        <label className="flex cursor-pointer items-center justify-between gap-3">
                          <span className="min-w-0">
                            <strong className="block text-sm font-bold text-[var(--daira-heading)]">لایک ریپلای کاربر <span className="text-[var(--daira-primary)]">(اختیاری)</span></strong>
                            <span className="mt-1 block text-xs leading-6 text-[var(--daira-text)]">ریپلای دریافتی به استوری به‌صورت خودکار لایک شود.</span>
                          </span>
                          <input type="checkbox" role="switch" aria-label="لایک خودکار ریپلای استوری"
                            checked={likeStoryReply} onChange={(event) => setLikeStoryReply(event.target.checked)}
                            className="daira-form-switch shrink-0 -scale-x-100" />
                        </label>
                      </section>
                    </div>
                  }
                  responseTypeTitle="نوع پاسخ خودکار"
                  responseTypeDescription=""
                  storyCreateMode
                  storyEditMode={isEditing}
                  hideLibrary
                  onDraftChange={setStoryShowcaseDraftChanged}
                  finalActions={isEditing && extraMessages.length > 0 ? (
                    <p className="text-xs leading-6 text-[var(--daira-text)]">
                      {new Intl.NumberFormat("fa-IR").format(extraMessages.length)} پیام اضافی قدیمی بدون تغییر حفظ می‌شود.
                    </p>
                  ) : undefined}
                  textPlaceholder="متنی که در پاسخ خودکار برای کاربر ارسال می‌شود..."
                />
                </div>
                </div>
              )}
            </div>
            )}

          </div>

          {error && <div role="alert" className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium leading-6 text-[var(--daira-error-text)]">{error}</div>}


        <GlassModalPresence open={editScopeOpen} onEscape={() => setEditScopeOpen(false)}>
          <div className="daira-glass-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditScopeOpen(false); }}>
            <div dir="rtl" role="dialog" aria-modal="true" aria-labelledby="edit-response-scope-title" className="daira-glass-dialog flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-[26px]">
              <div className="daira-glass-dialog__header flex items-center justify-between border-b p-4">
                <h2 id="edit-response-scope-title" className="text-sm font-extrabold text-[var(--daira-heading)]">اعمال تغییرات پاسخ</h2>
                <button type="button" aria-label="بستن" onClick={() => setEditScopeOpen(false)} className="daira-glass-dialog__close rounded-lg p-2"><X size={18}/></button>
              </div>
              <p className="px-4 pt-4 text-xs leading-6 text-[var(--daira-text-secondary)]">این پاسخ به چند محتوا متصل است. تیک محتوایی را که نباید تغییر کند بردار.</p>
              <div className="space-y-2 overflow-y-auto p-4">
                {originalMediaIds.map((id) => {
                  const media = linkedMediaItems.find((item) => item.id === id);
                  return <label key={id} className="daira-flow-glass flex min-h-16 cursor-pointer items-center gap-3 rounded-xl p-3">
                    <input type="checkbox" checked={editScopeIds.includes(id)} onChange={(event) => setEditScopeIds((current) => event.target.checked ? [...current,id] : current.filter((item) => item !== id))} className="h-5 w-5 accent-[var(--daira-primary)]"/>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--daira-surface-hover)]">
                      {media?.thumbnail_url || media?.media_url ? <img alt="" src={media.thumbnail_url || media.media_url || ""} className="h-full w-full object-cover"/> : <Camera size={18} className="text-[var(--daira-text-secondary)]"/>}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--daira-heading)]">{media?.caption?.trim() || (media?.media_product_type === "REELS" ? "ریلز" : "محتوای متصل")}</span>
                  </label>;
                })}
              </div>
              <div className="daira-glass-dialog__footer flex gap-2 border-t p-4">
                <button type="button" onClick={() => setEditScopeOpen(false)} className="daira-glass-dialog__secondary min-h-11 flex-1 rounded-xl border px-3 text-xs font-bold">انصراف</button>
                <button type="button" disabled={!editScopeIds.length || saving} onClick={() => { setEditScopeOpen(false); void saveAutomation(undefined, editScopeIds); }} className="daira-glass-dialog__primary min-h-11 flex-1 rounded-xl px-3 text-xs font-bold disabled:opacity-50">اعمال برای {new Intl.NumberFormat("fa-IR").format(editScopeIds.length)} محتوا</button>
              </div>
            </div>
          </div>
        </GlassModalPresence>
        {triggerType === "COMMENT_KEYWORD" && mediaDialogOpen && (
          <ContentSelectionDialog
            items={mediaItems}
            selectedIds={draftSelectedMediaIds}
            loading={mediaLoading}
            mode={triggerType === "STORY_REPLY_KEYWORD" ? "story" : "feed"}
            onToggle={(id) => setDraftSelectedMediaIds((current) =>
              triggerType === "COMMENT_KEYWORD"
                ? (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
                : (current.includes(id) ? [] : [id])
            )}
            onClose={() => setMediaDialogOpen(false)}
            onConfirm={confirmMediaSelection}
          />
        )}

    </div>
  );
}
