import { CONTRACT, swap } from "ulujs";
import { getAlgodClient, getIndexerClient, makeSigner, normalizeTokenId } from "./client.js";
import { findBestPool, getPoolInfo, isFromTokenA } from "./pools.js";
import { resolveToken, getTokenContractId } from "./tokens.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const poolABI = require("../data/pool-abi.json");

const DUMMY_ADDR = "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ";

function toBaseUnits(amount, decimals) {
  const parts = String(amount).split(".");
  const whole = parts[0];
  const frac = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + frac);
}

function fromBaseUnits(value, decimals) {
  const s = String(value).padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = s.slice(s.length - decimals);
  return `${whole}.${frac}`.replace(/\.?0+$/, "") || "0";
}

export async function getQuote(chain, fromSymbol, toSymbol, amount, slippage = 5) {
  const fromToken = await resolveToken(chain, fromSymbol);
  if (!fromToken) throw new Error(`Token "${fromSymbol}" not found`);
  const toToken = await resolveToken(chain, toSymbol);
  if (!toToken) throw new Error(`Token "${toSymbol}" not found`);

  const fromId = getTokenContractId(fromToken);
  const toId = getTokenContractId(toToken);
  if (!fromId || !toId) throw new Error("Cannot resolve token contract IDs");
  if (fromId === toId) throw new Error("From and to tokens must be different");

  const pool = await findBestPool(chain, fromId, toId);
  if (!pool) throw new Error(`No pool found for ${fromSymbol}/${toSymbol}`);

  const algod = getAlgodClient(chain);
  const indexer = getIndexerClient(chain);

  const info = await getPoolInfo(chain, pool.poolId);

  const fromDecimals = fromToken.decimals ?? 6;
  const toDecimals = toToken.decimals ?? 6;
  const amountBI = toBaseUnits(amount, fromDecimals);

  const acc = makeSigner(DUMMY_ADDR);
  const ci = new CONTRACT(pool.poolId, algod, indexer, { ...poolABI, events: [] }, acc);
  ci.setFee(4000);

  const swapAForB = isFromTokenA(pool, fromId);
  let outAmount;

  if (swapAForB) {
    const result = await ci.Trader_swapAForB(1, amountBI, 0n);
    if (!result.success) throw new Error("Swap simulation failed");
    outAmount = BigInt(result.returnValue[1]);
  } else {
    const result = await ci.Trader_swapBForA(1, amountBI, 0n);
    if (!result.success) throw new Error("Swap simulation failed");
    outAmount = BigInt(result.returnValue[0]);
  }

  const toAmountStr = fromBaseUnits(outAmount, toDecimals);
  const fromAmountNum = Number(amount);
  const toAmountNum = Number(toAmountStr);
  const rate = fromAmountNum > 0 ? toAmountNum / fromAmountNum : 0;
  const inverseRate = toAmountNum > 0 ? fromAmountNum / toAmountNum : 0;

  const totFee = Number(info.protoInfo?.totFee ?? info[2]?.[2] ?? 30);
  const feePercent = totFee / 100;
  const feeAmount = fromAmountNum * totFee / 10000;

  const balA = Number(info.poolBals?.A ?? info[0]?.[0] ?? 0);
  const balB = Number(info.poolBals?.B ?? info[0]?.[1] ?? 0);
  const spotRate = swapAForB
    ? (balB / balA) * Math.pow(10, fromDecimals - toDecimals)
    : (balA / balB) * Math.pow(10, fromDecimals - toDecimals);
  const priceImpact = spotRate > 0 ? Math.abs((rate - spotRate) / spotRate) * 100 : 0;

  const minReceived = toAmountNum * (1 - slippage / 100);

  return {
    poolId: pool.poolId,
    fromToken: { symbol: fromToken.symbol, contractId: fromId, decimals: fromDecimals },
    toToken: { symbol: toToken.symbol, contractId: toId, decimals: toDecimals },
    fromAmount: amount.toString(),
    toAmount: toAmountStr,
    rate,
    inverseRate,
    fee: feeAmount.toFixed(fromDecimals),
    feePercent,
    priceImpact: priceImpact.toFixed(4),
    minReceived: minReceived.toFixed(toDecimals),
    slippage,
  };
}
