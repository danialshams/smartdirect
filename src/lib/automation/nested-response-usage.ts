/** Track saved-response links explicitly embedded inside legacy QuickReply JSON.
 * Preserve user-facing payloads and unknown legacy fields while editing.
 */
export type ReplyJson = Record<string, unknown>;
export type ReplyPath = Array<string | number>;
export type NestedReplyUse = { savedResponseId: string; path: ReplyPath; label: string; messageType: string };
const kinds = new Set(["TEXT", "FORM", "SHOWCASE", "IMAGE", "VIDEO", "AUDIO"]);
function record(value: unknown): value is ReplyJson {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
export function parseQuickReplyJson(raw: string | null): ReplyJson | null {
  if (!raw) return null;
  try { const parsed: unknown = JSON.parse(raw); return record(parsed) ? parsed : null; }
  catch { return null; }
}
export function nestedReplyUses(raw: string | null): NestedReplyUse[] {
  const root = parseQuickReplyJson(raw);
  if (!root) return [];
  const out: NestedReplyUse[] = [];
  const visit = (node: ReplyJson, path: ReplyPath, label: string, depth: number) => {
    if (depth > 8) return;
    const type = typeof node.destinationType === "string" ? node.destinationType
      : typeof node.type === "string" ? node.type : "";
    const id = typeof node.savedResponseId === "string" ? node.savedResponseId.trim() : "";
    if (id && kinds.has(type)) out.push({ savedResponseId: id, path, label, messageType: type });
    // Executor traverses quickReplies first. Treat duplicated compatibility arrays
    // as one logical branch instead of double-counting a saved reply.
    const key = Array.isArray(node.quickReplies) ? "quickReplies" : "destinationQuickReplies";
    const children = node[key];
    if (!Array.isArray(children)) return;
    children.forEach((child, index) => {
      if (record(child)) visit(child, [...path, key, index],
        typeof child.title === "string" && child.title.trim() ? child.title.trim() : label,
        depth + 1);
    });
  };
  visit(root, [], "گزینه پاسخ", 0);
  return out;
}
export function nestedReplyAt(root: ReplyJson, path: ReplyPath): ReplyJson | null {
  if (path.length % 2 !== 0 || path.length > 16) return null;
  let node: unknown = root;
  for (let i = 0; i < path.length; i += 2) {
    const key = path[i], index = path[i + 1];
    if (!record(node) || (key !== "quickReplies" && key !== "destinationQuickReplies")
      || !Array.isArray(node[key]) || !Number.isSafeInteger(index) || (index as number) < 0) return null;
    node = (node[key] as unknown[])[index as number];
  }
  return record(node) ? node : null;
}
export function editQuickReplyDestination(raw: string | null, path: ReplyPath,
  sourceId: string, action: "apply" | "detach", template?: {
    messageType: string; text: string | null; mediaUrl: string | null; mediaId: string | null;
    showcaseId: string | null; formId: string | null; quickReplies: unknown;
  }): string {
  const root = parseQuickReplyJson(raw);
  if (!root) throw new Error("ساختار مقصد قبلی نامعتبر است.");
  const destination = nestedReplyAt(root, path);
  if (!destination || destination.savedResponseId !== sourceId)
    throw new Error("پاسخ ذخیره‌شده دیگر به این مقصد متصل نیست.");
  if (action === "detach") {
    destination.savedResponseId = null;
    return JSON.stringify(root);
  }
  if (!template) throw new Error("قالب جدید مشخص نیست.");
  const type = typeof destination.destinationType === "string" ? destination.destinationType : destination.type;
  if (type !== template.messageType) throw new Error("نوع مقصد با پاسخ ذخیره‌شده برابر نیست.");
  const text = template.text || "";
  const question = template.messageType === "FORM" ? text : "";
  destination.savedResponseId = sourceId;
  destination.text = template.messageType === "FORM" ? "" : text;
  destination.destinationText = template.messageType === "FORM" ? "" : text;
  destination.question = question;
  destination.destinationQuestion = question;
  destination.mediaUrl = template.mediaUrl || "";
  destination.destinationMediaUrl = template.mediaUrl || "";
  destination.mediaId = template.mediaId || "";
  destination.destinationMediaId = template.mediaId || "";
  destination.showcaseId = template.showcaseId || "";
  destination.destinationShowcaseId = template.showcaseId || "";
  destination.formId = template.formId || "";
  destination.destinationFormId = template.formId || "";
  if (template.messageType === "FORM") {
    const children = Array.isArray(destination.destinationQuickReplies) ? destination.destinationQuickReplies
      : Array.isArray(destination.quickReplies) ? destination.quickReplies : [];
    const fresh = Array.isArray(template.quickReplies) ? template.quickReplies : [];
    const oldPayloads = children.map((c) => record(c) ? c.payload : null);
    const newPayloads = fresh.map((c) => record(c) ? c.payload : null);
    if (JSON.stringify(oldPayloads) !== JSON.stringify(newPayloads))
      throw new Error("تغییر گزینه‌ها یا شناسه‌های فرم فعال باید از ویرایشگر خود فرم انجام شود.");
    // Merge into existing option identities; outstanding Meta button payloads
    // and legacy nextMessageId links must remain valid.
    const merge = (oldNode: unknown, newNode: unknown, depth: number): ReplyJson => {
      if (!record(oldNode) || !record(newNode) || depth > 8)
        throw new Error("گزینه قدیمی این فرم معتبر نیست.");
      if (oldNode.payload !== newNode.payload)
        throw new Error("شناسه یکی از گزینه‌های فعال تغییر کرده است.");
      const oldChildren = Array.isArray(oldNode.quickReplies) ? oldNode.quickReplies :
        Array.isArray(oldNode.destinationQuickReplies) ? oldNode.destinationQuickReplies : [];
      const newChildren = Array.isArray(newNode.quickReplies) ? newNode.quickReplies :
        Array.isArray(newNode.destinationQuickReplies) ? newNode.destinationQuickReplies : [];
      if (oldChildren.length !== newChildren.length)
        throw new Error("تعداد گزینه‌های فعال تغییر کرده است.");
      const combined = { ...oldNode, ...newNode,
        payload: oldNode.payload, id: oldNode.id, nextMessageId: oldNode.nextMessageId };
      if (oldChildren.length) {
        const nested = oldChildren.map((item, index) => merge(item, newChildren[index], depth + 1));
        combined.quickReplies = nested;
        combined.destinationQuickReplies = nested;
      }
      return combined;
    };
    const merged = children.map((item, index) => merge(item, fresh[index], 0));
    destination.quickReplies = merged;
    destination.destinationQuickReplies = merged;
  }
  // Older saved destinations can have both arrays. Synchronize corresponding
  // nodes so the editor and executor see the same answer after an update.
  if (path.length) {
    let variations: ReplyPath[] = [[]];
    for (let i = 0; i < path.length; i += 2) {
      const key = path[i], index = path[i + 1];
      const alternatives = key === "quickReplies"
        ? ["quickReplies", "destinationQuickReplies"]
        : ["destinationQuickReplies", "quickReplies"];
      variations = variations.flatMap((candidate) =>
        alternatives.map((alternative) => [...candidate, alternative, index]));
    }
    for (const variant of variations) {
      if (JSON.stringify(variant) === JSON.stringify(path)) continue;
      const counterpart = nestedReplyAt(root, variant);
      if (!counterpart || !destination.payload || counterpart.payload !== destination.payload) continue;
      for (const key of ["savedResponseId", "text", "destinationText", "question", "destinationQuestion",
        "mediaUrl", "destinationMediaUrl", "mediaId", "destinationMediaId",
        "showcaseId", "destinationShowcaseId", "formId", "destinationFormId"])
        if (key in destination) counterpart[key] = destination[key];
    }
  }
  return JSON.stringify(root);
}
