import { redirect } from "next/navigation";

// The app root sends visitors straight into the product — authenticated users
// land on the dashboard; the auth proxy bounces anonymous hits to /login.
// (The old marketing splash was out-of-scope scaffolding and predated the
// GHL-as-backend pivot, so it's been removed. Marketing belongs on its own site.)
export default function Home() {
  redirect("/dashboard");
}
