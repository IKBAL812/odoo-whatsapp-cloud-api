# Copyright (C) 2025 Ahmet Yiğit Budak
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl-3.0.html)
import json
import time

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class WhatsAppThread(models.Model):
    _name = "whatsapp.thread"
    _description = "WhatsApp Thread"
    _order = "last_message_date desc, id desc"

    name = fields.Char(string="Subject", required=True, default="WhatsApp Thread")
    backend_id = fields.Many2one(
        comodel_name="whatsapp.backend",
        string="Backend",
        required=True,
        ondelete="cascade",
        index=True,
    )
    company_id = fields.Many2one(
        comodel_name="res.company",
        string="Company",
        related="backend_id.company_id",
        store=True,
        index=True,
    )
    partner_id = fields.Many2one(
        comodel_name="res.partner",
        string="Partner",
        ondelete="set null",
        index=True,
    )
    phone_number = fields.Char(string="Phone Number", required=True, index=True)
    whatsapp_message_ids = fields.One2many(
        comodel_name="whatsapp.message",
        inverse_name="thread_id",
        string="WhatsApp Messages",
    )
    last_message_id = fields.Many2one(
        comodel_name="whatsapp.message",
        string="Last Message",
        readonly=True,
    )
    last_message_date = fields.Datetime(
        string="Last Message Date", readonly=True, index=True
    )
    last_message_preview = fields.Text(string="Last Message Preview", readonly=True)

    _sql_constraints = [
        (
            "whatsapp_thread_unique",
            "unique(backend_id, phone_number)",
            "A thread already exists for this backend and phone number.",
        )
    ]

    unread_count = fields.Integer(
        string="Unread Count",
        compute="_compute_unread_count",
    )

    def _compute_unread_count(self):
        """Compute unread count for each thread."""
        for thread in self:
            thread.unread_count = thread.get_unread_count()

    @api.model
    def _generate_thread_name(self, partner_id=None, phone_number=None):
        partner_name = ""
        if partner_id:
            partner = self.env["res.partner"].browse(partner_id)
            partner_name = partner.display_name
        phone_number = phone_number or ""
        if partner_name and phone_number:
            return f"{partner_name} ({phone_number})"
        return partner_name or phone_number or _("WhatsApp Thread")

    @api.model
    def create(self, vals):
        vals = dict(vals)
        if not vals.get("name"):
            vals["name"] = self._generate_thread_name(
                vals.get("partner_id"), vals.get("phone_number")
            )
        thread = super().create(vals)
        return thread

    def write(self, vals):
        res = super().write(vals)
        if "name" not in vals and any(
            field in vals for field in ("partner_id", "phone_number")
        ):
            for thread in self:
                new_name = thread._generate_thread_name(
                    thread.partner_id.id, thread.phone_number
                )
                if new_name != thread.name:
                    super(WhatsAppThread, thread).write({"name": new_name})
        return res

    def _register_message(self, message_record):
        """Attach the WhatsApp message to the thread and update metadata."""
        self.ensure_one()
        if not message_record.thread_id or message_record.thread_id != self:
            message_record.sudo().write({"thread_id": self.id})

        updates = {
            "last_message_id": message_record.id,
            "last_message_date": message_record.create_date,
            "last_message_preview": message_record.body or False,
        }
        if message_record.partner_id and not self.partner_id:
            updates["partner_id"] = message_record.partner_id.id
        self.sudo().write(updates)
        return message_record

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def _map_outgoing_status(raw_status):
        mapping = {
            None: "pending",
            "accepted": "sent",
            "sent": "sent",
            "delivered": "delivered",
            "read": "read",
            "failed": "failed",
            "held_for_quality_assessment": "pending",
        }
        return mapping.get(raw_status, "pending")

    def _get_media_id(self, media_id=None, attachment=None):
        """Get media ID from provided media_id or by uploading attachment.

        Args:
            media_id: WhatsApp media ID (if already uploaded)
            attachment: ir.attachment record or ID to upload

        Returns:
            str: WhatsApp media ID
        """
        if media_id:
            return media_id
        if attachment:
            if isinstance(attachment, int):
                attachment = self.env["ir.attachment"].browse(attachment).sudo()
            return self.backend_id._upload_media_to_whatsapp(attachment)
        return None

    def _send_message(
        self, *, payload, message_type, body=None, attachment=None, extra_vals=None
    ):
        self.ensure_one()
        backend = self.backend_id
        if not backend:
            raise UserError(_("A WhatsApp backend is required to send messages."))
        base_payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self.phone_number,
        }
        base_payload.update(payload)
        # Deep copy for storage purposes to avoid later mutation
        stored_request = json.loads(json.dumps(base_payload))
        response = backend._call_whatsapp_api("messages", base_payload)
        message_info = (response.get("messages") or [{}])[0]
        raw_status = message_info.get("message_status")
        status = self._map_outgoing_status(raw_status)
        if not raw_status and message_info.get("id"):
            status = "sent"

        vals = {
            "backend_id": backend.id,
            "thread_id": self.id,
            "direction": "outgoing",
            "message_type": message_type,
            "phone_number": self.phone_number,
            "partner_id": self.partner_id.id if self.partner_id else False,
            "body": body,
            "payload": {"request": stored_request, "response": response},
            "status": status,
            "message_id": message_info.get("id"),
            "timestamp": int(time.time()),
        }
        if attachment:
            vals["attachment_id"] = attachment
        if extra_vals:
            vals.update(extra_vals)

        message_record = self.env["whatsapp.message"].sudo().create(vals)
        self._register_message(message_record)
        return {
            "message_id": message_record.id,
            "whatsapp_id": message_record.message_id,
            "status": message_record.status,
            "thread_id": self.id,
            "thread_name": self.name,
            "partner_id": self.partner_id.id if self.partner_id else False,
            "phone_number": self.phone_number,
            "timestamp": message_record.timestamp,
        }

    @api.model
    def get_unread_count(self):
        """
        Calculate unread count for this thread.
        Only count incoming messages that haven't been read.
        """
        return len(
            self.env["whatsapp.message.read.status"]
            .search(
                [
                    ("message_id.thread_id", "=", self.id),
                    ("is_read", "=", False),
                    ("user_id", "=", self.env.user.id),
                ]
            )
            .mapped("message_id")
        )

    def mark_as_read(self):
        """
        Mark all incoming messages in this thread as read.
        Called when user opens a thread in the frontend.
        """
        messages = (
            self.env["whatsapp.message.read.status"]
            .search(
                [
                    ("message_id.thread_id", "=", self.id),
                    ("is_read", "=", False),
                    ("user_id", "=", self.env.user.id),
                ]
            )
            .mapped("message_id")
        )
        for msg in messages:
            msg.mark_as_read_by_user(self.env.user)

        return True

    # -------------------------------------------------------------------------
    # Sending API
    # -------------------------------------------------------------------------

    def send_text_message(self, body, preview_url=False):
        self.ensure_one()
        if not body:
            raise UserError(_("Body is required to send a text message."))
        payload = {
            "type": "text",
            "text": {
                "body": body,
            },
        }
        if preview_url:
            payload["text"]["preview_url"] = True
        return self._send_message(payload=payload, message_type="text", body=body)

    def send_reply_message(self, body, reply_to_message_id, preview_url=False):
        self.ensure_one()
        if not reply_to_message_id:
            raise UserError(
                _("Reply message requires a message identifier to reply to.")
            )
        if not body:
            raise UserError(_("Body is required to send a reply message."))
        payload = {
            "type": "text",
            "context": {"message_id": reply_to_message_id},
            "text": {
                "body": body,
            },
        }
        if preview_url:
            payload["text"]["preview_url"] = True
        return self._send_message(payload=payload, message_type="text", body=body)

    def send_reaction_message(self, emoji, target_message_id):
        self.ensure_one()
        if not target_message_id:
            raise UserError(_("Reaction message requires a target message identifier."))
        if not emoji:
            raise UserError(_("Reaction message requires an emoji."))
        payload = {
            "type": "reaction",
            "reaction": {
                "message_id": target_message_id,
                "emoji": emoji,
            },
        }
        return self._send_message(payload=payload, message_type="reaction", body=emoji)

    def send_document_message(
        self,
        *,
        media_id=None,
        link=None,
        caption=None,
        filename=None,
        attachment=None,
    ):
        self.ensure_one()
        media_id = self._get_media_id(media_id, attachment)

        document = {}
        if media_id:
            document["id"] = media_id
        elif link:
            document["link"] = link
        else:
            raise UserError(
                _(
                    "Document message requires either an attachment, "
                    "media ID, or a link."
                )
            )

        if caption:
            document["caption"] = caption
        if filename:
            document["filename"] = filename

        body_value = caption or filename or _("Document")
        payload = {
            "type": "document",
            "document": document,
        }
        return self._send_message(
            payload=payload,
            message_type="media",
            body=body_value,
            attachment=attachment,
        )

    def send_cta_url_message(
        self,
        body_text,
        button_text,
        url,
        *,
        header_text=None,
        footer_text=None,
    ):
        self.ensure_one()
        if not body_text:
            raise UserError(_("Body text is required for an interactive CTA message."))
        if not button_text or not url:
            raise UserError(_("CTA button text and URL are required."))
        interactive = {
            "type": "button",
            "body": {"text": body_text},
            "action": {
                "buttons": [
                    {
                        "type": "cta_url",
                        "text": button_text,
                        "url": url,
                    }
                ]
            },
        }
        if header_text:
            interactive["header"] = {"type": "text", "text": header_text}
        if footer_text:
            interactive["footer"] = {"text": footer_text}
        payload = {
            "type": "interactive",
            "interactive": interactive,
        }
        return self._send_message(
            payload=payload, message_type="interactive", body=body_text
        )

    def send_list_message(
        self,
        body_text,
        button_text,
        sections,
        *,
        header_text=None,
        footer_text=None,
    ):
        self.ensure_one()
        if not sections:
            raise UserError(
                _("Interactive list message requires at least one section.")
            )
        if not body_text or not button_text:
            raise UserError(
                _("Body text and button text are required for list messages.")
            )
        interactive = {
            "type": "list",
            "body": {"text": body_text},
            "action": {"button": button_text, "sections": sections},
        }
        if header_text:
            interactive["header"] = {"type": "text", "text": header_text}
        if footer_text:
            interactive["footer"] = {"text": footer_text}
        payload = {
            "type": "interactive",
            "interactive": interactive,
        }
        return self._send_message(
            payload=payload, message_type="interactive", body=body_text
        )

    def send_image_message(
        self,
        *,
        media_id=None,
        link=None,
        caption=None,
        attachment=None,
    ):
        self.ensure_one()
        media_id = self._get_media_id(media_id, attachment)

        image = {}
        if media_id:
            image["id"] = media_id
        elif link:
            image["link"] = link
        else:
            raise UserError(
                _("Image message requires either an attachment, media ID, or a link.")
            )

        if caption:
            image["caption"] = caption

        body_value = caption or _("Image")
        payload = {
            "type": "image",
            "image": image,
        }
        return self._send_message(
            payload=payload,
            message_type="media",
            body=body_value,
            attachment=attachment,
        )

    def send_video_message(
        self,
        *,
        media_id=None,
        link=None,
        caption=None,
        attachment=None,
    ):
        self.ensure_one()
        media_id = self._get_media_id(media_id, attachment)

        video = {}
        if media_id:
            video["id"] = media_id
        elif link:
            video["link"] = link
        else:
            raise UserError(
                _("Video message requires either an attachment, media ID, or a link.")
            )

        if caption:
            video["caption"] = caption

        body_value = caption or _("Video")
        payload = {
            "type": "video",
            "video": video,
        }
        return self._send_message(
            payload=payload,
            message_type="media",
            body=body_value,
            attachment=attachment,
        )
