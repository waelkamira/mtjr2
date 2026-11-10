import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "https://matjar.example" } }));

import {
  validateIdentityImageUploadRequest,
  validateIdentityMutationRequest,
  validateIdentityMutationOrigin
} from "@/server/identity/request-security";

function postRequest(contentType: string, origin = "https://matjar.example") {
  return new Request("https://matjar.example/api/upload", {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": contentType
    }
  });
}

describe("identity request security guards", () => {
  it("continues to allow same-origin JSON mutations", () => {
    expect(validateIdentityMutationRequest(postRequest("application/json"))).toBeNull();
  });

  it("rejects multipart bodies on JSON-only mutation endpoints", () => {
    const response = validateIdentityMutationRequest(postRequest("multipart/form-data; boundary=----e2e"));
    expect(response?.status).toBe(415);
  });

  it("allows same-origin multipart image uploads with a boundary", () => {
    expect(validateIdentityImageUploadRequest(postRequest("multipart/form-data; boundary=----e2e"))).toBeNull();
  });

  it("rejects non-multipart content on image upload endpoints", () => {
    const response = validateIdentityImageUploadRequest(postRequest("application/json"));
    expect(response?.status).toBe(415);
  });

  it("rejects missing and cross-origin mutation origins", () => {
    const missingOrigin = new Request("https://matjar.example/api", {
      method: "POST",
      headers: { "content-type": "application/json" }
    });
    expect(validateIdentityMutationOrigin(missingOrigin)?.status).toBe(403);
    expect(validateIdentityMutationOrigin(postRequest("application/json", "https://attacker.example"))?.status).toBe(403);
  });
});
