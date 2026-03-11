import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTokenContractId } from "../lib/tokens.js";
import { WVOI_ID } from "../lib/client.js";

describe("getTokenContractId", () => {
  it("returns null for null token", () => {
    assert.equal(getTokenContractId(null), null);
  });

  it("returns contractId when present", () => {
    assert.equal(getTokenContractId({ contractId: 12345 }), 12345);
  });

  it("falls back to tokenId", () => {
    assert.equal(getTokenContractId({ tokenId: 67890 }), 67890);
  });

  it("normalizes 0 to WVOI_ID", () => {
    assert.equal(getTokenContractId({ contractId: 0 }), WVOI_ID);
  });

  it("prefers contractId over tokenId", () => {
    assert.equal(getTokenContractId({ contractId: 111, tokenId: 222 }), 111);
  });
});
