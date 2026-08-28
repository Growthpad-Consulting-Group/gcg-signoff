import { NextRequest, NextResponse } from "next/server";
import { renderFullSignature } from "@/features/signatures/lib/renderFullSignature";

/**
 * Renders a staff member's current signature HTML by sender email. This is the seam the
 * outbound mail gateway (or a preview UI) calls at send time — see docs/signature-app.md
 * for how it fits into the Google Workspace Outbound Gateway flow.
 *
 * Auth: expects `x-render-secret` to match RENDER_API_SECRET, since the gateway calls this
 * unauthenticated-by-cookie, message by message.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.RENDER_API_SECRET;
  const provided = req.headers.get("x-render-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  try {
    const html = await renderFullSignature(email);
    return NextResponse.json({ html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to render signature";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
