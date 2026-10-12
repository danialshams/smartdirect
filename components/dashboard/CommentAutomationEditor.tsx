"use client";

import MediaAutomationEditor from "@/components/dashboard/MediaAutomationEditor";

export default function CommentAutomationEditor({ id }: { id: string }) {
  return <MediaAutomationEditor id={id} expectedTriggerType="COMMENT_KEYWORD" />;
}
