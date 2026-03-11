import { CONTRACT } from "ulujs";
import { fetchTokens, fetchTickers } from "./api.js";
import { WVOI_ID, normalizeTokenId, getAlgodClient, getIndexerClient, makeSigner } from "./client.js";
import { getTokenStandard, TOKEN_STANDARD } from "./tokenStandard.js";

const CACHE_TTL = 60_000;
let tokenCache = null;
let tokenCacheChain = null;
let tokenCachedAt = 0;

const DUMMY_ADDR = "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ";
const arc200DecimalsABI = {
  name: "arc200",
  methods: [{ name: "arc200_decimals", args: [], returns: { type: "uint8" } }],
  events: [],
};
const decimalsCache = new Map();

async function lookupArc200Decimals(chain, contractId) {
  const key = `${chain}:${contractId}`;
  if (decimalsCache.has(key)) return decimalsCache.get(key);
  try {
    const algod = getAlgodClient(chain);
    const indexer = getIndexerClient(chain);
    const ci = new CONTRACT(contractId, algod, indexer, arc200DecimalsABI, makeSigner(DUMMY_ADDR));
    ci.setFee(4000);
    const result = await ci.arc200_decimals();
    if (result.success) {
      const decimals = Number(result.returnValue);
      decimalsCache.set(key, decimals);
      return decimals;
    }
  } catch (_) { /* fall through */ }
  return null;
}

const VOI_TOKEN = {
  tokenId: 0,
  contractId: WVOI_ID,
  name: "Voi",
  symbol: "VOI",
  decimals: 6,
  tokenStandard: TOKEN_STANDARD.NETWORK,
};

function extractTokensFromTickers(tickers) {
  const seen = new Map();
  for (const t of tickers) {
    const parts = t.ticker_id?.split("_");
    if (!parts || parts.length !== 2) continue;
    const [idA, idB] = parts.map(Number);

    const pairs = [
      { contractId: idA, symbol: t.base_currency },
      { contractId: idB, symbol: t.target_currency },
    ];
    for (const { contractId, symbol } of pairs) {
      if (!symbol || seen.has(contractId)) continue;
      seen.set(contractId, {
        tokenId: contractId,
        contractId,
        name: symbol,
        symbol,
        decimals: 6,
      });
    }
  }
  return [...seen.values()];
}

export async function getTokens(chain) {
  if (tokenCache && tokenCacheChain === chain && Date.now() - tokenCachedAt < CACHE_TTL) {
    return tokenCache;
  }

  const [tokens, tickers] = await Promise.all([
    fetchTokens(chain).catch(() => []),
    fetchTickers(chain).catch(() => []),
  ]);
  const list = Array.isArray(tokens) ? [...tokens] : [];

  const tickerTokens = extractTokensFromTickers(
    Array.isArray(tickers) ? tickers : []
  );
  const known = new Set(list.map((t) => t.contractId ?? t.tokenId));
  for (const tt of tickerTokens) {
    if (!known.has(tt.contractId)) {
      list.push(tt);
      known.add(tt.contractId);
    }
  }

  const hasVOI = list.some(
    (t) => t.symbol === "VOI" || t.tokenId === 0 || t.contractId === WVOI_ID
  );
  if (!hasVOI) {
    list.unshift(VOI_TOKEN);
  }

  const result = list.filter((t) => t.symbol !== "wVOI");
  tokenCache = result;
  tokenCacheChain = chain;
  tokenCachedAt = Date.now();
  return result;
}

export async function getTickers(chain) {
  return fetchTickers(chain);
}

export async function resolveToken(chain, symbolOrId) {
  const tokens = await getTokens(chain);

  if (typeof symbolOrId === "string" && symbolOrId.toUpperCase() === "VOI") {
    return VOI_TOKEN;
  }

  let token = null;
  const asNum = Number(symbolOrId);
  if (!isNaN(asNum) && asNum > 0) {
    token = tokens.find(
      (t) => t.contractId === asNum || t.tokenId === asNum
    );
  }

  if (!token && typeof symbolOrId === "string") {
    const upper = symbolOrId.toUpperCase();
    token = tokens.find((t) => t.symbol?.toUpperCase() === upper);
  }

  if (token && !token.tokenStandard) {
    const cid = normalizeTokenId(token.contractId ?? token.tokenId);
    const info = getTokenStandard(chain, cid);
    token = { ...token, tokenStandard: info.standard };
    if (info.assetId !== undefined) token.assetId = info.assetId;
    if (info.approvalBuffer !== undefined) token.approvalBuffer = info.approvalBuffer;
  }

  if (token && token.tokenStandard !== TOKEN_STANDARD.NETWORK) {
    const cid = normalizeTokenId(token.contractId ?? token.tokenId);
    const onChain = await lookupArc200Decimals(chain, cid);
    if (onChain !== null) token = { ...token, decimals: onChain };
  }

  return token;
}

export function getTokenContractId(token) {
  if (!token) return null;
  if (token.contractId !== undefined) return normalizeTokenId(token.contractId);
  if (token.tokenId !== undefined) return normalizeTokenId(token.tokenId);
  return null;
}
