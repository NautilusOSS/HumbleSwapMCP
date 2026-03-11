import { z } from "zod";
import { getTokens, getTickers } from "../lib/tokens.js";
import {
  fetchTokenSearch,
  fetchTokenMetadata,
  fetchTokenStats,
  fetchTokenPools,
  fetchAllTokensStats,
  fetchTokenRankings,
} from "../lib/api.js";
import { DEFAULT_CHAIN } from "../lib/client.js";
import { jsonContent } from "../lib/utils.js";

export function registerTokenTools(server) {
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
      const tokens = await getTokens(DEFAULT_CHAIN);
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
      const tickers = await getTickers(DEFAULT_CHAIN);
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
      const results = await fetchTokenSearch(DEFAULT_CHAIN, query);
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
      const metadata = await fetchTokenMetadata(DEFAULT_CHAIN, assetId);
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
      const stats = await fetchTokenStats(DEFAULT_CHAIN, assetId);
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
      const pools = await fetchTokenPools(DEFAULT_CHAIN, assetId);
      return jsonContent(pools);
    }
  );

  server.tool(
    "get_all_tokens_stats",
    "Get comprehensive statistics across all tokens on Humble Swap.",
    {},
    async () => {
      const stats = await fetchAllTokensStats(DEFAULT_CHAIN);
      return jsonContent(stats);
    }
  );

  server.tool(
    "get_token_rankings",
    "Get token rankings by volume, liquidity, price change, and other metrics.",
    {},
    async () => {
      const rankings = await fetchTokenRankings(DEFAULT_CHAIN);
      return jsonContent(rankings);
    }
  );
}
