import { fetchTokens, fetchTickers } from "./api.js";
import { WVOI_ID, normalizeTokenId } from "./client.js";

const VOI_TOKEN = {
  tokenId: 0,
  contractId: WVOI_ID,
  name: "Voi",
  symbol: "VOI",
  decimals: 6,
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
  return list.filter((t) => t.symbol !== "wVOI");
}

export async function getTickers(chain) {
  return fetchTickers(chain);
}

export async function resolveToken(chain, symbolOrId) {
  const tokens = await getTokens(chain);

  if (typeof symbolOrId === "string" && symbolOrId.toUpperCase() === "VOI") {
    return VOI_TOKEN;
  }

  const asNum = Number(symbolOrId);
  if (!isNaN(asNum) && asNum > 0) {
    const byContract = tokens.find(
      (t) => t.contractId === asNum || t.tokenId === asNum
    );
    if (byContract) return byContract;
  }

  if (typeof symbolOrId === "string") {
    const upper = symbolOrId.toUpperCase();
    const bySymbol = tokens.find((t) => t.symbol?.toUpperCase() === upper);
    if (bySymbol) return bySymbol;
  }

  return null;
}

export function getTokenContractId(token) {
  if (!token) return null;
  if (token.contractId !== undefined) return normalizeTokenId(token.contractId);
  if (token.tokenId !== undefined) return normalizeTokenId(token.tokenId);
  return null;
}
