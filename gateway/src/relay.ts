import { deliverDirectly, type OutboundMessage } from "./mta.js";

/**
 * Relays the (now-signed) message onward for actual internet delivery. Performs MX lookups
 * and delivers directly to recipient mail servers (Phase 1 of moving to a real outbound MTA).
 * This gateway now owns the delivery path and IP reputation.
 */
export async function relayMessage(message: OutboundMessage): Promise<void> {
  if (process.env.GATEWAY_DRY_RUN === "true") {
    console.log("[gateway] DRY RUN — would deliver:", {
      envelope: { from: message.envelopeFrom, to: message.envelopeTo },
      subject: message.subject,
      html: message.html ? `${message.html.substring(0, 100)}...` : undefined,
    });
    return;
  }

  await deliverDirectly(message);
}
