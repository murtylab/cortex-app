import { INFOVIZ_URL } from "./config.js";

export const COMPASS_OPEN_EVENT = "cortex:open-compass";

export function isCortexCompassPath(pathname = globalThis.window?.location?.pathname) {
  return typeof pathname === "string"
    && /^\/cortex-compass(?:\/|\/index\.html)?$/.test(pathname);
}

export function readCompassSessionToken(hash = globalThis.window?.location?.hash) {
  if (typeof hash !== "string") return null;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const token = params.get("session")?.trim() ?? "";
  return /^[A-Za-z0-9_-]{16,256}$/.test(token) ? token : null;
}

function encodedSession(sessionId) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    throw new Error("A comparison session token is required.");
  }
  return encodeURIComponent(sessionId);
}

export function buildCortexCompassSessionUrl(sessionId) {
  return `/cortex-compass/#session=${encodedSession(sessionId)}`;
}

/** @param {string | null} sessionId */
export function buildEmbeddedCompassUrl(sessionId = null, infoVizUrl = INFOVIZ_URL) {
  const base = String(infoVizUrl).replace(/\/+$/, "");
  const embeddedUrl = `${base}/?embedded=1`;
  return sessionId === null || sessionId === undefined
    ? embeddedUrl
    : `${embeddedUrl}#session=${encodedSession(sessionId)}`;
}
