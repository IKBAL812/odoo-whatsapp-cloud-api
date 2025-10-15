import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const attachmentUrl = url.searchParams.get("url");
  const sessionId = request.headers.get("x-session-id") || url.searchParams.get("session_id");

  if (!attachmentUrl) {
    return NextResponse.json(
      { error: "Missing attachment URL" },
      { status: 400 }
    );
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session ID" },
      { status: 401 }
    );
  }

  try {
    // Fetch the attachment from Odoo backend
    const odooResponse = await fetch(`${attachmentUrl}?session_id=${sessionId}`, {
      method: "GET",
      headers: {
        "Cookie": `session_id=${sessionId}`,
      },
    });

    if (!odooResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch attachment: ${odooResponse.status}` },
        { status: odooResponse.status }
      );
    }

    // Get the file data
    const fileBuffer = await odooResponse.arrayBuffer();
    const contentType = odooResponse.headers.get("Content-Type") || "application/octet-stream";
    const contentDisposition = odooResponse.headers.get("Content-Disposition");

    // Return the file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition || "attachment",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to download attachment" },
      { status: 500 }
    );
  }
}
