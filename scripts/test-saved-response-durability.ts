import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collectSavedResponseMedia } from "../src/lib/automation/saved-response-media";

const image = "https://files.example.test/image.jpg";
const audio = "https://files.example.test/voice.m4a";
const media = collectSavedResponseMedia({
  messageType: "IMAGE", mediaUrl: image, quickReplies: [
    { destinationType: "TEXT", destinationMediaUrl: "", destinationQuickReplies: [
      { destinationType: "AUDIO", destinationMediaUrl: audio, destinationQuickReplies: [
        { destinationType: "IMAGE", destinationMediaUrl: image },
      ] },
    ] },
  ],
});
assert.deepEqual(media, { urls: [image, audio], missingOriginal: false });
assert.equal(collectSavedResponseMedia({ messageType: "AUDIO", mediaUrl: null, quickReplies: [] }).missingOriginal, true, "A Meta ID alone cannot back up saved audio");
assert.equal(collectSavedResponseMedia({ messageType: "TEXT", mediaUrl: null, quickReplies: [{ destinationType: "IMAGE", destinationMediaId: "meta123", destinationMediaUrl: "" }] }).missingOriginal, true, "Nested media IDs are not sufficient");
assert.deepEqual(collectSavedResponseMedia({ messageType: "TEXT", mediaUrl: null, quickReplies: [] }), { urls: [], missingOriginal: false });
assert.throws(() => collectSavedResponseMedia({ messageType: "TEXT", mediaUrl: null, quickReplies: Array.from({length:257},()=>({})) }), /شاخه/);

const saveRoute = readFileSync("app/api/saved-responses/route.ts", "utf8");
assert(saveRoute.includes("collectSavedResponseMedia") && saveRoute.includes("userId: session.user.id, publicUrl, deletedAt: null") && saveRoute.includes("provider.exists(original.storageKey)"), "Saved media must be verified against a real owned storage object");
const refs = readFileSync("src/lib/instagram/storage-references.ts", "utf8");
assert(refs.includes('FROM "QuickReply"') && refs.includes('FROM "SavedAutomationResponse"'), "Cleanup must retain originals referenced by both saved and active nested responses");
const sender = readFileSync("src/lib/automation/send-automation-message.ts", "utf8");
assert(sender.includes("message.mediaUrl ? { url: message.mediaUrl } : { attachment_id: message.mediaId }"), "Sending must prefer durable media URL and fall back to Meta-only IDs for legacy data");
console.log("SAVED_RESPONSE_DURABILITY_AND_META_ID_FALLBACK_OK");
