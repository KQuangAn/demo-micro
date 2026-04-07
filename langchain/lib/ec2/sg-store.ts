/**
 * ══════════════════════════════════════════════════════════════════
 *  In-Memory Security Group Store
 * ══════════════════════════════════════════════════════════════════
 *
 *  In production you'd use PostgreSQL / DynamoDB / Redis.
 *  This keeps the demo self-contained with no external DB.
 *
 *  Stores security groups synced from AWS and provides
 *  query methods the LangChain tools call.
 * ══════════════════════════════════════════════════════════════════
 */

import type { SecurityGroup, SecurityGroupRule, SecurityFinding } from "./types";

/* ─── singleton store ─────────────────────────────────────── */

const store = new Map<string, SecurityGroup>();

/* ─── WRITE ───────────────────────────────────────────────── */

export function upsertSecurityGroup(sg: SecurityGroup): void {
  store.set(sg.id, sg);
}

export function upsertMany(groups: SecurityGroup[]): void {
  for (const sg of groups) {
    store.set(sg.id, sg);
  }
}

export function clearStore(): void {
  store.clear();
}

/* ─── READ ────────────────────────────────────────────────── */

export function getAllSecurityGroups(): SecurityGroup[] {
  return Array.from(store.values());
}

export function getSecurityGroupById(id: string): SecurityGroup | undefined {
  return store.get(id);
}

export function getSecurityGroupByName(name: string): SecurityGroup | undefined {
  const lower = name.toLowerCase();
  return Array.from(store.values()).find(
    (sg) => sg.name.toLowerCase() === lower
  );
}

export function searchSecurityGroups(query: string): SecurityGroup[] {
  const lower = query.toLowerCase();
  return Array.from(store.values()).filter(
    (sg) =>
      sg.name.toLowerCase().includes(lower) ||
      sg.id.toLowerCase().includes(lower) ||
      sg.description.toLowerCase().includes(lower) ||
      Object.values(sg.tags).some((v) => v.toLowerCase().includes(lower))
  );
}

export function getGroupsWithOpenPort(port: number): SecurityGroup[] {
  return Array.from(store.values()).filter((sg) =>
    sg.inboundRules.some(
      (r) =>
        r.fromPort <= port &&
        r.toPort >= port &&
        (r.source === "0.0.0.0/0" || r.source === "::/0")
    )
  );
}

export function getStoreSize(): number {
  return store.size;
}

/* ─── SECURITY ANALYSIS ──────────────────────────────────── */

const WELL_KNOWN_PORTS: Record<number, string> = {
  22: "SSH",
  3389: "RDP",
  3306: "MySQL",
  5432: "PostgreSQL",
  27017: "MongoDB",
  6379: "Redis",
  9200: "Elasticsearch",
  8080: "HTTP Alt",
  443: "HTTPS",
  80: "HTTP",
  25: "SMTP",
  23: "Telnet",
  21: "FTP",
  445: "SMB",
  1433: "MSSQL",
  11211: "Memcached",
};

function isOpenToWorld(source: string): boolean {
  return source === "0.0.0.0/0" || source === "::/0";
}

function analyzeRule(
  sg: SecurityGroup,
  rule: SecurityGroupRule,
  direction: "inbound" | "outbound"
): SecurityFinding | null {
  if (!isOpenToWorld(rule.source)) return null;

  // all ports open to world
  if (rule.fromPort === 0 && rule.toPort === 65535) {
    return {
      severity: "CRITICAL",
      groupId: sg.id,
      groupName: sg.name,
      rule,
      direction,
      message: `All ports (0-65535) open to the entire internet (${rule.source})`,
      recommendation:
        "Restrict to specific ports and CIDR ranges. Never expose all ports to 0.0.0.0/0.",
    };
  }

  // all traffic protocol
  if (rule.protocol === "-1") {
    return {
      severity: "CRITICAL",
      groupId: sg.id,
      groupName: sg.name,
      rule,
      direction,
      message: `All traffic (all protocols) open to ${rule.source}`,
      recommendation:
        "Replace with specific protocol + port rules scoped to known CIDR blocks.",
    };
  }

  // sensitive ports open to world
  const sensitiveDbPorts = [3306, 5432, 27017, 6379, 9200, 1433, 11211];
  for (let port = rule.fromPort; port <= rule.toPort; port++) {
    if (sensitiveDbPorts.includes(port)) {
      return {
        severity: "CRITICAL",
        groupId: sg.id,
        groupName: sg.name,
        rule,
        direction,
        message: `${WELL_KNOWN_PORTS[port] || `Port ${port}`} (port ${port}) open to the internet`,
        recommendation: `Restrict ${WELL_KNOWN_PORTS[port] || `port ${port}`} to your VPC CIDR or specific IPs. Database ports should never be public.`,
      };
    }
  }

  // SSH/RDP open to world
  if (rule.fromPort <= 22 && rule.toPort >= 22) {
    return {
      severity: "HIGH",
      groupId: sg.id,
      groupName: sg.name,
      rule,
      direction,
      message: "SSH (port 22) open to the entire internet",
      recommendation:
        "Restrict SSH to your office IP or use Systems Manager Session Manager instead.",
    };
  }
  if (rule.fromPort <= 3389 && rule.toPort >= 3389) {
    return {
      severity: "HIGH",
      groupId: sg.id,
      groupName: sg.name,
      rule,
      direction,
      message: "RDP (port 3389) open to the entire internet",
      recommendation:
        "Restrict RDP to specific IPs or use a VPN. RDP brute-force is extremely common.",
    };
  }

  // HTTP open to world — often intentional, low severity
  if (rule.fromPort <= 80 && rule.toPort >= 80) {
    return {
      severity: "INFO",
      groupId: sg.id,
      groupName: sg.name,
      rule,
      direction,
      message: "HTTP (port 80) open to the internet",
      recommendation:
        "Ensure this is intentional. Prefer HTTPS (443) and redirect HTTP→HTTPS.",
    };
  }

  // Any other port open to world
  const portLabel = WELL_KNOWN_PORTS[rule.fromPort] || `Port ${rule.fromPort}`;
  return {
    severity: "MEDIUM",
    groupId: sg.id,
    groupName: sg.name,
    rule,
    direction,
    message: `${portLabel} open to the internet (${rule.source})`,
    recommendation: `Review if ${portLabel} needs public access. Restrict to known CIDR blocks if possible.`,
  };
}

export function analyzeSecurityGroup(sg: SecurityGroup): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const rule of sg.inboundRules) {
    const f = analyzeRule(sg, rule, "inbound");
    if (f) findings.push(f);
  }
  for (const rule of sg.outboundRules) {
    const f = analyzeRule(sg, rule, "outbound");
    if (f) findings.push(f);
  }
  return findings;
}

export function analyzeAll(): SecurityFinding[] {
  const all = getAllSecurityGroups();
  return all.flatMap(analyzeSecurityGroup);
}

export function getAnalysisSummary(): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  findings: SecurityFinding[];
} {
  const findings = analyzeAll();
  return {
    total: findings.length,
    critical: findings.filter((f) => f.severity === "CRITICAL").length,
    high: findings.filter((f) => f.severity === "HIGH").length,
    medium: findings.filter((f) => f.severity === "MEDIUM").length,
    low: findings.filter((f) => f.severity === "LOW").length,
    info: findings.filter((f) => f.severity === "INFO").length,
    findings,
  };
}
