import { AutomationMessageType } from "@/generated/prisma/client";
export type AutomationAction =
  | { type: "TEXT"; text: string }
  | { type: "IMAGE" | "VIDEO" | "AUDIO"; mediaUrl: string | null; mediaId: string | null }
  | { type: "FORM"; formId: string }
  | { type: "SHOWCASE"; showcaseId: string };
export function resolveAutomationAction(message: { messageType: AutomationMessageType; text: string | null; mediaUrl: string | null; mediaId: string | null; formId: string | null; showcaseId: string | null }): AutomationAction {
  switch (message.messageType) {
    case "TEXT": if (!message.text?.trim()) throw new Error("TEXT action requires text"); return { type: "TEXT", text: message.text.trim() };
    case "IMAGE":
    case "VIDEO":
    case "AUDIO": if (!message.mediaUrl?.trim() && !message.mediaId?.trim()) throw new Error(message.messageType + " action requires media"); return { type: message.messageType, mediaUrl: message.mediaUrl, mediaId: message.mediaId };
    case "FORM": if (!message.formId) throw new Error("FORM action requires formId"); return { type: "FORM", formId: message.formId };
    case "SHOWCASE": if (!message.showcaseId) throw new Error("SHOWCASE action requires showcaseId"); return { type: "SHOWCASE", showcaseId: message.showcaseId };
    default: throw new Error("Unsupported automation action: " + String(message.messageType));
  }
}
