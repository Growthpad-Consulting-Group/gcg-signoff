import nodemailer from "nodemailer";

/**
 * Sends a test message straight into the local gateway (bypassing Google entirely), so you
 * can verify signature injection end-to-end before touching real Workspace routing.
 *
 * Usage: FROM=jane.wanjiru@growthpad.co.ke TO=someone@example.com npm run test:send
 */
async function main() {
  const from = process.env.FROM ?? "jane.wanjiru@growthpad.co.ke";
  const to = process.env.TO ?? "test-recipient@example.com";
  const port = Number(process.env.GATEWAY_SMTP_PORT ?? 2525);

  const transporter = nodemailer.createTransport({ host: "localhost", port, secure: false, tls: { rejectUnauthorized: false } });

  await transporter.sendMail({
    from,
    to,
    subject: "Gateway test message",
    text: "This is a plain-text test body.",
    html: "<p>This is an <strong>HTML</strong> test body.</p>",
  });

  console.log(`Sent test mail from ${from} to ${to} via localhost:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
