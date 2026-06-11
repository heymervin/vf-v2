import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Brochure download proxy. Looks the brochure up by its opaque download_token,
 * logs the open (count + timestamp), then 302s to a fresh short-lived signed
 * URL for the private PDF. The token in the email is stable; the signed URL is
 * minted per request, so links never expire and the file stays private.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Basic shape guard (download_token is a uuid).
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: brochure } = await admin
    .from("brochures")
    .select("id, file_path, is_active, download_count")
    .eq("download_token", token)
    .maybeSingle();

  if (!brochure || !brochure.is_active) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Log the open (best effort — never block the download on this).
  await admin
    .from("brochures")
    .update({
      download_count: (brochure.download_count ?? 0) + 1,
      last_downloaded_at: new Date().toISOString(),
    })
    .eq("id", brochure.id);

  const { data: signed, error } = await admin.storage
    .from("brochures")
    .createSignedUrl(brochure.file_path, 60 * 5); // 5 minutes

  if (error || !signed) {
    console.error("brochure signed url failed:", error?.message);
    return new NextResponse("Brochure unavailable", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
