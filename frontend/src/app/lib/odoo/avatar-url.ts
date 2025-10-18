/**
 * Build the URL for a partner's avatar image
 * Uses the Next.js API proxy to handle CORS and 303 redirects from Odoo
 *
 * @param odooBaseUrl - The base URL of the Odoo instance (not used, kept for compatibility)
 * @param partnerId - The ID of the partner record
 * @param sessionId - The Odoo session ID for authentication
 * @returns The API proxy URL to fetch the avatar image with session
 */
export function buildPartnerAvatarUrl(
  odooBaseUrl: string,
  partnerId: number,
  sessionId?: string | null
): string {
  // Use Next.js API proxy route to handle CORS and redirects
  const baseUrl = `/api/avatar/${partnerId}`;

  if (sessionId) {
    return `${baseUrl}?session_id=${sessionId}`;
  }

  return baseUrl;
}
