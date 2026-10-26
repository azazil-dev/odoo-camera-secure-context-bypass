/** @odoo-module **/

import {
    validateEanUpcChecksum,
    SUPPORTED_1D_FORMATS,
} from "@camera_secure_context_bypass/photo_scanner/photo_decoder";

QUnit.module("camera_secure_context_bypass", {}, () => {
    QUnit.module("photo_decoder", () => {
        QUnit.test("validateEanUpcChecksum validates valid and invalid barcodes", (assert) => {
            // Valid EAN-13: 4006381333931
            assert.true(validateEanUpcChecksum("4006381333931"), "Valid EAN-13 passes");

            // Invalid EAN-13 (corrupted check digit)
            assert.false(validateEanUpcChecksum("4006381333932"), "Invalid EAN-13 checksum fails");

            // Valid EAN-8: 73513537
            assert.true(validateEanUpcChecksum("73513537"), "Valid EAN-8 passes");

            // Invalid EAN-8
            assert.false(validateEanUpcChecksum("73513538"), "Invalid EAN-8 checksum fails");

            // Valid UPC-A: 036000291452
            assert.true(validateEanUpcChecksum("036000291452"), "Valid UPC-A passes");

            // Code 128 / alphanumeric codes should not be rejected by EAN check
            assert.true(validateEanUpcChecksum("BATCH-2024-X"), "Code 128 string passes");
        });

        QUnit.test("SUPPORTED_1D_FORMATS includes 1D only and excludes QR code (FR-18)", (assert) => {
            assert.true(SUPPORTED_1D_FORMATS.includes("ean_13"), "Includes ean_13");
            assert.true(SUPPORTED_1D_FORMATS.includes("code_128"), "Includes code_128");
            assert.false(SUPPORTED_1D_FORMATS.includes("qr_code"), "Does NOT include qr_code");
            assert.false(SUPPORTED_1D_FORMATS.includes("data_matrix"), "Does NOT include data_matrix");
        });
    });
});

