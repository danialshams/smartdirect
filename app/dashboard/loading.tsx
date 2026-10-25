/**
 * Intentionally silent shared dashboard Suspense fallback.
 *
 * The authenticated DashboardShell keeps the real header, navigation and
 * Home artwork mounted across client-side route changes. Rendering a generic
 * Home / shell skeleton here, before each child route's own loading.tsx or
 * client-side skeleton, produces an incorrect two-stage loading flash.
 *
 * Keep this loading boundary to prevent an ancestor app/loading.tsx fallback
 * from replacing the dashboard chrome. Specific pages own their load states.
 */
export default function DashboardLoading() {
  return null;
}
