"use client";

import { usePathname } from "next/navigation";
import AutoRepliesSkeleton from "@/components/dashboard/AutoRepliesSkeleton";

export default function AutoRepliesRouteLoading() {
  const pathname = usePathname();

  // The list-page fallback must not flash while navigating to the creation form.
  // The nested /new/loading.tsx owns the creation skeleton.
  if (pathname?.replace(/\/$/, "").endsWith("/new")) return null;

  return <AutoRepliesSkeleton includeCreateButton />;
}
