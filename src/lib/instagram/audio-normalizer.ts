import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const SAFE_AUDIO_SIZE = 24_000_000;

export async function normalizeInstagramAudio(inputBuffer: Buffer, fileName: string): Promise<Buffer> {
      if (!ffmpegPath) throw new Error("FFmpeg در سرور در دسترس نیست.");
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "smartdirect-audio-"));
      const inputPath = path.join(tempDir, "input" + (path.extname(fileName) || ".audio"));
      const outputPath = path.join(tempDir, "output.m4a");
      try {
        await writeFile(inputPath, inputBuffer);
        let normalized: Buffer | null = null;
        for (const bitrate of ["96k", "64k", "48k"]) {
          await rm(outputPath, { force: true });
          await execFileAsync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-vn", "-c:a", "aac", "-b:a", bitrate, "-ar", "44100", "-ac", "2", "-movflags", "+faststart", outputPath], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
          normalized = await readFile(outputPath);
          if (normalized.length <= SAFE_AUDIO_SIZE) break;
        }
        if (!normalized || normalized.length > SAFE_AUDIO_SIZE) throw new Error("حجم فایل صوتی پس از تبدیل باید حداکثر 24 مگابایت باشد.");
        return normalized;
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
}
