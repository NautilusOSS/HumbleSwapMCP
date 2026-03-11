import { z } from "zod";
import {
  fetchPrices,
  fetchTokenPrice,
  fetchPriceHistory,
  fetchPriceTrends,
  fetchPriceAggregated,
} from "../lib/api.js";
import { DEFAULT_CHAIN } from "../lib/client.js";
import { jsonContent } from "../lib/utils.js";

export function registerPriceTools(server) {
  server.tool(
    "get_prices",
    "Get current prices for all tokens on Humble Swap.",
    {},
    async () => {
      const prices = await fetchPrices(DEFAULT_CHAIN);
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
      const price = await fetchTokenPrice(DEFAULT_CHAIN, tokenId);
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
      const history = await fetchPriceHistory(DEFAULT_CHAIN, tokenId, { period, interval });
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
      const trends = await fetchPriceTrends(DEFAULT_CHAIN, tokenId);
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
      const aggregated = await fetchPriceAggregated(DEFAULT_CHAIN, tokenId);
      return jsonContent(aggregated);
    }
  );
}
