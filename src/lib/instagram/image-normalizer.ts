import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { META_IMAGE_BYTES } from "./media-limits";

const execFileAsync = promisify(execFile);

/**
 * The Instagram media-publishing endpoint requires JPEG, even if the incoming
 * browser file is PNG or WebP. Avoid upscaling very small images when possible.
 */
export async function normalizeInstagramPublishImage(buffer: Buffer, fileName: string, targetType: "POST" | "STORY" | "CAROUSEL" | "REEL") {
  if (!buffer.length) throw new Error("تصویر خالی است.");
  if (path.extname(fileName).toLowerCase() === ".jpg" || path.extname(fileName).toLowerCase() === ".jpeg") {
    if (buffer.length < META_IMAGE_BYTES && buffer.subarray(0, 3).toString("hex") === "ffd8ff") return buffer;
  }
  if (!ffmpegPath) throw new Error("تبدیل تصویر برای اینستاگرام روی سرور در دسترس نیست.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "daira-photo-"));
  try {
    const input = path.join(dir, "input" + (path.extname(fileName).replace(/[^a-zA-Z0-9.]/g, "") || ".img"));
    const output = path.join(dir, "output.jpg");
    await writeFile(input, buffer);
    const portrait = targetType === "STORY";
    const width = 1080;
    const height = portrait ? 1920 : 1350;
    for (const quality of [3, 5, 8, 12]) {
      await execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-i", input,
        "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        "-frames:v", "1", "-pix_fmt", "yuvj420p", "-q:v", String(quality),
        output,
      ], { timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
      const converted = await readFile(output);
      if (converted.length > 0 && converted.length < META_IMAGE_BYTES) return converted;
    }
    throw new Error("حجم تصویر پس از تبدیل همچنان بیشتر از ۸ مگابایت است.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("۸ مگابایت")) throw error;
    throw new Error("تصویر قابل تبدیل به JPEG مناسب اینستاگرام نیست. تصویر دیگری انتخاب کنید.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
