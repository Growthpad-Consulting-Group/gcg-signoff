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

  // A real cert for STARTTLS (Let's Encrypt) instead of smtp-server's built-in default, whose
  // private key is publicly known. Optional — omit both to fall back to the default (fine for
  // local dev, not for anything reachable from the internet). See gateway/README.md for the
  // certbot + deploy-hook setup that keeps these files current.
  tlsCertPath: process.env.GATEWAY_TLS_CERT_PATH,
  tlsKeyPath: process.env.GATEWAY_TLS_KEY_PATH,

  // The Signoff app's render endpoint (src/app/api/render/route.ts) and its shared secret.
  renderApiUrl: required("RENDER_API_URL"),
  renderApiSecret: required("RENDER_API_SECRET"),
};
