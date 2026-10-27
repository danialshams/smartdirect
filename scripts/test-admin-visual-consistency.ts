import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
const css=read("app/rickandmorty/admin.css");
const widgets=read("components/admin/AdminWidgets.tsx");
const shell=read("components/admin/AdminShell.tsx");
const pages=[
 "app/rickandmorty/page.tsx",
 "app/rickandmorty/users/page.tsx",
 "app/rickandmorty/users/[id]/page.tsx",
 "app/rickandmorty/tickets/page.tsx",
 "app/rickandmorty/tickets/[id]/page.tsx",
 "app/rickandmorty/tickets/bulk/page.tsx",
 "app/rickandmorty/coupons/page.tsx",
 "app/rickandmorty/sms/page.tsx",
 "app/rickandmorty/monitoring/page.tsx",
 "app/rickandmorty/audit/page.tsx",
 "app/rickandmorty/meta-monitor/page.tsx",
 "app/rickandmorty/queue/page.tsx"
];
for(const path of pages) {
 const s=read(path);
 assert(s.includes("Admin")||s.includes("adm-"),"Admin page should use shared UI primitives: "+path);
 assert(!s.includes("@mui"),"Admin layout must remain independent from MUI: "+path);
}
assert(widgets.includes('createPortal(')&&widgets.includes('document.body'),"Modal must render outside animated/admin content stacking context");
assert(widgets.includes('role="dialog"')&&widgets.includes('aria-modal="true"'),"Modal must have accessible dialog semantics");
assert(widgets.includes("close.current()")&&widgets.includes("},[]);"),"Escape and modal close callbacks must remain stable across parent renders");
assert(widgets.includes('document.body.style.overflow="hidden"')&&widgets.includes("document.body.style.overflow=previous"),"Modal must lock and restore document scrolling");
assert(widgets.includes('event.key!=="Tab"'),"Modal must trap keyboard focus while open");
assert(css.includes('.adm-modal-portal')&&css.includes('z-index:9999'),"Modal must stay above header/footer and inside viewport");
assert(css.includes('.adm-modal-body')&&css.includes('min-height:0')&&css.includes('overflow-y:auto'),"Modal content must scroll inside viewport");
assert(!css.includes("backdrop-filter")&&!css.includes("animation:adminFade .2s ease both"),"Admin must have solid, non-glass, non-transforming surfaces");
assert(css.includes('.adm-btn>svg')&&css.includes('flex:none')&&css.includes('gap:9px'),"Action icons require dedicated flex spacing");
for(const name of ["adm-root","adm-btn-primary","adm-btn-secondary","adm-btn-danger","adm-btn-ghost","adm-panel","adm-state","adm-filter-grid","adm-bottom-nav","adm-modal-actions","adm-heading-actions"])assert(css.includes(name),"Missing shared admin style: "+name);
for(const key of ["--adm-success-soft","--adm-warning-soft","--adm-danger-soft","--adm-info-soft"])assert(css.includes(key),"Status colors must use the standalone semantic administration palette: "+key);
assert(shell.includes('const activeHref=items.filter('),"Sidebar must select only the longest matching admin route");
assert(css.includes('.adm-meta-badge')&&css.includes('.adm-meta-count-dot'),"Unread Meta counts must remain visible");
assert(css.includes('@media(max-width:390px)')&&css.includes('@media(max-width:650px)'),"Admin UI needs small-screen responsive constraints");
console.log("ADMIN_SOLID_LAYOUT_MODALS_BUTTONS_RTL_PALETTE_OK");

const tabbedPages=[
 "app/rickandmorty/page.tsx",
 "app/rickandmorty/users/page.tsx",
 "app/rickandmorty/users/[id]/page.tsx",
 "app/rickandmorty/tickets/page.tsx",
 "app/rickandmorty/tickets/[id]/page.tsx",
 "app/rickandmorty/tickets/bulk/page.tsx",
 "app/rickandmorty/sms/page.tsx",
 "app/rickandmorty/meta-monitor/page.tsx",
 "app/rickandmorty/monitoring/page.tsx",
 "app/rickandmorty/queue/page.tsx"
];
for(const p of tabbedPages)assert(read(p).includes("AdminMobileSections"),"Mobile sections are missing from "+p);
const tabs=read("components/admin/AdminMobileSections.tsx");
assert(tabs.includes('role="tablist"')&&tabs.includes('role="tabpanel"')&&tabs.includes('aria-selected={active===i}'),"Mobile sections must expose accessible navigable tabs");
assert(css.includes(".adm-mobile-menu{position:absolute;top:calc(")&&css.includes("transform-origin:top right"),"Navigation menu must unfold from its header corner, never from the bottom");
assert(shell.includes('aria-label="منوی مدیریت"')&&shell.includes('aria-expanded={menu}'),"Corner menu must expose expanded state");
assert(read("app/rickandmorty/monitoring/page.tsx").includes('href="/rickandmorty/queue"'),"Recovery should stay in admin navigation");
console.log("ADMIN_ALL_MOBILE_SECTIONS_CORNER_MENU_OK");


const dataView=read("components/admin/AdminDataView.tsx");
for(const marker of ["adm-info-grid","adm-info-cell","adm-action-area","adm-entity-row","adm-mini-metrics"])assert(css.includes(marker),"New admin information pattern missing: "+marker);
for(const primitive of ["AdminInfoGrid","AdminInfo","AdminCardHeader","AdminActionArea","AdminMetrics","AdminListItem"])assert(dataView.includes("function "+primitive),"Missing data layout primitive: "+primitive);
const detail=read("app/rickandmorty/users/[id]/page.tsx");
assert(detail.includes('labels={["حساب","اشتراک","پیج‌ها","پشتیبانی","سوابق"]}'),"User detail must have five distinct working areas");
assert(detail.includes('title="ویرایش شماره"')&&detail.includes('title="دسترسی حساب"')&&detail.includes('title="تغییر پلن و اعتبار"'),"Sensitive actions and forms must have independent cards");
assert(detail.includes('title="مشخصات"')&&detail.includes("AdminInfoGrid"),"User metadata must be in a structured data grid");
for(const path of ["app/rickandmorty/tickets/page.tsx","app/rickandmorty/coupons/page.tsx","app/rickandmorty/sms/page.tsx","app/rickandmorty/queue/page.tsx","app/rickandmorty/audit/page.tsx","app/rickandmorty/monitoring/page.tsx"])assert(read(path).includes("AdminInfoGrid"),"Long inline metadata not separated on "+path);
assert(tabs.includes("ArrowLeft")&&tabs.includes("ArrowRight")&&tabs.includes("Home")&&tabs.includes("End"),"Mobile tabs require keyboard navigation");
assert(css.includes(".adm-mobile-menu{position:absolute;top:calc("),"Mobile admin menu must remain corner-anchored");
console.log("ADMIN_V2_ALL_DATA_CARDS_OPERATIONS_SECTIONED_OK");
