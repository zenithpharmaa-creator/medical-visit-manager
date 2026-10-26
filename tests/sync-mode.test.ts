import { describe, expect, it } from "vitest";
import { shouldUseManagerSync } from "../shared/sync-mode";

describe("sync mode selection", () => {
  it("uses the manager route when the manager has no representative device", () => {
    expect(shouldUseManagerSync(false, "manager")).toBe(true);
  });

  it("keeps representative devices on the device-token route", () => {
    expect(shouldUseManagerSync(true, "representative")).toBe(false);
    expect(shouldUseManagerSync(false, "representative")).toBe(false);
  });
});
