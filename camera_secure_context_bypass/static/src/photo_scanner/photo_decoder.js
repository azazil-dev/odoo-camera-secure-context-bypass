/** @odoo-module **/

import { loadJS } from "@web/core/assets";
import { buildZXingBarcodeDetector } from "@web/webclient/barcode/ZXingBarcodeDetector";
import { loadImage } from "../utils/image_utils";

/* global BarcodeDetector */

/**
 * 1D Barcode formats supported in v1 scope (FR-18).
 * 2D barcodes like QR Code MUST NOT be enabled to reduce false positives in 1D photo-scan.
 */
export const SUPPORTED_1D_FORMATS = [
    "code_128",
    "code_39",
    "ean_13",
    "ean_8",
    "itf",
    "upc_a",
    "upc_e",
];

/**
 * Validate EAN / UPC checksum.
 * Returns boolean.
 *
 * @param {string} code
 * @returns {boolean}
 */
export function validateEanUpcChecksum(code) {
    if (!/^\d+$/.test(code)) {
        return false;
    }
    const len = code.length;
    // Supported: UPC-E (expanded to 8 or 12), EAN-8 (8), UPC-A (12), EAN-13 (13), ITF (14)
    if (![8, 12, 13, 14].includes(len)) {
        return true; // Not a standard fixed-length EAN/UPC; let pass (e.g. Code 128 / Code 39)
    }

    const digits = code.split("").map(Number);
    const checkDigit = digits[digits.length - 1];
    const dataDigits = digits.slice(0, -1);

    // Starting from right to left: alternate weighting 3 and 1
    let sum = 0;
    let weight = 3;
    for (let i = dataDigits.length - 1; i >= 0; i--) {
        sum += dataDigits[i] * weight;
        weight = weight === 3 ? 1 : 3;
    }

    const calculatedCheck = (10 - (sum % 10)) % 10;
    return calculatedCheck === checkDigit;
}

/**
 * Ensure ZXing library or native BarcodeDetector is loaded.
 */
let cachedDetectorClass = null;

export async function getDetectorClass() {
    if (cachedDetectorClass) {
        return cachedDetectorClass;
    }

    if ("BarcodeDetector" in window) {
        try {
            const supported = await window.BarcodeDetector.getSupportedFormats();
            // Check if it supports at least ean_13 or code_128
            if (supported.includes("ean_13") || supported.includes("code_128")) {
                cachedDetectorClass = window.BarcodeDetector;
                return cachedDetectorClass;
            }
        } catch (_) {
            // fallback to zxing
        }
    }

    // Load Odoo's core built-in ZXing library
    await loadJS("/web/static/lib/zxing-library/zxing-library.js");
    cachedDetectorClass = buildZXingBarcodeDetector(window.ZXing);
    return cachedDetectorClass;
}

/**
 * Generate image transformations for barcode decoding pipeline (FR-21):
 * 1. Resized original (max 1600px)
 * 2. Grayscale with contrast normalization
 * 3. Rotated 90 degrees
 * 4. 1200px downscale
 *
 * @param {HTMLImageElement} img
 * @returns {HTMLCanvasElement[]}
 */
export function generatePipelineCanvases(img) {
    const canvases = [];
    const maxSide = 1600;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const scale = Math.min(maxSide / Math.max(w, h), 1);
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);

    // Pass 1: Standard downsized canvas
    const c1 = document.createElement("canvas");
    c1.width = targetW;
    c1.height = targetH;
    const ctx1 = c1.getContext("2d");
    ctx1.drawImage(img, 0, 0, targetW, targetH);
    canvases.push(c1);

    // Pass 2: Grayscale with contrast normalization
    const c2 = document.createElement("canvas");
    c2.width = targetW;
    c2.height = targetH;
    const ctx2 = c2.getContext("2d");
    ctx2.drawImage(c1, 0, 0);
    try {
        const imgData = ctx2.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            // Luminance
            const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            // High contrast curve
            const enhanced = gray > 128 ? Math.min(255, gray * 1.2) : Math.max(0, gray * 0.8);
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
        }
        ctx2.putImageData(imgData, 0, 0);
        canvases.push(c2);
    } catch (_) {
        // Continue if getImageData fails (tainted canvas)
    }

    // Pass 3: Rotated 90 degrees (vertical barcodes)
    const c3 = document.createElement("canvas");
    c3.width = targetH;
    c3.height = targetW;
    const ctx3 = c3.getContext("2d");
    ctx3.translate(targetH / 2, targetW / 2);
    ctx3.rotate((90 * Math.PI) / 180);
    ctx3.drawImage(c1, -targetW / 2, -targetH / 2);
    canvases.push(c3);

    // Pass 4: 1200px downscale
    if (Math.max(w, h) > 1200) {
        const scale4 = Math.min(1200 / Math.max(w, h), 1);
        const w4 = Math.round(w * scale4);
        const h4 = Math.round(h * scale4);
        const c4 = document.createElement("canvas");
        c4.width = w4;
        c4.height = h4;
        const ctx4 = c4.getContext("2d");
        ctx4.drawImage(img, 0, 0, w4, h4);
        canvases.push(c4);
    }

    return canvases;
}

/**
 * Decode barcode from an image source (File, Blob, or URL).
 * Implements timeout abort (FR-23: 8 seconds maximum).
 *
 * @param {File|Blob|string} imageSource
 * @param {string[]} [formats=SUPPORTED_1D_FORMATS]
 * @returns {Promise<{ barcode: string, format: string, all: Array, mode: 'photo' }>}
 */
export async function decodeBarcodeFromPhoto(imageSource, formats = SUPPORTED_1D_FORMATS) {
    const DetectorClass = await getDetectorClass();
    const detector = new DetectorClass({ formats });
    const img = await loadImage(imageSource);

    const canvases = generatePipelineCanvases(img);

    const startTime = Date.now();
    const timeoutMs = 8000;

    for (const canvas of canvases) {
        if (Date.now() - startTime > timeoutMs) {
            throw new Error("Barcode decoding timed out");
        }

        try {
            // ZXingBarcodeDetector expects an element or canvas
            let results = [];
            if (detector.detect) {
                // If detector expects video or canvas
                results = await detector.detect(canvas);
            }

            if (results && results.length > 0) {
                for (const res of results) {
                    const codeVal = (res.rawValue || "").trim();
                    const format = res.format || "unknown";

                    // Check if 2D was erroneously returned (must be rejected per FR-18)
                    if (["qr_code", "data_matrix", "aztec", "pdf417"].includes(format)) {
                        continue;
                    }

                    // Checksum verification
                    if (["ean_13", "ean_8", "upc_a", "upc_e"].includes(format)) {
                        if (!validateEanUpcChecksum(codeVal)) {
                            continue; // Invalid checksum, try next
                        }
                    }

                    return {
                        barcode: codeVal,
                        format: format,
                        all: results,
                        mode: "photo",
                    };
                }
            }
        } catch (_) {
            // Try next pass
        }
    }

    throw new Error("No valid barcode found in photo");
}

