import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await params;

  // Get session ID from header or query parameter (like attachments download)
  const url = new URL(request.url);
  const sessionId =
    request.headers.get("x-session-id") || url.searchParams.get("session_id");

  if (!sessionId) {
    return new NextResponse(null, { status: 401 });
  }

  const protocol = process.env.ODOO_JSONRPC_PROTOCOL || "http";
  const host = process.env.ODOO_JSONRPC_HOST;
  const port = process.env.ODOO_JSONRPC_PORT;

  const odooUrl = `${protocol}://${host}:${port}/whatsapp/partner/profile_picture/${partnerId}`;

  try {
    // Fetch the avatar from Odoo backend with session cookie
    const response = await fetch(odooUrl, {
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
      redirect: "follow", // Automatically follow 303 redirects
      cache: "no-store", // Don't cache during development
    });

    if (!response.ok) {
      // If image not found, return 404 so Profile component shows colored avatar
      return new NextResponse(null, { status: 404 });
    }

    // Check if we got HTML instead of an image (login redirect)
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("text/html")) {
      return new NextResponse(null, { status: 401 });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
