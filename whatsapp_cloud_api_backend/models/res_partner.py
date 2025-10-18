# Copyright 2025 Erol Develi (https://github.com/erlinberg)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import models


class ResPartner(models.Model):
    _inherit = "res.partner"

    def _compute_avatar(self, avatar_field, image_field):
        """
        Override avatar computation to prevent Odoo from auto-generating
        default avatars.

        By default, Odoo automatically generates avatar images from partner initials
        when no avatar is set. This override allows the WhatsApp connector to
        distinguish between actual uploaded images and missing avatars by returning
        empty bytes instead of auto-generated placeholders.

        This enables the frontend to show appropriate fallback UI when partners
        have no actual profile picture.
        """
        # When called from WhatsApp connector, 
        # return raw image data without auto-generation
        if self._context.get("whatsapp_connector"):
            for record in self:
                avatar = record[image_field]
                if not avatar:
                    avatar = b""
                record[avatar_field] = avatar
            return True
        else:
            return super()._compute_avatar(avatar_field, image_field)
