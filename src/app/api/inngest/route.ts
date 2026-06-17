import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { healthPing } from "@/inngest/functions/health";
import { leadCaptured } from "@/inngest/functions/lead-captured";
import { sequenceRun } from "@/inngest/functions/sequence-run";
import { appointmentBooked } from "@/inngest/functions/appointment-booked";
import { opportunityWon } from "@/inngest/functions/opportunity-won";

// Add Inngest functions here as they are created.
const functions: Parameters<typeof serve>[0]["functions"] = [
  healthPing,
  leadCaptured,
  sequenceRun,
  appointmentBooked,
  opportunityWon,
];

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
