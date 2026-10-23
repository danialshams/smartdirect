/** Browser-side preflight only. The FFmpeg server check is authoritative. */
import { VOICE_MAX_SECONDS, VOICE_MAX_BYTES } from "./voice-limits";
export { VOICE_MAX_SECONDS, VOICE_MAX_BYTES } from "./voice-limits";

export async function validateVoiceFileForUpload(file: File): Promise<void> {
  if (!file.type.startsWith("audio/") && !/\.(m4a|mp3|ogg|aac|wav|webm|opus)$/i.test(file.name)) return;
  if (!file.size || file.size > VOICE_MAX_BYTES)
    throw new Error("حجم وویس باید کمتر از ۲۵ مگابایت باشد.");
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  try {
    const duration = await new Promise<number | null>((resolve) => {
      let done = false;
      const complete = (value: number | null) => {
        if (done) return;
        done = true;
        window.clearTimeout(timeout);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        resolve(value);
      };
      const timeout = window.setTimeout(() => complete(null), 6_000);
      audio.onloadedmetadata = () => complete(Number.isFinite(audio.duration) ? audio.duration : null);
      audio.onerror = () => complete(null);
      audio.preload = "metadata";
      audio.src = url;
      audio.load();
    });
    if (duration !== null && duration > VOICE_MAX_SECONDS + 0.05)
      throw new Error("مدت وویس نباید بیشتر از ۵ دقیقه باشد.");
    // If the browser cannot read the duration, the server rejects invalid files.
  } finally {
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
}
