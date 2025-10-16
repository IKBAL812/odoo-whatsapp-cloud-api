# Copyright (C) 2025 Ahmet Yiğit Budak (https://github.com/yibudak)
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
import logging
import secrets

import requests
from requests import RequestException

from odoo import _, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class WhatsAppBackend(models.Model):
    _name = "whatsapp.backend"
    _description = "WhatsApp Cloud API Backend"
    # _inherit = ["mail.thread", "mail.activity.mixin"]

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    api_token = fields.Char(string="API Token", required=True)
    phone_number_id = fields.Char(string="Phone Number ID", required=True)
    api_version = fields.Char(string="API Version", required=True, default="v23.0")
    webhook_secret = fields.Char(
        required=True,
        default=lambda self: secrets.token_urlsafe(32),
    )
    language = fields.Many2one(
        comodel_name="res.lang",
    )
    user_ids = fields.Many2many(
        comodel_name="res.users",
        string="Users",
        help="Users who can use this WhatsApp backend to send messages.",
    )
    message_ids = fields.One2many(
        comodel_name="whatsapp.message",
        inverse_name="backend_id",
        string="Messages",
        readonly=True,
        help="Messages sent or received via this backend.",
    )
    company_id = fields.Many2one(
        comodel_name="res.company",
        string="Company",
        default=lambda self: self.env.company,
    )

    # -------------------------------------------------------------------------
    # WhatsApp Cloud API helpers
    # -------------------------------------------------------------------------

    def _graph_api_base_url(self):
        self.ensure_one()
        if not self.phone_number_id:
            raise UserError(_("Phone number ID is required to use the WhatsApp API."))
        version = self.api_version or "v17.0"
        return f"https://graph.facebook.com/{version}/{self.phone_number_id}"

    def _call_whatsapp_api(self, endpoint, payload):
        self.ensure_one()
        if not self.api_token:
            raise UserError(_("API token is required to call the WhatsApp API."))
        url = f"{self._graph_api_base_url()}/{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
        except RequestException as exc:
            _logger.exception("WhatsApp API request failed")
            raise UserError(_("Unable to contact WhatsApp API: %s") % exc) from exc

        if response.status_code >= 400:
            try:
                error_content = response.json()
            except ValueError:
                error_content = response.text

            if isinstance(error_content, dict):
                error_message = (
                    error_content.get("error", {}).get("message")
                    or error_content.get("message")
                    or str(error_content)
                )
            else:
                error_message = error_content

            _logger.error(
                "WhatsApp API error (status %s): %s",
                response.status_code,
                error_message,
            )
            raise UserError(_("WhatsApp API error: %s") % error_message)

        try:
            return response.json()
        except ValueError as exc:
            _logger.exception("Invalid JSON response received from WhatsApp API")
            raise UserError(_("Invalid response from WhatsApp API.")) from exc

    def _upload_media_to_whatsapp(self, attachment):
        """Upload media to WhatsApp and return the media ID.

        Args:
            attachment: ir.attachment record containing the media file

        Returns:
            str: WhatsApp media ID
        """
        self.ensure_one()
        if not self.api_token:
            raise UserError(_("API token is required to upload media to WhatsApp."))
        if not attachment:
            raise UserError(_("Attachment is required to upload media."))

        url = f"{self._graph_api_base_url()}/media"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
        }

        # Get file data from attachment
        file_data = attachment.raw
        if not file_data:
            raise UserError(_("Attachment has no file data."))

        # Prepare multipart form data
        files = {"file": (attachment.name, file_data, attachment.mimetype)}
        data = {
            "messaging_product": "whatsapp",
        }

        try:
            response = requests.post(
                url, headers=headers, files=files, data=data, timeout=30
            )
        except RequestException as exc:
            _logger.exception("WhatsApp media upload failed")
            raise UserError(_("Unable to upload media to WhatsApp: %s") % exc) from exc

        if response.status_code >= 400:
            try:
                error_content = response.json()
            except ValueError:
                error_content = response.text

            if isinstance(error_content, dict):
                error_message = (
                    error_content.get("error", {}).get("message")
                    or error_content.get("message")
                    or str(error_content)
                )
            else:
                error_message = error_content

            _logger.error(
                "WhatsApp media upload error (status %s): %s",
                response.status_code,
                error_message,
            )
            raise UserError(_("WhatsApp media upload error: %s") % error_message)

        try:
            result = response.json()
            media_id = result.get("id")
            if not media_id:
                raise UserError(_("WhatsApp API did not return a media ID."))
            _logger.info("Media uploaded to WhatsApp successfully: %s", media_id)
            return media_id
        except ValueError as exc:
            _logger.exception("Invalid JSON response received from WhatsApp API")
            raise UserError(_("Invalid response from WhatsApp API.")) from exc

    # ---------------------------------------------------------------------
    # Thread helpers
    # ---------------------------------------------------------------------

    def _get_or_create_thread(self, phone_number, partner=None, contact_name=None):
        self.ensure_one()
        if not phone_number:
            raise UserError(
                _("A phone number is required to identify the WhatsApp thread.")
            )
        thread_model = self.env["whatsapp.thread"].sudo()
        thread = thread_model.search(
            [("backend_id", "=", self.id), ("phone_number", "=", phone_number)],
            limit=1,
        )
        create_vals = None
        if not thread:
            create_vals = {
                "backend_id": self.id,
                "phone_number": phone_number,
                "partner_id": partner.id if partner else False,
            }
            if contact_name:
                create_vals["name"] = contact_name
            thread = thread_model.create(create_vals)
        else:
            update_vals = {}
            if partner and not thread.partner_id:
                update_vals["partner_id"] = partner.id
            if contact_name and thread.name in {
                thread.phone_number,
                "WhatsApp Thread",
                False,
            }:
                update_vals["name"] = contact_name
            if update_vals:
                thread.sudo().write(update_vals)
        return thread

    # ---------------------------------------------------------------------
    # Public Backend API
    # ---------------------------------------------------------------------

    def initialize_web(self):
        user = self.env.user
        backend = self.sudo().search([("user_ids", "in", user.id)], limit=1)

        if not backend:
            return {
                "error": "this user has no backend assigned",
            }
        backend = backend[0]

        base_url = self.env["ir.config_parameter"].sudo().get_param("web.base.url")
        image_url_tpl = f"{base_url}/web/image?model=res.users&field=avatar_128&id="
        users_list = [
            {
                "id": backend_user.id,
                "name": backend_user.name,
                "image_url": f"{image_url_tpl}{backend_user.id}",
            }
            for backend_user in backend.user_ids
        ]

        return {
            "backend_id": backend.id,
            "language": backend.language.code if backend.language else self.env.lang,
            "company_id": backend.company_id.id,
            "user_id": user.id,
            "users": users_list,
        }

    # ---------------------------------------------------------------------
    # Public sending API
    # ---------------------------------------------------------------------

    def send_text_message(
        self, phone_number, body, *, preview_url=False, partner=None, contact_name=None
    ):
        thread = self._get_or_create_thread(
            phone_number, partner=partner, contact_name=contact_name
        )
        return thread.send_text_message(body, preview_url=preview_url)

    def send_reply_message(
        self,
        phone_number,
        body,
        reply_to_message_id,
        *,
        preview_url=False,
        partner=None,
        contact_name=None,
    ):
        thread = self._get_or_create_thread(
            phone_number, partner=partner, contact_name=contact_name
        )
        data = thread.send_reply_message(
            body, reply_to_message_id, preview_url=preview_url
        )

        # Link the replied message
        message_record = self.env["whatsapp.message"].search(
            [("id", "=", data["message_id"])]
        )
        reply_record = self.env["whatsapp.message"].search(
            [("message_id", "=", reply_to_message_id)]
        )
        message_record.sudo().write({"replied_message_id": reply_record.id})

        return data

    def send_reaction_message(
        self,
        phone_number,
        emoji,
        target_message_id,
        *,
        partner=None,
        contact_name=None,
    ):
        thread = self._get_or_create_thread(
            phone_number, partner=partner, contact_name=contact_name
        )
        return thread.send_reaction_message(emoji, target_message_id)

    def send_document_message(
        self,
        phone_number,
        *,
        media_id=None,
        link=None,
        caption=None,
        filename=None,
        attachment=None,
        partner=None,
        contact_name=None,
    ):
        thread = self._get_or_create_thread(
            phone_number, partner=partner, contact_name=contact_name
        )
        return thread.send_document_message(
            media_id=media_id,
            link=link,
            caption=caption,
            filename=filename,
            attachment=attachment,
        )

    def send_cta_url_message(
        self,
        phone_number,
        body_text,
        button_text,
        url,
        *,
        header_text=None,
        footer_text=None,
        partner=None,
        contact_name=None,
    ):
        thread = self._get_or_create_thread(
            phone_number, partner=partner, contact_name=contact_name
        )
        return thread.send_cta_url_message(
            body_text,
            button_text,
            url,
            header_text=header_text,
            footer_text=footer_text,
        )

    def send_list_message(
        self,
        phone_number,
        body_text,
        button_text,
        sections,
        *,
        header_text=None,
        footer_text=None,
        partner=None,
        contact_name=None,
    ):
        thread = self._get_or_create_thread(
            phone_number, partner=partner, contact_name=contact_name
        )
        return thread.send_list_message(
            body_text,
            button_text,
            sections,
            header_text=header_text,
            footer_text=footer_text,
        )

    def send_image_message(
        self,
        phone_number,
        *,
        media_id=None,
        link=None,
        caption=None,
        attachment=None,
        partner=None,
        contact_name=None,
    ):
        thread = self._get_or_create_thread(
            phone_number, partner=partner, contact_name=contact_name
        )
        return thread.send_image_message(
            media_id=media_id,
            link=link,
            caption=caption,
            attachment=attachment,
        )

    def send_video_message(
        self,
        phone_number,
        *,
        media_id=None,
        link=None,
        caption=None,
        attachment=None,
        partner=None,
        contact_name=None,
    ):
        thread = self._get_or_create_thread(
            phone_number, partner=partner, contact_name=contact_name
        )
        return thread.send_video_message(
            media_id=media_id,
            link=link,
            caption=caption,
            attachment=attachment,
        )
