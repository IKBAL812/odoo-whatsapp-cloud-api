# Copyright 2025 Ahmet Yiğit Budak (https://github.com/yibudak)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl)

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class WhatsAppComposer(models.TransientModel):
    _name = "whatsapp.composer"
    _description = "WhatsApp Template Message Composer"

    # Context fields
    res_model = fields.Char(
        string="Related Document Model",
        required=True,
    )
    res_id = fields.Integer(
        string="Related Document ID",
        required=True,
    )

    # Template selection
    template_id = fields.Many2one(
        comodel_name="whatsapp.template",
        string="Template",
        required=True,
        domain="[('status', '=', 'APPROVED'), ('model_name', '=', res_model)]",
    )

    # Backend selection (determines which phone number to send from)
    backend_id = fields.Many2one(
        comodel_name="whatsapp.backend",
        string="WhatsApp Number",
        required=True,
        help="Select the WhatsApp phone number to send from",
    )

    # Partner selection for recipient
    partner_id = fields.Many2one(
        comodel_name="res.partner",
        string="Recipient",
        required=True,
        help="Select the recipient partner",
    )

    # Phone number field (related from partner)
    phone_number = fields.Char(
        string="Phone Number",
        related="partner_id.mobile",
        readonly=True,
    )

    # Preview fields (computed)
    preview_header = fields.Text(
        string="Header Preview",
        compute="_compute_preview",
    )
    preview_body = fields.Text(
        string="Body Preview",
        compute="_compute_preview",
    )
    preview_footer = fields.Text(
        string="Footer Preview",
        compute="_compute_preview",
    )
    preview_buttons = fields.Text(
        string="Buttons Preview",
        compute="_compute_preview",
    )

    @api.model
    def default_get(self, fields_list):
        """Set defaults from context"""
        res = super().default_get(fields_list)

        active_model = self._context.get("active_model")
        active_id = self._context.get("active_id")

        if active_model:
            res["res_model"] = active_model
        if active_id:
            res["res_id"] = active_id

        # Set a default backend
        backend = self.env["whatsapp.backend"].search([], limit=1)
        res["backend_id"] = backend.id

        # Set a default template based on model
        template = self.env["whatsapp.template"].search(
            [
                ("status", "=", "APPROVED"),
                ("model_name", "=", res.get("res_model")),
            ],
            limit=1,
        )
        res["template_id"] = template.id

        # Set default partner from the record
        if active_model and active_id:
            record = self.env[active_model].browse(active_id)
            if record.exists():
                partner = self._get_partner_from_record(record)
                if partner:
                    res["partner_id"] = partner.id

        return res

    def _get_partner_from_record(self, record):
        """Get partner from record.

        Override this method in inheriting wizards for custom logic.
        """
        # If record is a partner
        if record._name == "res.partner":
            return record
        # Try common field patterns
        if hasattr(record, "partner_id") and record.partner_id:
            return record.partner_id
        if hasattr(record, "partner_shipping_id") and record.partner_shipping_id:
            return record.partner_shipping_id
        if hasattr(record, "customer_id") and record.customer_id:
            return record.customer_id
        return False

    @api.depends("template_id", "res_model", "res_id")
    def _compute_preview(self):
        """Compute the preview of the rendered template"""
        for wizard in self:
            wizard.preview_header = ""
            wizard.preview_body = ""
            wizard.preview_footer = ""
            wizard.preview_buttons = ""

            if not wizard.template_id or not wizard.res_model or not wizard.res_id:
                continue

            template = wizard.template_id
            record = self.env[wizard.res_model].browse(wizard.res_id)

            if not record.exists():
                continue

            # Use template's rendering methods
            wizard.preview_header = template._render_text_with_variables(
                template.header_text, record, "header"
            )
            wizard.preview_body = template._render_text_with_variables(
                template.body_text, record, "body"
            )
            wizard.preview_footer = template.footer_text or ""

            # Render buttons preview
            wizard.preview_buttons = wizard._render_buttons_preview(template, record)

    def _render_buttons_preview(self, template, record):
        """Render buttons preview with URLs substituted"""
        buttons_data = template.buttons_data or []
        if not buttons_data:
            return ""

        button_lines = []
        for btn_data in buttons_data:
            btn_type = btn_data.get("type", "")
            btn_text = btn_data.get("text", "")
            btn_idx = btn_data.get("index", 0)

            if btn_type == "URL":
                url = btn_data.get("url", "")
                if btn_data.get("has_variable"):
                    url = template._render_button_url_with_variables(
                        url, record, btn_idx
                    )
                button_lines.append(f"[URL] {btn_text}: {url}")
            elif btn_type == "QUICK_REPLY":
                button_lines.append(f"[Reply] {btn_text}")
            elif btn_type == "PHONE_NUMBER":
                phone = btn_data.get("phone_number", "")
                button_lines.append(f"[Call] {btn_text}: {phone}")

        return "\n".join(button_lines)

    @api.onchange("backend_id")
    def _onchange_backend_id(self):
        """Filter templates by backend's WABA ID"""
        if self.backend_id and self.backend_id.waba_id:
            return {
                "domain": {
                    "template_id": [
                        ("status", "=", "APPROVED"),
                        ("model_name", "=", self.res_model),
                        ("waba_id", "=", self.backend_id.waba_id),
                    ]
                }
            }
        return {
            "domain": {
                "template_id": [
                    ("status", "=", "APPROVED"),
                    ("model_name", "=", self.res_model),
                ]
            }
        }

    def action_send(self):
        """Send the template message"""
        self.ensure_one()

        if not self.phone_number:
            raise UserError(_("Recipient phone number is required."))

        # Get the source record
        record = self.env[self.res_model].browse(self.res_id)
        if not record.exists():
            raise UserError(_("The source record no longer exists."))

        # Validate template belongs to this backend's WABA
        if self.template_id.waba_id != self.backend_id.waba_id:
            raise UserError(
                _("Template '%s' belongs to a different WhatsApp Business Account.")
                % self.template_id.name
            )

        # Send the template message
        self.backend_id.send_template_message(
            phone_number=self.phone_number,
            template=self.template_id,
            record=record,
        )
        return {"type": "ir.actions.act_window_close"}
