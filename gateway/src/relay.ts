import nodemailer, { Transporter } from "nodemailer";
import { config } from "./config.js";

let transporter: Transporter | null = null;

/**
 * Relays the (now-signed) message onward for actual internet delivery. Points at Google's
 * SMTP Relay service by default — Google still performs the real send (MX lookup, retries,
 * SPF/DKIM), so this gateway never needs to be a full outbound MTA itself. See gateway/README.md
 * for the "SMTP relay service" setup this depends on in the Workspace Admin console.
 */
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.relayHost,
      port: config.relayPort,
      secure: false, // STARTTLS on 587
      auth: config.relayUser ? { user: config.relayUser, pass: config.relayPassword } : undefined,
    });
  }
  return transporter;
}

export interface RelayMessage {
  envelopeFrom: string;
  envelopeTo: string[];
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  html?: string;
  text?: string;
  /** The original message's Message-ID, preserved via nodemailer's dedicated `messageId`
   * option — NOT passed through the generic `headers` map below, since nodemailer also
   * auto-generates its own Message-ID header and a second one via `headers` would produce a
   * malformed message with two conflicting Message-ID lines (Gmail can silently drop mail
   * that looks like that, rather than just spam-flagging it). */
  messageId?: string;
  /** Everything else (In-Reply-To, References) — safe here since nodemailer doesn't
   * auto-generate those. */
  headers?: Record<string, string>;
  attachments?: { filename?: string; content: Buffer; contentType?: string; cid?: string }[];
}

export async function relayMessage(message: RelayMessage): Promise<void> {
  if (process.env.GATEWAY_DRY_RUN === "true") {
    console.log("[gateway] DRY RUN — would relay:", {
      envelope: { from: message.envelopeFrom, to: message.envelopeTo },
      subject: message.subject,
      html: message.html,
    });
    return;
  }

  await getTransporter().sendMail({
    envelope: { from: message.envelopeFrom, to: message.envelopeTo },
    from: message.from,
    to: message.to,
    cc: message.cc,
    subject: message.subject,
    html: message.html,
    text: message.text,
    messageId: message.messageId,
    headers: message.headers,
    attachments: message.attachments,
  });
}
