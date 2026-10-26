/** @odoo-module **/

/**
 * Pure functions for detecting camera environment and browser capabilities.
 * RFC 2119 compliant & unit-testable.
 */

/**
 * Detect the browser brand from user agent / navigator properties.
 *
 * @param {Object} [nav=window.navigator]
 * @returns {'chrome' | 'brave' | 'edge' | 'firefox' | 'safari' | 'other'}
 */
export function detectBrowser(nav = typeof window !== "undefined" ? window.navigator : {}) {
    // Brave has navigator.brave?.isBrave() or brave property
    if (nav.brave && typeof nav.brave.isBrave === "function") {
        return "brave";
    }

    const ua = nav.userAgent || "";

    // Order matters: Edge UA contains Chrome and Safari
    if (/Edg\//i.test(ua)) {
        return "edge";
    }
    // Firefox
    if (/Firefox|FxiOS/i.test(ua)) {
        return "firefox";
    }
    // Chrome
    if (/Chrome|CriOS/i.test(ua)) {
        return "chrome";
    }
    // Safari (ensure not Chrome/Edge)
    if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua)) {
        return "safari";
    }

    return "other";
}

/**
 * Detect the operating system from user agent / navigator properties.
 * Per PRD FR-3: iOS detection MUST include iPadOS reporting as Mac with touch points.
 * Every iOS/iPadOS browser MUST be treated as WebKit.
 *
 * @param {Object} [nav=window.navigator]
 * @returns {'windows' | 'linux' | 'macos' | 'android' | 'ios' | 'other'}
 */
export function detectOS(nav = typeof window !== "undefined" ? window.navigator : {}) {
    const ua = nav.userAgent || "";
    const platform = nav.platform || "";
    const maxTouchPoints = nav.maxTouchPoints || 0;

    // iPadOS 13+ reports platform 'MacIntel' with maxTouchPoints > 1
    if (/iPad|iPhone|iPod/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1)) {
        return "ios";
    }

    if (/Android/i.test(ua)) {
        return "android";
    }

    if (/Win/i.test(platform) || /Windows/i.test(ua)) {
        return "windows";
    }

    if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
        return "macos";
    }

    if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
        return "linux";
    }

    return "other";
}

/**
 * Check if the device/browser can use native camera app via `<input type="file" capture>`.
 * Returns true on touch/mobile user agents where `capture` is honored.
 *
 * @param {Object} [nav=window.navigator]
 * @returns {boolean}
 */
export function canNativeCapture(nav = typeof window !== "undefined" ? window.navigator : {}) {
    const os = detectOS(nav);
    const maxTouchPoints = nav.maxTouchPoints || 0;
    const ua = nav.userAgent || "";
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || maxTouchPoints > 0;

    return (os === "ios" || os === "android" || isMobile);
}

/**
 * Detect the full camera environment.
 * Pure and unit-testable by passing custom `win` and `nav` objects.
 *
 * @param {Object} [win=window]
 * @param {Object} [nav=window.navigator]
 * @returns {{
 *   isSecureContext: boolean,
 *   hasMediaDevices: boolean,
 *   canLive: boolean,
 *   canNativeCapture: boolean,
 *   browser: string,
 *   os: string,
 *   origin: string,
 *   mode: 'live' | 'native' | 'file'
 * }}
 */
export function detectCameraEnv(
    win = typeof window !== "undefined" ? window : {},
    nav = typeof window !== "undefined" ? window.navigator : {}
) {
    const isSecure = !!win.isSecureContext;
    const hasMedia = !!(nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === "function");
    const canLive = isSecure && hasMedia;
    const nativeCapture = canNativeCapture(nav);
    const browser = detectBrowser(nav);
    const os = detectOS(nav);
    const origin = (win.location && win.location.origin) || "";

    let mode = "file";
    if (canLive) {
        mode = "live";
    } else if (nativeCapture) {
        mode = "native";
    }

    return {
        isSecureContext: isSecure,
        hasMediaDevices: hasMedia,
        canLive,
        canNativeCapture: nativeCapture,
        browser,
        os,
        origin,
        mode,
    };
}

