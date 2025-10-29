/** @odoo-module **/

import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";
import { _t } from "@web/core/l10n/translation";

/**
 * WhatsApp User Menu Item
 *
 * Adds "Open WhatsApp" button to the user menu dropdown that performs SSO login
 * to the WhatsApp frontend application.
 * Only shown to users in WhatsApp backend groups.
 */
function whatsappMenuItem(env) {
    const user = env.services.user;
    const hasWhatsAppAccess = user.hasGroup('whatsapp_cloud_api_backend.group_whatsapp_backend_user');

    if (!hasWhatsAppAccess) {
        return null;
    }

    return {
        type: "item",
        id: "whatsapp",
        description: _t("Open WhatsApp"),
        callback: async () => {
            try {
                const result = await env.services.rpc("/whatsapp/frontend/sso-url");

                if (result.error) {
                    env.services.notification.add(result.error, {
                        type: "warning",
                        title: _t("WhatsApp Integration"),
                    });
                    return;
                }

                if (result.url) {
                    browser.open(result.url, "_blank");
                }
            } catch (error) {
                env.services.notification.add(
                    _t("Failed to open WhatsApp. Please contact your administrator."),
                    {
                        type: "danger",
                        title: _t("WhatsApp Integration Error"),
                    }
                );
                console.error("WhatsApp SSO error:", error.message || "An error occurred");
            }
        },
        sequence: 65, // Position between "My Odoo.com account" (60) and "Log out" (70)
    };
}

// Register the menu item in the user_menuitems registry
registry.category("user_menuitems").add("whatsapp", whatsappMenuItem);
