import { NextResponse } from "next/server";
import { runDailyBrief } from "@/lib/reports/daily-brief";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/daily-brief — Vercel Cron entrypoint (07:00 UTC daily).
 *
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}`. We reject mismatches
 * with 401 when CRON_SECRET is set.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await runDailyBrief();
  return NextResponse.json(result);
}
