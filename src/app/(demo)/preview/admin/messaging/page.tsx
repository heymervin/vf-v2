import { COMMS_IDENTITY } from "@/lib/mock/admin"
import { MessagingClient } from "./messaging-client"

export const metadata = { title: "Messaging (SMS / WhatsApp) — Admin" }

export default function MessagingPage() {
  return <MessagingClient identity={COMMS_IDENTITY} />
}
