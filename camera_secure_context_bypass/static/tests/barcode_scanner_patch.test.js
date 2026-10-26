/** @odoo-module **/

import { BarcodeDialog } from "@web/core/barcode/barcode_dialog";
import { isBarcodeScannerSupported } from "@web/core/barcode/barcode_video_scanner";
import { PhotoBarcodeScanner } from "@camera_secure_context_bypass/photo_scanner/photo_barcode_scanner";

QUnit.module("camera_secure_context_bypass", {}, () => {
    QUnit.module("barcode_scanner_patch", () => {
        QUnit.test("BarcodeDialog includes PhotoBarcodeScanner in components", (assert) => {
            assert.ok(BarcodeDialog.components.PhotoBarcodeScanner, "PhotoBarcodeScanner component registered");
            assert.strictEqual(BarcodeDialog.components.PhotoBarcodeScanner, PhotoBarcodeScanner, "Component reference matches");
        });

        QUnit.test("isBarcodeScannerSupported returns true", (assert) => {
            assert.true(isBarcodeScannerSupported(), "Scanner is supported via bypass");
        });
    });
});

