/** @odoo-module **/

import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";

/**
 * WhatsApp User Menu Item
 *
 * Adds "Open WhatsApp" button to the user menu dropdown that performs SSO login
 * to the WhatsApp frontend application.
 */
function whatsappMenuItem(env) {
    return {
        type: "item",
        id: "whatsapp",
        description: env._t("Open WhatsApp"),
        callback: async () => {
            try {
                const result = await env.services.rpc("/whatsapp/frontend/sso-url");

                if (result.error) {
                    env.services.notification.add(result.error, {
                        type: "warning",
                        title: env._t("WhatsApp Integration"),
                    });
                    return;
                }

                if (result.url) {
                    browser.open(result.url, "_blank");
                }
            } catch (error) {
                env.services.notification.add(
                    env._t("Failed to open WhatsApp. Please contact your administrator."),
                    {
                        type: "danger",
                        title: env._t("WhatsApp Integration Error"),
                    }
                );
                console.error("WhatsApp SSO error:", error);
            }
        },
        sequence: 65, // Position between "My Odoo.com account" (60) and "Log out" (70)
    };
}

// Register the menu item in the user_menuitems registry
registry.category("user_menuitems").add("whatsapp", whatsappMenuItem);
