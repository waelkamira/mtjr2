import "server-only";

const REQUEST_LIMIT_PER_ID = 50;
const RESET_INTERVAL_MS = 60 * 60 * 1000;

type ImgurRotationState = {
  idsKey: string;
  usage: number[];
  windowStartedAt: number;
};

type ImgurGlobal = typeof globalThis & {
  __matjarImgurRotation?: ImgurRotationState;
};

function getConfiguredIds(): string[] {
  const configured = process.env.IMGUR_CLIENT_IDS ?? process.env.IMGUR_CLIENT_ID ?? "";
  return [...new Set(configured.split(/[;,\n]/).map((id) => id.trim()).filter(Boolean))];
}

/**
 * Mirrors Cooking's ordered quota rotation:
 * use the first Client ID for up to 50 uploads, then the next ID;
 * once every configured ID reaches 50 uploads, further Imgur uploads are
 * blocked until the one-hour usage window resets to the first ID.
 */
export function getNextImgurClientId(): string {
  const ids = getConfiguredIds();
  if (!ids.length) throw new Error("Imgur is not configured. Set IMGUR_CLIENT_IDS.");

  const now = Date.now();
  const idsKey = ids.join(",");
  const root = globalThis as ImgurGlobal;
  let state = root.__matjarImgurRotation;

  if (!state || state.idsKey !== idsKey || now - state.windowStartedAt >= RESET_INTERVAL_MS) {
    state = { idsKey, usage: Array(ids.length).fill(0), windowStartedAt: now };
    root.__matjarImgurRotation = state;
  }

  const availableIndex = state.usage.findIndex((count) => count < REQUEST_LIMIT_PER_ID);
  if (availableIndex === -1) {
    // All IDs have consumed their hourly allowance. Do not silently overrun quotas.
    throw new Error("All configured Imgur Client IDs have reached their hourly upload limit.");
  }

  state.usage[availableIndex] += 1;
  return ids[availableIndex];
}
