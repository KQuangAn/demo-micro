/**
 * ══════════════════════════════════════════════════════════════════
 *  GET /api/ec2/security-groups — List / Search / Analyze
 * ══════════════════════════════════════════════════════════════════
 *
 *  Direct REST endpoint (no LLM) for:
 *    GET /api/ec2/security-groups             — list all
 *    GET /api/ec2/security-groups?search=xxx  — search
 *    GET /api/ec2/security-groups?analyze=all — full audit
 *
 *  POST /api/ec2/security-groups/sync         — re-sync from AWS
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { ensureSynced, syncFromAWS } from "@/lib/ec2/sg-sync";
import {
  getAllSecurityGroups,
  searchSecurityGroups,
  getAnalysisSummary,
} from "@/lib/ec2/sg-store";

export async function GET(req: NextRequest) {
  await ensureSynced();

  const search = req.nextUrl.searchParams.get("search");
  const analyze = req.nextUrl.searchParams.get("analyze");

  if (analyze === "all") {
    const summary = getAnalysisSummary();
    return NextResponse.json(summary);
  }

  if (search) {
    const results = searchSecurityGroups(search);
    return NextResponse.json({ count: results.length, groups: results });
  }

  const all = getAllSecurityGroups();
  return NextResponse.json({ count: all.length, groups: all });
}

export async function POST(req: NextRequest) {
  const result = await syncFromAWS();
  return NextResponse.json(result);
}
