/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";

/**
 * Structured guidance data for browser/OS combinations when accessed over insecure HTTP.
 * Complies with PRD Section 9.
 */
export function getBrowserGuidance(env) {
    const { browser, os, origin } = env;

    const permanentFix = {
        title: _t("Permanent Fix (Recommended for Production)"),
        description: _t(
            "Put Odoo behind an HTTPS reverse proxy (such as Nginx, Caddy, or Traefik) using a trusted SSL/TLS certificate. Configure 'proxy_mode = True' in odoo.conf and forward headers ('X-Forwarded-Proto https'). Access Odoo via the HTTPS hostname or domain."
        ),
    };

    let workaround = null;

    if (browser === "chrome" || browser === "brave" || browser === "edge") {
        const flagPrefix = browser === "brave" ? "brave" : browser === "edge" ? "edge" : "chrome";
        workaround = {
            title: _t("Client Workaround for %s / Chromium", browser.toUpperCase()),
            warning: _t(
                "Warning: Treating an insecure origin as secure lowers browser isolation. Use only on trusted private networks."
            ),
            steps: [
                _t("Open the browser flags URL in a new tab: %s://flags/#unsafely-treat-insecure-origin-as-secure", flagPrefix),
                _t("Enable the flag and add your exact Odoo origin (%s) to the text box.", origin || "http://<your-ip>:8069"),
                _t("Relaunch your browser. Live camera access will now be permitted for this origin."),
            ],
            canLiveAfterFlag: true,
        };
    } else if (browser === "firefox") {
        workaround = {
            title: _t("Client Workaround for Firefox"),
            warning: _t(
                "Warning: Modifying advanced settings may reduce security. Apply only on trusted local networks."
            ),
            steps: [
                _t("Open 'about:config' in a new tab and accept the risk warning."),
                _t("Search for and set 'media.devices.insecure.enabled' to true."),
                _t("Search for and set 'media.getusermedia.insecure.enabled' to true."),
                _t("Reload the Odoo page. Live camera will now be accessible."),
            ],
            canLiveAfterFlag: true,
        };
    } else if (os === "ios" || browser === "safari") {
        workaround = {
            title: _t("Safari / iOS / iPadOS Workaround"),
            warning: _t(
                "WebKit and iOS do not provide browser flags to bypass secure context restrictions. Live in-page video scanning is not possible over plain HTTP."
            ),
            steps: [
                _t("On mobile/iPadOS, tap 'Take Photo' or 'Scan Barcode' to trigger the native camera app."),
                _t("Photograph the barcode or subject; the browser will process it offline upon return."),
                _t("For live streaming video, the Odoo server MUST be accessed over HTTPS."),
            ],
            canLiveAfterFlag: false,
        };
    } else {
        workaround = {
            title: _t("Alternative Options"),
            warning: _t("Live camera is blocked by modern browser security policies on plain HTTP."),
            steps: [
                _t("Use the 'Take Photo / Upload' button to capture still photos using your system camera or file picker."),
                _t("Configure HTTPS on your local server for full live video support."),
            ],
            canLiveAfterFlag: false,
        };
    }

    return {
        workaround,
        permanentFix,
        origin,
    };
}

