import { NextRequest, NextResponse } from "next/server";

const REQUIRED_ENV_VARS = ["ODOO_JSONRPC_HOST"] as const;

const ensureEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

export async function POST(request: NextRequest) {
  try {
    ensureEnv();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Server configuration error",
      },
      { status: 500 }
    );
  }

  const sessionId = request.headers.get("x-session-id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing Odoo session id" },
      { status: 401 }
    );
  }

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Create form data to forward to Odoo
    const odooFormData = new FormData();
    odooFormData.append("file", file);
    odooFormData.append("filename", file.name);

    const protocolEnv: "http" | "https" =
      process.env.ODOO_JSONRPC_PROTOCOL === "https" ? "https" : "http";
    const portEnv = process.env.ODOO_JSONRPC_PORT;
    const port = portEnv ? Number(portEnv) : protocolEnv === "https" ? 443 : 80;

    if (Number.isNaN(port)) {
      return NextResponse.json(
        { error: "ODOO_JSONRPC_PORT must be a valid number" },
        { status: 500 }
      );
    }

    const hasDefaultPort =
      (protocolEnv === "http" && port === 80) ||
      (protocolEnv === "https" && port === 443);
    const baseURL = `${protocolEnv}://${process.env.ODOO_JSONRPC_HOST}${hasDefaultPort ? "" : `:${port}`}`;

    // Upload to Odoo
    const response = await fetch(`${baseURL}/whatsapp/attachment/upload/`, {
      method: "POST",
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
      body: odooFormData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return NextResponse.json(
        {
          error: `Failed to upload attachment to Odoo: ${response.status} - ${errorText}`,
        },
        { status: response.status }
      );
    }

    // Parse the response from Odoo (should return attachment ID)
    const data = await response.json();

    return NextResponse.json({
      attachmentId: data.id || data.attachment_id || data,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload attachment",
      },
      { status: 500 }
    );
  }
}
