"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import SimpleModal from "@/shared/ui/SimpleModal";
import ModalLeftPanel, { ProTip } from "@/shared/ui/ModalLeftPanel";

type Platform = "google_workspace" | "microsoft_365" | "other";

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
  domainId: string;
  domainName: string;
}

const PLATFORM_ICON: Record<Platform, string> = {
  google_workspace: "logos:google-gmail",
  microsoft_365: "logos:microsoft-icon",
  other: "solar:server-broken",
};

const PLATFORM_SUBTITLE: Record<Platform, string> = {
  google_workspace: "Fully supported by the built-in gateway — check off each step as you go.",
  microsoft_365: "The gateway doesn't have a Microsoft 365 connector yet — this is a starting point, not a turnkey guide.",
  other: "No built-in integration — you'll need your own relay.",
};

const GOOGLE_WORKSPACE_STEPS = [
  {
    title: "Deploy the gateway somewhere with a static outbound IP",
    body: "A small always-on VM works — it's a long-running TCP listener, not a serverless function. Run it behind TLS if possible; Google supports STARTTLS to the gateway.",
  },
  {
    title: "Restrict who can talk to it",
    body: (
      <>
        Set <code className="rounded bg-surface-2 px-1">GATEWAY_ALLOWED_IPS</code> to Google's published outbound-gateway IP ranges for your Workspace instance (shown in the Admin console when you configure the step below). Never leave this empty in production.
      </>
    ),
  },
  {
    title: "Enable Google's SMTP Relay service",
    body: "Admin console → Apps → Google Workspace → Gmail → Routing → SMTP relay service. Allow-list the gateway's own outbound IP there — this lets it hand mail back to Google for final delivery without needing its own SPF/DKIM setup. No DNS changes required for this step.",
  },
  {
    title: "Configure the Outbound Gateway",
    body: "Admin console → Apps → Google Workspace → Gmail → Routing → Outbound gateway, pointing at your gateway's public host:port. Start scoped to a single test OU, not the whole org.",
  },
  {
    title: "Send a real test message",
    body: "From that test account, across a couple of clients (Gmail web, a phone's native mail app, Outlook if anyone uses it) — confirm the signature appears and replies/threading still look normal.",
  },
  {
    title: "Widen the OU scope gradually",
    body: "Watch gateway logs for errors as you roll out to more of the domain.",
  },
  {
    title: "Add the SPF/DKIM records",
    body: (
      <>
        Turn on DKIM signing in Admin console → Apps → Google Workspace → Gmail → Authenticate email, then add the TXT record it gives you plus{" "}
        <code className="rounded bg-surface-2 px-1">v=spf1 include:_spf.google.com ~all</code> for SPF.
      </>
    ),
  },
];

function storageKey(domainId: string) {
  return `signoff:domain-setup:${domainId}`;
}

function loadChecked(domainId: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(domainId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export default function SetupGuideModal({ isOpen, onClose, platform, domainId, domainName }: SetupGuideModalProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) setChecked(loadChecked(domainId));
  }, [isOpen, domainId]);

  const toggleStep = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      try {
        window.localStorage.setItem(storageKey(domainId), JSON.stringify([...next]));
      } catch {
        // localStorage can throw in private browsing; the checklist just won't persist.
      }
      return next;
    });
  };

  return (
    <SimpleModal isOpen={isOpen} onClose={onClose} title="" width="max-w-4xl" noPadding>
      <div className="grid lg:grid-cols-5">
        <ModalLeftPanel
          title={`Set up ${domainName}`}
          subtitle={PLATFORM_SUBTITLE[platform]}
          icon={PLATFORM_ICON[platform]}
          iconBg="richBeige"
          footer={
            <ProTip icon="solar:refresh-circle-broken">
              Once the DNS records below are live, use "Verify DNS" on the domain card to confirm — it can take a few minutes to an hour for changes to propagate.
            </ProTip>
          }
        />

        <div className="lg:col-span-3 max-h-[80vh] overflow-y-auto p-8">
          {platform === "google_workspace" && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs text-text-lo">
                  {checked.size} of {GOOGLE_WORKSPACE_STEPS.length} steps checked
                </p>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${(checked.size / GOOGLE_WORKSPACE_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
              <ol className="space-y-1">
                {GOOGLE_WORKSPACE_STEPS.map((step, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer gap-3 rounded-lg p-2 transition-colors hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={checked.has(i)}
                        onChange={() => toggleStep(i)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded"
                      />
                      <div>
                        <p className={`text-sm font-medium ${checked.has(i) ? "text-text-lo line-through" : "text-text-hi"}`}>
                          {i + 1}. {step.title}
                        </p>
                        <div className="mt-0.5 text-xs leading-relaxed text-text-lo">{step.body}</div>
                      </div>
                    </label>
                  </li>
                ))}
              </ol>
            </>
          )}

          {platform === "microsoft_365" && (
            <div className="space-y-3 text-sm text-text-lo">
              <p className="flex items-start gap-2">
                <Icon icon="solar:danger-triangle-broken" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                The gateway currently only implements the Google Workspace relay flow (SMTP listener + Google's SMTP Relay service). Microsoft 365 needs a transport rule routing outbound mail through an equivalent connector, which isn't built yet.
              </p>
              <p>In the meantime: add an SPF record (<code className="rounded bg-surface-2 px-1">v=spf1 include:spf.protection.outlook.com -all</code>) and enable DKIM signing in the Microsoft 365 Defender portal.</p>
            </div>
          )}

          {platform === "other" && (
            <div className="space-y-3 text-sm text-text-lo">
              <p className="flex items-start gap-2">
                <Icon icon="solar:danger-triangle-broken" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                "Other / generic SMTP" has no built-in gateway integration — you'll need your own relay that calls this app's render API to fetch and stamp each sender's signature.
              </p>
              <p>Whatever relay you use, make sure its outbound IP is covered by an SPF include for this domain.</p>
            </div>
          )}
        </div>
      </div>
    </SimpleModal>
  );
}
