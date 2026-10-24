import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dairaTokens } from "../lib/design-system/palette";
const src=(p:string)=>readFileSync(p,"utf8");
const css=src("app/daira-glass.css");
const header=src("app/globals.css");
const nav=src("components/dashboard/DashboardHeader.tsx");
const content=src("components/dashboard/ContentSelectionDialog.tsx");
for(const key of ["glass-modal-balanced","glass-border-strong","glass-modal-dim",
  "search-surface","empty-bg","empty-border","keyword-container","keyword-chip-bg",
  "delete-modal","guide-glass","guide-glass-rim","flow-card-glass","skeleton-surface"]){
  assert(dairaTokens[("--daira-"+key) as keyof typeof dairaTokens],"Missing semantic palette token: "+key);
}
for(const cl of ["daira-glass-dialog","daira-glass-overlay","daira-search-field",
  "daira-empty-state","daira-keyword-input","daira-guide-glass","daira-flow-glass","daira-skeleton-glass"]){
  assert(css.includes("."+cl),"Missing shared component CSS "+cl);
}
assert(nav.includes("daira-liquid-corner-guard--header-top"),"Two upper header corners must be guarded");
assert(header.includes("border-bottom-color:var(--daira-glass-rim)"),"Header needs a continuous WHITE lower rim");
assert(header.includes("at bottom right")&&header.includes("at bottom left"),"Upper radius masks must match both sides");
assert(content.includes("daira-glass-dialog--content")&&content.includes("daira-glass-dialog__scroll"),"Content selection must be a floating glass modal with independent grid scrolling");
assert(content.includes("daira-glass-dialog__header")&&content.includes("daira-glass-dialog__footer"),"Picker header and action buttons should be fixed around scrolling results");
for(const p of ["DirectAutomationList","LiveAutomationList","AutoRepliesManager","SmartRemindersList"]){
  const s=src("components/dashboard/"+p+".tsx");
  assert(s.includes("daira-empty-state"),p+" missing shared empty treatment");
  assert(s.includes("daira-glass-dialog--danger"),p+" missing glass delete confirmation");
}
for(const p of ["AutomationCreationFlow","LiveAutomationEditor","EntryPointFlowBuilder"]){
 const s=src("components/dashboard/"+p+".tsx");
 assert(s.includes("daira-keyword-input"),p+" missing unified keyword field");
}
for(const p of ["AutomationCreationFlow","LiveAutomationEditor","DirectAutomationEditor","SmartReminderEditor"]){
  assert(src("components/dashboard/"+p+".tsx").includes("daira-guide-glass"),p+" missing shared yellow glass guide");
}
assert(src("components/dashboard/LiveAutomationList.tsx").includes('w-full flex-row items-center'),"Live reply plus must visibly precede its label in RTL");
assert(css.includes("font-size:16px!important") && css.includes("prefers-reduced-transparency:reduce"),"Mobile search and accessibility fallbacks must be preserved");

const presence = src("components/dashboard/GlassModalPresence.tsx");
const accountHeader = src("components/dashboard/DashboardHeader.tsx");
const picker = src("components/dashboard/ContentSelectionDialog.tsx");
// Prevent a second, nested blue focus outline from returning.
assert(css.includes(".daira-search-field input:focus-visible"),"The inner search input needs a focus reset");
assert(css.includes("border:0!important") && css.includes("outline:0!important") && css.includes("box-shadow:none!important"),
  "Only the outer search surface may draw a focus ring");
assert(!css.includes(".daira-search-field--floating input:focus-visible"),"Floating search must not own a second focus outline");
for(const component of ["DirectAutomationList","LiveAutomationList","AutoRepliesManager","SmartRemindersList","ShareMentionManager","InstagramInbox","EntryPointManager","AutomationManager"]) {
  const source = src("components/dashboard/"+component+".tsx");
  assert(source.includes("daira-search-field"),component+" needs a single shared search outer surface");
}
assert(presence.includes("setTimeout") && presence.includes('data-phase={open?"open":"closing"}'),
  "Custom modal exits must remain mounted long enough for the animation");
assert(presence.includes('event.key !== "Escape"'),"Modal Escape should close through the same animated lifecycle");
assert(accountHeader.includes("<GlassModalPresence") && accountHeader.includes('daira-account-modal__add'),
  "Account modal must animate and retain the add-account action");
assert(css.includes(".daira-account-modal__add {flex-direction:row-reverse}"),
  "Instagram icon must appear ahead of account-connection label in RTL");
assert(picker.includes("requestCloseRef.current()") && picker.includes("requestConfirm") && picker.includes('data-phase={closing ? "closing" : "open"}'),
  "Content selection must animate Escape, confirm, cancel and backdrop dismissals");
for(const component of ["DirectAutomationList","LiveAutomationList","SmartRemindersList","MediaAutomationEditor","IceBreakerManager","PersistentMenuManager","EntryPointManager","AutomationManager"]) {
  assert(src("components/dashboard/"+component+".tsx").includes("<GlassModalPresence"),
    component+" modal needs a real exit animation, not an instant unmount");
}
assert(css.includes("prefers-reduced-motion:reduce"),"Modal transitions need a reduced-motion fallback");


// Page-specific Liquid Glass adoption and the shared content picker must stay
// wired to the canonical palette rather than regressing to independent whites.
for (const key of [
  "inbox-frame-glass","inbox-sidebar-glass","inbox-composer-glass",
  "inbox-received-bubble","calendar-glass","calendar-field-glass",
  "publishing-glass","publishing-control-glass",
  "content-select-panel","content-select-button","content-select-button-hover",
]) {
  assert(dairaTokens[("--daira-" + key) as keyof typeof dairaTokens],
    "Missing page-level semantic glass token: " + key);
}
const inboxUi = src("components/dashboard/InstagramInbox.tsx");
assert(inboxUi.includes("daira-inbox-glass") && inboxUi.includes("inbox-thread-list")
  && inboxUi.includes("inbox-chat-scroll") && inboxUi.includes("inbox-composer"),
  "Inbox message, list, and composer surfaces must use shared glass wrappers");
assert(!inboxUi.includes("<Input") && inboxUi.includes('role="search" className="inbox-chat-search-panel'),
  "Inbox searches must not reintroduce MUI's nested double border");
const insightsUi = src("app/dashboard/insights/InsightsDashboard.tsx");
assert(insightsUi.includes("daira-insights-calendar-dialog")
  && insightsUi.includes("visibleCalendarField") && insightsUi.includes('data-phase={calendarOpen ? "open" : "closing"}'),
  "Insights calendar needs a glass dialog with a mounted exit transition");
const publishingUi = src("components/dashboard/publishing/PublishingDashboardV2.tsx");
const publishingEditor = src("components/dashboard/publishing/PublishingJobEditor.tsx");
const publishingQueue = src("components/dashboard/publishing/PublishingQueue.tsx");
assert(publishingUi.includes("daira-publishing-glass") && publishingEditor.includes("daira-publishing-glass")
  && publishingQueue.includes("daira-publishing-queue-item") && publishingQueue.includes("<GlassModalPresence"),
  "Publishing create, edit, queue, and cancel modal must share glass material");
const flowUi = src("components/dashboard/AutomationCreationFlow.tsx");
assert((flowUi.match(/daira-content-select-panel/g) || []).length >= 2
  && (flowUi.match(/daira-content-select-button/g) || []).length >= 2
  && flowUi.includes("<ContentSelectionDialog"),
  "Story and comment reply create/edit must reuse the same content selection panel, button and dialog");
assert(src("components/dashboard/SmartRemindersList.tsx").includes('<Plus size={20} aria-hidden="true" className="shrink-0"/><span>ایجاد یادآوری جدید</span>'),
  "Reminder create icon must be before text in RTL");
assert(css.includes(".daira-insights-calendar-dialog") && css.includes(".daira-publishing-queue-item"),
  "Page-level glass surfaces must be defined centrally");

// Response picker visuals must follow the same named palette in every editor.
const responseLibrary = src("components/dashboard/publishing/ReusableResponseLibrary.tsx");
const commentFlow = src("components/dashboard/AutomationCreationFlow.tsx");
const legacyComments = src("components/dashboard/MediaAutomationEditor.tsx");
const variantsField = src("components/dashboard/CommentReplyVariantsField.tsx");
for (const className of [
  "daira-response-library__panel", "daira-response-library__mode",
  "daira-response-library__item", "daira-response-library__scope-item",
  "daira-response-library__check-row", "daira-response-library__input",
  "daira-response-template", "daira-response-mode",
  "daira-comment-replies", "daira-comment-replies__option",
  "daira-comment-replies__textarea",
]) assert(css.includes("." + className), "Missing unified response glass rule: " + className);
assert(responseLibrary.includes('className="daira-response-library mb-5 space-y-4"'),
  "Response naming panel requires breathing room before the following editor field.");
assert(responseLibrary.includes('daira-response-library__icon-button daira-response-library__use')
  && !responseLibrary.includes('className="daira-glass-dialog__primary rounded-lg p-2"'),
  "Previously saved answers must not render a blue primary button in every row.");
assert(responseLibrary.includes("daira-response-library__dialog")
  && responseLibrary.includes("daira-response-library__scope-item")
  && responseLibrary.includes("daira-response-library__preview-branch"),
  "Response preview, scope editor and list need identical neutral contrast and glass treatment.");
assert(commentFlow.includes('daira-response-mode') && commentFlow.includes('daira-response-template')
  && !commentFlow.includes('!bg-[var(--daira-outline-hover-bg)]'),
  "Selected reply templates should not be concealed by !important generic glass backgrounds.");
for (const editor of [commentFlow, legacyComments])
  assert(editor.includes('className="daira-comment-replies') &&
    editor.includes('پاسخ‌های عمومی به کامنت'),
    "Public comment replies need a titled, visible section on both edit paths.");
assert(variantsField.includes('daira-comment-replies__option') &&
  variantsField.includes('daira-comment-replies__textarea'),
  "Comment inputs should have individually legible glass option cards.");
const responseCss = css.slice(css.indexOf("/* Reusable reply library:"));
assert(!/#[0-9a-f]{3,8}\\b/i.test(responseCss),
  "The response UI must use canonical Daira palette tokens rather than literal colors.");

console.log("DAIRA_GLASS_COVERAGE_OK");
