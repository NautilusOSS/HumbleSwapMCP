import algosdk from "algosdk";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../data/contracts.json");

const WVOI_ID = 390001;

export function getChainConfig(chain) {
  const c = config[chain];
  if (!c) throw new Error(`Unsupported chain: ${chain}. Use "voi".`);
  return c;
}

export function getAlgodClient(chain) {
  const c = getChainConfig(chain);
  return new algosdk.Algodv2(c.algodToken || "", c.algodUrl, c.algodPort);
}

export function getIndexerClient(chain) {
  const c = getChainConfig(chain);
  return new algosdk.Indexer("", c.indexerUrl, 443);
}

export function isNativeToken(contractIdOrSymbol) {
  if (typeof contractIdOrSymbol === "number") {
    return contractIdOrSymbol === 0 || contractIdOrSymbol === WVOI_ID;
  }
  if (typeof contractIdOrSymbol === "string") {
    return contractIdOrSymbol.toUpperCase() === "VOI";
  }
  return false;
}

export function normalizeTokenId(id) {
  return id === 0 ? WVOI_ID : id;
}

export function tokenMatchesPool(tokenContractId, poolTokenId) {
  const a = normalizeTokenId(tokenContractId);
  const b = normalizeTokenId(poolTokenId);
  return a === b;
}

export function makeSigner(addr) {
  return { addr, sk: new Uint8Array() };
}

export function appAddrStr(appId) {
  const addr = algosdk.getApplicationAddress(appId);
  return algosdk.encodeAddress(addr.publicKey);
}

export function encodeNote(text) {
  return new TextEncoder().encode(text);
}

export { algosdk, WVOI_ID };
