import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPoolTools } from "./tools/pools.js";
import { registerTokenTools } from "./tools/tokens.js";
import { registerPriceTools } from "./tools/prices.js";
import { registerTradingTools } from "./tools/trading.js";

const server = new McpServer({
  name: "humble-swap-mcp",
  version: "0.3.0",
});

registerPoolTools(server);
registerTokenTools(server);
registerPriceTools(server);
registerTradingTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
