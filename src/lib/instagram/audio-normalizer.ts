import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
/** Product policy, not a documented 60-second limit from Meta's Messaging API. */
export const MAX_INSTAGRAM_VOICE_SECONDS = 60;
export const MAX_INSTAGRAM_VOICE_BYTES = 25_000_000 - 1;
const SAFE_AUDIO_SIZE = 24_000_000;

export function assertInstagramVoiceDuration(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("مدت فایل صوتی قابل تشخیص نیست. از فایل صوتی معتبر استفاده کنید.");
  if (seconds > MAX_INSTAGRAM_VOICE_SECONDS + 0.05)
    throw new Error("مدت وویس نباید بیشتر از ۶۰ ثانیه باشد.");
}

/** Uses FFmpeg metadata probing. Rejects files with missing duration instead of guessing. */
async function probeDuration(filePath: string): Promise<number> {
  if (!ffmpegPath) throw new Error("FFmpeg در سرور در دسترس نیست.");
  let output = "";
  try {
    const result = await execFileAsync(ffmpegPath, ["-hide_banner", "-i", filePath], {
      timeout: 15_000, maxBuffer: 2 * 1024 * 1024,
    });
    output = String(result.stderr ?? "");
  } catch (error) {
    output = String((error as {stderr?:string}).stderr ?? "");
  }
  const match = output.match(/Duration:\s*(\d{2,}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) throw new Error("مدت فایل صوتی قابل تشخیص نیست یا فرمت آن پشتیبانی نمی‌شود.");
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export async function validateInstagramVoiceBuffer(inputBuffer: Buffer, fileName: string): Promise<void> {
  if (!inputBuffer.length || inputBuffer.length > MAX_INSTAGRAM_VOICE_BYTES)
    throw new Error("حجم وویس باید کمتر از ۲۵ مگابایت باشد.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "daira-voice-check-"));
  try {
    const input = path.join(dir, "source" + (path.extname(fileName) || ".audio"));
    await writeFile(input, inputBuffer);
    assertInstagramVoiceDuration(await probeDuration(input));
  } finally {
    await rm(dir, { recursive:true, force:true }).catch(() => undefined);
  }
}

export async function normalizeInstagramAudio(inputBuffer: Buffer, fileName: string): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("FFmpeg در سرور در دسترس نیست.");
  if (!inputBuffer.length || inputBuffer.length > MAX_INSTAGRAM_VOICE_BYTES)
    throw new Error("حجم وویس باید کمتر از ۲۵ مگابایت باشد.");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "smartdirect-audio-"));
  const inputPath = path.join(tempDir, "input" + (path.extname(fileName) || ".audio"));
  const outputPath = path.join(tempDir, "output.m4a");
  try {
    await writeFile(inputPath, inputBuffer);
    assertInstagramVoiceDuration(await probeDuration(inputPath));
    let normalized: Buffer | null = null;
    for (const bitrate of ["96k", "64k", "48k"]) {
      await rm(outputPath, { force: true });
      await execFileAsync(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
        "-vn", "-c:a", "aac", "-b:a", bitrate, "-ar", "44100",
        "-ac", "2", "-movflags", "+faststart", outputPath,
      ], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
      normalized = await readFile(outputPath);
      if (normalized.length <= SAFE_AUDIO_SIZE) break;
    }
    if (!normalized || normalized.length > SAFE_AUDIO_SIZE)
      throw new Error("حجم فایل صوتی پس از تبدیل باید حداکثر ۲۴ مگابایت باشد.");
    assertInstagramVoiceDuration(await probeDuration(outputPath));
    return normalized;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
