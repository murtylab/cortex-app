import { describe, expect, it } from "vitest";
import {
  buildCortexCompassSessionUrl,
  buildCompassSessionToken,
  buildEmbeddedCompassUrl,
  COMPASS_OPEN_EVENT,
  COMPASS_PREPARING_URL,
  isCortexCompassPath,
  readCompassSessionToken,
} from "./cortexCompassNavigation.js";

const token = "opaque_session_token_0123456789";

describe("Cortex-Compass internal navigation", () => {
  it("uses one stable event for the mounted Cortex workspace", () => {
    expect(COMPASS_OPEN_EVENT).toBe("cortex:open-compass");
  });

  it("opens preparation inside the normal Cortex-Compass host route", () => {
    expect(COMPASS_PREPARING_URL).toBe("/cortex-compass/?preparing=1");
  });

  it.each(["/cortex-compass", "/cortex-compass/", "/cortex-compass/index.html"])(
    "recognizes the exact host route %s",
    (pathname) => expect(isCortexCompassPath(pathname)).toBe(true),
  );

  it.each(["/lab/", "/cortex-compass-old/", "/cortex-compass/assets/file.js", "/prefix/cortex-compass/", "/cortex-compass//", undefined])(
    "does not treat a different route as Cortex-Compass: %s",
    (pathname) => expect(isCortexCompassPath(pathname)).toBe(false),
  );

  it("reads the opaque token without treating other URL fields as session data", () => {
    expect(readCompassSessionToken(`#session=${token}`)).toBe(token);
    expect(readCompassSessionToken(`session=${token}&model=clip_rn50`)).toBe(token);
    expect(readCompassSessionToken("#session=" + "a".repeat(16))).toBe("a".repeat(16));
    expect(readCompassSessionToken("#session=" + "b".repeat(256))).toBe("b".repeat(256));
  });

  it("bundles two to four individual sessions while preserving selected-model order", () => {
    const tokens = [token, "second_session_token_0123456789", "third_session_token_0123456789", "fourth_session_token_0123456789"];
    expect(buildCompassSessionToken([token])).toBe(token);
    for (const length of [2, 3, 4]) {
      const bundle = buildCompassSessionToken(tokens.slice(0, length));
      expect(bundle).toBe(`multi-v1.${tokens.slice(0, length).join(".")}`);
      expect(readCompassSessionToken(`#session=${encodeURIComponent(bundle)}`)).toBe(bundle);
      expect(buildEmbeddedCompassUrl(bundle)).toBe(`/infoviz/?embedded=1#session=${bundle}`);
    }
  });

  it.each([
    "multi-v1.", `multi-v1.${token}`, `multi-v1.${token}.${token}`,
    `multi-v1.${token}.short`, `multi-v1.${token}.${"a".repeat(257)}`,
    `multi-v2.${token}.${"b".repeat(16)}`,
    `multi-v1.${["a", "b", "c", "d", "e"].map((letter) => letter.repeat(16)).join(".")}`,
  ])("safely rejects malformed multi-session links: %s", (bundle) => {
    expect(readCompassSessionToken(`#session=${encodeURIComponent(bundle)}`)).toBeNull();
  });

  it.each([[], [token, token], ["short"], [token, 17], null, [token, ...["a", "b", "c", "d"].map((letter) => letter.repeat(16))]])(
    "rejects invalid bundles before navigation: %s", (tokens) => {
      expect(() => buildCompassSessionToken(tokens)).toThrow(/invalid or duplicate/i);
    },
  );

  it.each(["", "#", "#session=short", "#session=" + "a".repeat(257), "#session=opaque%2Fpath_is_not_a_token", "#session=%E0%A4%A", "#model=clip_rn50", null])(
    "safely ignores a malformed or absent session fragment: %s",
    (hash) => expect(readCompassSessionToken(hash)).toBeNull(),
  );

  it("puts only the encoded session token in the internal host handoff", () => {
    expect(buildCortexCompassSessionUrl("opaque token/with?chars"))
      .toBe("/cortex-compass/#session=opaque%20token%2Fwith%3Fchars");
    expect(buildCortexCompassSessionUrl(token)).not.toContain("path=");
  });

  it("embeds the existing child app without a token in static mode", () => {
    expect(buildEmbeddedCompassUrl()).toBe("/infoviz/?embedded=1");
  });

  it("keeps the encoded child token in the fragment, not the request query", () => {
    const url = buildEmbeddedCompassUrl("opaque token/with?chars");
    expect(url).toBe("/infoviz/?embedded=1#session=opaque%20token%2Fwith%3Fchars");
    expect(url.split("#")[0]).not.toContain("session=");
  });

  it.each(["https://compass.example/research/infoviz", "https://compass.example/research/infoviz/", "https://compass.example/research/infoviz///"])(
    "supports the configured visualization deployment base %s",
    (base) => expect(buildEmbeddedCompassUrl(token, base))
      .toBe(`https://compass.example/research/infoviz/?embedded=1#session=${token}`),
  );

  it("supports a visualization deployment at the root", () => {
    expect(buildEmbeddedCompassUrl(token, "/")).toBe(`/?embedded=1#session=${token}`);
  });

  it.each(["", "  ", null, 17])("rejects a missing token in a session URL: %s", (value) => {
    expect(() => buildCortexCompassSessionUrl(value)).toThrow(/token/i);
  });
});
