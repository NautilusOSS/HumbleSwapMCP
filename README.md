# HumbleSwapMCP

Protocol MCP server for the [Humble Swap](https://voi.humbleswap.sh) DEX on Voi.

## Architecture

HumbleSwapMCP is a protocol-level MCP that sits above the infrastructure MCP layer:

```
UluCoreMCP / UluVoiMCP / UluWalletMCP / UluBroadcastMCP
                        ↓
                  HumbleSwapMCP
                        ↓
               Humble API (reads)
               On-chain (writes)
```

**Data sources:**

- **Humble API** (`humble-api.voi.nautilus.sh`) — Pool listings, token metadata, price tickers.
- **On-chain** (algod) — Pool Info, swap simulation, transaction preparation.

**HumbleSwapMCP handles:**
- Pool discovery with token pairs, liquidity, and volume data
- Token listing with metadata
- Price data (current, historical, trends, aggregated)
- Swap quote simulation (no transaction built)
- Swap transaction preparation (unsigned)
- Add/remove liquidity transaction preparation (unsigned)
- Arbitrage opportunity detection
- Multi-hop swap routing

**HumbleSwapMCP does NOT:**
- Sign transactions (use UluWalletMCP)
- Broadcast transactions (use UluBroadcastMCP)
- Manage wallets

## Tools

### Pools

| Tool | Description |
|------|-------------|
| `get_pools` | List Humble Swap pools with token pairs, liquidity, and volume data |
| `get_pool` | Get detailed on-chain pool info (balances, fees, LP supply) |
| `get_pool_details` | Get detailed pool info from the Humble API |
| `get_pool_analytics` | Get pool analytics (TVL, liquidity depth, concentration) |
| `get_pool_stats` | Get comprehensive stats for a specific pool |
| `get_all_pools_stats` | Get stats across all pools |
| `compare_pools` | Compare multiple pools side by side |

### Tokens

| Tool | Description |
|------|-------------|
| `get_tokens` | List tokens available on Humble Swap |
| `get_tickers` | Get price ticker data for trading pairs |
| `search_tokens` | Search tokens by name or symbol |
| `get_token_metadata` | Get enriched metadata for a token |
| `get_token_stats` | Get comprehensive stats for a token |
| `get_token_pools` | Get pools containing a specific token |
| `get_all_tokens_stats` | Get stats across all tokens |
| `get_token_rankings` | Get token rankings by various metrics |

### Prices

| Tool | Description |
|------|-------------|
| `get_prices` | Get current prices for all tokens |
| `get_token_price` | Get current price for a specific token |
| `get_price_history` | Get historical price data |
| `get_price_trends` | Get price trend analytics (momentum, moving averages) |
| `get_price_aggregated` | Get aggregated price across pool sources |

### Trading

| Tool | Description |
|------|-------------|
| `get_quote` | Simulate a swap — returns expected output, rate, fee, price impact, minimum received |
| `get_swap_route` | Find all possible swap paths between two tokens |
| `swap_txn` | Build unsigned swap transactions |
| `add_liquidity_txn` | Build unsigned add-liquidity transactions |
| `remove_liquidity_txn` | Build unsigned remove-liquidity transactions |
| `get_protocol_stats` | Get protocol-wide statistics (TVL, volume, pool count) |
| `get_arbitrage_opportunities` | Detect arbitrage opportunities across pools |
| `get_triangular_arbitrage` | Detect triangular arbitrage (A→B→C→A) |

## Agent Workflow

```
Agent calls HumbleSwapMCP:  swap_txn(fromToken, toToken, amount, sender)
       → returns { transactions: [base64, ...] }

Agent calls UluWalletMCP: wallet_sign_transactions(signerId, transactions)
       → returns signed transactions

Agent calls UluBroadcastMCP: broadcast_transactions(network, txns)
       → returns transaction IDs
```

## Setup

```bash
npm install
```

## Usage

```bash
node index.js
```

## Testing

```bash
npm test
```

## Adding to a Client

Add to your MCP client config (e.g. `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "humble-swap": {
      "command": "node",
      "args": ["/absolute/path/to/HumbleSwapMCP/index.js"]
    }
  }
}
```

## Chain Support

Currently Voi mainnet only. All swap pools use the swap200 contract standard with ARC-200 tokens. The default chain is configured via `DEFAULT_CHAIN` in `lib/client.js`.

**Native VOI handling:** VOI (native token) is automatically wrapped/unwrapped to wVOI (contract 390001) during swaps. Users interact with "VOI" — wrapping is transparent.

## Project Structure

```
index.js              MCP server entry point — registers tools and starts transport
tools/
  pools.js            Pool tool registrations (7 tools)
  tokens.js           Token tool registrations (8 tools)
  prices.js           Price tool registrations (5 tools)
  trading.js          Quote, txn, arbitrage, router, protocol tools (8 tools)
lib/
  api.js              Humble API client with timeouts (humble-api.voi.nautilus.sh)
  client.js           Algod/Indexer client factory, token ID helpers, DEFAULT_CHAIN
  pools.js            Pool discovery with TTL caching, parallel best-pool selection
  tokens.js           Token listing with TTL caching and symbol resolution
  quote.js            Swap simulation via read-only contract calls
  builders.js         Unsigned transaction group builders with permutation retries
  utils.js            Shared utilities (toBaseUnits, fromBaseUnits, tryPermutations)
data/
  contracts.json      Network config, API URLs, key token IDs
  pool-abi.json       Pool contract ABI (swap200)
test/
  utils.test.js       Unit tests for shared utilities
  client.test.js      Unit tests for client helpers
  tokens.test.js      Unit tests for token resolution
  pools.test.js       Unit tests for pool helpers
```

## Pool Contract ABI

The swap200 pool contract exposes:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `Info` | `()((uint256,uint256),(uint256,uint256),(uint256,uint256,uint256,address,byte),(uint256,uint256),uint64,uint64)` | Pool state (balances, LP, fees, token IDs) |
| `Trader_swapAForB` | `(byte,uint256,uint256)(uint256,uint256)` | Swap token A for token B |
| `Trader_swapBForA` | `(byte,uint256,uint256)(uint256,uint256)` | Swap token B for token A |
| `Trader_exactSwapAForB` | `(byte,uint256,uint256)(uint256,uint256)` | Exact-output swap A→B |
| `Trader_exactSwapBForA` | `(byte,uint256,uint256)(uint256,uint256)` | Exact-output swap B→A |
| `Provider_deposit` | `(byte,(uint256,uint256),uint256)uint256` | Add liquidity |
| `Provider_withdraw` | `(byte,uint256,(uint256,uint256))(uint256,uint256)` | Remove liquidity |

## Token Standards

- **Network (VOI):** Wrapped via nt200 (wVOI, contract 390001). Deposit wraps native VOI; withdraw unwraps.
- **ARC-200:** Native ARC-200 tokens (e.g. VIA, GM, UNIT). Used directly.
- **ASA-backed ARC-200:** Bridged assets (e.g. aUSDC, aETH). Wrapped ASAs available as ARC-200 on Voi.
