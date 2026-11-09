import { afterEach, describe, expect, it, vi } from "vitest";
import { currentReturnPath, getCurrentReturnPath } from "@/lib/current-return-path";

describe("getCurrentReturnPath", () => {
  const origin = "https://market.example";

  afterEach(() => vi.unstubAllGlobals());

  it("uses the current page including query and hash", () => {
    expect(getCurrentReturnPath({
      pathname: "/products/chair",
      search: "?color=blue",
      hash: "#reviews",
      origin
    })).toBe("/products/chair?color=blue#reviews");
  });

  it("preserves a supplied return path from the login or registration page", () => {
    expect(getCurrentReturnPath({
      pathname: "/login",
      search: "?returnTo=%2Fcheckout%3Fstep%3Ddelivery",
      hash: "",
      origin
    })).toBe("/checkout?step=delivery");
  });

  it("preserves the requested page after registration", () => {
    expect(getCurrentReturnPath({
      pathname: "/register",
      search: "?returnTo=%2Fproducts%3Fcategory%3Dbooks",
      hash: "",
      origin
    })).toBe("/products?category=books");
  });

  it("uses an internal referrer when an auth page has no return path", () => {
    expect(getCurrentReturnPath({
      pathname: "/register",
      search: "",
      hash: "",
      origin,
      referrer: "https://market.example/products/chair?color=blue"
    })).toBe("/products/chair?color=blue");
  });

  it("rejects an external referrer", () => {
    expect(getCurrentReturnPath({
      pathname: "/login",
      search: "",
      hash: "",
      origin,
      referrer: "https://outside.example/steal"
    })).toBe("/");
  });

  it("does not return to an authentication page", () => {
    expect(getCurrentReturnPath({
      pathname: "/login",
      search: "?returnTo=%2Fregister",
      hash: "",
      origin
    })).toBe("/");
  });

  it("uses the last remembered application page when opened directly on an auth page", () => {
    const stored = new Map([["mtjr2.auth.returnTo", "/checkout?step=delivery"]]);
    vi.stubGlobal("window", {
      location: { pathname: "/login", search: "", hash: "", origin },
      sessionStorage: { getItem: (key: string) => stored.get(key) ?? null }
    });
    vi.stubGlobal("document", { referrer: "" });

    expect(currentReturnPath()).toBe("/checkout?step=delivery");
  });
});
