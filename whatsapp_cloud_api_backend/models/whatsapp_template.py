# Copyright 2025 Ahmet Yiğit Budak (https://github.com/yibudak)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl)

import re
from datetime import date, datetime

from odoo import _, api, fields, models


class WhatsAppTemplate(models.Model):
    _name = "whatsapp.template"
    _description = "WhatsApp Message Template"
    _order = "name"

    # Basic template info from WhatsApp API
    name = fields.Char(required=True, index=True)
    template_id = fields.Char(string="WhatsApp Template ID", index=True)
    status = fields.Selection(
        selection=[
            ("APPROVED", "Approved"),
            ("PENDING", "Pending"),
            ("REJECTED", "Rejected"),
            ("PAUSED", "Paused"),
            ("DISABLED", "Disabled"),
        ],
        default="PENDING",
    )
    category = fields.Selection(
        selection=[
            ("UTILITY", "Utility"),
            ("MARKETING", "Marketing"),
            ("AUTHENTICATION", "Authentication"),
        ],
    )
    language = fields.Char(string="Language Code", help="e.g., en_US, tr")

    # WABA association (templates belong to WABA, not individual backends)
    waba_id = fields.Char(
        string="WhatsApp Business Account ID",
        required=True,
        index=True,
        help="WABA ID this template belongs to. Any backend with"
        " matching WABA ID can use this template.",
    )

    # Odoo model association for variable mapping
    model_id = fields.Many2one(
        comodel_name="ir.model",
        string="Associated Model",
        help="Odoo model to use for populating template variables",
        ondelete="set null",
    )
    model_name = fields.Char(related="model_id.model", store=True)

    # Template structure (stored as JSON)
    components = fields.Json(help="Raw component data from WhatsApp API")

    # Parsed component fields for easier access
    header_text = fields.Text(compute="_compute_component_fields", store=True)
    body_text = fields.Text(compute="_compute_component_fields", store=True)
    footer_text = fields.Text(compute="_compute_component_fields", store=True)
    buttons_data = fields.Json(
        compute="_compute_component_fields",
        store=True,
        help="Parsed button data from template",
    )

    # Variable mappings
    variable_ids = fields.One2many(
        comodel_name="whatsapp.template.variable",
        inverse_name="template_id",
        string="Variable Mappings",
    )

    # Computed field for variable count
    variable_count = fields.Integer(compute="_compute_variable_count")

    active = fields.Boolean(default=True)
    last_synced = fields.Datetime(readonly=True)

    _sql_constraints = [
        (
            "template_waba_language_unique",
            "unique(template_id, waba_id, language)",
            "Template with this language already exists for this WABA.",
        )
    ]

    @api.depends("components")
    def _compute_component_fields(self):
        """Parse components JSON to extract header, body, footer, buttons"""
        for record in self:
            components = record.components or []
            record.header_text = ""
            record.body_text = ""
            record.footer_text = ""
            record.buttons_data = []

            buttons = []
            for comp in components:
                comp_type = comp.get("type", "").upper()
                if comp_type == "HEADER":
                    fmt = comp.get("format", "").upper()
                    if fmt == "TEXT" or comp.get("text"):
                        record.header_text = comp.get("text", "")
                elif comp_type == "BODY":
                    record.body_text = comp.get("text", "")
                elif comp_type == "FOOTER":
                    record.footer_text = comp.get("text", "")
                elif comp_type == "BUTTONS":
                    # Parse buttons
                    for idx, button in enumerate(comp.get("buttons", [])):
                        btn_type = button.get("type", "").upper()
                        btn_data = {
                            "index": idx,
                            "type": btn_type,
                            "text": button.get("text", ""),
                        }
                        if btn_type == "URL":
                            btn_data["url"] = button.get("url", "")
                            # Check if URL has variables
                            btn_data["has_variable"] = "{{" in button.get("url", "")
                        elif btn_type == "PHONE_NUMBER":
                            btn_data["phone_number"] = button.get("phone_number", "")
                        buttons.append(btn_data)

            record.buttons_data = buttons

    def _compute_variable_count(self):
        for record in self:
            record.variable_count = len(record.variable_ids)

    def _extract_variables_from_text(self, text):
        """Extract {{N}} style variables from text, return list of positions"""
        pattern = r"\{\{(\d+)\}\}"
        matches = re.findall(pattern, text or "")
        return sorted(set(int(m) for m in matches))

    def action_parse_variables(self):
        """Parse template and create/update variable records"""
        self.ensure_one()
        Variable = self.env["whatsapp.template.variable"]

        existing_vars = {
            (v.component_type, v.variable_position, v.button_index): v
            for v in self.variable_ids
        }

        components = self.components or []
        for comp in components:
            comp_type = comp.get("type", "").upper()
            text = comp.get("text", "")
            positions = self._extract_variables_from_text(text)

            # Map component type to selection value
            if comp_type == "HEADER":
                comp_key = "header"
            elif comp_type == "BODY":
                comp_key = "body"
            elif comp_type == "BUTTONS":
                # Handle button URL variables
                for idx, button in enumerate(comp.get("buttons", [])):
                    btn_type = button.get("type", "").upper()
                    if btn_type == "URL":
                        url = button.get("url", "")
                        url_positions = self._extract_variables_from_text(url)
                        for pos in url_positions:
                            key = ("button", pos, idx)
                            if key not in existing_vars:
                                Variable.create(
                                    {
                                        "template_id": self.id,
                                        "component_type": "button",
                                        "variable_position": pos,
                                        "button_index": idx,
                                        "variable_name": f"button_{idx}_url_{pos}",
                                    }
                                )
                continue
            else:
                continue

            for pos in positions:
                key = (comp_key, pos, 0)
                if key in existing_vars:
                    # Variable already exists
                    pass
                else:
                    Variable.create(
                        {
                            "template_id": self.id,
                            "component_type": comp_key,
                            "variable_position": pos,
                            "variable_name": f"{comp_key}_{pos}",
                        }
                    )

        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Variables Parsed"),
                "message": _("Template variables have been extracted."),
                "type": "success",
            },
        }

    def _render_text_with_variables(self, text, record, component_type):
        """Render template text by substituting variables with actual values

        Args:
            text: Template text with {{N}} placeholders
            record: Odoo record to get field values from
            component_type: 'header', 'body', or 'button'

        Returns:
            str: Rendered text with variables replaced
        """
        if not text:
            return ""

        result = text

        # Get variables for this component
        variables = self.variable_ids.filtered(
            lambda v: v.component_type == component_type
        ).sorted(lambda v: v.variable_position)

        for var in variables:
            placeholder = f"{{{{{var.variable_position}}}}}"
            value = var.get_value_from_record(record) if record else ""
            result = result.replace(placeholder, str(value) if value else "")

        return result

    def render_message_preview(self, record):
        """Render the full template message as it will appear to the recipient

        Args:
            record: Odoo record for variable substitution

        Returns:
            str: Fully rendered message text
        """
        self.ensure_one()
        parts = []

        # Render header
        if self.header_text:
            rendered_header = self._render_text_with_variables(
                self.header_text, record, "header"
            )
            if rendered_header:
                parts.append(rendered_header)

        # Render body
        if self.body_text:
            rendered_body = self._render_text_with_variables(
                self.body_text, record, "body"
            )
            if rendered_body:
                parts.append(rendered_body)

        # Footer (no variables)
        if self.footer_text:
            parts.append(self.footer_text)

        return "\n\n".join(parts) if parts else f"[Template: {self.name}]"

    def _render_button_url_with_variables(self, url, record, button_index):
        """Render button URL by substituting variables with actual values

        Args:
            url: URL string with {{N}} placeholders
            record: Odoo record to get field values from
            button_index: Index of the button (0-based)

        Returns:
            str: Rendered URL with variables replaced
        """
        if not url:
            return ""

        result = url

        # Get variables for this button
        variables = self.variable_ids.filtered(
            lambda v: v.component_type == "button" and v.button_index == button_index
        ).sorted(lambda v: v.variable_position)

        for var in variables:
            placeholder = f"{{{{{var.variable_position}}}}}"
            value = var.get_value_from_record(record) if record else ""
            result = result.replace(placeholder, str(value) if value else "")

        return result

    def build_payload_for_record(self, record):
        """Build template message payload using variable mappings from a record

        Args:
            record: Odoo record to get field values from

        Returns:
            dict: WhatsApp API template payload
        """
        self.ensure_one()

        components = []

        # Group variables by component type
        vars_by_component = {}
        button_vars = {}  # {button_index: [params]}

        for var in self.variable_ids.sorted(
            lambda v: (v.component_type, v.button_index, v.variable_position)
        ):
            comp_type = var.component_type

            # Get the value from the record
            value = var.get_value_from_record(record) if record else ""

            if comp_type == "button":
                # Group by button index
                btn_idx = var.button_index
                if btn_idx not in button_vars:
                    button_vars[btn_idx] = []
                button_vars[btn_idx].append(
                    {
                        "type": "text",
                        "text": str(value) if value else "",
                    }
                )
            else:
                if comp_type not in vars_by_component:
                    vars_by_component[comp_type] = []
                vars_by_component[comp_type].append(
                    {
                        "type": "text",
                        "text": str(value) if value else "",
                    }
                )

        # Build header component if has variables
        if "header" in vars_by_component:
            components.append(
                {
                    "type": "header",
                    "parameters": vars_by_component["header"],
                }
            )

        # Build body component
        if "body" in vars_by_component:
            components.append(
                {
                    "type": "body",
                    "parameters": vars_by_component["body"],
                }
            )

        # Build button components
        buttons_data = self.buttons_data or []
        for btn_data in buttons_data:
            btn_idx = btn_data.get("index", 0)
            btn_type = btn_data.get("type", "").upper()

            if btn_type == "URL" and btn_data.get("has_variable"):
                # URL button with dynamic parameter
                params = button_vars.get(btn_idx, [])
                if params:
                    components.append(
                        {
                            "type": "button",
                            "sub_type": "url",
                            "index": str(btn_idx),
                            "parameters": params,
                        }
                    )

        payload = {
            "name": self.name,
            "language": {"code": self.language, "policy": "deterministic"},
        }

        if components:
            payload["components"] = components

        return payload


class WhatsAppTemplateVariable(models.Model):
    _name = "whatsapp.template.variable"
    _description = "WhatsApp Template Variable Mapping"
    _order = "component_type, button_index, variable_position"

    template_id = fields.Many2one(
        comodel_name="whatsapp.template",
        required=True,
        ondelete="cascade",
        index=True,
    )

    # Position in template (e.g., {{1}}, {{2}})
    variable_position = fields.Integer(
        required=True,
        help="Variable position number (1 for {{1}}, 2 for {{2}}, etc.)",
    )

    # Which component this variable belongs to
    component_type = fields.Selection(
        selection=[
            ("header", "Header"),
            ("body", "Body"),
            ("button", "Button URL"),
        ],
        required=True,
    )

    # Button index (only used when component_type == 'button')
    button_index = fields.Integer(
        default=0,
        help="Index of the button (0-based) when component_type is 'button'",
    )

    # User-friendly name
    variable_name = fields.Char(help="Descriptive name for this variable")

    # For field type: reference to model field
    field_id = fields.Many2one(
        comodel_name="ir.model.fields",
        string="Source Field",
        help="Field to read value from",
        ondelete="set null",
    )
    field_name = fields.Char(related="field_id.name", readonly=True)

    # Related model from template (for domain filtering)
    template_model_id = fields.Many2one(
        related="template_id.model_id",
        store=True,
    )

    @api.onchange("template_id")
    def _onchange_template_id(self):
        """Clear field_id when template changes"""
        if self.field_id and self.field_id.model_id != self.template_id.model_id:
            self.field_id = False

    def get_value_from_record(self, record):
        """Get the variable value from an Odoo record

        Args:
            record: Odoo record to extract value from

        Returns:
            str: The value to use in the template
        """
        self.ensure_one()

        if not self.field_name or not record:
            return ""

        try:
            value = record[self.field_name]
            # Handle Many2one - get display name
            if hasattr(value, "display_name"):
                return value.display_name
            # Handle dates
            if isinstance(value, date | datetime):
                return str(value)
            # Handle boolean
            if isinstance(value, bool):
                return _("Yes") if value else _("No")
            # Handle numeric with zero check
            if value == 0:
                return "0"
            return str(value) if value else ""
        except Exception:
            return ""
