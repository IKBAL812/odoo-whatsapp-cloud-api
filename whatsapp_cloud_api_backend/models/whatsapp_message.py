# Copyright (C) 2025 Ahmet Yiğit Budak
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl-3.0.html)
from odoo import api, fields, models


class WhatsAppMessage(models.Model):
    _name = "whatsapp.message"
    _description = "WhatsApp Message"
    _order = "timestamp desc, id desc"
    _rec_name = "message_id"

    backend_id = fields.Many2one(
        comodel_name="whatsapp.backend",
        string="Backend",
        required=True,
        ondelete="cascade",
    )
    direction = fields.Selection(
        selection=[("incoming", "Incoming"), ("outgoing", "Outgoing")],
        string="Direction",
        default="outgoing",
        required=True,
        help="Indicates whether the message was received from or sent to WhatsApp.",
    )
    message_id = fields.Char(
        string="Message ID",
        copy=False,
        index=True,
        help="Identifier provided by the WhatsApp Cloud API.",
    )
    conversation_id = fields.Char(
        string="Conversation ID",
        help="External conversation identifier supplied by the WhatsApp API.",
    )
    phone_number = fields.Char(
        string="Phone Number",
        help="Counterparty phone number in international format.",
    )
    partner_id = fields.Many2one(
        comodel_name="res.partner",
        string="Partner",
        ondelete="cascade",
        index=True,
        help="Optional partner related to the counterparty of the message.",
    )
    thread_id = fields.Many2one(
        comodel_name="whatsapp.thread",
        string="Thread",
        required=True,
        ondelete="cascade",
        index=True,
        help="Conversation this message belongs to.",
    )
    message_type = fields.Selection(
        selection=[
            ("text", "Text"),
            ("media", "Media"),
            ("interactive", "Interactive"),
            ("reaction", "Reaction"),
            ("template", "Template"),
            ("status", "Status"),
            ("unknown", "Unknown"),
        ],
        string="Message Type",
        default="text",
        required=True,
        help="Type of message exchanged with the WhatsApp Cloud API.",
    )
    body = fields.Text(string="Body", help="Text content of the message, if any.")
    attachment_id = fields.Many2one(
        comodel_name="ir.attachment",
        string="Attachment",
        help="Optional media or document associated with the message.",
    )
    payload = fields.Json(
        string="Payload",
        help="Raw payload returned by the WhatsApp Cloud API for traceability.",
    )
    status = fields.Selection(
        selection=[
            ("draft", "Draft"),
            ("pending", "Pending"),
            ("sent", "Sent"),
            ("delivered", "Delivered"),
            ("read", "Read"),
            ("failed", "Failed"),
        ],
        string="Status",
        default="pending",
        required=True,
        help="Lifecycle state of the message in the WhatsApp Cloud API.",
    )

    company_id = fields.Many2one(
        comodel_name="res.company",
        string="Company",
        related="backend_id.company_id",
        store=True,
    )

    replied_message_id = fields.Many2one(
        comodel_name="whatsapp.message",
        string="Replied Message",
        help="Reference to the message this message is replying to, if any.",
    )

    timestamp = fields.Integer(
        string="Timestamp",
        required=True,
    )

    _sql_constraints = [
        (
            "whatsapp_message_unique",
            "unique(message_id, backend_id)",
            "A message with the same identifier already exists for this backend.",
        )
    ]

    def name_get(self):
        direction_labels = dict(self._fields["direction"].selection)
        result = []
        for record in self:
            name = (
                record.message_id
                or record.phone_number
                or direction_labels.get(record.direction, "")
            )
            if record.create_date:
                name = f"{name} [{fields.Datetime.to_string(record.create_date)}]"
            result.append((record.id, name))
        return result

    @api.model
    def search_read(self, domain=None, fields=None, offset=0, limit=None, order=None):
        res = super().search_read(
            domain=domain, fields=fields, offset=offset, limit=limit, order=order
        )
        if "attachment_id" in (fields or []) and self.env.context.get(
            "whatsapp_connector"
        ):
            base_url = self.env["ir.config_parameter"].sudo().get_param("web.base.url")
            for record in res:
                if record.get("attachment_id"):
                    attachment_record = (
                        self.env["ir.attachment"]
                        .browse(record["attachment_id"][0])
                        .sudo()
                    )
                    record["attachment"] = {
                        "id": attachment_record.id,
                        "name": attachment_record.name,
                        "mimetype": attachment_record.mimetype,
                        "url": f"{base_url}/whatsapp/attachment/{attachment_record.id}",
                        "file_size": attachment_record.file_size,
                    }
        return res
