import { z } from "zod";

export const reelOptionsSchema = z.object({
  coverMode: z.enum(["default", "upload", "frame"]),
  coverStorageKey: z.string().min(1).nullable(),
  coverUrl: z.string().url().nullable(),
  thumbOffsetMs: z.number().int().min(0).max(900000).nullable(),
  shareToFeed: z.boolean(),
}).strict().superRefine((value, context) => {
  const hasCover = Boolean(value.coverStorageKey && value.coverUrl);
  if (Boolean(value.coverStorageKey) !== Boolean(value.coverUrl)) {
    context.addIssue({ code: "custom", message: "فایل کاور ناقص است." });
  }
  if (value.coverMode === "upload" && !hasCover) {
    context.addIssue({ code: "custom", message: "برای کاور اختصاصی یک عکس آپلود کن." });
  }
  if (value.coverMode === "frame" && value.thumbOffsetMs === null) {
    context.addIssue({ code: "custom", message: "فریم کاور را انتخاب کن." });
  }
  if (value.coverMode !== "upload" && hasCover) {
    context.addIssue({ code: "custom", message: "کاور اختصاصی فقط در حالت آپلود مجاز است." });
  }
  if (value.coverMode !== "frame" && value.thumbOffsetMs !== null) {
    context.addIssue({ code: "custom", message: "زمان فریم فقط در حالت انتخاب فریم مجاز است." });
  }
});

export type ReelOptions = z.infer<typeof reelOptionsSchema>;

export const DEFAULT_REEL_OPTIONS: ReelOptions = {
  coverMode: "default",
  coverStorageKey: null,
  coverUrl: null,
  thumbOffsetMs: null,
  shareToFeed: true,
};

export function readReelOptions(value: unknown): ReelOptions {
  const result = reelOptionsSchema.safeParse(value);
  return result.success ? result.data : { ...DEFAULT_REEL_OPTIONS };
}
