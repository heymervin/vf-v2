import { NextResponse } from "next/server";
import { runDueSequenceSteps } from "@/lib/sequences/run-due";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sequences — Vercel Cron entrypoint (every 15 minutes).
 *
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}`. We reject mismatches
 * with 401 when CRON_SECRET is set.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await runDueSequenceSteps();
  return NextResponse.json(result);
}
