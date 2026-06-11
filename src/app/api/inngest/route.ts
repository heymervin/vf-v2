import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { healthPing } from "@/inngest/functions/health";

// Add Inngest functions here as they are created.
const functions: Parameters<typeof serve>[0]["functions"] = [healthPing];

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
