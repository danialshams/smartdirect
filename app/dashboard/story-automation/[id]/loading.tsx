import AutomationCreationSkeleton from "@/components/dashboard/AutomationCreationSkeleton";

// Prevent the story list's parent loading boundary from flashing during edit navigation.
export default function EditStoryAutomationLoading() {
  return <AutomationCreationSkeleton triggerType="STORY_REPLY_KEYWORD" />;
}
