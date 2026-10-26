/** @odoo-module **/

import { Component, useRef, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { decodeBarcodeFromPhoto, SUPPORTED_1D_FORMATS } from "./photo_decoder";
import { detectCameraEnv } from "../utils/camera_env";

export class PhotoBarcodeScanner extends Component {
    setup() {
        this.fileInputRef = useRef("fileInput");
        this.envInfo = detectCameraEnv();

        this.state = useState({
            status: "idle", // 'idle' | 'decoding' | 'success' | 'error'
            errorMessage: "",
            manualCode: "",
            showManualInput: false,
            decodedValue: "",
        });
    }

    /**
     * User tap opens the native camera directly (FR-17 user gesture requirement).
     */
    triggerCamera() {
        this.state.errorMessage = "";
        if (this.fileInputRef.el) {
            this.fileInputRef.el.click();
        }
    }

    async onPhotoCaptured(ev) {
        const file = ev.target.files && ev.target.files[0];
        if (!file) {
            return;
        }

        this.state.status = "decoding";
        this.state.errorMessage = "";

        try {
            const formats = this.props.formats || SUPPORTED_1D_FORMATS;
            const result = await decodeBarcodeFromPhoto(file, formats);

            this.state.status = "success";
            this.state.decodedValue = result.barcode;

            if ("vibrate" in navigator) {
                navigator.vibrate(100);
            }

            if (this.props.onScan) {
                this.props.onScan(result);
            }
        } catch (err) {
            this.state.status = "error";
            this.state.errorMessage = _t(
                "No barcode found. Retake the photo closer to the barcode, in focus and with good light, so the barcode fills most of the frame."
            );
            if (this.props.onError) {
                this.props.onError({ code: "NotFound", message: this.state.errorMessage });
            }
        } finally {
            if (this.fileInputRef.el) {
                this.fileInputRef.el.value = "";
            }
        }
    }

    toggleManualInput() {
        this.state.showManualInput = !this.state.showManualInput;
    }

    submitManualEntry() {
        const code = (this.state.manualCode || "").trim();
        if (!code) {
            return;
        }
        if (this.props.onScan) {
            this.props.onScan({
                barcode: code,
                format: "manual",
                mode: "manual",
            });
        }
    }

    onManualKeyDown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            this.submitManualEntry();
        }
    }
}

PhotoBarcodeScanner.template = "camera_secure_context_bypass.PhotoBarcodeScanner";
PhotoBarcodeScanner.defaultProps = {
    formats: SUPPORTED_1D_FORMATS,
    facingMode: "environment",
};
PhotoBarcodeScanner.props = {
    onScan: { type: Function },
    onError: { type: Function, optional: true },
    formats: { type: Array, optional: true },
    facingMode: { type: String, optional: true },
};

