/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { getBrowserGuidance } from "./browser_guide";

export class GuidancePanel extends Component {
    setup() {
        this.guidance = getBrowserGuidance(this.props.envInfo || {});
        this.state = useState({
            isOpen: false,
            copied: false,
        });
    }

    toggle() {
        this.state.isOpen = !this.state.isOpen;
    }

    /**
     * Copy origin to clipboard.
     * Complies with PRD FR-15: fallback to document.execCommand('copy') via temporary textarea
     * since navigator.clipboard is also blocked on insecure origins.
     */
    async copyOrigin() {
        const text = this.guidance.origin || window.location.origin;
        let success = false;

        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                success = true;
            } catch (_) {
                success = false;
            }
        }

        if (!success) {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            textarea.style.top = "-9999px";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                success = document.execCommand("copy");
            } catch (_) {
                success = false;
            }
            document.body.removeChild(textarea);
        }

        if (success) {
            this.state.copied = true;
            setTimeout(() => {
                this.state.copied = false;
            }, 2500);
        }
    }
}

GuidancePanel.template = "camera_secure_context_bypass.GuidancePanel";
GuidancePanel.props = {
    envInfo: { type: Object, optional: true },
};

