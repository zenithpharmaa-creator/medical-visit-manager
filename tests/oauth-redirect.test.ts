import { describe, expect, it } from "vitest";
import { resolveOAuthFrontendUrl } from "../server/_core/oauth-redirect";

describe("OAuth frontend redirect", () => {
  it("maps the forwarded API host to the matching Metro preview host", () => {
    expect(resolveOAuthFrontendUrl({
      host: "3000-abc.us5.manus.computer",
      forwardedProto: "https",
    })).toBe("https://8081-abc.us5.manus.computer");
  });

  it("prefers an explicitly configured preview URL", () => {
    expect(resolveOAuthFrontendUrl({
      host: "3000-abc.us5.manus.computer",
      protocol: "http",
      configuredUrl: "https://8081-configured.example/",
    })).toBe("https://8081-configured.example");
  });
});
