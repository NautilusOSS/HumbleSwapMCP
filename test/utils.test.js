import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toBaseUnits, fromBaseUnits, jsonContent } from "../lib/utils.js";

describe("toBaseUnits", () => {
  it("converts whole numbers", () => {
    assert.equal(toBaseUnits("100", 6), 100_000_000n);
  });

  it("converts decimals", () => {
    assert.equal(toBaseUnits("1.5", 6), 1_500_000n);
  });

  it("truncates excess decimals", () => {
    assert.equal(toBaseUnits("1.1234567890", 6), 1_123_456n);
  });

  it("pads short decimals", () => {
    assert.equal(toBaseUnits("1.1", 6), 1_100_000n);
  });

  it("handles zero", () => {
    assert.equal(toBaseUnits("0", 6), 0n);
  });

  it("handles 0 decimals", () => {
    assert.equal(toBaseUnits("42", 0), 42n);
  });

  it("handles large values", () => {
    assert.equal(toBaseUnits("999999999", 6), 999_999_999_000_000n);
  });
});

describe("fromBaseUnits", () => {
  it("converts base units to human readable", () => {
    assert.equal(fromBaseUnits(100_000_000n, 6), "100");
  });

  it("preserves fractional part", () => {
    assert.equal(fromBaseUnits(1_500_000n, 6), "1.5");
  });

  it("handles small values", () => {
    assert.equal(fromBaseUnits(1n, 6), "0.000001");
  });

  it("handles zero", () => {
    assert.equal(fromBaseUnits(0n, 6), "0");
  });

  it("strips trailing zeros", () => {
    assert.equal(fromBaseUnits(1_000_000n, 6), "1");
  });

  it("round-trips with toBaseUnits", () => {
    const original = "123.456";
    const base = toBaseUnits(original, 6);
    const back = fromBaseUnits(base, 6);
    assert.equal(back, original);
  });
});

describe("jsonContent", () => {
  it("returns MCP-shaped content", () => {
    const result = jsonContent({ foo: "bar" });
    assert.deepEqual(result, {
      content: [{ type: "text", text: '{\n  "foo": "bar"\n}' }],
    });
  });

  it("serializes bigint as string", () => {
    const result = jsonContent({ val: 123n });
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.val, "123");
  });
});
