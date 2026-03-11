import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getPools, getPoolInfo } from "./lib/pools.js";
import { getTokens, getTickers } from "./lib/tokens.js";
import { getQuote } from "./lib/quote.js";
import { prepareSwap, prepareAddLiquidity, prepareRemoveLiquidity } from "./lib/builders.js";
import {
  fetchPoolDetails,
  fetchPoolAnalytics,
  fetchPoolStats,
  fetchAllPoolsStats,
  fetchPoolsCompare,
  fetchTokenSearch,
  fetchTokenMetadata,
  fetchTokenStats,
  fetchTokenPools,
  fetchAllTokensStats,
  fetchTokenRankings,
  fetchPrices,
  fetchTokenPrice,
  fetchPriceHistory,
  fetchPriceTrends,
  fetchPriceAggregated,
  fetchProtocolStats,
  fetchArbitrageOpportunities,
  fetchTriangularArbitrage,
  fetchSwapRoute,
} from "./lib/api.js";

const server = new McpServer({
  name: "humble-swap-mcp",
  version: "0.2.0",
});

function jsonContent(data) {
  const text = JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  return { content: [{ type: "text", text }] };
}

// ============================================================
// Pool tools
// ============================================================

server.tool(
  "get_pools",
  "List Humble Swap pools with token pairs, liquidity, and volume data. Voi mainnet.",
  {
    symbol: z
      .string()
      .optional()
      .describe("Filter pools containing this token symbol"),
  },
  async ({ symbol }) => {
    const pools = await getPools("voi");
    let results = pools;
    if (symbol) {
      const upper = symbol.toUpperCase();
      results = pools.filter(
        (p) =>
          p.symbolA?.toUpperCase() === upper ||
          p.symbolB?.toUpperCase() === upper ||
          p.symA?.toUpperCase() === upper ||
          p.symB?.toUpperCase() === upper
      );
    }
    return jsonContent(results);
  }
);

server.tool(
  "get_pool",
  "Get detailed on-chain info for a specific Humble Swap pool (balances, fees, LP supply).",
  {
    poolId: z.number().describe("Pool application ID"),
  },
  async ({ poolId }) => {
    const info = await getPoolInfo("voi", poolId);
    return jsonContent(info);
  }
);

server.tool(
  "get_pool_details",
  "Get detailed pool information from the Humble API including token pair, balances, and configuration.",
  {
    poolId: z.number().describe("Pool application ID"),
  },
  async ({ poolId }) => {
    const details = await fetchPoolDetails("voi", poolId);
    return jsonContent(details);
  }
);

server.tool(
  "get_pool_analytics",
  "Get pool analytics including TVL, liquidity depth, and concentration metrics.",
  {
    poolId: z.number().describe("Pool application ID"),
  },
  async ({ poolId }) => {
    const analytics = await fetchPoolAnalytics("voi", poolId);
    return jsonContent(analytics);
  }
);

server.tool(
  "get_pool_stats",
  "Get comprehensive statistics for a specific pool (volume, fees, APR, etc.).",
  {
    poolId: z.number().describe("Pool application ID"),
  },
  async ({ poolId }) => {
    const stats = await fetchPoolStats("voi", poolId);
    return jsonContent(stats);
  }
);

server.tool(
  "get_all_pools_stats",
  "Get comprehensive statistics across all Humble Swap pools.",
  {},
  async () => {
    const stats = await fetchAllPoolsStats("voi");
    return jsonContent(stats);
  }
);

server.tool(
  "compare_pools",
  "Compare multiple pools side by side (liquidity, volume, fees, etc.).",
  {
    poolIds: z.array(z.number()).min(2).describe("Array of pool application IDs to compare"),
  },
  async ({ poolIds }) => {
    const comparison = await fetchPoolsCompare("voi", poolIds);
    return jsonContent(comparison);
  }
);

// ============================================================
// Token tools
// ============================================================

server.tool(
  "get_tokens",
  "List tokens available on Humble Swap with contract IDs and decimals. Voi mainnet.",
  {
    symbol: z
      .string()
      .optional()
      .describe("Filter by token symbol"),
  },
  async ({ symbol }) => {
    const tokens = await getTokens("voi");
    let results = tokens;
    if (symbol) {
      const upper = symbol.toUpperCase();
      results = tokens.filter((t) => t.symbol?.toUpperCase() === upper);
    }
    return jsonContent(results);
  }
);

server.tool(
  "get_tickers",
  "Get price ticker data for Humble Swap trading pairs.",
  {},
  async () => {
    const tickers = await getTickers("voi");
    return jsonContent(tickers);
  }
);

server.tool(
  "search_tokens",
  "Search Humble Swap tokens by name or symbol.",
  {
    query: z.string().describe("Search query (name or symbol)"),
  },
  async ({ query }) => {
    const results = await fetchTokenSearch("voi", query);
    return jsonContent(results);
  }
);

server.tool(
  "get_token_metadata",
  "Get enriched metadata for a token including name, symbol, decimals, and additional info.",
  {
    assetId: z.number().describe("Token asset / contract ID"),
  },
  async ({ assetId }) => {
    const metadata = await fetchTokenMetadata("voi", assetId);
    return jsonContent(metadata);
  }
);

server.tool(
  "get_token_stats",
  "Get comprehensive statistics for a specific token (volume, price change, holder count, etc.).",
  {
    assetId: z.number().describe("Token asset / contract ID"),
  },
  async ({ assetId }) => {
    const stats = await fetchTokenStats("voi", assetId);
    return jsonContent(stats);
  }
);

server.tool(
  "get_token_pools",
  "Get pool statistics for all pools containing a specific token.",
  {
    assetId: z.number().describe("Token asset / contract ID"),
  },
  async ({ assetId }) => {
    const pools = await fetchTokenPools("voi", assetId);
    return jsonContent(pools);
  }
);

server.tool(
  "get_all_tokens_stats",
  "Get comprehensive statistics across all tokens on Humble Swap.",
  {},
  async () => {
    const stats = await fetchAllTokensStats("voi");
    return jsonContent(stats);
  }
);

server.tool(
  "get_token_rankings",
  "Get token rankings by volume, liquidity, price change, and other metrics.",
  {},
  async () => {
    const rankings = await fetchTokenRankings("voi");
    return jsonContent(rankings);
  }
);

// ============================================================
// Price tools
// ============================================================

server.tool(
  "get_prices",
  "Get current prices for all tokens on Humble Swap.",
  {},
  async () => {
    const prices = await fetchPrices("voi");
    return jsonContent(prices);
  }
);

server.tool(
  "get_token_price",
  "Get current price data for a specific token.",
  {
    tokenId: z.number().describe("Token contract ID"),
  },
  async ({ tokenId }) => {
    const price = await fetchTokenPrice("voi", tokenId);
    return jsonContent(price);
  }
);

server.tool(
  "get_price_history",
  "Get historical price data for a token over a given period.",
  {
    tokenId: z.number().describe("Token contract ID"),
    period: z.string().optional().describe("Time period (e.g. '24h', '7d', '30d')"),
    interval: z.string().optional().describe("Data point interval (e.g. '1h', '1d')"),
  },
  async ({ tokenId, period, interval }) => {
    const history = await fetchPriceHistory("voi", tokenId, { period, interval });
    return jsonContent(history);
  }
);

server.tool(
  "get_price_trends",
  "Get price trend analytics for a token including momentum and moving averages.",
  {
    tokenId: z.number().describe("Token contract ID"),
  },
  async ({ tokenId }) => {
    const trends = await fetchPriceTrends("voi", tokenId);
    return jsonContent(trends);
  }
);

server.tool(
  "get_price_aggregated",
  "Get aggregated price for a token across multiple pool sources.",
  {
    tokenId: z.number().describe("Token contract ID"),
  },
  async ({ tokenId }) => {
    const aggregated = await fetchPriceAggregated("voi", tokenId);
    return jsonContent(aggregated);
  }
);

// ============================================================
// Protocol tools
// ============================================================

server.tool(
  "get_protocol_stats",
  "Get protocol-wide statistics for Humble Swap (total TVL, volume, number of pools, etc.).",
  {},
  async () => {
    const stats = await fetchProtocolStats("voi");
    return jsonContent(stats);
  }
);

// ============================================================
// Arbitrage tools
// ============================================================

server.tool(
  "get_arbitrage_opportunities",
  "Detect current arbitrage opportunities across Humble Swap pools.",
  {},
  async () => {
    const opportunities = await fetchArbitrageOpportunities("voi");
    return jsonContent(opportunities);
  }
);

server.tool(
  "get_triangular_arbitrage",
  "Detect triangular arbitrage opportunities (A->B->C->A cycles) across Humble Swap pools.",
  {},
  async () => {
    const opportunities = await fetchTriangularArbitrage("voi");
    return jsonContent(opportunities);
  }
);

// ============================================================
// Router tools
// ============================================================

server.tool(
  "get_swap_route",
  "Find all possible swap paths between two tokens, including multi-hop routes. Useful for tokens without a direct pool.",
  {
    tokenA: z.string().describe("Source token symbol or contract ID"),
    tokenB: z.string().describe("Destination token symbol or contract ID"),
  },
  async ({ tokenA, tokenB }) => {
    const route = await fetchSwapRoute("voi", tokenA, tokenB);
    return jsonContent(route);
  }
);

// ============================================================
// Quote tool
// ============================================================

server.tool(
  "get_quote",
  "Simulate a swap and get a quote with expected output, rate, fee, price impact, and minimum received. No transaction is built or signed.",
  {
    fromToken: z.string().describe("From token symbol or contract ID (e.g. 'VOI', 'aUSDC', '395614')"),
    toToken: z.string().describe("To token symbol or contract ID"),
    amount: z.string().describe("Amount to swap in human-readable units (e.g. '100' for 100 VOI)"),
    slippage: z
      .number()
      .optional()
      .default(5)
      .describe("Allowed slippage percentage (default 5)"),
  },
  async ({ fromToken, toToken, amount, slippage }) => {
    const quote = await getQuote("voi", fromToken, toToken, amount, slippage);
    return jsonContent(quote);
  }
);

// ============================================================
// Transaction preparation tools
// ============================================================

server.tool(
  "swap_txn",
  "Build unsigned transactions to swap tokens on Humble Swap. Returns base64-encoded transactions for signing via UluWalletMCP.",
  {
    fromToken: z.string().describe("From token symbol or contract ID"),
    toToken: z.string().describe("To token symbol or contract ID"),
    amount: z.string().describe("Amount to swap in human-readable units"),
    sender: z.string().describe("Sender wallet address"),
    slippage: z
      .number()
      .optional()
      .default(5)
      .describe("Allowed slippage percentage (default 5)"),
  },
  async ({ fromToken, toToken, amount, sender, slippage }) => {
    const result = await prepareSwap("voi", fromToken, toToken, amount, sender, slippage);
    return jsonContent(result);
  }
);

server.tool(
  "add_liquidity_txn",
  "Build unsigned transactions to add liquidity to a Humble Swap pool. Returns base64-encoded transactions for signing.",
  {
    poolId: z.number().describe("Pool application ID"),
    amountA: z.string().describe("Amount of token A in human-readable units"),
    amountB: z.string().describe("Amount of token B in human-readable units"),
    sender: z.string().describe("Sender wallet address"),
  },
  async ({ poolId, amountA, amountB, sender }) => {
    const result = await prepareAddLiquidity("voi", poolId, amountA, amountB, sender);
    return jsonContent(result);
  }
);

server.tool(
  "remove_liquidity_txn",
  "Build unsigned transactions to remove liquidity from a Humble Swap pool. Returns base64-encoded transactions for signing.",
  {
    poolId: z.number().describe("Pool application ID"),
    lpAmount: z.string().describe("Amount of LP tokens to burn in human-readable units"),
    sender: z.string().describe("Sender wallet address"),
  },
  async ({ poolId, lpAmount, sender }) => {
    const result = await prepareRemoveLiquidity("voi", poolId, lpAmount, sender);
    return jsonContent(result);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
