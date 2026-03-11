import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CHAIN,
  isNativeToken,
  normalizeTokenId,
  tokenMatchesPool,
  getChainConfig,
  WVOI_ID,
} from "../lib/client.js";

describe("DEFAULT_CHAIN", () => {
  it("is voi", () => {
    assert.equal(DEFAULT_CHAIN, "voi");
  });
});

describe("isNativeToken", () => {
  it("returns true for 0", () => {
    assert.equal(isNativeToken(0), true);
  });

  it("returns true for WVOI_ID", () => {
    assert.equal(isNativeToken(WVOI_ID), true);
  });

  it("returns true for VOI string", () => {
    assert.equal(isNativeToken("VOI"), true);
    assert.equal(isNativeToken("voi"), true);
  });

  it("returns false for other token IDs", () => {
    assert.equal(isNativeToken(12345), false);
  });

  it("returns false for other symbols", () => {
    assert.equal(isNativeToken("USDC"), false);
  });
});

describe("normalizeTokenId", () => {
  it("maps 0 to WVOI_ID", () => {
    assert.equal(normalizeTokenId(0), WVOI_ID);
  });

  it("passes through non-zero IDs", () => {
    assert.equal(normalizeTokenId(12345), 12345);
  });
});

describe("tokenMatchesPool", () => {
  it("matches same ID", () => {
    assert.equal(tokenMatchesPool(12345, 12345), true);
  });

  it("matches 0 to WVOI_ID", () => {
    assert.equal(tokenMatchesPool(0, WVOI_ID), true);
  });

  it("does not match different IDs", () => {
    assert.equal(tokenMatchesPool(111, 222), false);
  });
});

describe("getChainConfig", () => {
  it("returns config for voi", () => {
    const c = getChainConfig("voi");
    assert.equal(c.networkId, "voi-mainnet");
    assert.ok(c.algodUrl);
    assert.ok(c.apiUrl);
  });

  it("throws for unknown chain", () => {
    assert.throws(() => getChainConfig("unknown"), /Unsupported chain/);
  });
});
