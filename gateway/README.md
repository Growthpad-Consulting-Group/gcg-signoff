# Signoff Gateway

The outbound mail hop that stamps a staff member's signature onto their mail, then delivers
it directly to recipient mail servers. See `docs/ARCHITECTURE.md` in the repo root for why this
exists and how it fits together — short version:

```
sender (any client/device) → Google Workspace → [this gateway] → MX lookup & direct delivery → recipient
                                  (Outbound Gateway rule)      │
                                                               ▼
                                         GET /api/render?email=sender (the Next.js app)
```

This gateway receives mail from Google Workspace's Outbound Gateway, fetches the sender's
rendered signature from the app, appends it, performs MX lookups for each recipient domain, and
delivers directly to their mail servers. The gateway owns the sending IP's reputation and
delivery path.

## Local development

```bash
cd gateway
cp .env.example .env   # fill in RENDER_API_SECRET to match the app's
npm install
npm run dev
```

With `GATEWAY_DRY_RUN=true` (the `.env.example` default), the gateway logs the final stamped
message instead of performing actual MX lookups and delivery — safe to run against nothing but
your own machine.

In another terminal, with the Signoff app running (`npm run dev` in the repo root) and at least
one staff member + assigned template in the database:

```bash
FROM=jane.wanjiru@growthpad.co.ke TO=someone@example.com npm run test:send
```

Watch the gateway's terminal — you should see a DRY RUN log showing the message with the
signature appended. If `FROM` doesn't match a staff row with an assigned template,
the message passes through unmodified and the gateway logs "no signature — sender not found".

## Going to production — do this in order, and test at each step

This handles every piece of outgoing company mail. Don't skip straight to step 4.

1. **Deploy the gateway somewhere with a static outbound IP** (a small VM works — this is a
   long-running TCP listener, not a serverless function). Give it a real TLS cert for STARTTLS
   rather than smtp-server's built-in default (whose private key is publicly known):
   ```bash
   sudo dnf install -y epel-release && sudo dnf config-manager --set-enabled ol9_developer_EPEL
   sudo dnf install -y certbot
   # Needs an A record for this hostname pointing at the box, and port 80 briefly reachable
   # (open it in both the OS firewall and the cloud provider's security list/rules) —
   # certbot's standalone mode binds it just for the HTTP-01 challenge, nothing stays open after.
   sudo systemctl stop signoff-gateway
   sudo certbot certonly --standalone --non-interactive --agree-tos -m you@yourdomain.com -d gateway.yourdomain.com
   ```
   Then set up a deploy hook so renewals (auto-scheduled by certbot, ~every 60 days) copy the
   renewed cert somewhere the gateway's non-root user can actually read — Let's Encrypt's own
   `/etc/letsencrypt/live/.../privkey.pem` is root-only:
   ```bash
   sudo mkdir -p /opt/signoff-gateway/tls
   sudo tee /etc/letsencrypt/renewal-hooks/deploy/signoff-gateway.sh > /dev/null << 'EOF'
   #!/bin/bash
   set -e
   cp /etc/letsencrypt/live/gateway.yourdomain.com/fullchain.pem /opt/signoff-gateway/tls/fullchain.pem
   cp /etc/letsencrypt/live/gateway.yourdomain.com/privkey.pem /opt/signoff-gateway/tls/privkey.pem
   chown opc:opc /opt/signoff-gateway/tls/fullchain.pem /opt/signoff-gateway/tls/privkey.pem
   chmod 600 /opt/signoff-gateway/tls/privkey.pem
   chmod 644 /opt/signoff-gateway/tls/fullchain.pem
   systemctl restart signoff-gateway
   EOF
   sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/signoff-gateway.sh
   sudo /etc/letsencrypt/renewal-hooks/deploy/signoff-gateway.sh  # run once now to populate it
   ```
   Then set `GATEWAY_TLS_CERT_PATH=/opt/signoff-gateway/tls/fullchain.pem` and
   `GATEWAY_TLS_KEY_PATH=/opt/signoff-gateway/tls/privkey.pem` in `.env`. Omitting both falls
   back to the default cert — fine for local dev, not for anything internet-reachable.
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

## Status: Phase 1 in development (Sep 2026)

Earlier investigation found that relaying mail through Google's SMTP Relay service created an
architectural loop: Google's Outbound Gateway rule matches the same message twice (original →
gateway, then gateway's relayed copy back through Google), causing the message to loop endlessly.
This was unfixable via Admin console configuration.

**Decision: build a real outbound MTA** (Option A) instead of relying on Google's relay. The
gateway now performs MX lookups and delivers directly to recipient mail servers.

**Current implementation (Phase 1):**
- ✅ MX record lookups via DNS (`src/mxResolver.ts`)
- ✅ Direct SMTP delivery to recipient MX servers (`src/mta.ts`)
- ✅ Tries each MX in priority order, fails if all are unavailable
- ⏳ **No retry queue yet** — transient failures cause message loss. Phase 2 will add exponential
  backoff retry queue (5m → 10m → 30m → 1h → 2h → give up after ~5 days).
- ⏳ **No NDR/bounce handling yet** — failures just log. Phase 2+ will generate and send NDRs
  back to the original sender when delivery fails permanently.

**Known limitations and next steps:**
- Warm-up: a brand-new IP has zero reputation with mailbox providers. Real warm-up requires
  steady, low-volume delivery over **2–4 weeks** — not synthetic test bursts. See "Warm-up
  protocol" below.
- The cPanel-hosted domain (`paan.africa`) still can't use Outbound Gateway (lacks the routing
  feature) — falls back to the manual copy-signature mechanism in the app.
- Once Phase 1 testing confirms basic delivery works, Phase 2 will add retry queue + NDR
  handling for production readiness.

## Warm-up protocol (Phase 1 testing)

The outbound IP (`145.241.124.158`) starts with zero reputation. Mailbox providers apply
stricter standards to unknown IPs, and sending bursts to many recipients is indistinguishable
from a spam campaign — both will trigger abuse suppression.

**Step 1: Verify basic delivery works**
1. Deploy Phase 1 code to the OCI instance.
2. Send **one real test message** to a known-safe recipient (e.g., a personal Gmail account).
3. Check the recipient's inbox (including spam folder) to confirm arrival.
4. Check gateway logs for any delivery errors.

**Step 2: Gradual volume increase (2–4 weeks)**
- **Week 1:** Send 5–10 real messages per day to a small set of known recipients (Gmail, your own
  other domains, etc.). Monitor inbox arrival and spam folder placement.
- **Week 2:** Increase to 10–20 per day, gradually expanding recipient domains (but stay within
  your own org/trusted partners).
- **Weeks 3–4:** Increase to 50–100+ per day as confidence builds and you see consistent inbox
  placement. By week 4, full production use should be viable.

**Critical don'ts:**
- ❌ Don't send bursts (10+ messages in seconds/minutes) to many distinct external recipients.
- ❌ Don't send large attachments; keep early-stage messages small and text-focused.
- ❌ Don't send if any messages bounce (fix configuration issues first; bounces are reputation poison).
- ❌ Don't test multiple times with back-to-back attempts after failures; rest periods matter.

**How to monitor:**
- Watch gateway logs for delivery errors (`[gateway-mta] delivery failed to ...`).
- Spot-check recipient inboxes (including spam folders) for actual arrival.
- Monitor Postmaster Tools dashboards for this domain's reputation (Spam, Delivery Errors tabs).
- If messages start disappearing (sent but never arrive), **stop sending immediately** and
  investigate; continued bursts reinforce suppression.

## Operational status (as of the first real rollout attempt)

Real-world testing surfaced two things worth knowing before touching this again:

1. **`smtp-relay.gmail.com` throttles brand-new sending IPs inconsistently.** A fresh
   Reserved Public IP got a `421-4.7.0 "Try again later"` rejection at EHLO — before Google
   even evaluates the allowlist or SMTP AUTH — the large majority of the time, with occasional
   successes, for the first day or so. This wasn't fixable by any config change (IP allowlist,
   SMTP AUTH, a second fresh IP all made no difference); it's Google's own front-end fleet
   gradually building trust in the IP. Real Outbound Gateway traffic Google itself queues and
   retries automatically on a 421/450 from us, so a throttled message during warm-up is
   *delayed*, not lost — confirmed by watching a real message arrive ~7 minutes after the
   gateway's first attempt failed.

2. **Do not warm up by rapid-firing test messages to many different novel addresses.** That
   pattern — a new domain/IP sending bursts to lots of distinct external recipients in minutes
   — is indistinguishable from a spam campaign to Google's abuse detection. During testing this
   produced messages that Google's relay *accepted* (`250 OK`) but then silently discarded
   post-acceptance — no bounce, no spam-folder placement, just gone. Real warm-up needs the
   opposite: low, steady volume to a small set of real, expected recipients, increasing
   gradually over days — not synthetic test bursts. If messages start vanishing post-`250 OK`
   with zero bounce, stop sending immediately (further bursts likely reinforce the suppression)
   and fall back to Workspace's own **Reporting → Email Log Search** for the authoritative
   per-message trace, rather than guessing from gateway logs alone.

3. **Google's Outbound Gateway resubmits every message at least twice — deduplicate on
   Message-ID.** A second real rollout attempt hit a different failure mode: the *same* message
   got resubmitted by Google dozens of times over several minutes, each attempt succeeding
   (`250 OK` from us every time), producing either a single email with the signature stacked
   many times inside it, or — once an idempotency guard stopped the stacking — many separate
   duplicate deliveries instead. Neither a faster gateway (connection pooling cut per-message
   latency from ~4.7s to ~2.4s) nor the idempotency guard alone fixed the *resubmission* itself
   — Google kept resubmitting at nearly the same cadence regardless of our response time, which
   rules out a timeout/latency explanation. The actual fix: `dedupe.ts` tracks each `Message-ID`
   in a short-lived in-memory cache and acks (without re-relaying) any repeat seen within 15
   minutes. With that in place the real pattern became consistently clean: exactly one relay +
   one deduped repeat per message, then done — confirmed across multiple senders and messages.
   Root cause on Google's side is still unconfirmed (most likely redundant parallel delivery
   attempts from their distributed MTA fleet, which a receiving gateway is expected to
   deduplicate, same as any enterprise mail relay would) — but the fix doesn't depend on knowing
   why, just on not assuming "resubmitted" means "failed."

Given this, treat the rollout sequence below as needing a real multi-day warm-up pause between
steps 4 and 6, not a same-day walkthrough.

## What this MVP doesn't handle yet

- **Bounce/NDR handling** — delivery failures from Google's relay aren't surfaced anywhere yet
  beyond its own logs. Fine for initial rollout; worth wiring up before full production traffic.
- **Attachments larger than fit in memory** — `mailparser` buffers the whole message; revisit
  if large attachments turn out to be common.
