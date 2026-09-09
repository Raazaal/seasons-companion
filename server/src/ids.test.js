import { describe, it, expect } from "vitest";
import { generateJoinCode, generateId, generateToken } from "./ids.js";

describe("generateJoinCode", () => {
  it("returns a 4-character code from the unambiguous charset", () => {
    const code = generateJoinCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it("supports a custom length", () => {
    expect(generateJoinCode(6)).toHaveLength(6);
  });
});

describe("generateId / generateToken", () => {
  it("returns distinct UUID-like strings", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("generateToken also returns a distinct UUID-like string", () => {
    expect(generateToken()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
