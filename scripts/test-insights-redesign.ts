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

assert.ok(ui.includes('mode="range" numberOfMonths={calendarMonths}') &&
  ui.includes('onSelect={setDraftRange}') &&
  ui.includes('aria-modal="true" aria-label="انتخاب بازه زمانی"') &&
  ui.includes('startMonth={minDate} endMonth={today}'),
  "Custom range uses a single accessible Persian calendar with bounded date range");
assert.ok(ui.includes('draftRange.from <= draftRange.to') &&
  ui.includes("daysBetween(draftRange.from, draftRange.to) <= 730"),
  "Reject reversed or greater-than-2-years date ranges");
assert.ok(calendar.includes('props.numberOfMonths && props.numberOfMonths > 1 ? "704px" : "352px"') &&
  calendar.includes("locale={faIR}") && calendar.includes('numerals="arabext"'),
  "Shared Jalali calendar supports two months on desktop and one on mobile");

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
  ui.includes('label="فالو"') && ui.includes('label="آنفالو"') &&
  ui.includes('label="دنبال‌کنندگان"') &&
  ui.includes('label="جمع دسترسی روزانه"'),
  "Performance rates and six grid metrics must be present");
assert.ok(ui.includes("فالو و آنفالو") && ui.includes("تعداد افراد یکتای کل بازه نیست"),
  "Daily reach/engagement aggregations cannot be represented as unique people over the entire range");
assert.ok(ui.includes('value == null || !Number.isFinite(value) ? "—"') &&
  ui.includes('summary?.follows') && ui.includes('summary?.unfollows'),
  "Missing values must not be converted to zero");

assert.ok(ui.includes("lastSync.current") && ui.includes("requestNumber.current") &&
  ui.includes("controller.abort()"),
  "Switching date ranges must suppress redundant Meta sync and prevent stale response races");
assert.ok(history.includes("analyticsStartDate") && history.includes("const MAX_DAYS = 730;") &&
  history.includes("snapshotDate: { gte: from, lte: to }"),
  "History data contract and Meta two-year and account-creation constraints must remain intact");

console.log("INSIGHTS_REDESIGN_REGRESSION_OK");
