/** @odoo-module **/

import {
    detectBrowser,
    detectOS,
    canNativeCapture,
    detectCameraEnv,
} from "@camera_secure_context_bypass/utils/camera_env";

QUnit.module("camera_secure_context_bypass", {}, () => {
    QUnit.module("camera_env", () => {
        QUnit.test("detectBrowser identifies common browser User-Agents", (assert) => {
            assert.strictEqual(
                detectBrowser({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }),
                "chrome",
                "Chrome detected"
            );

            assert.strictEqual(
                detectBrowser({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0" }),
                "edge",
                "Edge detected"
            );

            assert.strictEqual(
                detectBrowser({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0" }),
                "firefox",
                "Firefox detected"
            );

            assert.strictEqual(
                detectBrowser({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15" }),
                "safari",
                "Safari detected"
            );

            assert.strictEqual(
                detectBrowser({
                    userAgent: "Mozilla/5.0 (Linux; Android 10) Chrome/120.0.0.0",
                    brave: { isBrave: () => true },
                }),
                "brave",
                "Brave detected via navigator.brave"
            );
        });

        QUnit.test("detectOS handles iPadOS reporting as Mac with touch points (FR-3)", (assert) => {
            // Modern iPadOS 13+ User Agent
            const ipadMockNav = {
                platform: "MacIntel",
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1 Safari/605.1.15",
                maxTouchPoints: 5,
            };

            assert.strictEqual(detectOS(ipadMockNav), "ios", "iPadOS correctly identified as iOS");
            assert.true(canNativeCapture(ipadMockNav), "iPadOS can use native capture");
        });

        QUnit.test("detectCameraEnv full matrix resolution (Section 5)", (assert) => {
            // Case 1: Insecure context on Desktop Chrome (No flag)
            const desktopHttp = detectCameraEnv(
                { isSecureContext: false, location: { origin: "http://192.168.1.50:8069" } },
                {
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
                    platform: "Win32",
                    maxTouchPoints: 0,
                    mediaDevices: undefined,
                }
            );
            assert.strictEqual(desktopHttp.mode, "file", "Desktop Chrome over HTTP defaults to file mode");
            assert.false(desktopHttp.canLive, "canLive is false");

            // Case 2: Insecure context on iPad Safari
            const ipadHttp = detectCameraEnv(
                { isSecureContext: false, location: { origin: "http://192.168.1.50:8069" } },
                {
                    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/605.1.15 Version/13.1 Safari/605.1.15",
                    platform: "MacIntel",
                    maxTouchPoints: 5,
                    mediaDevices: undefined,
                }
            );
            assert.strictEqual(ipadHttp.mode, "native", "iPad Safari over HTTP defaults to native camera mode");
            assert.true(ipadHttp.canNativeCapture, "canNativeCapture is true on iPad");

            // Case 3: Secure context (HTTPS / localhost)
            const secureEnv = detectCameraEnv(
                { isSecureContext: true, location: { origin: "https://odoo.lan:8069" } },
                {
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
                    platform: "Win32",
                    mediaDevices: { getUserMedia: () => Promise.resolve() },
                }
            );
            assert.strictEqual(secureEnv.mode, "live", "Secure context uses live mode");
            assert.true(secureEnv.canLive, "canLive is true under secure context");
        });
    });
});

