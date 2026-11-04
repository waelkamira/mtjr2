import { describe, expect, it } from "vitest";
import { defaultSupportSlaMinutes, nextSupportSlaPriority, supportSlaDueDates } from "@/server/support/sla-policy";

describe("support SLA policy", () => {
  it("sets first-response and resolution deadlines from ticket creation time", () => {
    const createdAt = new Date("2026-11-05T10:00:00.000Z");
    const due = supportSlaDueDates(createdAt, "NORMAL");
    expect(due.firstResponseDueAt.toISOString()).toBe("2026-11-05T18:00:00.000Z");
    expect(due.resolutionDueAt.toISOString()).toBe("2026-11-08T10:00:00.000Z");
  });

  it("uses tighter targets for higher priorities", () => {
    expect(defaultSupportSlaMinutes.LOW.firstResponseMinutes).toBeGreaterThan(defaultSupportSlaMinutes.NORMAL.firstResponseMinutes);
    expect(defaultSupportSlaMinutes.NORMAL.firstResponseMinutes).toBeGreaterThan(defaultSupportSlaMinutes.HIGH.firstResponseMinutes);
    expect(defaultSupportSlaMinutes.HIGH.firstResponseMinutes).toBeGreaterThan(defaultSupportSlaMinutes.URGENT.firstResponseMinutes);
  });

  it("escalates one priority level and never exceeds urgent", () => {
    expect(nextSupportSlaPriority("LOW")).toBe("NORMAL");
    expect(nextSupportSlaPriority("NORMAL")).toBe("HIGH");
    expect(nextSupportSlaPriority("HIGH")).toBe("URGENT");
    expect(nextSupportSlaPriority("URGENT")).toBe("URGENT");
  });
});
