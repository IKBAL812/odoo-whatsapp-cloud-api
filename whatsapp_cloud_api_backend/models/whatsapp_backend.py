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
from whatsapp import WhatsApp

from odoo import fields, models

import secrets

class WhatsAppBackend(models.Model):
    _name = "whatsapp.backend"
    _description = "WhatsApp Cloud API Backend"
    # _inherit = ["mail.thread", "mail.activity.mixin"]

    name = fields.Char(string="Name", required=True)
    active = fields.Boolean(string="Active", default=True)
    api_token = fields.Char(string="API Token", required=True)
    phone_number_id = fields.Char(string="Phone Number ID", required=True)
    api_version = fields.Char(string="API Version", required=True, default="v23.0")
    webhook_secret = fields.Char(
        string="Webhook Secret",
        required=True,
        default=lambda self: secrets.token_urlsafe(32),
    )
    language = fields.Many2one(
        comodel_name="res.lang",
        string="Language",
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

    def get_whatsapp_client(self):
        self.ensure_one()

        return WhatsApp(
            self.api_token,
            phone_number_id={self.name: self.phone_number_id},
            version=self.api_version,
        )
