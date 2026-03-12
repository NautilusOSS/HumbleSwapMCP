import { describe, it } from "node:test";
import assert from "node:assert/strict";
import algosdk from "algosdk";
import { withdraw_nnt200_txn } from "../lib/nnt200.js";

const APP_ID = 859317;
const ASSET_ID = 797369;
const HOLDER = "VVNPL3MM2XWE6XGVP6ILCQ5A6B5UFKAZMSKVLXMV5DQP75ODVZM3XCHGDA";

describe("withdraw_nnt200_txn foreignAssets fix", () => {
  it("includes the underlying ASA in foreignAssets across the transaction group", async () => {
    const result = await withdraw_nnt200_txn("voi", APP_ID, ASSET_ID, HOLDER, "0.01", 8);

    assert.ok(result.transactions, "should return transactions");
    assert.ok(result.transactions.length > 0, "should have at least one transaction");

    const allForeignAssets = new Set();
    let hasWithdrawAppCall = false;

    for (const b64 of result.transactions) {
      const txn = algosdk.decodeUnsignedTransaction(Buffer.from(b64, "base64"));
      if (txn.type === "appl" && txn.applicationCall) {
        const ac = txn.applicationCall;
        for (const a of ac.foreignAssets ?? []) allForeignAssets.add(Number(a));
        if (Number(ac.appIndex) === APP_ID) hasWithdrawAppCall = true;
      }
    }

    assert.ok(hasWithdrawAppCall, `should have an app-call to ${APP_ID}`);
    assert.ok(
      allForeignAssets.has(ASSET_ID),
      `foreignAssets across group ${JSON.stringify([...allForeignAssets])} should include ${ASSET_ID}`
    );
  });

  it("returns correct details metadata", async () => {
    const result = await withdraw_nnt200_txn("voi", APP_ID, ASSET_ID, HOLDER, "0.01", 8);

    assert.deepStrictEqual(result.details, {
      action: "withdraw_nnt200",
      chain: "voi",
      appId: APP_ID,
      assetId: ASSET_ID,
      amount: "0.01",
      sender: HOLDER,
    });
  });
});
