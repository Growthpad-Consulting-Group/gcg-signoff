"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import SimpleModal from "@/shared/ui/SimpleModal";
import Button from "@/shared/ui/Button";

interface CloudflareSectionProps {
  domainId: string;
  connected: boolean;
  detectedProvider: string | null;
  spfVerified: boolean;
  dkimVerified: boolean;
  onChanged: () => void;
}

export default function CloudflareSection({ domainId, connected, detectedProvider, spfVerified, dkimVerified, onChanged }: CloudflareSectionProps) {
  const [showConnect, setShowConnect] = useState(false);
  const [apiToken, setApiToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [applyingSpf, setApplyingSpf] = useState(false);
  const [applyingDkim, setApplyingDkim] = useState(false);
  const [dkimName, setDkimName] = useState("");
  const [dkimValue, setDkimValue] = useState("");

  const connect = async () => {
    if (!apiToken.trim()) return;
    setConnecting(true);
    const res = await fetch(`/api/domains/${domainId}/cloudflare/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiToken: apiToken.trim() }),
    });
    setConnecting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to connect Cloudflare");
      return;
    }
    toast.success("Cloudflare connected");
    setApiToken("");
    setShowConnect(false);
    onChanged();
  };

  const disconnect = async () => {
    const res = await fetch(`/api/domains/${domainId}/cloudflare/disconnect`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to disconnect");
      return;
    }
    toast.success("Cloudflare disconnected");
    onChanged();
  };

  const applySpf = async () => {
    setApplyingSpf(true);
    const res = await fetch(`/api/domains/${domainId}/cloudflare/apply-spf`, { method: "POST" });
    setApplyingSpf(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to apply SPF record");
      return;
    }
    toast.success("SPF record applied");
    onChanged();
  };

  const applyDkim = async () => {
    if (!dkimName.trim() || !dkimValue.trim()) return;
    setApplyingDkim(true);
    const res = await fetch(`/api/domains/${domainId}/cloudflare/apply-dkim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordName: dkimName.trim(), value: dkimValue.trim() }),
    });
    setApplyingDkim(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Failed to apply DKIM record");
      return;
    }
    toast.success("DKIM record applied");
    setDkimName("");
    setDkimValue("");
    onChanged();
  };

  // Nothing to apply — SPF and DKIM already resolve correctly, so don't dangle an "auto-apply"
  // offer that would have nothing to actually change.
  if (spfVerified && dkimVerified && !connected) return null;

  if (!connected) {
    return (
      <>
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
        >
          <Icon icon="simple-icons:cloudflare" className="h-3.5 w-3.5" />
          Connect Cloudflare to auto-apply records
        </button>

        <SimpleModal isOpen={showConnect} onClose={() => setShowConnect(false)} title="Connect Cloudflare" width="max-w-md">
          <div className="space-y-4">
            {detectedProvider && detectedProvider !== "Cloudflare" && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-900/10 dark:text-amber-400">
                <Icon icon="solar:danger-triangle-broken" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The last DNS check detected this domain's nameservers as <strong>{detectedProvider}</strong>, not Cloudflare — connecting here will only work if it's actually managed on Cloudflare.
              </p>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-text-hi">Cloudflare API token</label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste a scoped token"
                autoFocus
                className="w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="mt-1.5 text-xs text-text-lo">
                Create one at My Profile → API Tokens → Create Token, scoped to <strong>Zone → DNS → Edit</strong> for this one zone — not the legacy Global API Key. It's stored encrypted so you won't need to re-enter it next time.
              </p>
            </div>
            <Button className="w-full" onClick={connect} disabled={!apiToken.trim() || connecting}>
              {connecting ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </SimpleModal>
      </>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-app-border p-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Icon icon="simple-icons:cloudflare" className="h-3.5 w-3.5" />
          Cloudflare connected
        </span>
        <button onClick={disconnect} className="text-[11px] font-medium text-text-lo hover:text-status-danger">
          Disconnect
        </button>
      </div>

      {spfVerified && dkimVerified ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Icon icon="solar:check-circle-broken" className="h-3.5 w-3.5" />
          SPF and DKIM already resolve correctly — nothing to apply.
        </p>
      ) : (
        <>
          {!spfVerified && (
            <button
              onClick={applySpf}
              disabled={applyingSpf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-hi transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {applyingSpf ? <Icon icon="solar:loading-bold" className="h-3.5 w-3.5 animate-spin" /> : <Icon icon="solar:magic-stick-3-broken" className="h-3.5 w-3.5" />}
              Apply SPF record
            </button>
          )}

          {!dkimVerified && (
            <div className="flex flex-col gap-1.5 sm:flex-row">
              <input
                value={dkimName}
                onChange={(e) => setDkimName(e.target.value)}
                placeholder="Record name (e.g. google._domainkey)"
                className="flex-1 rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                value={dkimValue}
                onChange={(e) => setDkimValue(e.target.value)}
                placeholder="DKIM value from Google Admin"
                className="flex-1 rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs text-text-hi outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={applyDkim}
                disabled={!dkimName.trim() || !dkimValue.trim() || applyingDkim}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-hi transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {applyingDkim ? <Icon icon="solar:loading-bold" className="h-3.5 w-3.5 animate-spin" /> : <Icon icon="solar:magic-stick-3-broken" className="h-3.5 w-3.5" />}
                Apply DKIM
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
