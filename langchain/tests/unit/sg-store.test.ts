/**
 * ══════════════════════════════════════════════════════════════════
 *  Unit Tests: sg-store.ts
 * ══════════════════════════════════════════════════════════════════
 *
 *  WHAT TO TEST in pure functions/stores:
 *  ✅ Happy path — correct input → correct output
 *  ✅ Edge cases — empty store, missing IDs, case sensitivity
 *  ✅ Business logic — security analysis severity, rule matching
 *  ✅ State management — upsert overwrites, clearStore resets
 *
 *  WHAT NOT TO TEST here:
 *  ❌ AWS API calls (mock those or test separately)
 *  ❌ LLM responses (non-deterministic, test prompt structure instead)
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertSecurityGroup,
  upsertMany,
  clearStore,
  getAllSecurityGroups,
  getSecurityGroupById,
  getSecurityGroupByName,
  searchSecurityGroups,
  getGroupsWithOpenPort,
  getStoreSize,
  analyzeSecurityGroup,
  getAnalysisSummary,
} from "@/lib/ec2/sg-store";
import type { SecurityGroup } from "@/lib/ec2/types";

// ─── Test fixtures ─────────────────────────────────────────────────
// Real-world-like data makes tests meaningful and readable.
// Define fixtures once, reuse across tests.

const makeSG = (overrides: Partial<SecurityGroup> = {}): SecurityGroup => ({
  id: "sg-test001",
  name: "test-security-group",
  description: "A test security group",
  vpcId: "vpc-abc123",
  inboundRules: [],
  outboundRules: [],
  tags: { Environment: "test" },
  syncedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const SSH_OPEN_SG = makeSG({
  id: "sg-ssh001",
  name: "web-server-sg",
  inboundRules: [
    {
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      source: "0.0.0.0/0", // SSH open to world — should be CRITICAL
      description: "SSH access",
    },
  ],
});

const PRIVATE_DB_SG = makeSG({
  id: "sg-db001",
  name: "database-sg",
  inboundRules: [
    {
      protocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      source: "10.0.0.0/8", // Private CIDR — should be fine
      description: "PostgreSQL from internal",
    },
  ],
});

// ─── Tests ────────────────────────────────────────────────────────

describe("sg-store — CRUD", () => {
  // beforeEach resets the store so tests are ISOLATED
  // Never let test state bleed between tests!
  beforeEach(() => {
    clearStore();
  });

  it("starts empty after clearStore", () => {
    expect(getStoreSize()).toBe(0);
    expect(getAllSecurityGroups()).toEqual([]);
  });

  it("upsertSecurityGroup adds a new group", () => {
    const sg = makeSG();
    upsertSecurityGroup(sg);

    expect(getStoreSize()).toBe(1);
    expect(getAllSecurityGroups()).toHaveLength(1);
  });

  it("upsertSecurityGroup overwrites existing group with same ID", () => {
    const original = makeSG({ name: "original-name" });
    const updated = makeSG({ name: "updated-name" });

    upsertSecurityGroup(original);
    upsertSecurityGroup(updated); // Same ID → should replace

    expect(getStoreSize()).toBe(1); // Still 1, not 2
    expect(getSecurityGroupById("sg-test001")?.name).toBe("updated-name");
  });

  it("upsertMany adds multiple groups at once", () => {
    upsertMany([SSH_OPEN_SG, PRIVATE_DB_SG]);
    expect(getStoreSize()).toBe(2);
  });
});

describe("sg-store — queries", () => {
  beforeEach(() => {
    clearStore();
    upsertMany([SSH_OPEN_SG, PRIVATE_DB_SG]);
  });

  it("getSecurityGroupById returns the correct group", () => {
    const result = getSecurityGroupById("sg-ssh001");
    expect(result).not.toBeNull();
    expect(result?.name).toBe("web-server-sg");
  });

  it("getSecurityGroupById returns undefined for unknown ID", () => {
    expect(getSecurityGroupById("sg-doesnotexist")).toBeUndefined();
  });

  it("getSecurityGroupByName is case-insensitive", () => {
    // Name lookup should work regardless of case
    expect(getSecurityGroupByName("WEB-SERVER-SG")).toBeDefined();
    expect(getSecurityGroupByName("web-server-sg")).toBeDefined();
    expect(getSecurityGroupByName("DATABASE-SG")).toBeDefined();
  });

  it("getSecurityGroupByName returns undefined for unknown name", () => {
    expect(getSecurityGroupByName("nonexistent-sg")).toBeUndefined();
  });

  it("searchSecurityGroups matches by name fragment", () => {
    const results = searchSecurityGroups("web");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("sg-ssh001");
  });

  it("searchSecurityGroups matches by ID", () => {
    const results = searchSecurityGroups("sg-db");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("sg-db001");
  });

  it("searchSecurityGroups returns empty array when no match", () => {
    expect(searchSecurityGroups("zzz-no-match-zzz")).toEqual([]);
  });

  it("searchSecurityGroups matches by tag value", () => {
    const tagged = makeSG({ id: "sg-tagged", tags: { Team: "platform" } });
    upsertSecurityGroup(tagged);
    expect(searchSecurityGroups("platform")).toHaveLength(1);
  });
});

describe("sg-store — port queries", () => {
  beforeEach(() => {
    clearStore();
    upsertMany([SSH_OPEN_SG, PRIVATE_DB_SG]);
  });

  it("getGroupsWithOpenPort finds groups with port 22 open to world", () => {
    const results = getGroupsWithOpenPort(22);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("sg-ssh001");
  });

  it("getGroupsWithOpenPort ignores private-CIDR rules", () => {
    // Port 5432 is open but only to 10.0.0.0/8, not internet
    const results = getGroupsWithOpenPort(5432);
    expect(results).toHaveLength(0);
  });

  it("getGroupsWithOpenPort handles port ranges correctly", () => {
    const rangeSG = makeSG({
      id: "sg-range001",
      inboundRules: [
        {
          protocol: "tcp",
          fromPort: 8000,
          toPort: 9000, // Port 8080 is within this range
          source: "0.0.0.0/0",
          description: "Wide range",
        },
      ],
    });
    upsertSecurityGroup(rangeSG);

    expect(getGroupsWithOpenPort(8080)).toHaveLength(1);
    expect(getGroupsWithOpenPort(7999)).toHaveLength(0); // Below range
    expect(getGroupsWithOpenPort(9001)).toHaveLength(0); // Above range
  });
});

describe("sg-store — security analysis", () => {
  beforeEach(() => {
    clearStore();
  });

  it("analyzeSecurityGroup flags SSH open to world as HIGH severity", () => {
    const findings = analyzeSecurityGroup(SSH_OPEN_SG);

    // SSH open to 0.0.0.0/0 → HIGH (see sg-store analyzeRule logic)
    expect(findings.length).toBeGreaterThan(0);
    const sshFinding = findings.find((f) => f.message.match(/22|SSH/i));
    expect(sshFinding).toBeDefined();
    expect(sshFinding?.severity).toBe("HIGH");
    expect(sshFinding?.direction).toBe("inbound");
  });

  it("analyzeSecurityGroup returns no findings for locked-down group", () => {
    const findings = analyzeSecurityGroup(PRIVATE_DB_SG);
    // Private CIDR rules should not trigger findings
    expect(findings).toHaveLength(0);
  });

  it("analyzeSecurityGroup flags database ports open to world as CRITICAL", () => {
    const exposedDB = makeSG({
      id: "sg-exposed-db",
      inboundRules: [
        {
          protocol: "tcp",
          fromPort: 5432,
          toPort: 5432,
          source: "0.0.0.0/0", // PostgreSQL exposed — very bad
          description: "Public DB",
        },
      ],
    });

    const findings = analyzeSecurityGroup(exposedDB);
    const critical = findings.filter((f) => f.severity === "CRITICAL");
    expect(critical.length).toBeGreaterThan(0);
  });

  it("getAnalysisSummary aggregates findings across all groups", () => {
    upsertMany([SSH_OPEN_SG, PRIVATE_DB_SG]);

    const summary = getAnalysisSummary();
    // SSH_OPEN_SG → HIGH finding; PRIVATE_DB_SG → no findings
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.high).toBeGreaterThan(0); // SSH is HIGH severity
  });

  it("getAnalysisSummary returns zero totals for clean store", () => {
    upsertSecurityGroup(PRIVATE_DB_SG); // Only private rules

    const summary = getAnalysisSummary();
    expect(summary.critical).toBe(0);
    expect(summary.high).toBe(0);
  });
});
