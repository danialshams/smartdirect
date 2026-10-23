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
assert(src("components/dashboard/LiveAutomationList.tsx").includes('w-full flex-row-reverse items-center'),"Live reply create plus must appear visually before the label in RTL");
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

console.log("DAIRA_GLASS_COVERAGE_OK");
