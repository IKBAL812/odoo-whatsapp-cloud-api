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

WP_ATTACHMENT_DOWNLOAD_PATH = "/whatsapp/attachment/download/"
WP_ATTACHMENT_UPLOAD_PATH = "/whatsapp/attachment/upload/"
WP_PROFILE_PICTURE_PATH = "/whatsapp/partner/profile_picture/"


class WhatsAppCloudAPIBackendController(http.Controller):
    @http.route(
        WP_ATTACHMENT_DOWNLOAD_PATH + "<int:attachment_id>",
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

    @http.route(
        WP_ATTACHMENT_UPLOAD_PATH,
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def upload_attachment(self, **kwargs):
        Attachment = http.request.env["ir.attachment"].sudo()
        if "file" not in kwargs:
            return http.request.make_response("No file part in the request", status=400)
        file = kwargs.get("file")
        if file.filename == "":
            return http.request.make_response("No selected file", status=400)
        filecontent = file.read()
        if not filecontent:
            return http.request.make_response("Empty file", status=400)
        attachment = Attachment.create(
            {
                "name": file.filename,
                "datas": base64.b64encode(filecontent),
                "mimetype": file.content_type,
            }
        )
        # Just return uploaded attachment ID for simplicity
        return http.request.make_response(f"{attachment.id}", status=200)

    @http.route(
        WP_PROFILE_PICTURE_PATH + "<int:partner_id>",
        type="http",
        auth="user",
        methods=["GET"],
        csrf=False,
    )
    def serve_profile_picture(self, partner_id, **kwargs):
        Partner = http.request.env["res.partner"].sudo()
        partner = Partner.browse(partner_id)

        if not partner.exists():
            return http.request.not_found()
        if not partner.with_context(whatsapp_connector=True).avatar_256:
            return http.request.not_found()

        filecontent = base64.b64decode(partner.avatar_256)
        headers = [
            ("Content-Type", "image/png"),
            ("Content-Length", len(filecontent)),
            (
                "Content-Disposition",
                f'inline; filename="partner_{partner_id}_profile_picture.png"',
            ),
        ]
        return http.request.make_response(filecontent, headers)
