# Copyright 2025 Ahmet Yiğit Budak (https://github.com/yibudak)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl)
{
    "name": "WhatsApp Cloud API - Sale Integration",
    "summary": "Send WhatsApp template messages from Sale Orders",
    "version": "16.0.1.0.0",
    "author": "Ahmet Yiğit Budak, Altinkaya Enclosures",
    "website": "https://github.com/altinkaya-opensource/odoo-whatsapp-cloud-api",
    "license": "LGPL-3",
    "category": "Sales",
    "depends": ["whatsapp_cloud_api_backend", "sale"],
    "data": [
        "views/sale_order_views.xml",
    ],
    "installable": True,
    "auto_install": True,
}
