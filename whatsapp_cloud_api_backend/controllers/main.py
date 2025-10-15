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
import base64

from odoo import http


class WhatsAppCloudAPIBackendController(http.Controller):
    @http.route(
        "/whatsapp/attachment/<int:attachment_id>",
        type="http",
        auth="user",
        methods=["GET"],
        csrf=False,
    )
    def serve_attachment(self, attachment_id, **kwargs):
        Attachment = http.request.env["ir.attachment"].sudo()
        attachment = Attachment.browse(attachment_id)
        if not attachment.exists():
            return http.request.not_found()
        if not attachment.mimetype or not attachment.datas:
            return http.request.not_found()
        filecontent = base64.b64decode(attachment.datas)
        headers = [
            ("Content-Type", attachment.mimetype),
            ("Content-Length", len(filecontent)),
            (
                "Content-Disposition",
                f'attachment; filename="{attachment.name}"',
            ),
        ]
        return http.request.make_response(filecontent, headers)
