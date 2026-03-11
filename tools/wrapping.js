import { z } from "zod";
import { deposit_nt200_txn, withdraw_nt200_txn } from "../lib/nt200.js";
import { deposit_nnt200_txn, withdraw_nnt200_txn } from "../lib/nnt200.js";
import { DEFAULT_CHAIN } from "../lib/client.js";
import { jsonContent } from "../lib/utils.js";

export function registerWrappingTools(server) {
  // --- NT200 (network token wrapper) ---

  server.tool(
    "deposit_nt200",
    "Deposit native network tokens (e.g. VOI) into an NT200 wrapper contract to receive ARC-200 wrapped tokens. Returns base64-encoded unsigned transactions for signing.",
    {
      appId: z.number().describe("NT200 wrapper contract application ID"),
      sender: z.string().describe("Sender wallet address"),
      amount: z.string().describe("Amount to deposit in human-readable units (e.g. '100' for 100 VOI)"),
      decimals: z
        .number()
        .optional()
        .default(6)
        .describe("Token decimals (default 6)"),
    },
    async ({ appId, sender, amount, decimals }) => {
      const result = await deposit_nt200_txn(DEFAULT_CHAIN, appId, sender, amount, decimals);
      return jsonContent(result);
    }
  );

  server.tool(
    "withdraw_nt200",
    "Withdraw native network tokens from an NT200 wrapper contract by burning ARC-200 wrapped tokens. Returns base64-encoded unsigned transactions for signing.",
    {
      appId: z.number().describe("NT200 wrapper contract application ID"),
      sender: z.string().describe("Sender wallet address"),
      amount: z.string().describe("Amount to withdraw in human-readable units"),
      decimals: z
        .number()
        .optional()
        .default(6)
        .describe("Token decimals (default 6)"),
    },
    async ({ appId, sender, amount, decimals }) => {
      const result = await withdraw_nt200_txn(DEFAULT_CHAIN, appId, sender, amount, decimals);
      return jsonContent(result);
    }
  );

  // --- NNT200 (non-network / ASA token wrapper) ---

  server.tool(
    "deposit_nnt200",
    "Deposit an ASA (non-network token) into an NNT200 wrapper contract to receive ARC-200 wrapped tokens. Returns base64-encoded unsigned transactions for signing.",
    {
      appId: z.number().describe("NNT200 wrapper contract application ID"),
      assetId: z.number().describe("Underlying ASA ID to deposit"),
      sender: z.string().describe("Sender wallet address"),
      amount: z.string().describe("Amount to deposit in human-readable units"),
      decimals: z
        .number()
        .optional()
        .default(6)
        .describe("Token decimals (default 6)"),
    },
    async ({ appId, assetId, sender, amount, decimals }) => {
      const result = await deposit_nnt200_txn(DEFAULT_CHAIN, appId, assetId, sender, amount, decimals);
      return jsonContent(result);
    }
  );

  server.tool(
    "withdraw_nnt200",
    "Withdraw an ASA (non-network token) from an NNT200 wrapper contract by burning ARC-200 wrapped tokens. Returns base64-encoded unsigned transactions for signing.",
    {
      appId: z.number().describe("NNT200 wrapper contract application ID"),
      assetId: z.number().describe("Underlying ASA ID to withdraw"),
      sender: z.string().describe("Sender wallet address"),
      amount: z.string().describe("Amount to withdraw in human-readable units"),
      decimals: z
        .number()
        .optional()
        .default(6)
        .describe("Token decimals (default 6)"),
    },
    async ({ appId, assetId, sender, amount, decimals }) => {
      const result = await withdraw_nnt200_txn(DEFAULT_CHAIN, appId, assetId, sender, amount, decimals);
      return jsonContent(result);
    }
  );
}
