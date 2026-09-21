export type AutomationConditionContext = { automationIsActive: boolean; humanHandoffActive: boolean };
export type AutomationConditionResult = { allowed: true } | { allowed: false; reason: "INACTIVE" | "HUMAN_HANDOFF" };
export function evaluateAutomationConditions(context: AutomationConditionContext): AutomationConditionResult {
  if (!context.automationIsActive) return { allowed: false, reason: "INACTIVE" };
  if (context.humanHandoffActive) return { allowed: false, reason: "HUMAN_HANDOFF" };
  return { allowed: true };
}
