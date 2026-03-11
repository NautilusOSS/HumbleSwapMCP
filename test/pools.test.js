import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isFromTokenA } from "../lib/pools.js";
import { WVOI_ID } from "../lib/client.js";

describe("isFromTokenA", () => {
  it("returns true when fromId matches tokA", () => {
    assert.equal(isFromTokenA({ tokA: 111, tokB: 222 }, 111), true);
  });

  it("returns false when fromId matches tokB", () => {
    assert.equal(isFromTokenA({ tokA: 111, tokB: 222 }, 222), false);
  });

  it("normalizes native token (0 matches WVOI_ID)", () => {
    assert.equal(isFromTokenA({ tokA: WVOI_ID, tokB: 222 }, 0), true);
  });
});
