# Gateway Deployment Status

## Current State (Sep 4, 2026)

**Status:** Paused pending OCI port 25 unblock  
**Code:** Phase 1 complete and deployed to `/opt/signoff-gateway` on `145.241.124.158`  
**Service:** Stopped and disabled  
**Outbound Gateway:** Disabled in Admin console  

## What's Ready

- ✅ Phase 1 MTA code built and deployed (MX resolver + direct SMTP delivery)
- ✅ Gateway service installed and tested locally (DRY_RUN mode works)
- ✅ TLS certs in place for incoming connections
- ✅ API integration to Signoff app working
- ✅ Signature injection pipeline ready

## What's Blocked

### Primary Blocker: OCI VCN Security List

**Outbound SMTP (port 25, TCP) is blocked.** Direct SMTP delivery to recipient mail servers requires port 25 — there is no alternative. The gateway tested successfully against Gmail's MX servers during development, but the OCI instance cannot reach port 25 outbound.

### Secondary (Non-Critical): PTR Record

**Reverse DNS (PTR) not available on Free Tier.** OCI declined the PTR request because the tenancy is on Trial/Free Tier. PTR records help with mail reputation/warm-up but are not strictly required for delivery. Upgrading to a paid OCI tenancy would unlock this feature, but it's not a blocker for Phase 1.

## Oracle Free Tier Considerations

The current OCI setup is on a Free Tier tenancy, which has two limitations:
1. **Port 25 is blocked** (affects this project)
2. **PTR records unavailable** (affects mail reputation, not delivery itself)

Upgrading to a paid tenancy would unlock both, but:
- Free Tier is sufficient if port 25 gets unblocked (unlikely on Free Tier)
- Paid tenancy is the real solution for production mail infrastructure
- Cost: varies by usage, but typically $20-50/month for a small mail gateway instance

**Decision:** Keep Free Tier for now since it's an experimental feature. If the gateway becomes mission-critical, migrate to paid tier.

## To Resume When Port 25 Unblocked

1. **File OCI support ticket** requesting:
   - Allow TCP port 25 egress from VCN subnet `10.0.0.0/24`
   - Or: Allow TCP port 25 outbound for instance `145.241.124.158`

2. **Once approved**, test connectivity:
   ```bash
   ssh -i key opc@145.241.124.158 "timeout 10 bash -c '</dev/tcp/gmail-smtp-in.l.google.com/25' && echo 'Port 25 open' || echo 'Still blocked'"
   ```

3. **Restart gateway:**
   ```bash
   sudo systemctl enable signoff-gateway
   sudo systemctl start signoff-gateway
   ```

4. **Re-enable Outbound Gateway** in Admin console (point to `145.241.124.158:25`)

5. **Send one real test message** and monitor logs:
   ```bash
   sudo journalctl -u signoff-gateway -f
   ```

## Fallback: Gmail API Push

If OCI port 25 remains unavailable, the Gmail API signature push mechanism remains production-ready:
- Compose signatures work reliably
- Reply signatures still absent (known limitation)
- Zero network/firewall issues
- No warm-up required

Switch back by disabling Outbound Gateway and using `/staff` page sync buttons.

## Reference

- **Gateway code:** `/Users/Apple/code/clients/gcg-signoff/gateway/`
- **Architecture docs:** `docs/ARCHITECTURE.md`
- **Deployment target:** `145.241.124.158:/opt/signoff-gateway`
- **Systemd service:** `/etc/systemd/system/signoff-gateway.service` (on server)
