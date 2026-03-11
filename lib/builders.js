import { abi, CONTRACT } from "ulujs";
import {
  getAlgodClient,
  makeSigner,
  appAddrStr,
  encodeNote,
  isNativeToken,
  WVOI_ID,
  normalizeTokenId,
} from "./client.js";
import { findBestPool, getPoolInfo, isFromTokenA } from "./pools.js";
import { resolveToken, getTokenContractId } from "./tokens.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const poolABI = require("../data/pool-abi.json");

function toBaseUnits(amount, decimals) {
  const parts = String(amount).split(".");
  const whole = parts[0];
  const frac = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + frac);
}

function makeBuilders(algod, poolId, tokenContractId, sender) {
  const signer = makeSigner(sender);
  const poolSpec = { ...poolABI, events: [] };
  return {
    ci: new CONTRACT(poolId, algod, undefined, abi.custom, signer),
    pool: new CONTRACT(poolId, algod, undefined, poolSpec, signer, true, false, true),
    token: new CONTRACT(tokenContractId, algod, undefined, abi.nt200, signer, true, false, true),
  };
}

export async function prepareSwap(chain, fromSymbol, toSymbol, amount, sender, slippage = 5) {
  const fromToken = await resolveToken(chain, fromSymbol);
  if (!fromToken) throw new Error(`Token "${fromSymbol}" not found`);
  const toToken = await resolveToken(chain, toSymbol);
  if (!toToken) throw new Error(`Token "${toSymbol}" not found`);

  const fromId = getTokenContractId(fromToken);
  const toId = getTokenContractId(toToken);
  if (!fromId || !toId) throw new Error("Cannot resolve token contract IDs");
  if (fromId === toId) throw new Error("From and to tokens must be different");

  const bestPool = await findBestPool(chain, fromId, toId);
  if (!bestPool) throw new Error(`No pool found for ${fromSymbol}/${toSymbol}`);

  const algod = getAlgodClient(chain);
  const fromDecimals = fromToken.decimals ?? 6;
  const toDecimals = toToken.decimals ?? 6;
  const baseAmount = toBaseUnits(amount, fromDecimals);
  const poolAddr = appAddrStr(bestPool.poolId);
  const swapAForB = isFromTokenA(bestPool, fromId);

  const { getQuote } = await import("./quote.js");
  const quote = await getQuote(chain, fromSymbol, toSymbol, amount, slippage);
  const minOutBI = toBaseUnits(quote.minReceived, toDecimals);

  const fromIsNative = isNativeToken(fromId);
  const toIsNative = isNativeToken(toId);

  const { ci, pool, token: fromTokenCI } = makeBuilders(algod, bestPool.poolId, fromId, sender);

  let toTokenCI;
  if (toIsNative) {
    toTokenCI = new CONTRACT(toId, algod, undefined, abi.nt200, makeSigner(sender), true, false, true);
  }

  let customTx;

  for (const [p1, p2, p3] of [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ]) {
    const buildN = [];

    if (fromIsNative) {
      if (p1 > 0) {
        const txnO = (await fromTokenCI.createBalanceBox(sender)).obj;
        buildN.push({ ...txnO, payment: 28500, note: encodeNote("nt200 createBalanceBox") });
      }
      {
        const txnO = (await fromTokenCI.deposit(baseAmount)).obj;
        buildN.push({ ...txnO, payment: baseAmount, note: encodeNote("nt200 deposit") });
      }
    }

    {
      const approveAmount = baseAmount + baseAmount / 10n;
      const txnO = (await fromTokenCI.arc200_approve(poolAddr, approveAmount)).obj;
      buildN.push({ ...txnO, payment: p2 > 0 ? 28502 : 0, note: encodeNote("arc200 approve") });
    }

    if (swapAForB) {
      const txnO = (await pool.Trader_swapAForB(1, baseAmount, minOutBI)).obj;
      buildN.push({ ...txnO, payment: p3 > 0 ? 9e5 : 1e5, note: encodeNote("swap A->B") });
    } else {
      const txnO = (await pool.Trader_swapBForA(1, baseAmount, minOutBI)).obj;
      buildN.push({ ...txnO, payment: p3 > 0 ? 9e5 : 1e5, note: encodeNote("swap B->A") });
    }

    if (toIsNative && toTokenCI) {
      const txnO = (await toTokenCI.withdraw(minOutBI)).obj;
      buildN.push({ ...txnO, note: encodeNote("nt200 withdraw") });
    }

    ci.setFee(20000);
    ci.setEnableGroupResourceSharing(true);
    ci.setExtraTxns(buildN);

    customTx = await ci.custom();
    if (customTx.success) break;
  }

  if (!customTx?.success) {
    throw new Error("Failed to build swap transaction");
  }

  return {
    transactions: customTx.txns,
    details: {
      action: "swap",
      chain,
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      fromAmount: amount.toString(),
      expectedOutput: quote.toAmount,
      minReceived: quote.minReceived,
      slippage,
      poolId: bestPool.poolId,
      rate: quote.rate,
      sender,
    },
  };
}

export async function prepareAddLiquidity(chain, poolId, amountA, amountB, sender) {
  const algod = getAlgodClient(chain);
  const info = await getPoolInfo(chain, poolId);
  const tokA = Number(info.tokA ?? info[4]);
  const tokB = Number(info.tokB ?? info[5]);

  const tokAIsNative = isNativeToken(tokA);
  const tokBIsNative = isNativeToken(tokB);

  const tokenAres = await resolveToken(chain, String(tokA));
  const tokenBres = await resolveToken(chain, String(tokB));
  const decA = tokenAres?.decimals ?? 6;
  const decB = tokenBres?.decimals ?? 6;

  const baseA = toBaseUnits(amountA, decA);
  const baseB = toBaseUnits(amountB, decB);
  const poolAddr = appAddrStr(poolId);

  const signer = makeSigner(sender);
  const ci = new CONTRACT(poolId, algod, undefined, abi.custom, signer);
  const poolCI = new CONTRACT(poolId, algod, undefined, { ...poolABI, events: [] }, signer, true, false, true);
  const tokenACI = new CONTRACT(normalizeTokenId(tokA), algod, undefined, abi.nt200, signer, true, false, true);
  const tokenBCI = new CONTRACT(normalizeTokenId(tokB), algod, undefined, abi.nt200, signer, true, false, true);

  let customTx;

  for (const [p1, p2, p3, p4] of [
    [0, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [1, 1, 0, 0],
    [0, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 1],
    [1, 1, 1, 1],
  ]) {
    const buildN = [];

    if (tokAIsNative) {
      if (p1 > 0) {
        const txnO = (await tokenACI.createBalanceBox(sender)).obj;
        buildN.push({ ...txnO, payment: 28500, note: encodeNote("nt200 createBalanceBox A") });
      }
      const txnO = (await tokenACI.deposit(baseA)).obj;
      buildN.push({ ...txnO, payment: baseA, note: encodeNote("nt200 deposit A") });
    }

    {
      const txnO = (await tokenACI.arc200_approve(poolAddr, baseA + baseA / 10n)).obj;
      buildN.push({ ...txnO, payment: p2 > 0 ? 28502 : 0, note: encodeNote("arc200 approve A") });
    }

    if (tokBIsNative) {
      if (p3 > 0) {
        const txnO = (await tokenBCI.createBalanceBox(sender)).obj;
        buildN.push({ ...txnO, payment: 28500, note: encodeNote("nt200 createBalanceBox B") });
      }
      const txnO = (await tokenBCI.deposit(baseB)).obj;
      buildN.push({ ...txnO, payment: baseB, note: encodeNote("nt200 deposit B") });
    }

    {
      const txnO = (await tokenBCI.arc200_approve(poolAddr, baseB + baseB / 10n)).obj;
      buildN.push({ ...txnO, payment: p4 > 0 ? 28502 : 0, note: encodeNote("arc200 approve B") });
    }

    {
      const txnO = (await poolCI.Provider_deposit(1, [baseA, baseB], 0n)).obj;
      buildN.push({ ...txnO, payment: 1e5, note: encodeNote("provider deposit") });
    }

    ci.setFee(20000);
    ci.setEnableGroupResourceSharing(true);
    ci.setExtraTxns(buildN);

    customTx = await ci.custom();
    if (customTx.success) break;
  }

  if (!customTx?.success) {
    throw new Error("Failed to build add liquidity transaction");
  }

  return {
    transactions: customTx.txns,
    details: {
      action: "add_liquidity",
      chain,
      poolId,
      amountA: amountA.toString(),
      amountB: amountB.toString(),
      tokA,
      tokB,
      sender,
    },
  };
}

export async function prepareRemoveLiquidity(chain, poolId, lpAmount, sender) {
  const algod = getAlgodClient(chain);
  const info = await getPoolInfo(chain, poolId);
  const tokA = Number(info.tokA ?? info[4]);
  const tokB = Number(info.tokB ?? info[5]);

  const tokAIsNative = isNativeToken(tokA);
  const tokBIsNative = isNativeToken(tokB);

  const baseLP = toBaseUnits(lpAmount, 6);
  const signer = makeSigner(sender);
  const ci = new CONTRACT(poolId, algod, undefined, abi.custom, signer);
  const poolCI = new CONTRACT(poolId, algod, undefined, { ...poolABI, events: [] }, signer, true, false, true);

  let tokenACI, tokenBCI;
  if (tokAIsNative) {
    tokenACI = new CONTRACT(normalizeTokenId(tokA), algod, undefined, abi.nt200, signer, true, false, true);
  }
  if (tokBIsNative) {
    tokenBCI = new CONTRACT(normalizeTokenId(tokB), algod, undefined, abi.nt200, signer, true, false, true);
  }

  let customTx;

  for (const [p1, p2] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const buildN = [];

    {
      const txnO = (await poolCI.Provider_withdraw(1, baseLP, [0n, 0n])).obj;
      buildN.push({ ...txnO, payment: 1e5, note: encodeNote("provider withdraw") });
    }

    if (tokAIsNative && tokenACI) {
      const txnO = (await tokenACI.withdraw(p1 > 0 ? 1n : 0n)).obj;
      buildN.push({ ...txnO, note: encodeNote("nt200 withdraw A") });
    }

    if (tokBIsNative && tokenBCI) {
      const txnO = (await tokenBCI.withdraw(p2 > 0 ? 1n : 0n)).obj;
      buildN.push({ ...txnO, note: encodeNote("nt200 withdraw B") });
    }

    ci.setFee(20000);
    ci.setEnableGroupResourceSharing(true);
    ci.setExtraTxns(buildN);

    customTx = await ci.custom();
    if (customTx.success) break;
  }

  if (!customTx?.success) {
    throw new Error("Failed to build remove liquidity transaction");
  }

  return {
    transactions: customTx.txns,
    details: {
      action: "remove_liquidity",
      chain,
      poolId,
      lpAmount: lpAmount.toString(),
      tokA,
      tokB,
      sender,
    },
  };
}
