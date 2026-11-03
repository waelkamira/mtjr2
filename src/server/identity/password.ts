import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = 1 << 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: MAX_MEMORY
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey as Buffer);
      }
    );
  });
}

function validatePassword(password: string): void {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `Password must contain between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`
    );
  }
}

/** Stores a versioned scrypt hash; the plaintext password is never persisted. */
export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);

  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64url"),
    key.toString("base64url")
  ].join("$");
}

/** Malformed/unsupported hashes fail closed instead of throwing. */
export async function verifyPassword(
  password: string,
  encodedHash: string
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > PASSWORD_MAX_LENGTH ||
    typeof encodedHash !== "string"
  ) {
    return false;
  }

  const parts = encodedHash.split("$");
  if (parts.length !== 6) return false;

  const [algorithm, cost, blockSize, parallelization, saltEncoded, keyEncoded] =
    parts;

  if (
    algorithm !== "scrypt" ||
    cost !== String(COST) ||
    blockSize !== String(BLOCK_SIZE) ||
    parallelization !== String(PARALLELIZATION)
  ) {
    return false;
  }

  let salt: Buffer;
  let expectedKey: Buffer;

  try {
    salt = Buffer.from(saltEncoded, "base64url");
    expectedKey = Buffer.from(keyEncoded, "base64url");
  } catch {
    return false;
  }

  if (salt.length !== SALT_LENGTH || expectedKey.length !== KEY_LENGTH) {
    return false;
  }

  const actualKey = await deriveKey(password, salt);
  return timingSafeEqual(actualKey, expectedKey);
}
