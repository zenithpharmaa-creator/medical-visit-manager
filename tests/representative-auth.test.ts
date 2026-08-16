import { describe, expect, it } from "vitest";
import { validateRepresentativePassword } from "../lib/representative-auth-validation";

describe("representative account fields", () => {
  it("allows an empty password when the current password should remain unchanged", () => {
    expect(validateRepresentativePassword("").valid).toBe(true);
  });

  it("requires at least three characters for a new password", () => {
    expect(validateRepresentativePassword("12").valid).toBe(false);
    expect(validateRepresentativePassword("123").valid).toBe(true);
  });
});
