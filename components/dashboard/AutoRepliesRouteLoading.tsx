"use client";

import { usePathname } from "next/navigation";
import AutoRepliesSkeleton from "@/components/dashboard/AutoRepliesSkeleton";
import CommentAutomationEditSkeleton from "@/components/dashboard/CommentAutomationEditSkeleton";

export default function AutoRepliesRouteLoading() {
  const pathname = usePathname()?.replace(/\/$/, "") || "";

  // The nested forms own their route skeletons. Do not flash the list skeleton
  // while navigating to an editor route.
  if (pathname.endsWith("/new")) return null;
  if (/^\/dashboard\/comment-automation\/[^/]+$/.test(pathname)) {
    return <CommentAutomationEditSkeleton />;
  }

  return <AutoRepliesSkeleton includeCreateButton />;
}
