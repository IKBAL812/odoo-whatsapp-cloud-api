# Copyright 2025 Erol Develi (https://github.com/erlinberg)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from urllib.parse import quote

from odoo import http
from odoo.http import request


class WhatsAppFrontendAuthController(http.Controller):
    @http.route(
        "/whatsapp/frontend/sso-url",
        type="json",
        auth="user",
        methods=["POST"],
    )
    def get_sso_url(self, **kwargs):
        """
        Generate SSO URL for the WhatsApp frontend application.

        This endpoint:
        1. Checks if the current user has assigned WhatsApp backends
        2. Extracts the frontend URL from the backend's webhook URL
        3. Returns an SSO URL with the current session ID

        Returns:
            dict: {'url': str} with SSO URL, or {'error': str} if not available
        """
        user = request.env.user

        # Find backends assigned to the current user
        Backend = request.env["whatsapp.backend"]
        backends = Backend.sudo().search([("user_ids", "in", user.id)], limit=1)

        if not backends:
            return {
                "error": "No WhatsApp backend assigned to your user. "
                "Please contact your administrator."
            }

        if not backends.frontend_webhook_url:
            return {
                "error": "WhatsApp frontend URL not configured. "
                "Please contact your administrator."
            }

        # Extract base URL from webhook URL
        # The webhook URL typically ends with /api/webhooks/whatsapp
        frontend_webhook_url = backends.frontend_webhook_url
        base_url = frontend_webhook_url.replace("/api/webhooks/whatsapp", "")

        # Get current session ID
        session_id = request.session.sid

        # Construct SSO URL with properly encoded session ID
        sso_url = f"{base_url}/api/auth/sso-login?session={quote(session_id, safe='')}"

        return {"url": sso_url}
