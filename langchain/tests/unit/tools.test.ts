/**
 * ══════════════════════════════════════════════════════════════════
 *  Unit Tests: LangChain Tools (tools.ts)
 * ══════════════════════════════════════════════════════════════════
 *
 *  STRATEGY: Mock external dependencies, test tool logic in isolation.
 *
 *  Tools depend on:
 *    • sg-store  → mock to control data
 *    • sg-sync   → mock to prevent real AWS calls
 *
 *  This way tests are:
 *    ✅ Fast (no network)
 *    ✅ Deterministic (no random AWS data)
 *    ✅ Isolated (not affected by other tests)
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules BEFORE importing the thing under test ───────────
// Vitest hoists vi.mock() calls to the top, so order doesn't matter,
// but it's a good habit to declare mocks before imports.

vi.mock("@/lib/ec2/sg-sync", () => ({
  // Replace ensureSynced with a no-op — no real AWS calls in tests
  ensureSynced: vi.fn().mockResolvedValue(undefined),
  syncFromAWS: vi.fn().mockResolvedValue({ count: 3, source: "mock" }),
}));

vi.mock("@/lib/ec2/sg-store", () => ({
  // We control exactly what data the tools will "see"
  getAllSecurityGroups: vi.fn(),
  getSecurityGroupById: vi.fn(),
  getSecurityGroupByName: vi.fn(),
  searchSecurityGroups: vi.fn(),
  getGroupsWithOpenPort: vi.fn(),
  analyzeSecurityGroup: vi.fn(),
  analyzeAll: vi.fn(),
  getAnalysisSummary: vi.fn(),
  upsertSecurityGroup: vi.fn(),
  upsertMany: vi.fn(),
  clearStore: vi.fn(),
  getStoreSize: vi.fn(),
}));

import {
  listSecurityGroupsTool,
  getSecurityGroupTool,
  searchSecurityGroupsTool,
  findOpenPortTool,
  analyzeGroupTool,
  analyzeAllTool,
  syncFromAWSTool,
} from "@/lib/ec2/tools";
import * as sgStore from "@/lib/ec2/sg-store";
import type { SecurityGroup, SecurityFinding } from "@/lib/ec2/types";

// ─── Shared fixtures ───────────────────────────────────────────────

const mockSG: SecurityGroup = {
  id: "sg-mock001",
  name: "mock-web-sg",
  description: "Mock web security group",
  vpcId: "vpc-mock",
  inboundRules: [
    { protocol: "tcp", fromPort: 22, toPort: 22, source: "0.0.0.0/0", description: "SSH" },
    { protocol: "tcp", fromPort: 443, toPort: 443, source: "0.0.0.0/0", description: "HTTPS" },
  ],
  outboundRules: [],
  tags: { Environment: "test", Team: "platform" },
  syncedAt: "2026-01-01T00:00:00.000Z",
};

const mockFinding: SecurityFinding = {
  severity: "HIGH",
  groupId: "sg-mock001",
  groupName: "mock-web-sg",
  rule: mockSG.inboundRules[0],
  direction: "inbound",
  message: "SSH (port 22) open to the entire internet",
  recommendation: "Restrict SSH to your office IP.",
};

// ─── list_security_groups tool ────────────────────────────────────

describe("listSecurityGroupsTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted list when groups exist", async () => {
    vi.mocked(sgStore.getAllSecurityGroups).mockReturnValue([mockSG]);

    // Tools expose an `.invoke()` method — this is how LangChain calls them
    const result = await listSecurityGroupsTool.invoke({});

    expect(result).toContain("sg-mock001");
    expect(result).toContain("mock-web-sg");
    expect(result).toContain("1 security groups");
  });

  it("returns empty message when store is empty", async () => {
    vi.mocked(sgStore.getAllSecurityGroups).mockReturnValue([]);

    const result = await listSecurityGroupsTool.invoke({});

    expect(result).toContain("No security groups found");
  });
});

// ─── get_security_group tool ──────────────────────────────────────

describe("getSecurityGroupTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds group by ID", async () => {
    vi.mocked(sgStore.getSecurityGroupById).mockReturnValue(mockSG);
    vi.mocked(sgStore.getSecurityGroupByName).mockReturnValue(undefined);

    const result = await getSecurityGroupTool.invoke({ identifier: "sg-mock001" });

    expect(result).toContain("sg-mock001");
    expect(result).toContain("mock-web-sg");
    // getSecurityGroupById is tried first
    expect(sgStore.getSecurityGroupById).toHaveBeenCalledWith("sg-mock001");
  });

  it("falls back to name lookup when ID not found", async () => {
    vi.mocked(sgStore.getSecurityGroupById).mockReturnValue(undefined);
    vi.mocked(sgStore.getSecurityGroupByName).mockReturnValue(mockSG);

    const result = await getSecurityGroupTool.invoke({ identifier: "mock-web-sg" });

    expect(result).toContain("mock-web-sg");
    expect(sgStore.getSecurityGroupByName).toHaveBeenCalledWith("mock-web-sg");
  });

  it("returns not-found message when neither ID nor name matches", async () => {
    vi.mocked(sgStore.getSecurityGroupById).mockReturnValue(undefined);
    vi.mocked(sgStore.getSecurityGroupByName).mockReturnValue(undefined);

    const result = await getSecurityGroupTool.invoke({ identifier: "sg-ghost" });

    expect(result).toContain("not found");
    expect(result).toContain("sg-ghost");
  });
});

// ─── search_security_groups tool ─────────────────────────────────

describe("searchSecurityGroupsTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching groups", async () => {
    vi.mocked(sgStore.searchSecurityGroups).mockReturnValue([mockSG]);

    const result = await searchSecurityGroupsTool.invoke({ query: "web" });

    expect(result).toContain("1 matching");
    expect(result).toContain("mock-web-sg");
    expect(sgStore.searchSecurityGroups).toHaveBeenCalledWith("web");
  });

  it("returns no-match message when empty", async () => {
    vi.mocked(sgStore.searchSecurityGroups).mockReturnValue([]);

    const result = await searchSecurityGroupsTool.invoke({ query: "zzz" });

    expect(result).toContain("No security groups matching");
    expect(result).toContain("zzz");
  });
});

// ─── find_groups_with_open_port tool ─────────────────────────────

describe("findOpenPortTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports groups with the port open to internet", async () => {
    vi.mocked(sgStore.getGroupsWithOpenPort).mockReturnValue([mockSG]);

    const result = await findOpenPortTool.invoke({ port: 22 });

    expect(result).toContain("1 group(s)");
    expect(result).toContain("port 22");
    expect(sgStore.getGroupsWithOpenPort).toHaveBeenCalledWith(22);
  });

  it("reports clean when no groups expose the port", async () => {
    vi.mocked(sgStore.getGroupsWithOpenPort).mockReturnValue([]);

    const result = await findOpenPortTool.invoke({ port: 3306 });

    expect(result).toContain("No security groups have port 3306 open");
  });
});

// ─── analyze_security_group tool ─────────────────────────────────

describe("analyzeGroupTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns findings when issues exist", async () => {
    vi.mocked(sgStore.getSecurityGroupById).mockReturnValue(mockSG);
    vi.mocked(sgStore.getSecurityGroupByName).mockReturnValue(undefined);
    vi.mocked(sgStore.analyzeSecurityGroup).mockReturnValue([mockFinding]);

    const result = await analyzeGroupTool.invoke({ identifier: "sg-mock001" });

    expect(result).toContain("HIGH");
    expect(result).toContain("SSH");
    expect(result).toContain("mock-web-sg");
  });

  it("returns clean message when no issues", async () => {
    vi.mocked(sgStore.getSecurityGroupById).mockReturnValue(mockSG);
    vi.mocked(sgStore.getSecurityGroupByName).mockReturnValue(undefined);
    vi.mocked(sgStore.analyzeSecurityGroup).mockReturnValue([]); // No findings

    const result = await analyzeGroupTool.invoke({ identifier: "sg-mock001" });

    expect(result).toContain("No security issues found");
    expect(result).toContain("✅");
  });

  it("returns not-found when group doesn't exist", async () => {
    vi.mocked(sgStore.getSecurityGroupById).mockReturnValue(undefined);
    vi.mocked(sgStore.getSecurityGroupByName).mockReturnValue(undefined);

    const result = await analyzeGroupTool.invoke({ identifier: "sg-ghost" });

    expect(result).toContain("not found");
  });
});

// ─── analyze_all_security_groups tool ────────────────────────────

describe("analyzeAllTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns summary with finding counts", async () => {
    vi.mocked(sgStore.getAnalysisSummary).mockReturnValue({
      total: 2,
      critical: 0,
      high: 2,
      medium: 0,
      low: 0,
      info: 0,
      findings: [mockFinding, { ...mockFinding, groupId: "sg-mock002" }],
    });

    const result = await analyzeAllTool.invoke({});

    expect(result).toContain("Total findings: 2");
    expect(result).toContain("HIGH: 2");
    expect(result).toContain("CRITICAL: 0");
  });

  it("returns clean message when no findings", async () => {
    vi.mocked(sgStore.getAnalysisSummary).mockReturnValue({
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      findings: [],
    });

    const result = await analyzeAllTool.invoke({});

    expect(result).toContain("No security issues found");
    expect(result).toContain("✅");
  });
});

// ─── sync_security_groups tool ────────────────────────────────────

describe("syncFromAWSTool", () => {
  it("returns sync result message", async () => {
    const result = await syncFromAWSTool.invoke({});

    expect(result).toContain("Synced 3 security groups");
    expect(result).toContain("mock");
  });
});
