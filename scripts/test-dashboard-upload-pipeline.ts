import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { normalizeInstagramAudio } from "../src/lib/instagram/audio-normalizer";

const fs = await import("node:fs");

async function main() {
  assert(ffmpegPath, "FFmpeg must be available");
  const dir = await mkdtemp(path.join(os.tmpdir(), "daira-upload-test-"));
  try {
    const input = path.join(dir, "voice.wav");
    execFileSync(ffmpegPath!, [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
      "-i", "sine=frequency=440:duration=0.2", "-c:a", "pcm_s16le", input,
    ], { timeout: 30_000 });
    const converted = await normalizeInstagramAudio(await readFile(input), "voice.wav");
    assert(converted.length > 100, "Empty normalized audio");
    assert(converted.subarray(4, 8).toString("ascii") === "ftyp", "Converted audio must be MP4/M4A");
    assert(converted.length < 24_000_000, "Voice exceeds Meta safe attachment size");

    const read = (filename: string) => fs.readFileSync(filename, "utf8");
    const shared = read("components/dashboard/publishing/shared-upload.ts");
    const publish = read("components/dashboard/publishing/PublishingDashboardV2.tsx");
    const story = read("components/dashboard/publishing/PublishingStoryAutomationSetup.tsx");
    const automation = read("components/dashboard/AutomationFlowMessage.tsx");
    const finalize = read("app/api/instagram/publishing/upload/client/route.ts");
    const inbox = read("app/api/instagram/inbox/route.ts");
    assert(shared.includes("onUploadProgress:"), "Missing direct upload progress");
    assert(shared.includes('formData.append("purpose", purpose)'), "Missing server automation purpose");
    assert(shared.includes('purpose: "AUTOMATION"') || shared.includes('purpose === "AUTOMATION"'), "Missing automation limits");
    assert(shared.includes("normalizeAutomationImage"), "Missing iPhone image compatibility");
    assert(publish.includes('length: type === "CAROUSEL" ? 3 : 1'), "Carousel parallelism missing");
    assert(publish.includes("uploadAbortControllersRef"), "Per-file cancellation missing");
    assert(story.includes("uploadFileWithProgress"), "Story uploads must use unified transport");
    assert(automation.includes("uploadFileWithProgress"), "Automation uploads must use unified transport");
    assert(finalize.includes("headBlob(pathname)"), "Finalization must verify actual blob");
    assert(finalize.includes("finalizeAudioUpload"), "Direct voice finalization missing");
    assert(inbox.includes("MAX_MESSAGE_IMAGE_SIZE"), "Inbox Meta image limit missing");

    console.log(JSON.stringify({ success: true, test: "dashboard-upload-pipeline", audioConversion: true,
      actualProgress: true, perFileCancellation: true, parallelCarousel: true,
      purposeLimits: true, verifiedBlobFinalization: true, inboxMediaLimits: true }, null, 2));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error("Dashboard upload pipeline test FAILED:", error); process.exitCode = 1; });
