import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  // The port Google Workspace's Outbound Gateway connects to. Google's gateway feature expects
  // plain SMTP or STARTTLS on a port you control — 2525 is a common non-privileged default for
  // local/dev; production typically binds 25 or 587 behind a load balancer.
  smtpPort: Number(process.env.GATEWAY_SMTP_PORT ?? 2525),
  smtpHost: process.env.GATEWAY_SMTP_HOST ?? "0.0.0.0",

  // Restricts who may hand mail to this gateway. In production this should be Google's
  // published outbound IP ranges for your Workspace instance, not left open.
  allowedClientIps: (process.env.GATEWAY_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean),

  // The Signoff app's render endpoint (src/app/api/render/route.ts) and its shared secret.
  renderApiUrl: required("RENDER_API_URL"),
  renderApiSecret: required("RENDER_API_SECRET"),

  // Where the gateway hands mail back off for actual delivery, after stamping. Google's own
  // "SMTP relay service" (smtp-relay.gmail.com) is the recommended target — it accepts mail
  // from an authorized IP/domain and handles real internet delivery, so this gateway never
  // needs to be a full outbound MTA (no MX lookups, retries, or bounce handling to build).
  relayHost: process.env.RELAY_SMTP_HOST ?? "smtp-relay.gmail.com",
  relayPort: Number(process.env.RELAY_SMTP_PORT ?? 587),
  relayUser: process.env.RELAY_SMTP_USER,
  relayPassword: process.env.RELAY_SMTP_PASSWORD,
};
