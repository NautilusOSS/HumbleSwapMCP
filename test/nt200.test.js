import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateWrapParams } from "../lib/utils.js";

describe("NT200 validation (via validateWrapParams)", () => {
  const VALID_ADDR = "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ";

  it("passes with valid params", () => {
    assert.doesNotThrow(() => validateWrapParams(390001, VALID_ADDR, "100"));
  });

  it("rejects missing appId", () => {
    assert.throws(() => validateWrapParams(undefined, VALID_ADDR, "100"), /appId/);
  });

  it("rejects zero appId", () => {
    assert.throws(() => validateWrapParams(0, VALID_ADDR, "100"), /appId/);
  });

  it("rejects negative appId", () => {
    assert.throws(() => validateWrapParams(-1, VALID_ADDR, "100"), /appId/);
  });

  it("rejects missing sender", () => {
    assert.throws(() => validateWrapParams(390001, undefined, "100"), /sender/);
  });

  it("rejects empty sender", () => {
    assert.throws(() => validateWrapParams(390001, "", "100"), /sender/);
  });

  it("rejects non-string sender", () => {
    assert.throws(() => validateWrapParams(390001, 12345, "100"), /sender/);
  });

  it("rejects missing amount", () => {
    assert.throws(() => validateWrapParams(390001, VALID_ADDR, undefined), /amount/);
  });

  it("rejects empty string amount", () => {
    assert.throws(() => validateWrapParams(390001, VALID_ADDR, ""), /amount/);
  });

  it("rejects zero amount", () => {
    assert.throws(() => validateWrapParams(390001, VALID_ADDR, "0"), /amount/);
  });

  it("rejects negative amount", () => {
    assert.throws(() => validateWrapParams(390001, VALID_ADDR, "-5"), /amount/);
  });

  it("rejects non-numeric amount", () => {
    assert.throws(() => validateWrapParams(390001, VALID_ADDR, "abc"), /amount/);
  });

  it("accepts decimal amounts", () => {
    assert.doesNotThrow(() => validateWrapParams(390001, VALID_ADDR, "1.5"));
  });

  it("accepts large amounts", () => {
    assert.doesNotThrow(() => validateWrapParams(390001, VALID_ADDR, "999999999"));
  });
});

describe("NT200 deposit_nt200_txn / withdraw_nt200_txn exports", () => {
  it("exports deposit_nt200_txn function", async () => {
    const mod = await import("../lib/nt200.js");
    assert.equal(typeof mod.deposit_nt200_txn, "function");
  });

  it("exports withdraw_nt200_txn function", async () => {
    const mod = await import("../lib/nt200.js");
    assert.equal(typeof mod.withdraw_nt200_txn, "function");
  });
});
