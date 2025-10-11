# Copyright (C) 2025 Ahmet Yiğit Budak
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl-3.0.html)
from odoo import _, api, fields, models


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
    last_message_date = fields.Datetime(string="Last Message Date", readonly=True, index=True)
    last_message_preview = fields.Text(string="Last Message Preview", readonly=True)

    _sql_constraints = [
        (
            "whatsapp_thread_unique",
            "unique(backend_id, phone_number)",
            "A thread already exists for this backend and phone number.",
        )
    ]

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

    def _register_incoming_message(self, message_record):
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
