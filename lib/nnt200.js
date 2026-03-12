import { abi, CONTRACT } from "ulujs";
import {
  getAlgodClient,
  getIndexerClient,
  makeSigner,
  encodeNote,
} from "./client.js";
import { toBaseUnits, tryPermutations, validateWrapParams } from "./utils.js";

const DEPOSIT_FLAGS = [
  [0],
  [1],
];

const WITHDRAW_FLAGS = [
  [0],
];

/**
 * Build unsigned transactions to deposit an ASA into an NNT200 wrapper
 * contract.  Creates an asset-transfer + application-call group.
 *
 * @param {string} chain     - Chain identifier (e.g. "voi")
 * @param {number} appId     - NNT200 wrapper application ID
 * @param {number} assetId   - Underlying ASA ID to deposit
 * @param {string} sender    - Sender wallet address
 * @param {string} amount    - Human-readable amount to deposit
 * @param {number} [decimals=6] - Token decimals
 * @returns {{ transactions: string[], details: object }}
 */
export async function deposit_nnt200_txn(chain, appId, assetId, sender, amount, decimals = 6) {
  validateWrapParams(appId, sender, amount, { assetId });

  const algod = getAlgodClient(chain);
  const indexer = getIndexerClient(chain);
  const baseAmount = toBaseUnits(amount, decimals);
  const signer = makeSigner(sender);

  const ci = new CONTRACT(appId, algod, indexer, abi.custom, signer);
  const tokenCI = new CONTRACT(appId, algod, indexer, abi.nt200, signer, true, false, true);

  const customTx = await tryPermutations(ci, DEPOSIT_FLAGS, async ([needsBox]) => {
    const txns = [];

    if (needsBox > 0) {
      const txnO = (await tokenCI.createBalanceBox(sender)).obj;
      txns.push({ ...txnO, payment: 28500, note: encodeNote("nnt200 createBalanceBox") });
    }

    const txnO = (await tokenCI.deposit(baseAmount)).obj;
    txns.push({ ...txnO, xaid: assetId, aamt: baseAmount, note: encodeNote("nnt200 deposit") });

    return txns;
  });

  return {
    transactions: customTx.txns,
    details: {
      action: "deposit_nnt200",
      chain,
      appId,
      assetId,
      amount: amount.toString(),
      sender,
    },
  };
}

/**
 * Build unsigned transactions to withdraw an ASA from an NNT200 wrapper
 * contract.  The contract releases the ASA back to the sender via inner
 * transaction.
 *
 * @param {string} chain     - Chain identifier (e.g. "voi")
 * @param {number} appId     - NNT200 wrapper application ID
 * @param {number} assetId   - Underlying ASA ID to withdraw
 * @param {string} sender    - Sender wallet address
 * @param {string} amount    - Human-readable amount to withdraw
 * @param {number} [decimals=6] - Token decimals
 * @returns {{ transactions: string[], details: object }}
 */
export async function withdraw_nnt200_txn(chain, appId, assetId, sender, amount, decimals = 6) {
  validateWrapParams(appId, sender, amount, { assetId });

  const algod = getAlgodClient(chain);
  const indexer = getIndexerClient(chain);
  const baseAmount = toBaseUnits(amount, decimals);
  const signer = makeSigner(sender);

  const ci = new CONTRACT(appId, algod, indexer, abi.custom, signer);
  const tokenCI = new CONTRACT(appId, algod, indexer, abi.nt200, signer, true, false, true);

  // Use "default" GRS strategy so the ASA is carried by a separate GRS helper
  // transaction in the group.  The "merge" strategy loses the foreignAssets
  // reference when box-related GRS helpers are popped last.
  const customTx = await tryPermutations(ci, WITHDRAW_FLAGS, async () => {
    const txnO = (await tokenCI.withdraw(baseAmount)).obj;
    return [{ ...txnO, apas: [assetId], note: encodeNote("nnt200 withdraw") }];
  }, { strategies: ["default"] });

  return {
    transactions: customTx.txns,
    details: {
      action: "withdraw_nnt200",
      chain,
      appId,
      assetId,
      amount: amount.toString(),
      sender,
    },
  };
}
