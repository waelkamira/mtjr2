import { describe, expect, it } from "vitest";
import { notificationRetryDelayMs } from "@/server/notifications/delivery-policy";

describe("notificationRetryDelayMs", () => {
  it("uses exponential backoff beginning at one minute", () => {
    expect(notificationRetryDelayMs(1)).toBe(60_000);
    expect(notificationRetryDelayMs(2)).toBe(120_000);
    expect(notificationRetryDelayMs(3)).toBe(240_000);
  });

  it("caps retries at six hours and bounds invalid attempts", () => {
    expect(notificationRetryDelayMs(20)).toBe(6 * 60 * 60 * 1000);
    expect(notificationRetryDelayMs(0)).toBe(60_000);
    expect(notificationRetryDelayMs(-4)).toBe(60_000);
  });
});
