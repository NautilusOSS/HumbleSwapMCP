import { swap } from "ulujs";
import { fetchPools, fetchTickers } from "./api.js";
import { getAlgodClient, getIndexerClient, normalizeTokenId, tokenMatchesPool } from "./client.js";

function extractPoolsFromTickers(tickers) {
  const seen = new Map();
  for (const t of tickers) {
    const parts = t.ticker_id?.split("_");
    if (!parts || parts.length !== 2) continue;
    const poolId = Number(t.pool_id);
    if (!poolId || seen.has(poolId)) continue;
    const [tokA, tokB] = parts.map(Number);
    seen.set(poolId, { poolId, tokA, tokB });
  }
  return [...seen.values()];
}

export async function getPools(chain) {
  const pools = await fetchPools(chain).catch(() => []);
  const list = Array.isArray(pools) ? pools : [];
  if (list.length > 0) return list;

  const tickers = await fetchTickers(chain).catch(() => []);
  return extractPoolsFromTickers(Array.isArray(tickers) ? tickers : []);
}

export async function getPoolInfo(chain, poolId) {
  const algod = getAlgodClient(chain);
  const indexer = getIndexerClient(chain);
  const ci = new swap(poolId, algod, indexer);
  const result = await ci.Info();
  if (!result.success) throw new Error(`Failed to get pool info for ${poolId}`);
  return result.returnValue;
}

export async function findBestPool(chain, fromContractId, toContractId) {
  const pools = await getPools(chain);
  const fromId = normalizeTokenId(fromContractId);
  const toId = normalizeTokenId(toContractId);

  const eligible = pools.filter((p) => {
    const pA = normalizeTokenId(p.tokA);
    const pB = normalizeTokenId(p.tokB);
    const hasFrom = pA === fromId || pB === fromId;
    const hasTo = pA === toId || pB === toId;
    return hasFrom && hasTo && pA !== pB;
  });

  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  const algod = getAlgodClient(chain);
  const indexer = getIndexerClient(chain);
  let bestPool = null;
  let maxLP = 0n;

  for (const pool of eligible) {
    try {
      const ci = new swap(pool.poolId, algod, indexer);
      const info = await ci.Info();
      if (info.success) {
        const lpMinted = BigInt(info.returnValue.lptBals?.lpMinted ?? info.returnValue[1]?.[0] ?? 0);
        if (lpMinted > maxLP) {
          maxLP = lpMinted;
          bestPool = pool;
        }
      }
    } catch {
      continue;
    }
  }

  return bestPool || eligible[0];
}

export function isFromTokenA(pool, fromContractId) {
  return tokenMatchesPool(fromContractId, pool.tokA);
}
