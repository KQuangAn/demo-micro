/**
 * ══════════════════════════════════════════════════════════════════
 *  LangChain Tools for EC2 Security Groups
 * ══════════════════════════════════════════════════════════════════
 *
 *  These tools are given to the agent so it can query, search,
 *  and analyze security groups based on user questions.
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { tool } from "@langchain/core/tools";
import * as z from "zod";
import {
  getAllSecurityGroups,
  getSecurityGroupById,
  getSecurityGroupByName,
  searchSecurityGroups,
  getGroupsWithOpenPort,
  analyzeSecurityGroup,
  analyzeAll,
  getAnalysisSummary,
} from "./sg-store";
import { ensureSynced } from "./sg-sync";
import type { SecurityGroup } from "./types";

/* ─── helper: format SG for LLM consumption ──────────────── */

function formatSG(sg: SecurityGroup): string {
  const inbound = sg.inboundRules
    .map(
      (r) =>
        `    ${r.protocol}:${r.fromPort}-${r.toPort} ← ${r.source} (${r.description})`
    )
    .join("\n");
  const outbound = sg.outboundRules
    .map(
      (r) =>
        `    ${r.protocol}:${r.fromPort}-${r.toPort} → ${r.source} (${r.description})`
    )
    .join("\n");
  const tags = Object.entries(sg.tags)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return `[${sg.id}] ${sg.name}
  Description: ${sg.description}
  VPC: ${sg.vpcId}
  Tags: ${tags}
  Inbound Rules:
${inbound || "    (none)"}
  Outbound Rules:
${outbound || "    (none)"}
  Synced: ${sg.syncedAt}`;
}

/* ─── TOOL: List all security groups ─────────────────────── */

export const listSecurityGroupsTool = tool(
  async () => {
    await ensureSynced();
    const groups = getAllSecurityGroups();
    if (groups.length === 0) return "No security groups found in the store.";
    return `Found ${groups.length} security groups:\n\n${groups.map(formatSG).join("\n\n")}`;
  },
  {
    name: "list_security_groups",
    description:
      "List all EC2 security groups currently stored. Returns IDs, names, descriptions, VPCs, inbound/outbound rules, and tags.",
  }
);

/* ─── TOOL: Get a specific security group ────────────────── */

export const getSecurityGroupTool = tool(
  async (input: { identifier: string }) => {
    await ensureSynced();
    const sg =
      getSecurityGroupById(input.identifier) ||
      getSecurityGroupByName(input.identifier);
    if (!sg)
      return `Security group "${input.identifier}" not found. Try listing all groups first.`;
    return formatSG(sg);
  },
  {
    name: "get_security_group",
    description:
      "Get details of a specific security group by its ID (sg-xxx) or name.",
    schema: z.object({
      identifier: z
        .string()
        .describe("Security group ID (sg-xxx) or name"),
    }),
  }
);

/* ─── TOOL: Search security groups ───────────────────────── */

export const searchSecurityGroupsTool = tool(
  async (input: { query: string }) => {
    await ensureSynced();
    const results = searchSecurityGroups(input.query);
    if (results.length === 0)
      return `No security groups matching "${input.query}".`;
    return `Found ${results.length} matching groups:\n\n${results.map(formatSG).join("\n\n")}`;
  },
  {
    name: "search_security_groups",
    description:
      "Search security groups by name, ID, description, or tag value. Use for partial matches.",
    schema: z.object({
      query: z.string().describe("Search term"),
    }),
  }
);

/* ─── TOOL: Find groups with a port open to internet ─────── */

export const findOpenPortTool = tool(
  async (input: { port: number }) => {
    await ensureSynced();
    const groups = getGroupsWithOpenPort(input.port);
    if (groups.length === 0)
      return `No security groups have port ${input.port} open to 0.0.0.0/0.`;
    return `${groups.length} group(s) have port ${input.port} open to the internet:\n\n${groups.map(formatSG).join("\n\n")}`;
  },
  {
    name: "find_groups_with_open_port",
    description:
      "Find security groups that have a specific port open to the entire internet (0.0.0.0/0). Useful for finding misconfigurations.",
    schema: z.object({
      port: z
        .number()
        .describe(
          "Port number to check (e.g. 22 for SSH, 3306 for MySQL, 6379 for Redis)"
        ),
    }),
  }
);

/* ─── TOOL: Analyze one security group ───────────────────── */

export const analyzeGroupTool = tool(
  async (input: { identifier: string }) => {
    await ensureSynced();
    const sg =
      getSecurityGroupById(input.identifier) ||
      getSecurityGroupByName(input.identifier);
    if (!sg)
      return `Security group "${input.identifier}" not found.`;

    const findings = analyzeSecurityGroup(sg);
    if (findings.length === 0)
      return `No security issues found in ${sg.name} (${sg.id}). Looks good! ✅`;

    const lines = findings.map(
      (f) =>
        `[${f.severity}] ${f.message}\n  → ${f.recommendation}`
    );
    return `Security analysis for ${sg.name} (${sg.id}):\n\n${lines.join("\n\n")}`;
  },
  {
    name: "analyze_security_group",
    description:
      "Run a security audit on a specific security group. Finds misconfigurations like ports open to the internet, overly permissive rules, and sensitive services exposed.",
    schema: z.object({
      identifier: z
        .string()
        .describe("Security group ID (sg-xxx) or name to analyze"),
    }),
  }
);

/* ─── TOOL: Analyze ALL security groups ──────────────────── */

export const analyzeAllTool = tool(
  async () => {
    await ensureSynced();
    const summary = getAnalysisSummary();
    if (summary.total === 0)
      return "No security issues found across all groups. ✅";

    const header = `Security Audit Summary:
  Total findings: ${summary.total}
  🔴 CRITICAL: ${summary.critical}
  🟠 HIGH: ${summary.high}
  🟡 MEDIUM: ${summary.medium}
  🔵 LOW: ${summary.low}
  ⚪ INFO: ${summary.info}`;

    const details = summary.findings
      .sort((a, b) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
        return order[a.severity] - order[b.severity];
      })
      .map(
        (f) =>
          `[${f.severity}] ${f.groupName} (${f.groupId})\n  ${f.message}\n  → ${f.recommendation}`
      );

    return `${header}\n\n${details.join("\n\n")}`;
  },
  {
    name: "analyze_all_security_groups",
    description:
      "Run a full security audit across ALL security groups. Returns a prioritized list of findings with severity, description, and recommendations.",
  }
);

/* ─── TOOL: Sync from AWS ────────────────────────────────── */

export const syncFromAWSTool = tool(
  async () => {
    const { syncFromAWS } = await import("./sg-sync");
    const result = await syncFromAWS();
    return `Synced ${result.count} security groups from ${result.source}.`;
  },
  {
    name: "sync_security_groups",
    description:
      "Refresh security groups from AWS EC2 API (or load seed data if no AWS credentials). Use when user asks to refresh or re-sync.",
  }
);

/* ─── Export all tools ───────────────────────────────────── */

export const ec2Tools = [
  listSecurityGroupsTool,
  getSecurityGroupTool,
  searchSecurityGroupsTool,
  findOpenPortTool,
  analyzeGroupTool,
  analyzeAllTool,
  syncFromAWSTool,
];
