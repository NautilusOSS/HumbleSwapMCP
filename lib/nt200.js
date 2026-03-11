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
 * Build unsigned transactions to deposit native network tokens into an NT200
 * wrapper contract.  Creates a payment + application-call group.
 *
 * @param {string} chain   - Chain identifier (e.g. "voi")
 * @param {number} appId   - NT200 wrapper application ID
 * @param {string} sender  - Sender wallet address
 * @param {string} amount  - Human-readable amount to deposit
 * @param {number} [decimals=6] - Token decimals
 * @returns {{ transactions: string[], details: object }}
 */
export async function deposit_nt200_txn(chain, appId, sender, amount, decimals = 6) {
  validateWrapParams(appId, sender, amount);

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
      txns.push({ ...txnO, payment: 28500, note: encodeNote("nt200 createBalanceBox") });
    }

    const txnO = (await tokenCI.deposit(baseAmount)).obj;
    txns.push({ ...txnO, payment: baseAmount, note: encodeNote("nt200 deposit") });

    return txns;
  });

  return {
    transactions: customTx.txns,
    details: {
      action: "deposit_nt200",
      chain,
      appId,
      amount: amount.toString(),
      sender,
    },
  };
}

/**
 * Build unsigned transactions to withdraw native network tokens from an NT200
 * wrapper contract.  The contract releases native tokens back to the sender.
 *
 * @param {string} chain   - Chain identifier (e.g. "voi")
 * @param {number} appId   - NT200 wrapper application ID
 * @param {string} sender  - Sender wallet address
 * @param {string} amount  - Human-readable amount to withdraw
 * @param {number} [decimals=6] - Token decimals
 * @returns {{ transactions: string[], details: object }}
 */
export async function withdraw_nt200_txn(chain, appId, sender, amount, decimals = 6) {
  validateWrapParams(appId, sender, amount);

  const algod = getAlgodClient(chain);
  const indexer = getIndexerClient(chain);
  const baseAmount = toBaseUnits(amount, decimals);
  const signer = makeSigner(sender);

  const ci = new CONTRACT(appId, algod, indexer, abi.custom, signer);
  const tokenCI = new CONTRACT(appId, algod, indexer, abi.nt200, signer, true, false, true);

  const customTx = await tryPermutations(ci, WITHDRAW_FLAGS, async () => {
    const txnO = (await tokenCI.withdraw(baseAmount)).obj;
    return [{ ...txnO, note: encodeNote("nt200 withdraw") }];
  });

  return {
    transactions: customTx.txns,
    details: {
      action: "withdraw_nt200",
      chain,
      appId,
      amount: amount.toString(),
      sender,
    },
  };
}
