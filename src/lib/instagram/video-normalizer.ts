import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const SAFE_VIDEO_SIZE = 100 * 1024 * 1024;
const SAFE_MESSAGE_VIDEO_SIZE = 24 * 1024 * 1024;

export type InstagramVideoTarget = "CAROUSEL" | "REEL" | "STORY" | "MESSAGE";

export async function normalizeInstagramVideo(
  inputBuffer: Buffer,
  fileName: string,
  targetType: InstagramVideoTarget,
): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("FFmpeg در سرور در دسترس نیست؛ تبدیل ویدئو انجام نشد.");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "smartdirect-video-"));
  const extension = path.extname(fileName).toLowerCase();
  const inputPath = path.join(tempDir, "input" + (/^\.(mp4|mov|m4v|avi|mkv|webm|3gp|mpeg|mpg|mts|m2ts)$/.test(extension) ? extension : ".video"));
  const outputPath = path.join(tempDir, "normalized.mp4");

  try {
    console.info("[Instagram Video Normalizer] started", {
      fileName: path.basename(fileName),
      inputBytes: inputBuffer.length,
      targetType,
    });
    await writeFile(inputPath, inputBuffer);

    // Feed carousel videos use a 4:5 canvas; Reels and Stories use 9:16.
    // Fit the full source inside the canvas instead of cropping away user content.
    const canvas = targetType === "CAROUSEL"
      ? { width: 1080, height: 1350 }
      : targetType === "MESSAGE"
        ? { width: 720, height: 1280 }
        : { width: 1080, height: 1920 };
    const safeVideoSize = targetType === "MESSAGE" ? SAFE_MESSAGE_VIDEO_SIZE : SAFE_VIDEO_SIZE;
    const videoFilter = [
      "scale=" + canvas.width + ":" + canvas.height + ":force_original_aspect_ratio=decrease:force_divisible_by=2",
      "pad=" + canvas.width + ":" + canvas.height + ":(ow-iw)/2:(oh-ih)/2:color=black",
      "setsar=1",
      "fps=30",
    ].join(",");

    let normalized: Buffer | null = null;
    for (const crf of ["23", "26", "29", "32"]) {
      await rm(outputPath, { force: true });
      await execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", inputPath,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-map_metadata", "-1",
        "-vf", videoFilter,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", crf,
        "-flags", "+cgop", "-x264-params", "open-gop=0",
        "-maxrate", "5M", "-bufsize", "10M", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-sn", "-dn", "-movflags", "+faststart", "-f", "mp4", outputPath,
      ], { timeout: 600000, maxBuffer: 8 * 1024 * 1024 });

      normalized = await readFile(outputPath);
      if (normalized.length <= safeVideoSize) break;
    }

    if (!normalized?.length) throw new Error("تبدیل ویدئو خروجی خالی تولید کرد.");
    if (normalized.length > safeVideoSize) {
      throw new Error(
        targetType === "MESSAGE"
          ? "حجم ویدئو پس از بهینه‌سازی هنوز بیش از 24 مگابایت است؛ مدت ویدئو را کوتاه‌تر کنید."
          : "حجم ویدئو پس از بهینه‌سازی هنوز بیش از 100 مگابایت است؛ مدت ویدئو را کوتاه‌تر کنید.",
      );
    }

    console.info("[Instagram Video Normalizer] completed", {
      fileName: path.basename(fileName),
      targetType,
      outputWidth: canvas.width,
      outputHeight: canvas.height,
      outputBytes: normalized.length,
    });
    return normalized;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("100 مگابایت") || error.message.includes("24 مگابایت"))) throw error;
    throw new Error("تبدیل ویدئو به فرمت سازگار با Instagram ناموفق بود. فایل ویدئو را بررسی کنید و دوباره تلاش کنید.");
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
