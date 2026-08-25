# Signoff Gateway

The outbound mail hop that stamps a staff member's signature onto their mail before Google
Workspace delivers it. See `docs/ARCHITECTURE.md` in the repo root for why this exists and how
it fits together — short version:

```
sender (any client/device) → Google Workspace → [this gateway] → Google SMTP Relay → recipient
                                                        │
                                                        ▼
                                         GET /api/render?email=sender (the Next.js app)
```

Google still performs SPF/DKIM and actual internet delivery via its SMTP Relay service — this
gateway only receives the message, asks the app for the sender's rendered signature, appends
it, and hands the message back. It never resolves MX records or retries failed deliveries
itself.

## Local development

```bash
cd gateway
cp .env.example .env   # fill in RENDER_API_SECRET to match the app's
npm install
npm run dev
```

With `GATEWAY_DRY_RUN=true` (the `.env.example` default), the gateway logs the final stamped
message instead of actually relaying it — safe to run against nothing but your own machine.

In another terminal, with the Signoff app running (`npm run dev` in the repo root) and at least
one staff member + assigned template in the database:

```bash
FROM=jane.wanjiru@growthpad.co.ke TO=someone@example.com npm run test:send
```

Watch the gateway's terminal — you should see the relayed (or dry-run-logged) message with the
signature appended after `--`. If `FROM` doesn't match a staff row with an assigned template,
the message passes through unmodified and the gateway logs "no signature — sender not found".

## Going to production — do this in order, and test at each step

This handles every piece of outgoing company mail. Don't skip straight to step 4.

1. **Deploy the gateway somewhere with a static outbound IP** (a small VM works — this is a
   long-running TCP listener, not a serverless function). Run it behind TLS if possible; Google
   supports STARTTLS to the gateway.
2. **Set `GATEWAY_ALLOWED_IPS`** to Google's published outbound-gateway IP ranges for your
   Workspace instance (Admin console shows these when you configure the gateway in step 4).
   Never leave this empty in production — it's the only thing stopping arbitrary senders from
   handing mail to this service and having it relayed as if from your domain.
3. **Enable Google's SMTP Relay service** (Admin console → Apps → Google Workspace → Gmail →
   Routing → SMTP relay service) and allow-list this gateway's own outbound IP there — this is
   what lets the gateway hand mail back to Google for final delivery without needing its own
   SPF/DKIM setup. No DNS changes are required for this step.
4. **Configure the Outbound Gateway** (Admin console → Apps → Google Workspace → Gmail →
   Routing → Outbound gateway) pointing at this service's host:port. Start by scoping it to a
   single test OU (e.g. a throwaway test account), not the whole org.
5. **Send a real test message from that test account**, from a couple of different clients
   (Gmail web, a phone's native mail app, Outlook if anyone has it configured) and confirm the
   signature shows up on all of them, and that replies/threading still look normal.
6. **Widen the OU scope gradually**, watching gateway logs for errors, before rolling out to
   the whole domain.

## What this MVP doesn't handle yet

- **Bounce/NDR handling** — delivery failures from Google's relay aren't surfaced anywhere yet
  beyond its own logs. Fine for initial rollout; worth wiring up before full production traffic.
- **Attachments larger than fit in memory** — `mailparser` buffers the whole message; revisit
  if large attachments turn out to be common.
- **Deploy-status sync** — nothing yet flips `signature_assignments.deploy_status` in the app
  based on gateway activity. Next piece to build once this is confirmed working end-to-end.
