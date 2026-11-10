export const defaultSupportSlaMinutes = {
  LOW: { firstResponseMinutes: 24 * 60, resolutionMinutes: 5 * 24 * 60 },
  NORMAL: { firstResponseMinutes: 8 * 60, resolutionMinutes: 72 * 60 },
  HIGH: { firstResponseMinutes: 4 * 60, resolutionMinutes: 24 * 60 },
  URGENT: { firstResponseMinutes: 60, resolutionMinutes: 4 * 60 }
} as const;

export type SupportSlaPriority = keyof typeof defaultSupportSlaMinutes;

export function supportSlaDueDates(createdAt: Date, priority: SupportSlaPriority) {
  const policy = defaultSupportSlaMinutes[priority];
  return {
    firstResponseDueAt: new Date(createdAt.getTime() + policy.firstResponseMinutes * 60_000),
    resolutionDueAt: new Date(createdAt.getTime() + policy.resolutionMinutes * 60_000)
  };
}

export function nextSupportSlaPriority(priority: SupportSlaPriority): SupportSlaPriority {
  if (priority === "LOW") return "NORMAL";
  if (priority === "NORMAL") return "HIGH";
  if (priority === "HIGH") return "URGENT";
  return "URGENT";
}
