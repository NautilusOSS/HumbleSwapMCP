import { createRequire } from "module";
const require = createRequire(import.meta.url);
const standardsDB = require("../data/token-standards.json");

export const TOKEN_STANDARD = {
  NETWORK: "network",
  ASA: "asa",
  ARC200: "arc200",
  ARC200_EXCHANGE: "arc200-exchange",
};

export const arc200RedeemABI = {
  name: "arc200_redeem",
  description: "ARC-200 ASA wrapper (redeem/exchange)",
  methods: [
    {
      name: "arc200_redeem",
      args: [{ type: "uint64", name: "amount" }],
      readonly: false,
      returns: { type: "void" },
      desc: "Redeem ASA for ARC-200",
    },
    {
      name: "arc200_swapBack",
      args: [{ type: "uint64", name: "amount" }],
      readonly: false,
      returns: { type: "void" },
      desc: "Swap ARC-200 back to ASA",
    },
    {
      name: "arc200_exchange",
      args: [],
      readonly: false,
      returns: { type: "(uint64,address)" },
      desc: "ARC-200 exchange info",
    },
  ],
  events: [],
};

/**
 * Look up the token standard for a given contract ID on a chain.
 * Returns { standard, assetId? } or a default of "arc200" for unknown tokens.
 */
export function getTokenStandard(chain, contractId) {
  const chainDB = standardsDB[chain];
  if (!chainDB) return { standard: TOKEN_STANDARD.ARC200 };
  const entry = chainDB[String(contractId)];
  if (!entry) return { standard: TOKEN_STANDARD.ARC200 };
  return entry;
}
