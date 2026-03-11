import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../data/contracts.json");

function getConfig(chain) {
  const c = config[chain];
  if (!c) throw new Error(`Unsupported chain: ${chain}`);
  return c;
}

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  return res.json();
}

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  return res.json();
}

// --- Pools ---

export async function fetchPools(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/pools`);
}

export async function fetchPoolById(chain, poolId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/pools/${poolId}`);
}

export async function fetchPoolDetails(chain, poolId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/pools/${poolId}/details`);
}

export async function fetchPoolAnalytics(chain, poolId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/pools/${poolId}/analytics`);
}

export async function fetchPoolStats(chain, poolId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/pools/${poolId}/stats`);
}

export async function fetchAllPoolsStats(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/pools/stats`);
}

export async function fetchPoolsCompare(chain, poolIds) {
  const c = getConfig(chain);
  const params = poolIds.map((id) => `poolIds=${id}`).join("&");
  return get(`${c.apiUrl}/pools/compare?${params}`);
}

export async function fetchPoolsBulk(chain, poolIds) {
  const c = getConfig(chain);
  return post(`${c.apiUrl}/pools/bulk`, { poolIds });
}

// --- Tokens ---

export async function fetchTokens(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/tokens`);
}

export async function fetchTokenById(chain, assetId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/tokens/${assetId}`);
}

export async function fetchTokenMetadata(chain, assetId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/tokens/${assetId}/metadata`);
}

export async function fetchTokenStats(chain, assetId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/tokens/${assetId}/stats`);
}

export async function fetchTokenPools(chain, assetId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/tokens/${assetId}/pools`);
}

export async function fetchAllTokensStats(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/tokens/stats`);
}

export async function fetchTokenRankings(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/tokens/rankings`);
}

export async function fetchTokenSearch(chain, query) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/tokens/search?q=${encodeURIComponent(query)}`);
}

export async function fetchTokensBulk(chain, assetIds) {
  const c = getConfig(chain);
  return post(`${c.apiUrl}/tokens/bulk`, { assetIds });
}

// --- Prices ---

export async function fetchPrices(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/prices`);
}

export async function fetchTokenPrice(chain, tokenId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/prices/${tokenId}`);
}

export async function fetchPriceHistory(chain, tokenId, params = {}) {
  const c = getConfig(chain);
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  ).toString();
  const url = `${c.apiUrl}/prices/${tokenId}/history${qs ? `?${qs}` : ""}`;
  return get(url);
}

export async function fetchPriceTrends(chain, tokenId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/prices/${tokenId}/trends`);
}

export async function fetchPriceAggregated(chain, tokenId) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/prices/${tokenId}/aggregated`);
}

// --- Protocol ---

export async function fetchProtocolStats(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/protocol/stats`);
}

// --- Arbitrage ---

export async function fetchArbitrageOpportunities(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/arbitrage/opportunities`);
}

export async function fetchTriangularArbitrage(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/arbitrage/triangular`);
}

export async function fetchArbitrageDiagnostics(chain) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/arbitrage/diagnostics`);
}

// --- Router ---

export async function fetchSwapRoute(chain, tokenA, tokenB) {
  const c = getConfig(chain);
  return get(`${c.apiUrl}/router/${tokenA}/${tokenB}`);
}

// --- Integrations ---

export async function fetchTickers(chain) {
  const c = getConfig(chain);
  return get(c.tickerUrl);
}
