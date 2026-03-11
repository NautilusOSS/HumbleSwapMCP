import algosdk from "algosdk";

export function validateWrapParams(appId, sender, amount, { assetId } = {}) {
  if (!appId || (typeof appId === "number" && appId <= 0)) {
    throw new Error("appId is required and must be a positive number");
  }
  if (!sender || typeof sender !== "string") {
    throw new Error("sender is required");
  }
  if (amount === undefined || amount === null || amount === "" || Number(amount) <= 0 || isNaN(Number(amount))) {
    throw new Error("amount must be a positive number");
  }
  if (assetId !== undefined) {
    if (!assetId || (typeof assetId === "number" && assetId <= 0)) {
      throw new Error("assetId is required and must be a positive number for NNT200 operations");
    }
  }
}

export function toBaseUnits(amount, decimals) {
  const parts = String(amount).split(".");
  const whole = parts[0];
  const frac = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + frac);
}

export function fromBaseUnits(value, decimals) {
  const s = String(value).padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = s.slice(s.length - decimals);
  return `${whole}.${frac}`.replace(/\.?0+$/, "") || "0";
}

export function jsonContent(data) {
  const text = JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  return { content: [{ type: "text", text }] };
}

const NOTE_PREFIX_RE = /^arccjs-v[\d.]+:\S+ custom\s*/;

export function decodeTxnSummary(base64Txns) {
  return base64Txns.map((b64, i) => {
    const txn = algosdk.decodeUnsignedTransaction(Buffer.from(b64, "base64"));
    let note = "";
    if (txn.note?.length) {
      note = new TextDecoder().decode(txn.note).replace(NOTE_PREFIX_RE, "");
    }
    const row = { "#": i + 1, type: txn.type ?? "?" };
    if (txn.type === "pay") {
      row.amount = Number(txn.amount ?? 0) / 1e6;
    } else if (txn.type === "appl") {
      row.appId = Number(txn.appIndex ?? 0);
    }
    row.note = note;
    return row;
  });
}

/**
 * Try building a transaction group across multiple payment-flag permutations.
 * Calls `buildTxns(flags)` for each permutation, sets them on `ci`, and
 * returns the first successful `ci.custom()` result.
 */
export async function tryPermutations(ci, flagSets, buildTxns, { fee = 4000 } = {}) {
  let lastError;
  for (const flags of flagSets) {
    const txns = await buildTxns(flags);
    ci.setFee(fee);
    ci.setEnableGroupResourceSharing(true);
    ci.setGroupResourceSharingStrategy("merge");
    ci.setExtraTxns(txns);
    const result = await ci.custom();
    if (result.success) return result;
    lastError = result.error ?? result.returnValue ?? "unknown";
  }
  throw new Error(`All ${flagSets.length} permutations failed. Last error: ${lastError}`);
}
