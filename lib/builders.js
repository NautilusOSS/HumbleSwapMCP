// Transaction builders for Humble Swap pool interactions.
//
// Reference implementations:
//   Pool contract (Reach): https://github.com/HumbleOSS/humble-core/blob/main/index.rsh
//   ulujs swap utility:    https://github.com/temptemp3/ulujs/blob/main/utils/swap.js
//   Humble interface:       https://github.com/HumbleOSS/humble-interface/blob/beta/src/components/Swap/index.tsx

import { abi, CONTRACT } from "ulujs";
import {
  getAlgodClient,
  getIndexerClient,
  makeSigner,
  appAddrStr,
  encodeNote,
  normalizeTokenId,
} from "./client.js";
import { findBestPool, getPoolInfo } from "./pools.js";
import { resolveToken, getTokenContractId } from "./tokens.js";
import { toBaseUnits, fromBaseUnits, tryPermutations } from "./utils.js";
import { TOKEN_STANDARD, arc200RedeemABI } from "./tokenStandard.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const poolABI = require("../data/pool-abi.json");

function abiForStandard(std) {
  if (std === TOKEN_STANDARD.NETWORK || std === TOKEN_STANDARD.ASA) return abi.nt200;
  return abi.arc200;
}

function makeSwapBuilders(algod, indexer, poolId, fromTokenId, toTokenId, sender, fromStandard, toStandard) {
  const signer = makeSigner(sender);
  const simPool = new CONTRACT(poolId, algod, indexer, poolABI, signer);
  simPool.setFee(4000);
  const builders = {
    ci: new CONTRACT(poolId, algod, indexer, abi.custom, signer),
    pool: new CONTRACT(poolId, algod, indexer, poolABI, signer, true, false, true),
    fromToken: new CONTRACT(fromTokenId, algod, indexer, abiForStandard(fromStandard), signer, true, false, true),
    toToken: new CONTRACT(toTokenId, algod, indexer, abiForStandard(toStandard), signer, true, false, true),
    simPool,
  };
  if (fromStandard === TOKEN_STANDARD.ARC200_EXCHANGE) {
    builders.fromRedeem = new CONTRACT(fromTokenId, algod, indexer, arc200RedeemABI, signer, true, false, true);
  }
  if (toStandard === TOKEN_STANDARD.ARC200_EXCHANGE) {
    builders.toRedeem = new CONTRACT(toTokenId, algod, indexer, arc200RedeemABI, signer, true, false, true);
  }
  return builders;
}

// [ensureInputBox, approvePayment, ensureOutputBalance]
const SWAP_FLAGS = [
  [0, 0, 0],
  [1, 1, 1],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 0],
  [1, 0, 1],
  [0, 1, 1],
];

const ADD_LIQ_FLAGS = [
  [0, 0, 0, 0],
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [1, 1, 0, 0],
  [0, 0, 1, 0],
  [1, 1, 1, 0],
  [0, 0, 0, 1],
  [1, 1, 1, 1],
];

const REMOVE_LIQ_FLAGS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

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
  const indexer = getIndexerClient(chain);
  const fromDecimals = fromToken.decimals ?? 6;
  const toDecimals = toToken.decimals ?? 6;
  const baseAmount = toBaseUnits(amount, fromDecimals);
  const poolAddr = appAddrStr(bestPool.poolId);

  const fromStd = fromToken.tokenStandard ?? TOKEN_STANDARD.ARC200;
  const toStd = toToken.tokenStandard ?? TOKEN_STANDARD.ARC200;
  const fromAssetId = fromToken.assetId ?? null;
  const toAssetId = toToken.assetId ?? null;
  const approvalBuf = fromToken.approvalBuffer ?? 1;
  const approvalAmount = approvalBuf > 1
    ? baseAmount * BigInt(Math.round(approvalBuf * 100)) / 100n
    : baseAmount;

  const info = await getPoolInfo(chain, bestPool.poolId);
  const onChainTokA = normalizeTokenId(info.tokA);
  const onChainTokB = normalizeTokenId(info.tokB);
  const swapAForB = fromId === onChainTokA && toId === onChainTokB;
  const swapMethod = swapAForB ? "Trader_swapAForB" : "Trader_swapBForA";

  const {
    ci, pool,
    fromToken: fromTokenCI, toToken: toTokenCI,
    fromRedeem, toRedeem,
    simPool,
  } = makeSwapBuilders(algod, indexer, bestPool.poolId, fromId, toId, sender, fromStd, toStd);

  const simResult = await simPool[swapMethod](1, baseAmount, 0n);
  if (!simResult.success) throw new Error(`Swap simulation failed: ${simResult.error ?? "unknown"}`);
  const simOutput = swapAForB
    ? BigInt(simResult.returnValue[1])
    : BigInt(simResult.returnValue[0]);
  if (simOutput === 0n) throw new Error("Swap would return zero output");

  const slippageBps = BigInt(Math.round(slippage * 100));
  const minOutBI = simOutput * (10000n - slippageBps) / 10000n;

  let toAsaOptIn = false;
  if (toStd === TOKEN_STANDARD.ASA && toAssetId != null) {
    const acct = await algod.accountInformation(sender).do();
    const assets = acct.assets || [];
    toAsaOptIn = !assets.some(
      (a) => Number(a["asset-id"] ?? a.assetId ?? 0) === toAssetId
    );
  }

  let effectiveFromStd = fromStd;
  if (fromStd === TOKEN_STANDARD.ASA || fromStd === TOKEN_STANDARD.NETWORK) {
    try {
      const balCI = new CONTRACT(fromId, algod, indexer, abi.arc200, makeSigner(sender));
      const balResult = await balCI.arc200_balanceOf(sender);
      if (balResult.success && BigInt(balResult.returnValue) >= baseAmount) {
        effectiveFromStd = TOKEN_STANDARD.ARC200;
      }
    } catch (_) { /* fall through to original standard */ }
  }

  let escrowTopUp = 0;
  try {
    const escrowInfo = await algod.accountInformation(poolAddr).do();
    const bal = Number(escrowInfo.amount ?? escrowInfo["amount"]);
    const minBal = Number(escrowInfo["min-balance"] ?? 0);
    if (bal < minBal + 100_000) escrowTopUp = 100_000;
  } catch (_) { /* proceed without top-up */ }

  // Use "default" first so GRS helpers stay separate and the pool's inner app (e.g. 47165331)
  // remains in foreign-apps; "merge" can drop it and cause "unavailable App" on broadcast.
  const customTx = await tryPermutations(ci, SWAP_FLAGS, async ([p1, p2, p3]) => {
    const txns = [];

    // --- Pre-swap: wrap input token if needed ---
    if (effectiveFromStd === TOKEN_STANDARD.NETWORK) {
      if (p1 > 0) {
        const txnO = (await fromTokenCI.createBalanceBox(sender)).obj;
        txns.push({ ...txnO, payment: 28500, note: encodeNote("nt200 createBalanceBox") });
      }
      const txnO = (await fromTokenCI.deposit(baseAmount)).obj;
      txns.push({ ...txnO, payment: baseAmount, note: encodeNote("nt200 deposit") });
    } else if (effectiveFromStd === TOKEN_STANDARD.ASA && fromAssetId != null) {
      if (p1 > 0) {
        const txnO = (await fromTokenCI.createBalanceBox(sender)).obj;
        txns.push({ ...txnO, payment: 28500, note: encodeNote("nnt200 createBalanceBox") });
      }
      const txnO = (await fromTokenCI.deposit(baseAmount)).obj;
      txns.push({ ...txnO, xaid: fromAssetId, aamt: baseAmount, note: encodeNote("nnt200 deposit") });
    } else if (effectiveFromStd === TOKEN_STANDARD.ARC200_EXCHANGE && fromRedeem) {
      if (p1 > 0) {
        const txnO = (await fromTokenCI.arc200_approve(appAddrStr(fromId), baseAmount)).obj;
        txns.push({ ...txnO, payment: 28500, note: encodeNote("arc200 approve redeem") });
      }
      const txnO = (await fromRedeem.arc200_redeem(baseAmount)).obj;
      txns.push({ ...txnO, xaid: fromAssetId, aamt: baseAmount, note: encodeNote("arc200_redeem deposit") });
    }

    // --- Approve pool to spend input ---
    {
      const txnO = (await fromTokenCI.arc200_approve(poolAddr, approvalAmount)).obj;
      txns.push({ ...txnO, payment: p2 > 0 ? 28502 : 0, note: encodeNote("arc200 approve") });
    }

    // --- Ensure output token balance box ---
    if (p3 > 0) {
      const txnO = (await toTokenCI.arc200_transfer(poolAddr, 0n)).obj;
      txns.push({ ...txnO, payment: 28501, note: encodeNote("ensure output balance") });
    }

    // --- Swap ---
    {
      const txnO = (await pool[swapMethod](0, baseAmount, minOutBI)).obj;
      txns.push({ ...txnO, payment: escrowTopUp, note: encodeNote(`swap ${swapAForB ? "A->B" : "B->A"}`) });
    }

    // --- Post-swap: unwrap output token if needed ---
    if (toStd === TOKEN_STANDARD.NETWORK) {
      const txnO = (await toTokenCI.withdraw(simOutput)).obj;
      txns.push({ ...txnO, note: encodeNote("nt200 withdraw") });
    } else if (toStd === TOKEN_STANDARD.ASA && toAssetId != null) {
      const txnO = (await toTokenCI.withdraw(simOutput)).obj;
      const optInFields = toAsaOptIn
        ? { xaid: toAssetId, snd: sender, arcv: sender, apas: [toAssetId] }
        : { apas: [toAssetId] };
      txns.push({ ...txnO, ...optInFields, note: encodeNote("nnt200 withdraw") });
    } else if (toStd === TOKEN_STANDARD.ARC200_EXCHANGE && toRedeem) {
      const txnO = (await toRedeem.arc200_swapBack(simOutput)).obj;
      const fields = {};
      if (toAssetId != null) fields.apas = [toAssetId];
      txns.push({ ...txnO, ...fields, note: encodeNote("arc200_swapBack withdraw") });
    }

    return txns;
  }, { strategies: ["default", "merge"] });

  const expectedOutput = fromBaseUnits(simOutput, toDecimals);
  const rate = Number(amount) > 0 ? Number(expectedOutput) / Number(amount) : 0;

  return {
    transactions: customTx.txns,
    details: {
      action: "swap",
      chain,
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      fromAmount: amount.toString(),
      expectedOutput,
      minReceived: fromBaseUnits(minOutBI, toDecimals),
      slippage,
      poolId: bestPool.poolId,
      rate,
      sender,
    },
  };
}

export async function prepareAddLiquidity(chain, poolId, amountA, amountB, sender) {
  const algod = getAlgodClient(chain);
  const indexer = getIndexerClient(chain);
  const info = await getPoolInfo(chain, poolId);
  const tokA = Number(info.tokA ?? info[4]);
  const tokB = Number(info.tokB ?? info[5]);

  const tokenAres = await resolveToken(chain, String(normalizeTokenId(tokA)));
  const tokenBres = await resolveToken(chain, String(normalizeTokenId(tokB)));
  const decA = tokenAres?.decimals ?? 6;
  const decB = tokenBres?.decimals ?? 6;
  const stdA = tokenAres?.tokenStandard ?? TOKEN_STANDARD.ARC200;
  const stdB = tokenBres?.tokenStandard ?? TOKEN_STANDARD.ARC200;

  const baseA = toBaseUnits(amountA, decA);
  const baseB = toBaseUnits(amountB, decB);
  const poolAddr = appAddrStr(poolId);
  const normA = normalizeTokenId(tokA);
  const normB = normalizeTokenId(tokB);

  const signer = makeSigner(sender);
  const ci = new CONTRACT(poolId, algod, indexer, abi.custom, signer);
  const poolCI = new CONTRACT(poolId, algod, indexer, poolABI, signer, true, false, true);
  const tokenACI = new CONTRACT(normA, algod, indexer, abiForStandard(stdA), signer, true, false, true);
  const tokenBCI = new CONTRACT(normB, algod, indexer, abiForStandard(stdB), signer, true, false, true);

  const customTx = await tryPermutations(ci, ADD_LIQ_FLAGS, async ([p1, p2, p3, p4]) => {
    const txns = [];

    if (stdA === TOKEN_STANDARD.NETWORK) {
      if (p1 > 0) {
        const txnO = (await tokenACI.createBalanceBox(sender)).obj;
        txns.push({ ...txnO, payment: 28500, note: encodeNote("nt200 createBalanceBox A") });
      }
      const txnO = (await tokenACI.deposit(baseA)).obj;
      txns.push({ ...txnO, payment: baseA, note: encodeNote("nt200 deposit A") });
    }

    {
      const txnO = (await tokenACI.arc200_approve(poolAddr, baseA + baseA / 10n)).obj;
      txns.push({ ...txnO, payment: p2 > 0 ? 28502 : 0, note: encodeNote("arc200 approve A") });
    }

    if (stdB === TOKEN_STANDARD.NETWORK) {
      if (p3 > 0) {
        const txnO = (await tokenBCI.createBalanceBox(sender)).obj;
        txns.push({ ...txnO, payment: 28500, note: encodeNote("nt200 createBalanceBox B") });
      }
      const txnO = (await tokenBCI.deposit(baseB)).obj;
      txns.push({ ...txnO, payment: baseB, note: encodeNote("nt200 deposit B") });
    }

    {
      const txnO = (await tokenBCI.arc200_approve(poolAddr, baseB + baseB / 10n)).obj;
      txns.push({ ...txnO, payment: p4 > 0 ? 28502 : 0, note: encodeNote("arc200 approve B") });
    }

    {
      const txnO = (await poolCI.Provider_deposit(1, [baseA, baseB], 0n)).obj;
      txns.push({ ...txnO, payment: 1e5, note: encodeNote("provider deposit") });
    }

    return txns;
  });

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
  const indexer = getIndexerClient(chain);
  const info = await getPoolInfo(chain, poolId);
  const tokA = Number(info.tokA ?? info[4]);
  const tokB = Number(info.tokB ?? info[5]);

  const tokenAres = await resolveToken(chain, String(normalizeTokenId(tokA)));
  const tokenBres = await resolveToken(chain, String(normalizeTokenId(tokB)));
  const stdA = tokenAres?.tokenStandard ?? TOKEN_STANDARD.ARC200;
  const stdB = tokenBres?.tokenStandard ?? TOKEN_STANDARD.ARC200;

  const baseLP = toBaseUnits(lpAmount, 6);
  const signer = makeSigner(sender);
  const ci = new CONTRACT(poolId, algod, indexer, abi.custom, signer);
  const poolCI = new CONTRACT(poolId, algod, indexer, poolABI, signer, true, false, true);

  let tokenACI, tokenBCI;
  if (stdA === TOKEN_STANDARD.NETWORK) {
    tokenACI = new CONTRACT(normalizeTokenId(tokA), algod, indexer, abi.nt200, signer, true, false, true);
  }
  if (stdB === TOKEN_STANDARD.NETWORK) {
    tokenBCI = new CONTRACT(normalizeTokenId(tokB), algod, indexer, abi.nt200, signer, true, false, true);
  }

  const customTx = await tryPermutations(ci, REMOVE_LIQ_FLAGS, async ([p1, p2]) => {
    const txns = [];

    {
      const txnO = (await poolCI.Provider_withdraw(1, baseLP, [0n, 0n])).obj;
      txns.push({ ...txnO, payment: 1e5, note: encodeNote("provider withdraw") });
    }

    if (stdA === TOKEN_STANDARD.NETWORK && tokenACI) {
      const txnO = (await tokenACI.withdraw(p1 > 0 ? 1n : 0n)).obj;
      txns.push({ ...txnO, note: encodeNote("nt200 withdraw A") });
    }

    if (stdB === TOKEN_STANDARD.NETWORK && tokenBCI) {
      const txnO = (await tokenBCI.withdraw(p2 > 0 ? 1n : 0n)).obj;
      txns.push({ ...txnO, note: encodeNote("nt200 withdraw B") });
    }

    return txns;
  });

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
