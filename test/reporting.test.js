import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { submitIssue, CATEGORIES } from "../lib/reporting.js";

describe("CATEGORIES", () => {
  it("has expected keys", () => {
    const keys = Object.keys(CATEGORIES);
    assert.ok(keys.includes("bug"));
    assert.ok(keys.includes("unexpected-data"));
    assert.ok(keys.includes("api-error"));
    assert.ok(keys.includes("inconsistency"));
    assert.ok(keys.includes("feature-request"));
    assert.ok(keys.includes("other"));
  });
});

describe("submitIssue (no GITHUB_TOKEN)", () => {
  it("returns a url_generated result with a GitHub URL", async () => {
    const result = await submitIssue({
      title: "Test issue",
      description: "Something went wrong",
      category: "bug",
      serverVersion: "0.3.0",
    });
    assert.equal(result.submitted, false);
    assert.ok(result.url.startsWith("https://github.com/"));
    assert.ok(result.url.includes("NautilusOSS/HumbleSwapMCP"));
    assert.ok(result.url.includes("issues/new"));
  });

  it("includes title and description in URL params", async () => {
    const result = await submitIssue({
      title: "Pool returns NaN",
      description: "get_pool returned NaN for TVL",
      category: "unexpected-data",
      toolName: "get_pool",
      serverVersion: "0.3.0",
    });
    assert.ok(result.url.includes("Pool+returns+NaN"));
    assert.ok(result.url.includes("get_pool"));
  });

  it("includes context fields in the body", async () => {
    const result = await submitIssue({
      title: "Swap error",
      description: "Swap failed unexpectedly",
      category: "api-error",
      toolName: "swap_txn",
      input: '{"fromToken":"VOI","toToken":"USDC","amount":"100"}',
      output: "Error: timeout",
      expected: "A valid transaction group",
      serverVersion: "0.3.0",
    });
    const url = new URL(result.url);
    const body = url.searchParams.get("body");
    assert.ok(body.includes("swap_txn"));
    assert.ok(body.includes("Error: timeout"));
    assert.ok(body.includes("A valid transaction group"));
    assert.ok(body.includes("v0.3.0"));
  });

  it("adds labels to the URL", async () => {
    const result = await submitIssue({
      title: "Feature idea",
      description: "Add multi-hop routing",
      category: "feature-request",
      serverVersion: "0.3.0",
    });
    assert.ok(result.url.includes("labels="));
    assert.ok(result.url.includes("enhancement"));
    assert.ok(result.url.includes("mcp-reported"));
  });
});
