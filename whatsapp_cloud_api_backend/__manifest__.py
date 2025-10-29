# Copyright 2025 Ahmet Yiğit Budak (https://github.com/yibudak)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl)
{
    "name": "WhatsApp Cloud API Backend",
    "summary": "WhatsApp Cloud API & Odoo Integration Backend",
    "version": "17.0.1.0.0",
    "author": "Ahmet Yiğit Budak, Altinkaya Enclosures",
    "website": "https://github.com/altinkaya-opensource/odoo-whatsapp-cloud-api",
    "license": "LGPL-3",
    "category": "Tools",
    "depends": ["base", "mail", "queue_job", "web"],
    "external_dependencies": {"python": ["requests"]},
    "data": [
        "security/whatsapp_security.xml",
        "security/ir.model.access.csv",
        "views/whatsapp_backend_views.xml",
        "views/whatsapp_message_views.xml",
        "views/whatsapp_thread_views.xml",
        "views/whatsapp_chatbot_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "whatsapp_cloud_api_backend/static/src/js/user_menu.js",
        ],
    },
    "installable": True,
}
