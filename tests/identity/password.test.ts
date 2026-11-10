import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword
} from "../../src/server/identity/password";

describe("password hashing", () => {
  it("hashes and verifies a valid password", async () => {
    const password = "correct horse battery staple 2026";
    const encoded = await hashPassword(password);

    expect(encoded).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const encoded = await hashPassword("correct horse battery staple 2026");

    await expect(verifyPassword("incorrect password", encoded)).resolves.toBe(
      false
    );
  });

  it("rejects malformed or unsupported hashes", async () => {
    await expect(verifyPassword("any password", "not-a-hash")).resolves.toBe(
      false
    );
    await expect(
      verifyPassword("any password", "scrypt$999999999$8$1$a$b")
    ).resolves.toBe(false);
  });

  it("enforces the password length policy", async () => {
    await expect(hashPassword("too-short")).rejects.toThrow(/between 12 and 128/);
    await expect(hashPassword("x".repeat(129))).rejects.toThrow(
      /between 12 and 128/
    );
  });
});
