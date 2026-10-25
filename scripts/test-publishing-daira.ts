import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const src=(p:string)=>readFileSync(p,"utf8");
const root="components/dashboard/publishing/";
const editor=src(root+"PublishingDashboardV2.tsx");
const queue=src(root+"PublishingQueue.tsx");
const guide=src(root+"PublishingSectionGuide.tsx");
const storySetup=src(root+"PublishingStoryAutomationSetup.tsx");
const loading=src(root+"PublishingPageSkeleton.tsx");
const editPage=src(root+"PublishingJobEditor.tsx");
const tags=src(root+"PublishingWithTags.tsx");
const palette=src("lib/design-system/palette.ts");
const route=src("app/dashboard/publishing/page.tsx");

assert.ok(editor.includes('activeTab==="queue"') && editor.includes('<PublishingQueue'),"Queue must remain a separate tab");
assert.ok(editor.includes('setActiveTab("queue")'),"Both publishing modes must move to queue for tracking");
assert.ok(editor.includes('ref={publishingTabsRef}') &&
  editor.includes('if (activeTab === "queue") publishingTabsRef.current?.scrollIntoView('),
  "Queue switches must scroll the actual dashboard container to the queue header.");
assert.ok(!editor.includes('getElementById("publishing-active")?.scrollIntoView'),
  "Scheduled publishes must not scroll users back to the bottom of the queue.");

assert.ok(editor.includes("max-w-4xl") && editor.includes('className="space-y-5 pb-7"'),"Create form should remain one continuous page");
assert.ok(!editor.includes("<PublishingWizardProgress") && !editor.includes("goToWizardStep("),"Old wizard navigation must be removed");
assert.ok(editor.includes('<PublishingSectionGuide number={1}') && editor.includes('<PublishingSectionGuide number={type==="STORY"?3:4}'),"Contextual guide section order missing");
assert.ok(guide.includes("daira-guide-glass") && guide.includes("var(--daira-guide-glass)") && guide.includes("Lightbulb"),"Publishing guide should use the canonical yellow glass guide design");
assert.ok(editor.includes('type!=="STORY" && ('),"Story should omit irrelevant caption/tag section");
assert.ok(editor.includes('type==="STORY" ?') && editor.includes("storyCreateMode") && storySetup.includes("storyCreateMode ?"),"Story must reuse the modern reply type picker");
assert.ok(editor.includes("showTags &&") && editor.includes("taggedUsersByMedia[item.storageKey]"),"Optional per-media tagging should work");
assert.ok(!tags.includes("window.fetch ="),"Legacy global fetch override must remain absent");
assert.ok(editor.includes("canSubmitMedia") && editor.includes("canSubmitAutomation") && editor.includes("!publishing"),"Final button must validate real media/automation state");
assert.ok(editor.includes("setStoryResponseSaved(false); setStoryResponseEditing(false); setStoryResponseDirty(false);"),"Switching content types must clear saved story reply state");
assert.ok(!editor.includes("handleBackToTypeSelection();"),"Late publish failures must never clear a fresh in-progress draft");
assert.ok(editor.includes('onClick={()=>void createJob(publishNow)}'),"Publishing must still call original engine");
assert.ok(editor.includes('const selectedScheduleDate = !publishNow ? stage6Date : scheduledDate;'),"Jalali schedule must be respected for all types");
assert.ok(editor.includes('const selectedHour = !publishNow ? stage6Hour : hour;'),"Schedule hour missing");
assert.ok(editor.includes('const selectedMinute = !publishNow ? stage6Minute : minute;'),"Schedule minute missing");
assert.ok(editor.includes('onDragEnd={(event: DragEndEvent)') && editor.includes("moveUploadedSlide"),"Album sorting must be preserved");
assert.ok(editor.includes("retryLocalUpload") && editor.includes("removeUploaded") && editor.includes("ProgressBar"),"Upload progress, deletion and retries must work");
assert.ok(editor.includes("changeContentType(nextType)") || editor.includes("changeContentType(value)"),"Changing content type must require explicit interaction");
assert.ok(editor.includes('window.confirm("با تغییر نوع محتوا'),"Unsaved media must be protected when changing content type");
assert.ok(queue.includes("onRetry") && queue.includes("onCancel") && queue.includes("در انتظار"),"Queue actions must be preserved");
assert.ok(!queue.includes(">جزئیات</Link>") && queue.includes("<span>ویرایش</span>"),"Queue must omit details link but preserve edit action");
assert.ok(queue.includes('CAROUSEL:"پست اسلایدی"') && editor.includes('CAROUSEL: "پست اسلایدی"') && editPage.includes('CAROUSEL: "پست اسلایدی"'),"Carousel must be called پست اسلایدی everywhere in publishing UI");
assert.ok(!editor.includes("به وقت تهران"),"Timezone note should not appear in schedule UI");
assert.ok(editor.includes('(uploadedMedia.length ? uploadedMedia : [null]).map') && editor.includes('item?.storageKey ?? "__pending__"'),"Tag input must be available before upload");
assert.ok(!editor.includes('next[result.storageKey] = [...new Set'),"No tag must be registered before media exists");
assert.ok(editor.includes('next[result.storageKey] = pending'),"Typed draft should remain after the first upload");
assert.ok(editor.includes('disabled={!item || !draft.trim()}'),"Pre-upload add tag button must remain disabled");
assert.ok(editor.includes('if (!uploadedMedia.some((item) => item.storageKey === mediaKey)) return;'),"Enter key and handler must reject tag additions without an uploaded file");
assert.ok(editor.includes("برای فعال‌شدن دکمه افزودن تگ، ابتدا رسانه را آپلود کن."),"Pre-upload tagging availability should be explained");
assert.ok(editor.includes('type === "CAROUSEL" && item && ('),"Empty carousel must not try to render missing media preview");
assert.ok(loading.includes('view === "queue"') && loading.includes('view === "editor"'),"Skeletons for queue/editor must remain");
assert.ok(editPage.includes('<PublishingPageSkeleton view="editor" />'),"Editor skeleton required");
assert.ok(route.includes("PublishingWithTags"),"Publishing page route should resolve");
assert.ok(existsSync("app/dashboard/publishing/loading.tsx"),"Create route skeleton missing");
assert.ok(src("app/dashboard/publishing/[id]/loading.tsx").includes('view="editor"'),"Editor route skeleton missing");
assert.ok(palette.includes("publishing: {") && palette.includes("guide: {"),"Publishing palette and guide colors should be centralized");
assert.ok(editor.includes('const accountScopeKey = dashboardAccounts.map(account => account.id).sort().join("|")') &&
  editor.includes('publishingJobsCacheOwner === accountScopeKey ? publishingJobsCache : null') &&
  editor.includes('publishingJobsCacheOwner = accountScopeKey') &&
  editor.includes('sessionStorage.getItem("smartdirect:publishing-jobs:v2:" + accountScopeKey)') &&
  editor.includes('sessionStorage.setItem("smartdirect:publishing-jobs:v2:" + accountScopeKey') &&
  !editor.includes('sessionStorage.getItem("smartdirect:publishing-jobs")'),
  "Publishing revisit cache and previous-status notifications must be scoped to the authorized account set");
assert.ok(editor.includes("const jobsLoadInFlightRef = useRef<Promise<void> | null>(null)") &&
  editor.includes("if (jobsLoadInFlightRef.current)") &&
  editor.includes("pendingJobsRefreshRef.current = true") &&
  editor.includes("} while (pendingJobsRefreshRef.current)") &&
  editor.includes("void request.then(clear, clear)") &&
  (editor.match(/await loadJobs\(true\)/g) || []).length >= 4 &&
  editor.includes("void loadJobs(true).catch("),
  "Publishing polls must coalesce and never lose a post-mutation, detail-return or foreground recheck");
assert.ok(editor.includes("async function loadResources(accountId: string, signal: AbortSignal)") &&
  editor.includes('fetch("/api/showcases" + query, { cache: "no-store", credentials: "include", signal })') &&
  editor.includes('fetch("/api/forms" + query, { cache: "no-store", credentials: "include", signal })') &&
  editor.includes("if (signal.aborted) return;") &&
  editor.includes("return () => controller.abort();"),
  "Switching Instagram account or Story reply type must abort stale form/showcase reads");
console.log("PUBLISHING_DAIRA_SINGLE_PAGE_REGRESSION_OK");
