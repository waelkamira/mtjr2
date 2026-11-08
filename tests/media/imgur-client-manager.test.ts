import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getNextImgurClientId } from "@/server/media/imgur-client-manager";

describe("Imgur Client ID rotation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { __matjarImgurRotation?: unknown }).__matjarImgurRotation;
  });

  it("uses each Client ID in order, caps each at 50 uploads, then resets after one hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T12:00:00.000Z"));
    vi.stubEnv("IMGUR_CLIENT_IDS", "client-a,client-b");

    expect(Array.from({ length: 50 }, () => getNextImgurClientId()).every((id) => id === "client-a")).toBe(true);
    expect(getNextImgurClientId()).toBe("client-b");
    expect(Array.from({ length: 49 }, () => getNextImgurClientId()).every((id) => id === "client-b")).toBe(true);
    expect(() => getNextImgurClientId()).toThrow(/hourly upload limit/i);

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(getNextImgurClientId()).toBe("client-a");
  });

  it("deduplicates configured IDs and resets usage when the configured list changes", () => {
    vi.stubEnv("IMGUR_CLIENT_IDS", "client-a,client-a;client-b");
    expect(getNextImgurClientId()).toBe("client-a");
    vi.stubEnv("IMGUR_CLIENT_IDS", "client-c");
    expect(getNextImgurClientId()).toBe("client-c");
  });
});
