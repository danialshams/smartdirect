import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const ui = read("app/dashboard/insights/InsightsDashboard.tsx");
const history = read("app/api/instagram/insights/history/route.ts");
const calendar = read("components/dashboard/DashboardUI.tsx");

assert.ok(ui.includes('aria-labelledby="insights-heading"') &&
  ui.includes("var(--daira-primary)") && ui.includes("var(--daira-border)"),
  "Page title and filters must use current SmartDirect design tokens");
assert.ok(ui.includes("InsightsSkeleton") && ui.includes("daira-skeleton__bar") &&
  !ui.includes("function Spinner("),
  "Load states must render chart/stat shaped skeletons instead of spinners");
assert.ok(ui.includes("const [preset, setPreset] = useState<Preset>(30)") &&
  ui.includes("([7, 30, 90] as const).map((days)") &&
  ui.includes("setAppliedRange(null)"),
  "7/30/90-day presets must remain available and exit custom-range mode");

assert.ok(ui.includes('["from", "to"] as const') === false &&
  ui.includes('(["from", "to"] as const).map((field)') &&
  ui.includes('openCalendar(field)'),
  "Date range uses two clear, independently accessible start/end fields");
assert.ok(ui.includes('mode="single" numberOfMonths={1}') &&
  ui.includes('selected={calendarOpen === "from" ? draftFrom : draftTo}') &&
  ui.includes('onSelect={pickDate}') &&
  ui.includes('aria-modal="true"') &&
  ui.includes('before: calendarOpen === "to" ? (draftFrom ?? minDate) : minDate'),
  "Each Persian date picker must use one month and respect selectable boundaries");
assert.ok(ui.includes('draftFrom <= draftTo') &&
  ui.includes("daysBetween(draftFrom, draftTo) <= 730") &&
  ui.includes('if (draftTo && draftTo < chosen) setDraftTo(undefined);'),
  "Reject reversed/overlong ranges and clear outdated end dates when start changes");
assert.ok(calendar.includes("locale={faIR}") && calendar.includes('numerals="arabext"'),
  "Use the existing shared Jalali calendar");

assert.ok(ui.includes("new ResizeObserver(update)") &&
  ui.includes('className="block w-full touch-pan-y"') &&
  !ui.includes("min-w-[560px]") && !ui.includes("overflow-x-auto"),
  "Trend chart must fit mobile width and avoid horizontal overflow");
assert.ok(ui.includes("onPointerDown={(event) => choosePoint(event.clientX)}") &&
  ui.includes("onPointerMove={(event) => choosePoint(event.clientX)}") &&
  ui.includes("event.pointerType ===") && ui.includes('onKeyDown={(event) => {'),
  "Trend supports touch, pointer and keyboard inspection");
assert.ok(ui.includes('{ id: "reach", title: "دسترسی"') &&
  ui.includes('{ id: "views", title: "بازدید"') &&
  ui.includes('{ id: "interactions", title: "تعاملات"') &&
  !ui.includes('{ id: "accountsEngaged",'),
  "Chart shows exactly three requested tabs");

assert.ok(ui.includes('title="نرخ‌های عملکرد"') &&
  ui.includes('title="آمار کلی"') &&
  ui.includes('label: "فالو"') && ui.includes('label: "آنفالو"') &&
  ui.includes('label: "دنبال‌کنندگان"') &&
  ui.includes('label: "جمع دسترسی روزانه"'),
  "Performance rates and six grid metrics must be present");
assert.ok(ui.includes('ref={containerRef} dir="ltr"') &&
  ui.includes('<div dir="ltr" className="mt-1 flex'),
  "The historical trend and date labels must run left-to-right within the RTL page");
assert.ok(ui.includes('function InsightsGuide(') &&
  ui.includes('dairaPalette.guide.background') &&
  ui.includes('<InsightsGuide text={help} />') &&
  ui.includes('help="دسترسی یعنی') &&
  ui.includes('help="نرخ تعامل از نسبت') &&
  ui.includes('help="این بخش مجموع آمار روزانه'),
  "Every analytics section must have a short yellow guide without a More option");
assert.ok(!ui.includes("بیشتر بدانیم") &&
  !ui.includes("برای مشاهده تاریخ و مقدار دقیق، نمودار را لمس کن.") &&
  !ui.includes("تعاملات نسبت به دسترسی") &&
  !ui.includes("{growthNote}") &&
  !ui.includes("دسترسی و تعاملات روزانه ممکن است شامل"),
  "Remove repeated descriptive copy under the chart, rates, and page footer");
assert.ok(ui.includes('function AnimatedStatValue(') &&
  ui.includes('prefers-reduced-motion: reduce') &&
  ui.includes('group flex min-h-[146px]') &&
  ui.includes('flex-col items-center justify-center') &&
  ui.includes('transition-colors duration-200'),
  "Centered metric tiles must animate softly and respect reduced motion");
assert.ok(ui.includes("فالو و آنفالو") && ui.includes("تعداد افراد یکتای کل بازه نیست"),
  "Daily reach/engagement aggregations cannot be represented as unique people over the entire range");
assert.ok(ui.includes('value == null || !Number.isFinite(value) ? "—"') &&
  ui.includes('summary?.follows') && ui.includes('summary?.unfollows') &&
  ui.includes('زیر ۱۰۰ فالوور'),
  "Missing values must not be converted to zero");

assert.ok(ui.includes("lastSync.current") && ui.includes("requestNumber.current") &&
  ui.includes("controller.abort()"),
  "Switching date ranges must suppress redundant Meta sync and prevent stale response races");
assert.ok(history.includes("analyticsStartDate") && history.includes("const MAX_DAYS = 730;") &&
  history.includes("snapshotDate: { gte: from, lte: to }"),
  "History data contract and Meta two-year and account-creation constraints must remain intact");

console.log("INSIGHTS_REDESIGN_REGRESSION_OK");
