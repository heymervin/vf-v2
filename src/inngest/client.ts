import { Inngest } from "inngest";

// In production, INNGEST_SIGNING_KEY must be set so the Inngest SDK can verify
// that incoming webhook POSTs are genuinely from Inngest's servers.
// In local dev with INNGEST_DEV=1 the signing check is bypassed by the SDK,
// so the key may be absent.
//
// The check is skipped during `next build` (NEXT_PHASE=phase-production-build)
// because the signing key is a runtime secret that shouldn't be present in CI
// build environments. It is enforced at server startup / first request.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (
  process.env.NODE_ENV === "production" &&
  !isBuildPhase &&
  !process.env.INNGEST_SIGNING_KEY
) {
  throw new Error(
    "INNGEST_SIGNING_KEY must be set in production. " +
      "Add it to your environment variables.",
  );
}

export const inngest = new Inngest({
  id: "venueflow",
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
