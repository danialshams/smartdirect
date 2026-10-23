import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { prisma } from "../src/lib/prisma";
import { maximumUploadBytes, checkMediaOutputSize, META_IMAGE_BYTES, META_MESSAGE_BYTES } from "../src/lib/instagram/media-limits";
import { normalizeInstagramPublishImage } from "../src/lib/instagram/image-normalizer";
import { reserveUpload, getUploadQuota } from "../src/lib/storage/upload-accounting";

async function main() {
  assert.equal(maximumUploadBytes("AUTOMATION", "IMAGE"), META_IMAGE_BYTES);
  assert.equal(maximumUploadBytes("AUTOMATION", "VIDEO"), META_MESSAGE_BYTES);
  assert.equal(maximumUploadBytes("AUTOMATION", "AUDIO"), META_MESSAGE_BYTES);
  assert.equal(maximumUploadBytes("PUBLISHING", "VIDEO", "STORY"), 100 * 1024 * 1024);
  assert.equal(maximumUploadBytes("PUBLISHING", "VIDEO", "CAROUSEL"), 100 * 1024 * 1024);
  assert(maximumUploadBytes("PUBLISHING", "VIDEO", "REEL") >= 100 * 1024 * 1024);
  assert.throws(() => checkMediaOutputSize("AUTOMATION", "IMAGE", META_IMAGE_BYTES + 1));
  assert.throws(() => checkMediaOutputSize("AUTOMATION", "AUDIO", META_MESSAGE_BYTES + 1));
  assert.throws(() => checkMediaOutputSize("PUBLISHING", "IMAGE", META_IMAGE_BYTES + 1));
  assert(ffmpegPath, "FFmpeg is needed for image normalizer verification");
  const dir = await mkdtemp(path.join(os.tmpdir(), "daira-storage-regression-"));
  try {
    const png = path.join(dir, "source.png");
    execFileSync(ffmpegPath!, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=300x400", "-frames:v", "1", png]);
    const result = await normalizeInstagramPublishImage(await readFile(png), "source.png", "POST");
    assert(result.subarray(0, 3).toString("hex") === "ffd8ff", "Publishing image must be JPEG");
    assert(result.length > 100 && result.length < META_IMAGE_BYTES);
  } finally { await rm(dir, { recursive: true, force: true }); }

  const oldBytes = process.env.STORAGE_MAX_BYTES_PER_USER;
  const oldCount = process.env.STORAGE_MAX_OBJECTS_PER_USER;
  process.env.STORAGE_MAX_BYTES_PER_USER = "120";
  process.env.STORAGE_MAX_OBJECTS_PER_USER = "4";
  const user = await prisma.user.create({ data: {
    email: "quota-" + Date.now() + "-" + Math.random().toString(36).slice(2) + "@test.invalid",
    name: "Quota regression", password: "test",
  } });
  try {
    assert.equal(getUploadQuota().maxBytes, 120);
    const results = await Promise.allSettled([
      reserveUpload({ userId: user.id, storageKey: "pending/" + user.id + "/a", bytes: 80, purpose: "AUTOMATION" }),
      reserveUpload({ userId: user.id, storageKey: "pending/" + user.id + "/b", bytes: 80, purpose: "AUTOMATION" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "Concurrent uploads must not overdraw quota");
    const totals = await prisma.instagramStorageObject.aggregate({
      where: { userId: user.id, deletedAt: null }, _sum: { fileSize: true },
    });
    assert.equal(Number(totals._sum.fileSize), 80, "Reserved bytes must be counted");
    const valid = await prisma.instagramStorageObject.findFirst({ where: { userId: user.id } });
    assert(valid?.purpose === "AUTOMATION");
    await assert.rejects(reserveUpload({
      userId: user.id, storageKey: "pending/" + user.id + "/too-large", bytes: 100, purpose: "PUBLISHING",
    }), /سهمیه/);
  } finally {
    await prisma.instagramStorageObject.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    if (oldBytes === undefined) delete process.env.STORAGE_MAX_BYTES_PER_USER;
    else process.env.STORAGE_MAX_BYTES_PER_USER = oldBytes;
    if (oldCount === undefined) delete process.env.STORAGE_MAX_OBJECTS_PER_USER;
    else process.env.STORAGE_MAX_OBJECTS_PER_USER = oldCount;
  }
  console.log("DAIRA_STORAGE_QUOTA_AND_META_MEDIA_LIMITS_OK");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
