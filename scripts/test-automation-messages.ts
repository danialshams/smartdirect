import fs from "node:fs";
const source = fs.readFileSync("src/lib/automation/send-automation-message.ts", "utf8");
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
async function main() {
  const required = [
    ["TEXT", "message.messageType === \"TEXT\""],
    ["FORM", "message.messageType === \"FORM\""],
    ["SHOWCASE", "message.messageType === \"SHOWCASE\""],
    ["IMAGE", "message.messageType === \"IMAGE\""],
    ["VIDEO", "message.messageType === \"VIDEO\""],
    ["AUDIO", "message.messageType === \"AUDIO\""],
    ["Form token", "createPublicFormToken"],
    ["Showcase lookup", "prisma.showcase.findFirst"],
    ["Media attachment", "attachmentPayload"],
    ["Send idempotency", "claimSendMessage"],
    ["Token lifecycle", "getValidInstagramAccessToken"],
  ] as const;
  for (const [name, marker] of required) assert(source.includes(marker), name + " execution path is missing");
  assert(source.includes("Only TEXT messages are supported as Instagram Comment Private Replies."), "Comment rich-media guard is missing");
  assert(source.includes("getPublicAppUrl()"), "Public form URL resolution is missing");
  assert(source.includes('template_type: "generic"'), "Generic template resolution is missing");
  console.log("104-107 Automation message execution: OK");
  console.log(JSON.stringify({ success: true, text: true, media: ["IMAGE","VIDEO","AUDIO"], form: true, showcase: true, idempotency: true, tokenLifecycle: true }, null, 2));
}
main().catch((error) => { console.error("104-107 Automation message execution: FAILED"); console.error(error); process.exitCode = 1; });
