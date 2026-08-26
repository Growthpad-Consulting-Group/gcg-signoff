"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import SimpleModal from "@/shared/ui/SimpleModal";
import ModalLeftPanel, { ProTip, StepIndicator } from "@/shared/ui/ModalLeftPanel";

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
  google_workspace: "The gateway infrastructure is already deployed — these are just the steps left for this specific domain.",
  microsoft_365: "The gateway doesn't have a Microsoft 365 connector yet — this is a starting point, not a turnkey guide.",
  other: "No built-in integration — you'll need your own relay.",
};

// Deploying the gateway VM, restricting its IPs, and enabling Google's SMTP Relay service are
// one-time org-wide infrastructure — not repeated per domain, so they're not steps here.
const GOOGLE_WORKSPACE_STEPS = [
  {
    icon: "solar:key-minimalistic-square-broken",
    title: "Add the SPF/DKIM records",
    body: (
      <>
        Turn on DKIM signing in Admin console → Apps → Google Workspace → Gmail → Authenticate email, then add the TXT record it gives you plus{" "}
        <code className="rounded bg-surface-2 px-1">v=spf1 include:_spf.google.com ~all</code> for SPF.
      </>
    ),
  },
  {
    icon: "solar:routing-2-broken",
    title: "Configure the Outbound Gateway for this domain",
    body: "Admin console → Apps → Google Workspace → Gmail → Routing → Outbound gateway, pointing at the gateway's host:port. Start scoped to a single test OU in this domain, not the whole org.",
  },
  {
    icon: "solar:letter-broken",
    title: "Send a real test message",
    body: "From that test account, across a couple of clients (Gmail web, a phone's native mail app, Outlook if anyone uses it) — confirm the signature appears and replies/threading still look normal.",
  },
  {
    icon: "solar:widget-broken",
    title: "Widen the OU scope gradually",
    body: "Watch gateway logs for errors as you roll out to the rest of this domain's org units.",
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
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const loaded = loadChecked(domainId);
    setChecked(loaded);
    // Resume on the first unfinished step rather than always starting over at 1.
    const firstUnchecked = GOOGLE_WORKSPACE_STEPS.findIndex((_, i) => !loaded.has(i));
    setStepIndex(firstUnchecked === -1 ? GOOGLE_WORKSPACE_STEPS.length - 1 : firstUnchecked);
  }, [isOpen, domainId]);

  const persist = (next: Set<number>) => {
    try {
      window.localStorage.setItem(storageKey(domainId), JSON.stringify([...next]));
    } catch {
      // localStorage can throw in private browsing; the checklist just won't persist.
    }
  };

  const markDone = (i: number, done: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (done) next.add(i);
      else next.delete(i);
      persist(next);
      return next;
    });
  };

  const stepIndicatorSteps = useMemo(
    () =>
      GOOGLE_WORKSPACE_STEPS.map((s, i) => ({
        number: i + 1,
        label: s.title,
        icon: checked.has(i) ? "solar:check-circle-bold" : s.icon,
      })),
    [checked]
  );

  const step = GOOGLE_WORKSPACE_STEPS[stepIndex];
  const isLast = stepIndex === GOOGLE_WORKSPACE_STEPS.length - 1;

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
              Once the DNS records are live, use "Verify DNS" on the domain card to confirm — it can take a few minutes to an hour for changes to propagate.
            </ProTip>
          }
        >
          {platform === "google_workspace" && (
            <StepIndicator
              steps={stepIndicatorSteps}
              currentStep={stepIndex + 1}
              variant="vertical"
              onStepClick={(n) => setStepIndex(n - 1)}
            />
          )}
        </ModalLeftPanel>

        <div className="flex max-h-[80vh] flex-col lg:col-span-3">
          <div className="flex-1 overflow-y-auto p-8">
            {platform === "google_workspace" && step && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-text-lo">
                    Step {stepIndex + 1} of {GOOGLE_WORKSPACE_STEPS.length}
                  </span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${((stepIndex + 1) / GOOGLE_WORKSPACE_STEPS.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10">
                  <Icon icon={step.icon} className="h-6 w-6 text-brand-600" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-text-hi">{step.title}</h3>
                <p className="text-sm leading-relaxed text-text-lo">{step.body}</p>

                <label className="mt-6 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-sm text-text-hi transition-colors hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={checked.has(stepIndex)}
                    onChange={(e) => markDone(stepIndex, e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Mark this step done
                </label>
              </div>
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

          {platform === "google_workspace" && (
            <div className="flex items-center justify-between border-t border-app-border p-4">
              <button
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                disabled={stepIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi disabled:opacity-40"
              >
                <Icon icon="solar:arrow-left-broken" className="h-4 w-4" />
                Back
              </button>
              {isLast ? (
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                >
                  Done
                  <Icon icon="solar:check-circle-broken" className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setStepIndex((i) => Math.min(GOOGLE_WORKSPACE_STEPS.length - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                >
                  Next
                  <Icon icon="solar:arrow-right-broken" className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </SimpleModal>
  );
}
