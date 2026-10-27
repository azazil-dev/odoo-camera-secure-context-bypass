/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { BarcodeDialog } from "@web/core/barcode/barcode_dialog";
import * as barcodeVideoScannerModule from "@web/core/barcode/barcode_video_scanner";
import { browser } from "@web/core/browser/browser";
import { detectCameraEnv } from "../utils/camera_env";
import { PhotoBarcodeScanner } from "../photo_scanner/photo_barcode_scanner";

/**
 * Patch stock Odoo Barcode Scanner for non-secure HTTP contexts (Odoo 19).
 *
 * Requirements:
 * - When detectCameraEnv().canLive is false, render PhotoBarcodeScanner
 *   instead of trying to initialize navigator.mediaDevices.getUserMedia stream.
 * - Successful scan delivers result via original onResult handler.
 * - Fail safe - if patch target missing, log warning and preserve stock behavior.
 */
try {
    if (barcodeVideoScannerModule) {
        // 1. Override support check to allow photo-scan fallback on touch/mobile devices or insecure contexts
        const originalIsSupported = barcodeVideoScannerModule.isBarcodeScannerSupported;
        barcodeVideoScannerModule.isBarcodeScannerSupported = function () {
            const env = detectCameraEnv();
            if (env.canLive) {
                return originalIsSupported ? originalIsSupported() : true;
            }
            // Over HTTP: supported if native capture or file photo scan is available
            return true;
        };

        // 2. Over plain HTTP, browser.navigator.mediaDevices is undefined.
        // Provide dummy mediaDevices on browser.navigator so any component checking
        // browser.navigator.mediaDevices at runtime will report supported.
        if (browser && browser.navigator && !browser.navigator.mediaDevices) {
            const fakeMediaDevices = {
                getUserMedia: () => Promise.reject(new Error("Insecure context: use photo scan fallback")),
            };
            try {
                Object.defineProperty(browser.navigator, "mediaDevices", {
                    value: fakeMediaDevices,
                    configurable: true,
                    writable: true,
                });
            } catch (_) {
                // If browser.navigator is non-extensible, wrap it in a proxy on the browser object
                const originalNavigator = browser.navigator;
                browser.navigator = new Proxy(originalNavigator, {
                    get(target, prop, receiver) {
                        if (prop === "mediaDevices") {
                            return fakeMediaDevices;
                        }
                        return Reflect.get(target, prop, receiver);
                    },
                });
            }
        }
    }

    // 2b. Patch navigator.permissions.query for non-secure contexts.
    // In some browsers, 'camera' is not a valid PermissionName enum value when
    // served over plain HTTP, causing a TypeError. Wrap query to catch and
    // return a safe default so Odoo core doesn't crash at startup.
    if (browser && browser.navigator) {
        const nav = browser.navigator;
        if (nav.permissions && typeof nav.permissions.query === "function") {
            const originalQuery = nav.permissions.query.bind(nav.permissions);
            nav.permissions.query = function (desc) {
                try {
                    return originalQuery(desc);
                } catch (err) {
                    if (err instanceof TypeError && desc && desc.name) {
                        console.warn(
                            "[camera_secure_context_bypass] permissions.query rejected " +
                            "'" + desc.name + "' — returning default 'denied'."
                        );
                        return Promise.resolve({
                            name: desc.name,
                            state: "denied",
                            onchange: null,
                            addEventListener: () => {},
                            removeEventListener: () => {},
                        });
                    }
                    throw err;
                }
            };
        }
    }

    if (BarcodeDialog) {
        // 3. Register PhotoBarcodeScanner component into BarcodeDialog
        BarcodeDialog.components = {
            ...BarcodeDialog.components,
            PhotoBarcodeScanner,
        };

        // 4. Patch BarcodeDialog behavior
        patch(BarcodeDialog.prototype, {
            setup() {
                super.setup();
                this.cameraEnv = detectCameraEnv();
                if (!this.cameraEnv.canLive) {
                    this.state.usePhotoScan = true;
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
