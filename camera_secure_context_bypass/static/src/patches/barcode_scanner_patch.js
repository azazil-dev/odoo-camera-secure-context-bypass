/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { BarcodeDialog } from "@web/webclient/barcode/barcode_scanner";
import * as barcodeScannerModule from "@web/webclient/barcode/barcode_scanner";
import { detectCameraEnv } from "../utils/camera_env";
import { PhotoBarcodeScanner } from "../photo_scanner/photo_barcode_scanner";

/**
 * Patch stock Odoo Barcode Scanner for non-secure HTTP contexts.
 *
 * Requirements:
 * - FR-27, FR-28, FR-29: When detectCameraEnv().canLive is false, render PhotoBarcodeScanner
 *   instead of trying to initialize navigator.mediaDevices.getUserMedia stream.
 * - FR-30: Successful scan delivers result via original onResult handler.
 * - FR-31: Fail safe - if patch target missing, log warning and preserve stock behavior.
 */
try {
    if (barcodeScannerModule && BarcodeDialog) {
        // 1. Override support check to allow photo-scan fallback on touch/mobile devices or insecure contexts
        const originalIsSupported = barcodeScannerModule.isBarcodeScannerSupported;
        barcodeScannerModule.isBarcodeScannerSupported = function () {
            const env = detectCameraEnv();
            if (env.canLive) {
                return originalIsSupported ? originalIsSupported() : true;
            }
            // Over HTTP: supported if native capture or file photo scan is available
            return true;
        };

        // 2. Register PhotoBarcodeScanner component into BarcodeDialog
        BarcodeDialog.components = {
            ...BarcodeDialog.components,
            PhotoBarcodeScanner,
        };

        // 3. Patch BarcodeDialog behavior
        patch(BarcodeDialog.prototype, {
            setup() {
                this.cameraEnv = detectCameraEnv();
                if (this.cameraEnv.canLive) {
                    // Normal secure context: run stock behavior
                    super.setup();
                } else {
                    // Insecure context (HTTP): Skip getUserMedia stream setup
                    this.state = {
                        isReady: true,
                        usePhotoScan: true,
                    };
                }
            },

            onPhotoScanResult(result) {
                const barcodeValue = typeof result === "object" ? result.barcode : result;
                this.onResult(barcodeValue);
            },
        });
    }
} catch (err) {
    console.warn("[camera_secure_context_bypass] Failed to patch BarcodeDialog:", err);
}

