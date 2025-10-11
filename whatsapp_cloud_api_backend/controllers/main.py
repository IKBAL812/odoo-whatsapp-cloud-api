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
import json
from http import HTTPStatus

from werkzeug.exceptions import Forbidden

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class WhatsAppCloudAPIBackendController(http.Controller):
    _webhook_url = "/graph_tus/webhook"

    @http.route(
        _webhook_url,
        type="http",
        methods=["GET"],
        auth="public",
        csrf=False,
    )
    def whatsapp_webhook_verify(self, **kw):
        verify_token = kw.get("hub.verify_token")
        hub_mode = kw.get("hub.mode")
        hub_challenge = kw.get("hub.challenge")
        if not (verify_token and hub_mode and hub_challenge):
            return Forbidden()

        backend = (
            request.env["whatsapp.backend"]
            .sudo()
            .search(
                [("webhook_secret", "=", verify_token), ("active", "=", True)],
                limit=1,
            )
        )
        if hub_mode == "subscribe" and backend:
            response = request.make_response(hub_challenge)
            response.status_code = HTTPStatus.OK.value
            return response

        response = request.make_response({})
        response.status_code = HTTPStatus.FORBIDDEN.value
        return response

    @http.route(
        _webhook_url,
        type="json",
        methods=["POST"],
        auth="public",
        csrf=False,
    )
    def whatsapp_webhook(self, **kwargs):
        """
        Endpoint to handle WhatsApp Cloud API webhooks.
        """
        payload = json.loads(request.httprequest.data.decode("utf-8"))
        backend = self._find_backend_from_payload(payload)
        if not backend:
            _logger.warning(
                "WhatsApp webhook rejected: unable to resolve backend for payload: %s",
                payload,
            )
            return {"error": "invalid_webhook"}
        self._handle_webhook_payload(backend, payload)
        return {"status": "processed"}

    def _find_backend_from_payload(self, payload):
        entries = payload.get("entry") or []
        for entry in entries:
            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                metadata = value.get("metadata") or {}
                phone_number_id = metadata.get("phone_number_id")
                if not phone_number_id:
                    continue
                backend = (
                    request.env["whatsapp.backend"]
                    .sudo()
                    .search(
                        [
                            ("phone_number_id", "=", phone_number_id),
                            ("active", "=", True),
                        ],
                        limit=1,
                    )
                )
                if backend:
                    return backend
        return request.env["whatsapp.backend"].browse()

    def _handle_webhook_payload(self, backend, payload):
        if payload.get("object") != "whatsapp_business_account":
            _logger.debug(
                "Ignored webhook payload with unexpected object: %s",
                payload.get("object"),
            )
            return

        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value") or {}
                metadata = value.get("metadata") or {}
                phone_number_id = metadata.get("phone_number_id")
                if (
                    phone_number_id
                    and backend.phone_number_id
                    and phone_number_id != backend.phone_number_id
                ):
                    _logger.debug(
                        "Webhook phone_number_id (%s) does not match backend (%s); skipping",
                        phone_number_id,
                        backend.phone_number_id,
                    )
                    continue
                for message in value.get("messages", []):
                    self._process_incoming_message(backend, value, message, payload)

    def _process_incoming_message(self, backend, value, message, full_payload):
        message_model = request.env["whatsapp.message"].sudo()
        msg_type_raw = message.get("type")
        msg_type = self._map_message_type(msg_type_raw)
        phone_number = message.get("from")
        contact = (value.get("contacts") or [{}])[0]
        partner = self._match_partner(phone_number)
        thread = self._find_or_create_thread(backend, phone_number, partner, contact)
        existing = message_model.search(
            [("backend_id", "=", backend.id), ("message_id", "=", message.get("id"))],
            limit=1,
        )

        msg_vals = {
            "backend_id": backend.id,
            "direction": "incoming",
            "message_id": message.get("id"),
            "conversation_id": (message.get("context") or {}).get("id"),
            "phone_number": phone_number,
            "partner_id": partner.id if partner else False,
            "thread_id": thread.id,
            "message_type": msg_type,
            "body": self._extract_body(message),
            "payload": full_payload,
            "status": "delivered",
        }

        if existing:
            existing.write(msg_vals)
            message_record = existing
        else:
            message_record = message_model.create(msg_vals)

        if msg_type == "media":
            attachment = self._ensure_media_attachment(
                message_record, message, msg_type_raw
            )
            if attachment:
                message_record.write({"attachment_id": attachment.id})
        thread._register_incoming_message(message_record)

    def _map_message_type(self, msg_type_raw):
        if msg_type_raw in {"image", "video", "audio", "document", "sticker"}:
            return "media"
        if msg_type_raw in {"text", "interactive", "template", "status"}:
            return msg_type_raw
        return "unknown"

    def _extract_body(self, message):
        msg_type_raw = message.get("type")
        if msg_type_raw == "text":
            return (message.get("text") or {}).get("body")
        if msg_type_raw in {"image", "video", "audio", "document", "sticker"}:
            data = message.get(msg_type_raw) or {}
            return data.get("caption") or data.get("filename")
        interactive = message.get("interactive") or {}
        if interactive:
            for key in ("list_reply", "button_reply"):
                option = interactive.get(key) or {}
                if option.get("title"):
                    return option["title"]
        return None

    def _ensure_media_attachment(self, message_record, message, msg_type_raw):
        media_info = message.get(msg_type_raw) or {}
        media_id = media_info.get("id")
        if not media_id:
            return False
        attachment_model = request.env["ir.attachment"].sudo()
        media_url = self._build_media_url(media_id)
        existing = attachment_model.search(
            [
                ("res_model", "=", "whatsapp.message"),
                ("res_id", "=", message_record.id),
                ("url", "=", media_url),
            ],
            limit=1,
        )
        if existing:
            return existing
        attachment_vals = {
            "name": media_info.get("filename") or media_id,
            "type": "url",
            "url": media_url,
            "mimetype": media_info.get("mime_type"),
            "res_model": "whatsapp.message",
            "res_id": message_record.id,
            "description": media_info.get("caption"),
        }
        return attachment_model.create(attachment_vals)

    def _match_partner(self, phone_number):
        if not phone_number:
            return False
        partner_env = request.env["res.partner"].sudo()
        partner = partner_env.search(
            [("phone_mobile_search", "ilike", phone_number)], limit=1
        )   
        return partner

    def _build_media_url(self, media_id):
        return f"https://graph.facebook.com/v20.0/{media_id}"

    def _find_or_create_thread(self, backend, phone_number, partner, contact):
        thread_model = request.env["whatsapp.thread"].sudo()
        thread = thread_model.search(
            [
                ("backend_id", "=", backend.id),
                ("phone_number", "=", phone_number),
            ],
            limit=1,
        )
        display_name = (contact or {}).get("profile", {}).get("name")

        if not thread:
            vals = {
                "backend_id": backend.id,
                "phone_number": phone_number,
                "partner_id": partner.id if partner else False,
            }
            if display_name:
                vals["name"] = display_name
            thread = thread_model.create(vals)
        else:
            update_vals = {}
            if partner and not thread.partner_id:
                update_vals["partner_id"] = partner.id
            if display_name and thread.name in {
                thread.phone_number,
                "WhatsApp Thread",
                False,
            }:
                update_vals["name"] = display_name
            if update_vals:
                thread.sudo().write(update_vals)
        return thread
