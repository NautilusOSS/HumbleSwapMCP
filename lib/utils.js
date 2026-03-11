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

/**
 * Try building a transaction group across multiple payment-flag permutations.
 * Calls `buildTxns(flags)` for each permutation, sets them on `ci`, and
 * returns the first successful `ci.custom()` result.
 */
export async function tryPermutations(ci, flagSets, buildTxns, { fee = 20000 } = {}) {
  let lastError;
  for (const flags of flagSets) {
    const txns = await buildTxns(flags);
    ci.setFee(fee);
    ci.setEnableGroupResourceSharing(true);
    ci.setExtraTxns(txns);
    const result = await ci.custom();
    if (result.success) return result;
    lastError = result.error ?? result.returnValue ?? "unknown";
  }
  throw new Error(`All ${flagSets.length} permutations failed. Last error: ${lastError}`);
}
