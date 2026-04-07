/**
 * ══════════════════════════════════════════════════════════════════
 *  AWS EC2 Security Group Sync
 * ══════════════════════════════════════════════════════════════════
 *
 *  Fetches security groups from AWS EC2 and stores them locally.
 *  Falls back to seed data when AWS credentials are not available.
 *
 * ══════════════════════════════════════════════════════════════════
 */

import type { SecurityGroup, SecurityGroupRule } from "./types";
import { upsertMany, getStoreSize } from "./sg-store";

/* ─── Seed data — realistic examples for local dev ─────── */

const SEED_SECURITY_GROUPS: SecurityGroup[] = [
  {
    id: "sg-0a1b2c3d4e5f00001",
    name: "web-server-prod",
    description: "Production web servers - public facing",
    vpcId: "vpc-abc123",
    inboundRules: [
      {
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        source: "0.0.0.0/0",
        description: "HTTPS from anywhere",
      },
      {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        source: "0.0.0.0/0",
        description: "HTTP from anywhere (redirects to HTTPS)",
      },
      {
        protocol: "tcp",
        fromPort: 22,
        toPort: 22,
        source: "10.0.0.0/8",
        description: "SSH from internal VPN only",
      },
    ],
    outboundRules: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 65535,
        source: "0.0.0.0/0",
        description: "Allow all outbound",
      },
    ],
    tags: { Environment: "production", Team: "platform", Service: "web" },
    syncedAt: new Date().toISOString(),
  },
  {
    id: "sg-0a1b2c3d4e5f00002",
    name: "database-prod",
    description: "Production RDS databases",
    vpcId: "vpc-abc123",
    inboundRules: [
      {
        protocol: "tcp",
        fromPort: 5432,
        toPort: 5432,
        source: "sg-0a1b2c3d4e5f00001",
        description: "PostgreSQL from web servers",
      },
      {
        protocol: "tcp",
        fromPort: 5432,
        toPort: 5432,
        source: "10.0.0.0/8",
        description: "PostgreSQL from VPN",
      },
    ],
    outboundRules: [
      {
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        source: "0.0.0.0/0",
        description: "HTTPS for AWS API calls",
      },
    ],
    tags: { Environment: "production", Team: "data", Service: "postgres" },
    syncedAt: new Date().toISOString(),
  },
  {
    id: "sg-0a1b2c3d4e5f00003",
    name: "bastion-host",
    description: "Bastion / jump box for SSH access",
    vpcId: "vpc-abc123",
    inboundRules: [
      {
        protocol: "tcp",
        fromPort: 22,
        toPort: 22,
        source: "0.0.0.0/0",
        description: "SSH from anywhere — NEEDS REVIEW",
      },
    ],
    outboundRules: [
      {
        protocol: "tcp",
        fromPort: 22,
        toPort: 22,
        source: "10.0.0.0/8",
        description: "SSH to internal hosts",
      },
    ],
    tags: { Environment: "production", Team: "infra", Service: "bastion" },
    syncedAt: new Date().toISOString(),
  },
  {
    id: "sg-0a1b2c3d4e5f00004",
    name: "dev-anything-goes",
    description: "Dev environment — overly permissive",
    vpcId: "vpc-dev456",
    inboundRules: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 65535,
        source: "0.0.0.0/0",
        description: "All traffic from anywhere",
      },
    ],
    outboundRules: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 65535,
        source: "0.0.0.0/0",
        description: "All traffic to anywhere",
      },
    ],
    tags: { Environment: "development", Team: "dev", Service: "misc" },
    syncedAt: new Date().toISOString(),
  },
  {
    id: "sg-0a1b2c3d4e5f00005",
    name: "redis-cache",
    description: "ElastiCache Redis cluster",
    vpcId: "vpc-abc123",
    inboundRules: [
      {
        protocol: "tcp",
        fromPort: 6379,
        toPort: 6379,
        source: "0.0.0.0/0",
        description: "Redis from anywhere — MISCONFIGURED",
      },
    ],
    outboundRules: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 65535,
        source: "0.0.0.0/0",
        description: "All outbound",
      },
    ],
    tags: { Environment: "production", Team: "platform", Service: "redis" },
    syncedAt: new Date().toISOString(),
  },
  {
    id: "sg-0a1b2c3d4e5f00006",
    name: "monitoring-stack",
    description: "Prometheus + Grafana + AlertManager",
    vpcId: "vpc-abc123",
    inboundRules: [
      {
        protocol: "tcp",
        fromPort: 3000,
        toPort: 3000,
        source: "10.0.0.0/8",
        description: "Grafana UI from VPN",
      },
      {
        protocol: "tcp",
        fromPort: 9090,
        toPort: 9090,
        source: "10.0.0.0/8",
        description: "Prometheus from VPN",
      },
      {
        protocol: "tcp",
        fromPort: 9093,
        toPort: 9093,
        source: "10.0.0.0/8",
        description: "AlertManager from VPN",
      },
    ],
    outboundRules: [
      {
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        source: "0.0.0.0/0",
        description: "HTTPS for alerting webhooks",
      },
      {
        protocol: "tcp",
        fromPort: 9100,
        toPort: 9100,
        source: "10.0.0.0/8",
        description: "Node Exporter scraping",
      },
    ],
    tags: { Environment: "production", Team: "sre", Service: "monitoring" },
    syncedAt: new Date().toISOString(),
  },
  {
    id: "sg-0a1b2c3d4e5f00007",
    name: "legacy-app",
    description: "Legacy monolith — scheduled for decommission",
    vpcId: "vpc-legacy789",
    inboundRules: [
      {
        protocol: "tcp",
        fromPort: 22,
        toPort: 22,
        source: "0.0.0.0/0",
        description: "SSH wide open",
      },
      {
        protocol: "tcp",
        fromPort: 3306,
        toPort: 3306,
        source: "0.0.0.0/0",
        description: "MySQL wide open — CRITICAL",
      },
      {
        protocol: "tcp",
        fromPort: 8080,
        toPort: 8080,
        source: "0.0.0.0/0",
        description: "App port from anywhere",
      },
      {
        protocol: "tcp",
        fromPort: 3389,
        toPort: 3389,
        source: "0.0.0.0/0",
        description: "RDP wide open — CRITICAL",
      },
    ],
    outboundRules: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 65535,
        source: "0.0.0.0/0",
        description: "All outbound",
      },
    ],
    tags: { Environment: "production", Team: "legacy", Service: "monolith" },
    syncedAt: new Date().toISOString(),
  },
  {
    id: "sg-0a1b2c3d4e5f00008",
    name: "api-gateway-prod",
    description: "API Gateway / Load Balancer",
    vpcId: "vpc-abc123",
    inboundRules: [
      {
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        source: "0.0.0.0/0",
        description: "HTTPS from CloudFront",
      },
    ],
    outboundRules: [
      {
        protocol: "tcp",
        fromPort: 8080,
        toPort: 8080,
        source: "sg-0a1b2c3d4e5f00001",
        description: "To web servers",
      },
    ],
    tags: { Environment: "production", Team: "platform", Service: "api-gw" },
    syncedAt: new Date().toISOString(),
  },
];

/* ─── Sync from AWS (or seed) ────────────────────────────── */

export async function syncFromAWS(): Promise<{
  count: number;
  source: "aws" | "seed";
}> {
  const hasAwsCreds =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  if (hasAwsCreds) {
    try {
      const { EC2Client, DescribeSecurityGroupsCommand } = await import(
        "@aws-sdk/client-ec2"
      );

      const ec2 = new EC2Client({
        region: process.env.AWS_REGION || "ap-southeast-1",
      });

      const result = await ec2.send(new DescribeSecurityGroupsCommand({}));
      const groups: SecurityGroup[] = (result.SecurityGroups || []).map(
        (sg) => ({
          id: sg.GroupId || "unknown",
          name: sg.GroupName || "unnamed",
          description: sg.Description || "",
          vpcId: sg.VpcId || "",
          inboundRules: (sg.IpPermissions || []).flatMap((perm) =>
            (perm.IpRanges || []).map((range) => ({
              protocol: perm.IpProtocol || "-1",
              fromPort: perm.FromPort ?? 0,
              toPort: perm.ToPort ?? 65535,
              source: range.CidrIp || "unknown",
              description: range.Description || "",
            }))
          ),
          outboundRules: (sg.IpPermissionsEgress || []).flatMap((perm) =>
            (perm.IpRanges || []).map((range) => ({
              protocol: perm.IpProtocol || "-1",
              fromPort: perm.FromPort ?? 0,
              toPort: perm.ToPort ?? 65535,
              source: range.CidrIp || "unknown",
              description: range.Description || "",
            }))
          ),
          tags: Object.fromEntries(
            (sg.Tags || []).map((t) => [t.Key || "", t.Value || ""])
          ),
          syncedAt: new Date().toISOString(),
        })
      );

      upsertMany(groups);
      return { count: groups.length, source: "aws" };
    } catch (err) {
      console.warn("AWS sync failed, falling back to seed data:", err);
    }
  }

  // Fall back to seed data
  upsertMany(SEED_SECURITY_GROUPS);
  return { count: SEED_SECURITY_GROUPS.length, source: "seed" };
}

/* ─── Ensure store is populated ──────────────────────────── */

let synced = false;
export async function ensureSynced(): Promise<void> {
  if (synced && getStoreSize() > 0) return;
  await syncFromAWS();
  synced = true;
}
