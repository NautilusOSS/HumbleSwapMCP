// Issue reporting via GitHub Issues API or pre-filled URL fallback.

const GITHUB_REPO = process.env.HUMBLE_MCP_GITHUB_REPO || "NautilusOSS/HumbleSwapMCP";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SUBMIT_TIMEOUT = 15_000;

const CATEGORIES = {
  bug: "bug",
  "unexpected-data": "unexpected data",
  "api-error": "API error",
  inconsistency: "data inconsistency",
  "feature-request": "feature request",
  other: "other",
};

function buildIssueBody({ description, category, toolName, input, output, expected, serverVersion }) {
  const sections = [`## Description\n\n${description}`];

  if (category) {
    sections.push(`**Category:** ${CATEGORIES[category] || category}`);
  }

  if (toolName || input || output || expected) {
    const ctx = ["## Context"];
    if (toolName) ctx.push(`**Tool:** \`${toolName}\``);
    if (input) ctx.push(`**Input:**\n\`\`\`json\n${input}\n\`\`\``);
    if (output) ctx.push(`**Actual output:**\n\`\`\`json\n${output}\n\`\`\``);
    if (expected) ctx.push(`**Expected:** ${expected}`);
    sections.push(ctx.join("\n"));
  }

  const meta = ["## Environment", `- **MCP Server:** humble-swap-mcp v${serverVersion}`];
  sections.push(meta.join("\n"));

  sections.push("---\n*This issue was filed via the MCP `report_issue` tool with user approval.*");

  return sections.join("\n\n");
}

function labelForCategory(category) {
  const map = {
    bug: "bug",
    "unexpected-data": "bug",
    "api-error": "bug",
    inconsistency: "bug",
    "feature-request": "enhancement",
    other: "triage",
  };
  return map[category] || "triage";
}

async function createGitHubIssue(title, body, labels) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/issues`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "humble-swap-mcp",
    },
    body: JSON.stringify({ title, body, labels }),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  const issue = await res.json();
  return { submitted: true, issueNumber: issue.number, url: issue.html_url };
}

function buildIssueUrl(title, body, labels) {
  const params = new URLSearchParams({ title, body });
  if (labels.length) params.set("labels", labels.join(","));
  const url = `https://github.com/${GITHUB_REPO}/issues/new?${params}`;
  return { submitted: false, url };
}

export async function submitIssue({ title, description, category, toolName, input, output, expected, serverVersion }) {
  const body = buildIssueBody({ description, category, toolName, input, output, expected, serverVersion });
  const labels = [labelForCategory(category), "mcp-reported"];

  if (GITHUB_TOKEN) {
    return createGitHubIssue(title, body, labels);
  }
  return buildIssueUrl(title, body, labels);
}

export { CATEGORIES };
