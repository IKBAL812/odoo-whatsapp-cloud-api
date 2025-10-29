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

from odoo import fields, models


class WhatsAppChatbot(models.Model):
    _name = "whatsapp.chatbot"
    _description = "WhatsApp Chatbot Automation"
    _rec_name = "title"
    _order = "sequence, title"

    title = fields.Char(
        required=True,
        translate=True,
        help="Name of the chatbot",
    )
    active = fields.Boolean(
        default=True,
        help="If unchecked, this chatbot will be disabled",
    )
    sequence = fields.Integer(
        default=10,
        help="Used to order chatbots in the list",
    )
    script_ids = fields.One2many(
        comodel_name="whatsapp.chatbot.script",
        inverse_name="chatbot_id",
        string="Conversation Scripts",
        help="Define the conversation flow steps",
    )
    main_menu_button_text = fields.Char(
        translate=True,
        default="Main Menu",
        required=True,
        help="Text displayed on the button to return to main menu",
    )
