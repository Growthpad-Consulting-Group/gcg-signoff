import nodemailer from "nodemailer";
import { resolveMxServers } from "./mxResolver.js";

export interface OutboundMessage {
  envelopeFrom: string;
  envelopeTo: string[];
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  html?: string;
  text?: string;
  messageId?: string;
  headers?: Record<string, string>;
  attachments?: { filename?: string; content: Buffer; contentType?: string; cid?: string }[];
}

/**
 * Delivers a message directly to recipient MX servers. Tries each recipient's MX records
 * in priority order. For Phase 1, this is synchronous delivery with no retry queue — messages
 * that fail transiently just fail. Phase 2 will add a queue and exponential backoff.
 */
export async function deliverDirectly(message: OutboundMessage): Promise<void> {
  const recipients = message.envelopeTo || [];

  // Group recipients by domain for efficient MX lookups and delivery
  const recipientsByDomain = new Map<string, string[]>();
  for (const recipient of recipients) {
    const [, domain] = recipient.split("@");
    if (!domain) throw new Error(`Invalid recipient email: ${recipient}`);
    if (!recipientsByDomain.has(domain)) {
      recipientsByDomain.set(domain, []);
    }
    recipientsByDomain.get(domain)!.push(recipient);
  }

  // Deliver to each domain's MX servers
  const deliveryErrors: string[] = [];
  for (const [domain, domainRecipients] of recipientsByDomain) {
    try {
      await deliverToDomain(domain, domainRecipients, message);
      console.log(`[gateway-mta] delivered to ${domain}: ${domainRecipients.join(", ")}`);
    } catch (err) {
      const errorMsg = `${domain}: ${(err as Error).message}`;
      deliveryErrors.push(errorMsg);
      console.error(`[gateway-mta] delivery failed to ${errorMsg}`);
    }
  }

  // If all domains failed, throw (caller will handle the error / queue for retry)
  if (deliveryErrors.length === recipients.length) {
    throw new Error(`All recipients failed: ${deliveryErrors.join("; ")}`);
  }

  // Partial failure: some domains succeeded, some failed.
  // Phase 1 treatment: log and continue (Phase 2 will queue failures separately).
  if (deliveryErrors.length > 0) {
    console.warn(`[gateway-mta] partial delivery — failed domains: ${deliveryErrors.join("; ")}`);
  }
}

/**
 * Attempt delivery to a specific domain via its MX servers.
 * Tries each MX in priority order and throws if all fail.
 */
async function deliverToDomain(
  domain: string,
  recipients: string[],
  message: OutboundMessage
): Promise<void> {
  const mxServers = await resolveMxServers(domain);

  let lastError: Error | null = null;
  for (const { exchange, priority } of mxServers) {
    try {
      const transporter = nodemailer.createTransport({
        host: exchange,
        port: 25, // Standard SMTP port to MX servers (not authenticated)
        secure: false,
        tls: {
          rejectUnauthorized: false, // Allow self-signed/unverified certificates
        },
        connectionTimeout: 10000, // 10 second timeout
        socketTimeout: 10000,
      });

      await transporter.sendMail({
        envelope: { from: message.envelopeFrom, to: recipients },
        from: message.from || message.envelopeFrom,
        to: recipients.join(", "),
        cc: message.cc,
        subject: message.subject,
        html: message.html,
        text: message.text,
        messageId: message.messageId,
        headers: message.headers,
        attachments: message.attachments,
      });

      await transporter.close();
      return; // Success — stop trying other MX servers
    } catch (err) {
      lastError = err as Error;
      console.warn(`[gateway-mta] MX ${exchange} (priority ${priority}) failed: ${lastError.message}`);
      // Continue to next MX server
    }
  }

  // All MX servers failed
  throw new Error(`All MX servers for ${domain} failed; last error: ${lastError?.message}`);
}
