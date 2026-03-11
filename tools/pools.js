import { z } from "zod";
import { getPools, getPoolInfo } from "../lib/pools.js";
import {
  fetchPoolDetails,
  fetchPoolAnalytics,
  fetchPoolStats,
  fetchAllPoolsStats,
  fetchPoolsCompare,
} from "../lib/api.js";
import { DEFAULT_CHAIN } from "../lib/client.js";
import { jsonContent } from "../lib/utils.js";

export function registerPoolTools(server) {
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
      const pools = await getPools(DEFAULT_CHAIN);
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
      const info = await getPoolInfo(DEFAULT_CHAIN, poolId);
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
      const details = await fetchPoolDetails(DEFAULT_CHAIN, poolId);
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
      const analytics = await fetchPoolAnalytics(DEFAULT_CHAIN, poolId);
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
      const stats = await fetchPoolStats(DEFAULT_CHAIN, poolId);
      return jsonContent(stats);
    }
  );

  server.tool(
    "get_all_pools_stats",
    "Get comprehensive statistics across all Humble Swap pools.",
    {},
    async () => {
      const stats = await fetchAllPoolsStats(DEFAULT_CHAIN);
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
      const comparison = await fetchPoolsCompare(DEFAULT_CHAIN, poolIds);
      return jsonContent(comparison);
    }
  );
}
