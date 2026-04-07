/**
 * ══════════════════════════════════════════════════════════════════
 *  EC2 Security Group Types
 * ══════════════════════════════════════════════════════════════════
 */

export interface SecurityGroupRule {
  protocol: string;       // tcp, udp, icmp, -1 (all)
  fromPort: number;
  toPort: number;
  source: string;         // CIDR or security group ID
  description: string;
}

export interface SecurityGroup {
  id: string;             // sg-xxxxxxxx
  name: string;
  description: string;
  vpcId: string;
  inboundRules: SecurityGroupRule[];
  outboundRules: SecurityGroupRule[];
  tags: Record<string, string>;
  syncedAt: string;       // ISO timestamp
}

export interface SecurityFinding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  groupId: string;
  groupName: string;
  rule: SecurityGroupRule;
  direction: "inbound" | "outbound";
  message: string;
  recommendation: string;
}

export interface AgentMode {
  type: "simple" | "react";
}
