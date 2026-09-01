import { readFileSync } from "fs";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { config } from "./config.js";
import { fetchSignatureHtml } from "./renderClient.js";
import { appendToHtml, appendToText } from "./injectSignature.js";
import { relayMessage } from "./relay.js";
import { reportDeployStatus } from "./deployStatusClient.js";
import { isIpAllowed } from "./ipMatch.js";
import { isFirstDelivery } from "./dedupe.js";

function isAllowed(remoteAddress: string): boolean {
  if (config.allowedClientIps.length === 0) {
    console.warn("[gateway] GATEWAY_ALLOWED_IPS is empty — accepting mail from any IP. Set it before pointing production Workspace routing here.");
    return true;
  }
  return isIpAllowed(remoteAddress, config.allowedClientIps);
}

// Real cert for STARTTLS if configured (see config.ts) — otherwise smtp-server falls back to
// its own built-in default cert, whose private key is publicly known (fine for local dev only).
function loadTls(): { key: Buffer; cert: Buffer } | Record<string, never> {
  if (!config.tlsCertPath || !config.tlsKeyPath) {
    console.warn("[gateway] GATEWAY_TLS_CERT_PATH/GATEWAY_TLS_KEY_PATH not set — using smtp-server's default TLS cert, which is NOT secure for a publicly reachable gateway.");
    return {};
  }
  return { key: readFileSync(config.tlsKeyPath), cert: readFileSync(config.tlsCertPath) };
}
const tls = loadTls();

const server = new SMTPServer({
  banner: "Signoff outbound signature gateway",
  authOptional: true,
  disabledCommands: ["AUTH"], // Google's Outbound Gateway connects unauthenticated over the IP allowlist below.
  ...tls,

  onConnect(session, callback) {
    if (!isAllowed(session.remoteAddress)) {
      return callback(new Error(`Connection from ${session.remoteAddress} not permitted`));
    }
    callback();
  },

  onData(stream, session, callback) {
    simpleParser(stream)
      .then(async (parsed) => {
        const envelopeFrom = session.envelope.mailFrom ? session.envelope.mailFrom.address : "";
        const envelopeTo = session.envelope.rcptTo.map((r) => r.address);

        // See dedupe.ts — Google's Outbound Gateway has been observed resubmitting the exact
        // same message many times in quick succession, independent of our response latency.
        // Ack success without re-processing rather than relaying (and thus delivering) it again.
        if (!isFirstDelivery(parsed.messageId)) {
          console.log(`[gateway] duplicate delivery of ${parsed.messageId} from ${envelopeFrom} — acked, not re-relayed`);
          return callback();
        }

        const signatureHtml = envelopeFrom ? await fetchSignatureHtml(envelopeFrom) : null;

        const html = signatureHtml && parsed.html ? appendToHtml(parsed.html, signatureHtml) : parsed.html || undefined;
        const text = signatureHtml && parsed.text ? appendToText(parsed.text, signatureHtml) : parsed.text;

        // In-Reply-To/References are safe in the generic headers map — unlike Message-ID,
        // nodemailer doesn't auto-generate those, so there's no duplicate-header risk.
        const headers: Record<string, string> = {};
        const inReplyTo = parsed.inReplyTo;
        if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
        if (parsed.references) headers["References"] = ([] as string[]).concat(parsed.references as any).join(" ");

        try {
          await relayMessage({
            envelopeFrom,
            envelopeTo,
            from: parsed.from?.text,
            to: parsed.to && "text" in parsed.to ? parsed.to.text : undefined,
            cc: parsed.cc && "text" in parsed.cc ? parsed.cc.text : undefined,
            subject: parsed.subject,
            html: html || undefined,
            text,
            messageId: parsed.messageId,
            headers,
            attachments: parsed.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType,
              cid: a.cid,
            })),
          });
        } catch (relayErr) {
          // Only staff with an assignment have a deploy_status row worth updating.
          if (signatureHtml) await reportDeployStatus(envelopeFrom, "error", (relayErr as Error).message);
          throw relayErr;
        }

        if (signatureHtml) await reportDeployStatus(envelopeFrom, "deployed");

        console.log(`[gateway] relayed ${envelopeFrom} -> ${envelopeTo.join(", ")}${signatureHtml ? " (signed)" : " (no signature — sender not found)"}`);
        callback();
      })
      .catch((err) => {
        console.error("[gateway] failed to process message:", err);
        // Fail closed: if we can't confidently stamp+relay, reject rather than silently drop.
        callback(new Error("Temporary failure processing message"));
      });
  },
});

server.on("error", (err) => console.error("[gateway] SMTP server error:", err));

server.listen(config.smtpPort, config.smtpHost, () => {
  console.log(`[gateway] listening on ${config.smtpHost}:${config.smtpPort}`);
  console.log(`[gateway] render API: ${config.renderApiUrl}`);
  console.log(`[gateway] relaying via: ${config.relayHost}:${config.relayPort}`);
});
