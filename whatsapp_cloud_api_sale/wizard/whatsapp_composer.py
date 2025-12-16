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
from odoo import _, models


class WhatsappComposer(models.TransientModel):
    _inherit = "whatsapp.composer"

    def action_send(self):
        self.ensure_one()
        if self.res_model == "sale.order":
            order = self.env[self.res_model].browse(self.res_id)
            if order.state == "draft":
                order.state = "sent"
                order.message_post(body=_("Quotation sent via WhatsApp."))

        return super().action_send()
