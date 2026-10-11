import { describe, expect, it } from "vitest";
import {
  buildCortexCompassSessionUrl,
  buildEmbeddedCompassUrl,
  COMPASS_OPEN_EVENT,
  isCortexCompassPath,
  readCompassSessionToken,
} from "./cortexCompassNavigation.js";

const token = "opaque_session_token_0123456789";

describe("Cortex-Compass internal navigation", () => {
  it("uses one stable event for the mounted Cortex workspace", () => {
    expect(COMPASS_OPEN_EVENT).toBe("cortex:open-compass");
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
