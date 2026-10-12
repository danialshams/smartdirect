"use client";

import MediaAutomationEditor from "@/components/dashboard/MediaAutomationEditor";

export default function StoryAutomationEdit({ id }: { id: string }) {
  return <MediaAutomationEditor id={id} expectedTriggerType="STORY_REPLY_KEYWORD" />;
}
