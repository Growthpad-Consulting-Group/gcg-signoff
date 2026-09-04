# Signoff — Team Email Signature Platform

Signoff is a custom-HTML signature builder for Growthpad Consulting Group: design signature
templates, assign them to staff with per-person merge fields (name, role, department, phone),
and have them appear automatically on outgoing mail — on every device and every mail client,
not just Gmail's web compose window.

This doc captures the *why* behind the architecture, not just the *what* — read it before
changing how signatures actually get deployed.

## 1. The core misconception this avoids

DNS records (CNAME, MX) don't inject signature content into outgoing mail. They only route mail
and host assets. Signature injection happens at one of a few real layers — client-side compose
settings, an API push to mailbox settings, or a server-side stamp applied to the message before
it's delivered. Which layer you use determines whether the signature actually appears on every
device, or only on the one client you configured.

## 2. Why "just use Gmail's signature setting" doesn't satisfy our requirements

Two native options exist and were ruled out for different reasons:

- **Gmail `sendAs.signature` (per-user API)** — only applies when composing in Gmail web/app. A
  reply sent from Outlook, native iOS/Android Mail (IMAP), or any third-party client won't carry
  it. Fails the "works on every client" requirement.
- **Google Workspace "Append footer" (Admin console → Gmail → Compliance)** — genuinely
  server-side and universal (stamped by Google's infrastructure regardless of sending client),
  but it's a **static HTML string per rule**, scoped by OU/group, with no merge-tag support and
  no public API for programmatic management. Personalizing per staff member at scale would mean
  hand-maintaining one compliance rule per person — not something an app can drive.

Since we explicitly need per-person dynamic fields (name, role, department, phone), neither
native option is sufficient on its own.

## 3. The chosen architecture: Outbound Gateway + this app

Google Workspace supports routing outbound mail through an **Outbound Gateway** (Admin console →
Gmail → Routing) — Google still delivers the mail, but first hands it to a gateway server we
control, which can rewrite the message body before it goes out. This is the same mechanism
commercial signature tools (Exclaimer, CodeTwo, Rocketseed) use under the hood for Workspace.

Flow for one outgoing message:

```
Staff sends mail (any client: web, iOS, Android, Outlook, native Mail)
        │
        ▼
Google Workspace mail server
        │  (Outbound Gateway rule routes it to our gateway)
        ▼
Our gateway service  ──calls──▶  GET /api/render?email=sender@growthpad.co.ke
        │                              (this app — looks up the sender's staff
        │                               record + assigned template, renders
        │                               merge tags, returns final HTML)
        ▼
Gateway appends the returned signature HTML to the message body
        │
        ▼
Hands the message back to Google Workspace
        │
        ▼
Google delivers it to the recipient
```

Because the stamp happens after the message leaves the sender's device and before Google's
final delivery, it doesn't matter which client or device originated the message — every one of
them is caught by the same gateway rule. This is the property that makes "works on any device,
any client" true rather than aspirational.

**Not yet built:** the gateway service itself (the box in the middle). This repo currently
implements the app-facing half — the builder, staff/template management, and the `/api/render`
endpoint the gateway will call. The gateway is a separate small service (Node/SMTP or a
Cloudflare Email Worker are both reasonable) that sits between Workspace and the internet; it's
the next piece to build once templates and staff data exist to test against.

## 3b. What we learned running the gateway for real, and the lighter alternative it led to

The gateway works — verified end-to-end multiple times with real delivered mail — but a
first production rollout surfaced something the design didn't originally account for:
**a brand-new sending IP has to earn Google's trust before delivery is fast and reliable.**
Concretely: `smtp-relay.gmail.com` intermittently rejected our gateway's connection with
`421-4.7.0 "Try again later"` for the first day or so, regardless of correct IP allowlisting,
SMTP AUTH, or even a second fresh IP — none of that helped, because the rejection happens at
EHLO, before any of that is evaluated. Google Postmaster Tools confirmed this directly:
*"You haven't sent enough emails to personal Gmail accounts... continue to send at a steady
rate."* Every message we traced through Google's own Email Log Search eventually succeeded —
delivery was never actually lost, just delayed (minutes to a few hours) during this warm-up
window. Full story and the abuse-pattern pitfall to avoid (rapid test bursts to many novel
addresses look like spam to Google, worse than genuine warm-up) is in `gateway/README.md`'s
"Operational status" section.

Given that, `src/features/signatures/lib/gmailSync.ts` implements a second, lighter delivery
mechanism: instead of intercepting mail in transit, it pushes a staff member's rendered
signature directly into their Gmail account's own "sendAs" signature setting via the Gmail
API (`users.settings.sendAs.patch`). Google is the only sender at any point — there's no new
IP in the path, so there's nothing to warm up.

**The trade-off:** this only takes effect when someone composes through Gmail's own web/app
client. A third-party IMAP client (Outlook desktop, Apple Mail, Thunderbird) reads its own
local signature setting instead and never sees this. For a Workspace-native team where
everyone actually uses Gmail day to day, that's likely no loss in practice.

**Final decision (Sep 2026) — Gmail API push is the production mechanism.** After thorough
investigation of the Outbound Gateway + SMTP relay path:

1. **Architectural loop discovered:** Google's Outbound Gateway rule has no scoping/exception
   options and unconditionally re-matches mail the gateway relays back out via
   `smtp-relay.gmail.com`. Since that relayed copy is still authenticated as the original
   `@growthpad.net` sender, it loops back to the gateway indefinitely (the Message-ID dedup
   guard silently absorbs it, making logs look clean while nothing is delivered).

2. **OCI infrastructure constraint:** Free Tier OCI blocks outbound SMTP port 25, preventing
   direct MTA delivery to recipient mail servers. Building a full outbound MTA (Phase 1 code
   exists) would require paid infrastructure with zero guarantee of working reliably for this
   domain.

3. **Preferred solution:** Gmail API push via `sendAs.signature` is proven, simple, and fully
   operational now. Its known limitation — signatures only on newly composed mail, not replies —
   is a documented Google API constraint, not a bug in our implementation.

**Production mechanism: Gmail API push only.** Use `/staff` page → "Sync" per person, or "Sync
all to Gmail". Outbound Gateway and the SMTP relay service are **disabled** in Admin console.
The gateway Phase 1 code remains in the repo for historical reference; not recommended for
production deployment.

**Setup required, one-time:** the Gmail push needs a Google Cloud service account authorized
for domain-wide delegation:
1. Google Cloud Console → create/select a project → APIs & Services → enable the **Gmail API**.
2. IAM & Admin → Service Accounts → create one → Keys → create a JSON key. Set
   `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (from that JSON)
   in the app's env.
3. Workspace Admin console → Security → API controls → Domain-wide Delegation → Add new →
   paste the service account's numeric Client ID → Scope:
   `https://www.googleapis.com/auth/gmail.settings.basic` — this narrower scope is
   deliberate: Google specifically allows the `signature` field of `sendAs.patch` to be
   updated with it, unlike every other field on that resource (delegates, forwarding, etc.),
   which needs the more sensitive `gmail.settings.sharing` scope instead.

This is an internal tool acting only within your own domain, so it does **not** need Google's
public OAuth app verification/security-assessment process — that process exists for apps
requesting consent from accounts outside your organization, which doesn't apply here.

## 4. DNS, SPF, and DKIM — not required for Gmail API push

With the Gmail API push mechanism, no DNS or authentication changes are needed. Google remains
the sender at every hop; the app only updates the signature field in Workspace's sendAs settings.
SPF, DKIM, and DMARC all remain unchanged.

*(Note: If the Outbound Gateway path is revisited in future, the DNS section below would apply.
Kept for reference only.)*
Both are TXT record edits — one-time, low-risk, and exactly what the "don't mind adding DNS
records" tolerance from the original scoping conversation covers. No MX changes, ever, for this
domain's inbound mail.

## 5. Multi-domain support

`domains.platform` (`google_workspace` | `microsoft_365` | `other`) exists because growthpad.co.ke
is on Google Workspace today, but the team may add domains on other platforms later:

- **Google Workspace** → Outbound Gateway, as above.
- **Microsoft 365** → the equivalent mechanism is a mail-flow (transport) rule or Graph API
  connector — Microsoft stays the sender, so SPF/DKIM stay untouched, same as the gateway case.
- **Other / generic SMTP** → the only case that needs a true SMTP relay with an MX change, and
  the one with real ongoing deliverability risk. Only worth doing if that platform truly has no
  native mail-flow rule feature — check before building a relay for it.

## 6. Data model

- **`domains`** — one row per mail domain this workspace manages signatures for; carries which
  platform it's on and gateway/DNS verification status.
- **`staff`** — people whose outgoing mail should carry a signature; the merge-tag source data
  (name, role, department, phone, photo) lives here.
- **`signature_templates`** — reusable designs. `html` is fully-inlined, table-based markup
  (the layout rules email clients — especially Outlook's Word rendering engine — actually
  respect) with `{{merge_tag}}` placeholders.
- **`signature_assignments`** — join of staff → template, one per staff member, tracking
  `deploy_status` so the future gateway/sync job knows what's stale after a template edit.

See `supabase/migrations/0001_init.sql` for the full schema, and
`src/features/signatures/lib/mergeTags.ts` for the supported tag set and rendering logic.

## 7. What exists in this repo today vs. what's next

**Built:**
- Signature template builder (`/templates/[id]`) — HTML source + live preview, merge-tag
  insertion, table-based starter template.
- Staff management (`/staff`) — add staff, assign a template per person.
- Domain management (`/domains`) — register a domain and its mail platform.
- `GET /api/render` — the render endpoint the gateway calls per message, secured by
  `RENDER_API_SECRET`.
- `POST /api/deploy-status` — the gateway reports back here after each relay, so
  `signature_assignments.deploy_status` reflects whether a message actually went out signed.
- `gateway/` — the Outbound Gateway service itself: receives mail, calls `/api/render`, injects
  the signature, relays via Google's SMTP Relay service, and reports status back. Deployed
  live (Oracle Cloud, `145.241.124.158:25`) and proven end-to-end with real delivered mail —
  but currently **paused** (Outbound Gateway disabled in Admin console) mid-IP-warm-up after a
  batch of rapid test sends to many novel addresses got silently discarded by Google's relay
  post-acceptance. See `gateway/README.md`'s "Operational status" section for the full story
  and what to do differently on resume — short version: low steady volume to real recipients,
  not test bursts.

**Next:**
- Resume Outbound Gateway with a disciplined, slow warm-up pace once ready (see
  `gateway/README.md`).
- Surfacing `deploy_status`/`deploy_error` in the `/staff` UI beyond the existing pill (e.g. a
  "why did this fail" detail view) once real deploy errors start happening.
