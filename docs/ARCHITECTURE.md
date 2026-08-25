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

## 4. DNS, SPF, and DKIM — what's actually required

The Outbound Gateway is **not** an MX record change — inbound mail is untouched, and this is
configured entirely in Workspace's Admin console (a hostname/IP for the gateway), not DNS.

The one DNS change needed: add the gateway's sending IP to the domain's **SPF** record
(`include:` the gateway) so Google's outbound authentication still passes once mail has been
through it. If the gateway re-signs the message, it also needs its own **DKIM** key published.
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
  the signature, relays via Google's SMTP Relay service, and reports status back. Verified
  end-to-end locally (dry-run mode); not yet wired into real Workspace routing — see
  `gateway/README.md` for the production rollout sequence.

**Next (not yet built):**
- Actually deploying the gateway and pointing Workspace's Outbound Gateway setting at it —
  needs Google Admin console access (`gateway/README.md` has the exact steps and ordering).
- Surfacing `deploy_status`/`deploy_error` in the `/staff` UI beyond the existing pill (e.g. a
  "why did this fail" detail view) once real deploy errors start happening.
