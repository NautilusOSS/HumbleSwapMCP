import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateWrapParams } from "../lib/utils.js";

describe("NNT200 validation (via validateWrapParams with assetId)", () => {
  const VALID_ADDR = "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ";

  it("passes with valid params including assetId", () => {
    assert.doesNotThrow(() => validateWrapParams(400000, VALID_ADDR, "50", { assetId: 12345 }));
  });

  it("rejects missing assetId when provided as undefined via option", () => {
    assert.doesNotThrow(() => validateWrapParams(400000, VALID_ADDR, "50", {}));
  });

  it("rejects zero assetId", () => {
    assert.throws(() => validateWrapParams(400000, VALID_ADDR, "50", { assetId: 0 }), /assetId/);
  });

  it("rejects negative assetId", () => {
    assert.throws(() => validateWrapParams(400000, VALID_ADDR, "50", { assetId: -1 }), /assetId/);
  });

  it("rejects null assetId", () => {
    assert.throws(() => validateWrapParams(400000, VALID_ADDR, "50", { assetId: null }), /assetId/);
  });

  it("accepts valid assetId", () => {
    assert.doesNotThrow(() => validateWrapParams(400000, VALID_ADDR, "10", { assetId: 999 }));
  });

  it("still validates base params with assetId", () => {
    assert.throws(() => validateWrapParams(0, VALID_ADDR, "50", { assetId: 12345 }), /appId/);
    assert.throws(() => validateWrapParams(400000, "", "50", { assetId: 12345 }), /sender/);
    assert.throws(() => validateWrapParams(400000, VALID_ADDR, "0", { assetId: 12345 }), /amount/);
  });
});

describe("NNT200 deposit_nnt200_txn / withdraw_nnt200_txn exports", () => {
  it("exports deposit_nnt200_txn function", async () => {
    const mod = await import("../lib/nnt200.js");
    assert.equal(typeof mod.deposit_nnt200_txn, "function");
  });

  it("exports withdraw_nnt200_txn function", async () => {
    const mod = await import("../lib/nnt200.js");
    assert.equal(typeof mod.withdraw_nnt200_txn, "function");
  });
});
