"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { connectGhl, disconnectGhl, testGhlConnection } from "./actions";
import type { GhlCounts } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GhlSettingsProps {
  connected: boolean;
  mode: string;
  locationId: string | null;
  counts: GhlCounts | null;
  canManage: boolean;
}

// ── LiveCounts — rendered when connected and live data was fetched ─────────────

function LiveCounts({ counts }: { counts: GhlCounts }) {
  const totalValue = counts.pipelineStages.reduce(
    (sum, s) => sum + s.totalValue,
    0,
  );
  const totalOpps = counts.pipelineStages.reduce(
    (sum, s) => sum + s.count,
    0,
  );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-2xl font-bold text-foreground">
          {counts.totalContacts.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Contacts in GHL</p>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-2xl font-bold text-foreground">
          {totalOpps.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Open opportunities</p>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-2xl font-bold text-foreground">
          {totalValue > 0
            ? `$${(totalValue / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : "—"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Pipeline value</p>
      </div>
    </div>
  );
}

// ── ConnectForm — paste PIT + location ID ─────────────────────────────────────

function ConnectForm({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [token, setToken] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleConnect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    const result = await connectGhl({ token, locationId });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("GoHighLevel connected.");
    router.refresh();
  }

  return (
    <form onSubmit={handleConnect} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ghl-token">
          Private Integration Token <span aria-hidden="true">*</span>
        </Label>
        <Input
          id="ghl-token"
          type="password"
          placeholder="eyJhbGci…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          disabled={!canManage || saving}
          className="font-mono text-[16px] sm:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Found in your GHL sub-account under Settings → Integrations → Private
          Integration Token.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ghl-location-id">
          Location ID <span aria-hidden="true">*</span>
        </Label>
        <Input
          id="ghl-location-id"
          placeholder="abc123XYZ"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          required
          disabled={!canManage || saving}
          className="font-mono text-[16px] sm:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Found in GHL under Settings → Business Info → Location ID.
        </p>
      </div>

      {canManage && (
        <Button type="submit" disabled={saving}>
          {saving ? "Connecting…" : "Connect GoHighLevel"}
        </Button>
      )}
    </form>
  );
}

// ── GhlSettings — main export ─────────────────────────────────────────────────

export function GhlSettings({
  connected,
  mode,
  locationId,
  counts,
  canManage,
}: GhlSettingsProps) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [liveCounts, setLiveCounts] = React.useState<GhlCounts | null>(counts);

  async function handleDisconnect() {
    if (!canManage) return;
    setDisconnecting(true);
    const result = await disconnectGhl();
    setDisconnecting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("GoHighLevel disconnected.");
    router.refresh();
  }

  async function handleTest() {
    setTesting(true);
    const result = await testGhlConnection();
    setTesting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLiveCounts(result.data);
    toast.success("Connection verified — live counts updated.");
  }

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Connection status</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {connected
                ? `Connected · Location ${locationId ?? "unknown"} · mode: ${mode}`
                : "Not connected — GHL features are disabled."}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              connected
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {/* Live counts when connected */}
        {connected && liveCounts && (
          <div className="mt-5">
            <LiveCounts counts={liveCounts} />
          </div>
        )}

        {connected && !liveCounts && (
          <p className="mt-4 text-sm text-muted-foreground">
            Live counts unavailable — GHL may be unreachable. Use &ldquo;Test
            connection&rdquo; to retry.
          </p>
        )}

        {/* Action buttons when connected */}
        {connected && canManage && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        )}
      </div>

      {/* Connect form — only shown when not connected */}
      {!connected && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Connect your sub-account
          </h2>
          <ConnectForm canManage={canManage} />
        </div>
      )}
    </div>
  );
}
