/** @odoo-module **/

/**
 * Image processing utilities: resizing, compression, format conversion.
 * Works entirely in memory with canvas, releasing memory immediately.
 */

/**
 * Load an Image from File, Blob, or DataURL.
 *
 * @param {File|Blob|string} source
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(source) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let url = "";

        if (typeof source === "string") {
            url = source;
        } else if (source instanceof Blob || source instanceof File) {
            url = URL.createObjectURL(source);
        } else {
            return reject(new Error("Invalid image source"));
        }

        img.onload = () => {
            if (url.startsWith("blob:")) {
                URL.revokeObjectURL(url);
            }
            resolve(img);
        };
        img.onerror = (err) => {
            if (url.startsWith("blob:")) {
                URL.revokeObjectURL(url);
            }
            reject(err);
        };
        img.src = url;
    });
}

/**
 * Calculate target dimensions keeping aspect ratio.
 *
 * @param {number} srcWidth
 * @param {number} srcHeight
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @returns {{ width: number, height: number }}
 */
export function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    if (!maxWidth && !maxHeight) {
        return { width: srcWidth, height: srcHeight };
    }
    const ratio = Math.min(
        maxWidth ? maxWidth / srcWidth : 1,
        maxHeight ? maxHeight / srcHeight : 1,
        1
    );
    return {
        width: Math.round(srcWidth * ratio),
        height: Math.round(srcHeight * ratio),
    };
}

/**
 * Resize and export an HTMLImageElement or HTMLVideoElement to canvas.
 *
 * @param {HTMLImageElement|HTMLVideoElement} mediaEl
 * @param {Object} options
 * @param {number} [options.maxWidth=1280]
 * @param {number} [options.maxHeight=1280]
 * @param {number} [options.quality=0.85]
 * @param {'base64'|'dataUrl'|'blob'} [options.outputFormat='base64']
 * @returns {Promise<{ data: string|Blob, mimeType: string, width: number, height: number }>}
 */
export async function processMediaFrame(mediaEl, options = {}) {
    const maxWidth = options.maxWidth || 1280;
    const maxHeight = options.maxHeight || 1280;
    const quality = options.quality !== undefined ? options.quality : 0.85;
    const outputFormat = options.outputFormat || "base64";

    const srcWidth = mediaEl.videoWidth || mediaEl.naturalWidth || mediaEl.width;
    const srcHeight = mediaEl.videoHeight || mediaEl.naturalHeight || mediaEl.height;

    if (!srcWidth || !srcHeight) {
        throw new Error("Unable to read media dimensions");
    }

    const { width, height } = calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(mediaEl, 0, 0, width, height);

    const mimeType = "image/jpeg";

    if (outputFormat === "blob") {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
        return { data: blob, mimeType, width, height };
    }

    const dataUrl = canvas.toDataURL(mimeType, quality);
    if (outputFormat === "dataUrl") {
        return { data: dataUrl, mimeType, width, height };
    }

    // Default: base64 without prefix
    const base64 = dataUrl.split(",")[1] || "";
    return { data: base64, mimeType, width, height };
}

/**
 * Process a File or Blob through the standard resize/compression pipeline.
 *
 * @param {File|Blob} file
 * @param {Object} options
 * @returns {Promise<{ data: string|Blob, mimeType: string, width: number, height: number }>}
 */
export async function processImageFile(file, options = {}) {
    const img = await loadImage(file);
    return processMediaFrame(img, options);
}

