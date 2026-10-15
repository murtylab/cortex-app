import { INFOVIZ_URL } from "./config.js";

export const COMPASS_OPEN_EVENT = "cortex:open-compass";
export const COMPASS_PREPARING_URL = "/cortex-compass/?preparing=1";
const SINGLE_SESSION_TOKEN = /^[A-Za-z0-9_-]{16,256}$/;
const MULTI_SESSION_PREFIX = "multi-v1.";

function isCompassSessionToken(value) {
  if (SINGLE_SESSION_TOKEN.test(value)) return true;
  if (!value.startsWith(MULTI_SESSION_PREFIX)) return false;
  const tokens = value.slice(MULTI_SESSION_PREFIX.length).split(".");
  return tokens.length >= 2 && tokens.length <= 4
    && tokens.every((token) => SINGLE_SESSION_TOKEN.test(token))
    && new Set(tokens).size === tokens.length;
}

/** Bundle only opaque session IDs; the selected model's session stays first. */
export function buildCompassSessionToken(sessionIds) {
  if (!Array.isArray(sessionIds) || sessionIds.length < 1 || sessionIds.length > 4
    || sessionIds.some((token) => typeof token !== "string" || !SINGLE_SESSION_TOKEN.test(token))
    || new Set(sessionIds).size !== sessionIds.length) {
    throw new Error("Cortex Core returned invalid or duplicate comparison session tokens.");
  }
  return sessionIds.length === 1 ? sessionIds[0] : `${MULTI_SESSION_PREFIX}${sessionIds.join(".")}`;
}

export function isCortexCompassPath(pathname = globalThis.window?.location?.pathname) {
  return typeof pathname === "string"
    && /^\/cortex-compass(?:\/|\/index\.html)?$/.test(pathname);
}

export function readCompassSessionToken(hash = globalThis.window?.location?.hash) {
  if (typeof hash !== "string") return null;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const token = params.get("session")?.trim() ?? "";
  return isCompassSessionToken(token) ? token : null;
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
