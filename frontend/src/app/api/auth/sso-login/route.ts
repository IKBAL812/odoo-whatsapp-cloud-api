import { NextResponse } from "next/server";

/**
 * SSO Login Endpoint
 *
 * This endpoint handles Single Sign-On (SSO) authentication from Odoo.
 * It accepts an Odoo session ID and redirects to the main page where
 * the React app will automatically authenticate the user.
 *
 * Flow:
 * 1. User clicks "Open WhatsApp" button in Odoo
 * 2. Odoo backend generates SSO URL with session ID
 * 3. This endpoint redirects to main page with session parameter
 * 4. React app detects parameter and calls loginWithSessionId()
 * 5. Session stored in localStorage via existing auth flow
 *
 * Security:
 * - Session ID passed via HTTPS (encrypted in transit)
 * - Session validated client-side via existing validation endpoint
 * - URL parameter cleaned immediately (no browser history)
 * - Uses existing authentication flow
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");

  // Validate session parameter exists
  if (!sessionId || sessionId.trim().length === 0) {
    return NextResponse.redirect(
      new URL("/?error=missing_session", request.url)
    );
  }

  // Redirect to main page with SSO session parameter
  // The React app will detect this and automatically log in
  return NextResponse.redirect(
    new URL(
      `/?sso_session=${encodeURIComponent(sessionId.trim())}`,
      request.url
    )
  );
}
