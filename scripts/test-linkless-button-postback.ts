import assert from "node:assert/strict";
import {
  createLinklessButtonPayload,
  parseLinklessButtonPayload,
  resolveLinklessButtonTitle,
} from "../src/lib/automation/linkless-button";

const source = {
  id: "cmt_source_123",
  linkButtons: [{ title: "اطلاعات📃", url: "" }, { title: "صفحه وب", url: "https://example.com" }],
  linkButtonUrl: null,
  linkButtonTitle: null,
};

const v2 = createLinklessButtonPayload(source.id, 0);
assert.equal(v2, "DAIRA_LINKLESS_BUTTON:cmt_source_123:1");
assert.deepEqual(parseLinklessButtonPayload(v2), { messageId: source.id, buttonIndex: 0 });
assert.equal(resolveLinklessButtonTitle(parseLinklessButtonPayload(v2)!, "اطلاعات📃", [source]), "اطلاعات📃");
assert.equal(resolveLinklessButtonTitle(parseLinklessButtonPayload(v2)!, null, [source]), "اطلاعات📃");

// Previously sent Instagram messages still send DAIRA_LINKLESS_BUTTON_1.
const old = parseLinklessButtonPayload("DAIRA_LINKLESS_BUTTON_1");
assert.deepEqual(old, { messageId: null, buttonIndex: 0 });
assert.equal(resolveLinklessButtonTitle(old!, "اطلاعات📃", [source]), "اطلاعات📃");
assert.equal(resolveLinklessButtonTitle(old!, null, [source]), null);
assert.equal(resolveLinklessButtonTitle(old!, "مشاوره", [source]), null);

// A link button must never be treated as a DM postback.
assert.equal(resolveLinklessButtonTitle({ messageId: source.id, buttonIndex: 1 }, "صفحه وب", [source]), null);
assert.equal(resolveLinklessButtonTitle({ messageId: "another_account", buttonIndex: 0 }, "اطلاعات📃", [source]), null);
assert.equal(resolveLinklessButtonTitle(old!, "اطلاعات📃", []), null);
assert.equal(parseLinklessButtonPayload("DAIRA_LINKLESS_BUTTON_0"), null);
assert.equal(parseLinklessButtonPayload("DAIRA_LINKLESS_BUTTON_42"), null);
assert.equal(parseLinklessButtonPayload("DAIRA_LINKLESS_BUTTON:other:0"), null);
assert.throws(() => createLinklessButtonPayload("bad:source", 0));
assert.throws(() => createLinklessButtonPayload("safe", 3));

// Legacy one-button shape is also supported.
const legacySource = { id: "oldmsg", linkButtons: null, linkButtonUrl: "", linkButtonTitle: "اطلاعات📃" };
assert.equal(resolveLinklessButtonTitle(old!, "اطلاعات📃", [legacySource]), "اطلاعات📃");
console.log("PASS: Instagram linkless postback identity, legacy compatibility, and security guards");
