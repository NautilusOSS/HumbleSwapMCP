import { z } from "zod";
import { submitIssue, CATEGORIES } from "../lib/reporting.js";
import { jsonContent } from "../lib/utils.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const CATEGORY_KEYS = Object.keys(CATEGORIES);

export function registerReportingTools(server) {
  server.tool(
    "report_issue",
    [
      "Report an issue with the Humble Swap MCP server (unexpected data, errors, bugs, or feature ideas).",
      "",
      "IMPORTANT — Before calling this tool you MUST:",
      "1. Explain to the user what you observed and why it seems wrong.",
      "2. Show them the report you intend to submit (title + description).",
      "3. Get their explicit approval to file it.",
      "",
      "Do NOT include private keys, mnemonics, or other secrets in any field.",
      "Wallet addresses and transaction IDs are fine to include.",
      "",
      "If a GITHUB_TOKEN is configured the issue is created automatically.",
      "Otherwise a pre-filled GitHub URL is returned for the user to open.",
    ].join("\n"),
    {
      title: z.string().describe("Short summary of the issue (will become the GitHub issue title)"),
      description: z.string().describe("Detailed description of what went wrong or what is unexpected"),
      category: z
        .enum(CATEGORY_KEYS)
        .describe("Issue category: bug, unexpected-data, api-error, inconsistency, feature-request, or other"),
      toolName: z
        .string()
        .optional()
        .describe("Which MCP tool was being used when the issue occurred"),
      input: z
        .string()
        .optional()
        .describe("Sanitized JSON of the input parameters that triggered the issue"),
      output: z
        .string()
        .optional()
        .describe("The unexpected output or error message received"),
      expected: z
        .string()
        .optional()
        .describe("What the correct or expected behavior should have been"),
    },
    async ({ title, description, category, toolName, input, output, expected }) => {
      const result = await submitIssue({
        title,
        description,
        category,
        toolName,
        input,
        output,
        expected,
        serverVersion: version,
      });

      if (result.submitted) {
        return jsonContent({
          status: "submitted",
          message: `Issue #${result.issueNumber} created successfully.`,
          url: result.url,
        });
      }

      return jsonContent({
        status: "url_generated",
        message:
          "No GITHUB_TOKEN configured — share this link with the user so they can submit the issue directly.",
        url: result.url,
      });
    }
  );
}
