"use client";

import { Icon } from "@iconify/react";
import SimpleModal from "@/shared/ui/SimpleModal";

type Platform = "google_workspace" | "microsoft_365" | "other";

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
  domainName: string;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-semibold text-brand-600">
        {n}
      </span>
      <div>
        <p className="text-sm font-medium text-text-hi">{title}</p>
        <div className="mt-0.5 text-xs leading-relaxed text-text-lo">{children}</div>
      </div>
    </li>
  );
}

export default function SetupGuideModal({ isOpen, onClose, platform, domainName }: SetupGuideModalProps) {
  return (
    <SimpleModal isOpen={isOpen} onClose={onClose} title={`Set up ${domainName}`} width="max-w-lg">
      {platform === "google_workspace" && (
        <ol className="space-y-4">
          <Step n={1} title="Deploy the gateway somewhere with a static outbound IP">
            A small always-on VM works — it's a long-running TCP listener, not a serverless function. Run it behind TLS if possible; Google supports STARTTLS to the gateway.
          </Step>
          <Step n={2} title="Restrict who can talk to it">
            Set <code className="rounded bg-surface-2 px-1">GATEWAY_ALLOWED_IPS</code> to Google's published outbound-gateway IP ranges for your Workspace instance (shown in the Admin console when you configure step 4). Never leave this empty in production.
          </Step>
          <Step n={3} title="Enable Google's SMTP Relay service">
            Admin console → Apps → Google Workspace → Gmail → Routing → SMTP relay service. Allow-list the gateway's own outbound IP there — this lets it hand mail back to Google for final delivery without needing its own SPF/DKIM setup. No DNS changes required for this step.
          </Step>
          <Step n={4} title="Configure the Outbound Gateway">
            Admin console → Apps → Google Workspace → Gmail → Routing → Outbound gateway, pointing at your gateway's public host:port. Start scoped to a single test OU, not the whole org.
          </Step>
          <Step n={5} title="Send a real test message">
            From that test account, across a couple of clients (Gmail web, a phone's native mail app, Outlook if anyone uses it) — confirm the signature appears and replies/threading still look normal.
          </Step>
          <Step n={6} title="Widen the OU scope gradually">
            Watch gateway logs for errors as you roll out to more of the domain.
          </Step>
          <Step n={7} title="Add the SPF/DKIM records">
            Turn on DKIM signing in Admin console → Apps → Google Workspace → Gmail → Authenticate email, then add the TXT record it gives you plus <code className="rounded bg-surface-2 px-1">v=spf1 include:_spf.google.com ~all</code> for SPF. Use "Verify DNS" on this page once added.
          </Step>
        </ol>
      )}

      {platform === "microsoft_365" && (
        <div className="space-y-3 text-sm text-text-lo">
          <p className="flex items-start gap-2">
            <Icon icon="solar:danger-triangle-broken" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            The gateway currently only implements the Google Workspace relay flow (SMTP listener + Google's SMTP Relay service). Microsoft 365 needs a transport rule routing outbound mail through an equivalent connector, which isn't built yet — treat this as a starting point, not a turnkey guide.
          </p>
          <p>In the meantime: add an SPF record (<code className="rounded bg-surface-2 px-1">v=spf1 include:spf.protection.outlook.com -all</code>) and enable DKIM signing in the Microsoft 365 Defender portal, then use "Verify DNS" on this page.</p>
        </div>
      )}

      {platform === "other" && (
        <div className="space-y-3 text-sm text-text-lo">
          <p className="flex items-start gap-2">
            <Icon icon="solar:danger-triangle-broken" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            "Other / generic SMTP" has no built-in gateway integration — you'll need your own relay that calls this app's render API to fetch and stamp each sender's signature.
          </p>
          <p>Whatever relay you use, make sure its outbound IP is covered by an SPF include for this domain, then use "Verify DNS" on this page to confirm.</p>
        </div>
      )}
    </SimpleModal>
  );
}
