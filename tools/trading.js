import { z } from "zod";
import { getQuote } from "../lib/quote.js";
import { prepareSwap, prepareAddLiquidity, prepareRemoveLiquidity } from "../lib/builders.js";
import {
  fetchProtocolStats,
  fetchArbitrageOpportunities,
  fetchTriangularArbitrage,
  fetchSwapRoute,
} from "../lib/api.js";
import { DEFAULT_CHAIN } from "../lib/client.js";
import { jsonContent } from "../lib/utils.js";

export function registerTradingTools(server) {
  // --- Protocol ---

  server.tool(
    "get_protocol_stats",
    "Get protocol-wide statistics for Humble Swap (total TVL, volume, number of pools, etc.).",
    {},
    async () => {
      const stats = await fetchProtocolStats(DEFAULT_CHAIN);
      return jsonContent(stats);
    }
  );

  // --- Arbitrage ---

  server.tool(
    "get_arbitrage_opportunities",
    "Detect current arbitrage opportunities across Humble Swap pools.",
    {},
    async () => {
      const opportunities = await fetchArbitrageOpportunities(DEFAULT_CHAIN);
      return jsonContent(opportunities);
    }
  );

  server.tool(
    "get_triangular_arbitrage",
    "Detect triangular arbitrage opportunities (A->B->C->A cycles) across Humble Swap pools.",
    {},
    async () => {
      const opportunities = await fetchTriangularArbitrage(DEFAULT_CHAIN);
      return jsonContent(opportunities);
    }
  );

  // --- Router ---

  server.tool(
    "get_swap_route",
    "Find all possible swap paths between two tokens, including multi-hop routes. Useful for tokens without a direct pool.",
    {
      tokenA: z.string().describe("Source token symbol or contract ID"),
      tokenB: z.string().describe("Destination token symbol or contract ID"),
    },
    async ({ tokenA, tokenB }) => {
      const route = await fetchSwapRoute(DEFAULT_CHAIN, tokenA, tokenB);
      return jsonContent(route);
    }
  );

  // --- Quote ---

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
      const quote = await getQuote(DEFAULT_CHAIN, fromToken, toToken, amount, slippage);
      return jsonContent(quote);
    }
  );

  // --- Transaction preparation ---

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
      const result = await prepareSwap(DEFAULT_CHAIN, fromToken, toToken, amount, sender, slippage);
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
      const result = await prepareAddLiquidity(DEFAULT_CHAIN, poolId, amountA, amountB, sender);
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
      const result = await prepareRemoveLiquidity(DEFAULT_CHAIN, poolId, lpAmount, sender);
      return jsonContent(result);
    }
  );
}
