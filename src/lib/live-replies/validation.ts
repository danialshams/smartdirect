import { prisma } from "@/lib/prisma";
import { LiveRuleValidationError, type LiveReplyOption, type LiveRule } from "./config";

function findReferences(rule: LiveRule) {
  const showcases = new Set<string>();
  const forms = new Set<string>();
  const media = new Set<string>();
  const walk = (items: LiveReplyOption[]) => {
    for (const o of items) {
      if (o.destinationType === "SHOWCASE") showcases.add(o.destinationShowcaseId);
      if (o.destinationType === "FORM" && o.destinationFormId) forms.add(o.destinationFormId);
      if (o.destinationMediaUrl) media.add(o.destinationMediaUrl);
      walk(o.destinationQuickReplies);
    }
  };
  if (rule.mode === "FOLLOW_UP") {
    const r = rule.response;
    if (r.messageType === "SHOWCASE") showcases.add(r.showcaseId);
    if (r.messageType === "FORM" && r.formId) forms.add(r.formId);
    if (r.mediaUrl) media.add(r.mediaUrl);
    walk(r.quickReplies);
  }
  return { showcases, forms, media };
}
export async function validateLiveRuleReferences(rule: LiveRule, accountId: string, userId: string) {
  const { showcases, forms, media } = findReferences(rule);
  if (showcases.size) {
    const count = await prisma.showcase.count({
      where: { id: { in: [...showcases] }, instagramAccountId: accountId, userId, isActive: true },
    });
    if (count !== showcases.size) throw new LiveRuleValidationError("یکی از ویترین‌ها متعلق به این پیج نیست.");
  }
  if (forms.size) {
    const count = await prisma.form.count({
      where: { id: { in: [...forms] }, instagramAccountId: accountId, userId, isActive: true },
    });
    if (count !== forms.size) throw new LiveRuleValidationError("یکی از فرم‌ها متعلق به این پیج نیست.");
  }
  if (media.size) {
    const urls = [...media];
    const [storage, usedMedia, showcaseItems] = await Promise.all([
      prisma.instagramStorageObject.findMany({
        where: { userId, publicUrl: { in: urls }, deletedAt: null }, select: { publicUrl: true },
      }),
      prisma.automationMessage.findMany({
        where: { mediaUrl: { in: urls }, automation: { instagramAccountId: accountId, instagramAccount: { userId } } },
        select: { mediaUrl: true },
      }),
      prisma.showcaseItem.findMany({
        where: { imageUrl: { in: urls }, showcase: { userId, instagramAccountId: accountId } },
        select: { imageUrl: true },
      }),
    ]);
    const owned = new Set([...storage.map((x) => x.publicUrl), ...usedMedia.map((x) => x.mediaUrl), ...showcaseItems.map((x) => x.imageUrl)]);
    if (urls.some((url) => !owned.has(url))) throw new LiveRuleValidationError("یکی از فایل‌های پاسخ متعلق به این پیج نیست.");
  }
}
