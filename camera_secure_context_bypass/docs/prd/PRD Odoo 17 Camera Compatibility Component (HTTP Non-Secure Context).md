# PRD: Odoo 17 Camera Compatibility Component (HTTP / Non-Secure Context)

Author: Arif N Ramadhan | License: OPL-1 | Target: Odoo 17 (Enterprise, self-hosted, LAN) | Audience: AI coding agent

## 1. How to Read This Document

This PRD is written for an AI coding agent. Keywords MUST, MUST NOT, SHOULD, MAY follow RFC 2119. Every requirement has an ID (FR-x, NFR-x, AC-x). Implement exactly what is specified. If something is ambiguous, pick the safest option listed in Section 14 and note the assumption in the module README. Do not invent features outside the scope.

## 2. Problem Statement

The client runs Odoo 17 Enterprise on a local server and opens it by IP address over plain HTTP (for example `http://192.168.1.10:8069`). Odoo features that use the camera (attendance kiosk, barcode scanning, webcam capture, photo fields) call `navigator.mediaDevices.getUserMedia()`. Browsers expose `navigator.mediaDevices` only in a **secure context** (HTTPS, `localhost`, or `127.0.0.1`). On HTTP over a LAN IP, `navigator.mediaDevices` is `undefined` and the camera cannot be opened.

**Primary use case:** the camera barcode scanner dialog does not open on an iPad (Safari/WebKit) when Odoo is opened over HTTP. This is the first problem the module MUST solve; the generic camera capture component is secondary.

## 3. Hard Technical Reality (MUST read first)

1. A web module **cannot bypass** the secure-context restriction. It is enforced by the browser engine, not by Odoo. No JavaScript, polyfill, or Odoo module can make `getUserMedia` work on an insecure origin in Safari, iOS browsers, or default Chrome/Firefox.
2. The agent MUST NOT attempt hacks to fake `navigator.mediaDevices`, spoof `window.isSecureContext`, or inject iframes to trick the browser. These do not work and MUST NOT be shipped.
3. What this module CAN do, and therefore the real deliverable:
   - Detect the insecure-context condition reliably and early.
   - Provide a **working capture path that does not require a secure context**: an `<input type="file" accept="image/*" capture>` element, which mobile browsers allow over HTTP and which opens the native camera app.
   - Use live `getUserMedia` capture automatically whenever the context is secure.
   - Show clear, per-browser, per-OS guidance for the supported per-client workarounds (browser flags) and for the proper fix (HTTPS).
4. The proper permanent fix is HTTPS in front of Odoo (reverse proxy with a certificate trusted by clients). The module documents this but does not replace it.

**Scope decision for barcode scanning:** live video scanning over HTTP is impossible on iOS/iPadOS, so the module implements **photo-scan**. The user photographs the barcode with the native camera app (allowed over HTTP), the module decodes the still image offline in the browser, and the result is delivered to Odoo as a normal scan. It is not live: one photo equals one scan. Only 1D barcodes are in scope (Section 8.6).

## 4. Goals and Non-Goals

### Goals

- G1: Ship one reusable OWL component, `CameraCapture`, that other Odoo modules can embed.
- G2: The component works (returns an image) on every listed browser/OS combination in Section 5, in either secure or insecure context, using the best available path.
- G3: Give users an actionable message instead of a silent failure or a raw browser error.
- G4: Keep the module small, upgrade-safe, and free of third-party runtime code other than the offline barcode decoder.

* G5: Make the built-in Odoo camera barcode scanner usable on iPad and every other listed browser over plain HTTP, using photo-scan (Sections 8.6 and 8.7).

### Non-Goals (v1)

- NG1: Copying or editing Odoo Enterprise source files. Enterprise code MUST NOT be copied or modified. Only the scanner component is extended at runtime, through patching (Section 8.7).
- NG2: Live video preview or continuous barcode scanning on an insecure context (technically impossible).
- NG3: Generating, installing, or managing SSL certificates or Nginx configs automatically.
- NG4: Modifying browser settings from the server.
- NG5: Video recording or audio capture.

## 5. Supported Environments and Expected Behavior

Legend: **Live** = in-page video via getUserMedia. **Native** = native camera app via input capture. **File** = file picker only (no camera).

| Environment | Secure context (HTTPS/localhost) | Insecure context (HTTP + IP) |
| --- | --- | --- |
| Chrome / Brave / Edge, Windows, Linux, macOS | Live | File, or Live after user sets the flag (Section 9) |
| Chrome / Brave, Android | Live | Native, or Live after flag |
| Firefox, Windows, Linux, macOS | Live | File, or Live after about:config change |
| Firefox, Android | Live | Native, or Live after about:config change |
| Safari, macOS | Live | File only. No flag exists. HTTPS required for Live |
| Safari and all browsers on iOS (WebKit) | Live | Native only. No flag exists. HTTPS required for Live |

The agent MUST make the component behave per this table and MUST NOT promise Live capture where the table says it is impossible.

For barcode scanning, every row marked Native or File uses photo-scan (Section 8.6). On iPad over HTTP photo-scan is the only available path.

## 6. Module Metadata

- Technical name (assumption, may be changed): `camera_secure_context_bypass`
- Display name: Camera HTTP Compatibility
- Odoo version: 17.0, manifest version `17.0.1.0.0`
- Author: `Arif N Ramadhan`
- License: `OPL-1`
- Category: Technical
- Depends: `['web']` only
- Application: False, installable: True
- Must include a `LICENSE` file with the OPL-1 text reference and a `README.md`.
- No CDN and no network calls to third-party hosts. The only third-party code allowed is the offline barcode decoder (Section 8.6), shipped locally with its license text. The module MUST work fully offline on a LAN.

## 7. Architecture

Suggested file structure:

```
camera_secure_context_bypass/
  __manifest__.py
  __init__.py
  README.md
  LICENSE
  static/lib/
    zxing/                      # ONLY if Odoo does not already ship a decoder (see FR-19)
  static/src/
    camera_capture/
      camera_capture.js         # OWL component
      camera_capture.xml        # QWeb template
      camera_capture.scss
    photo_scanner/
      photo_barcode_scanner.js  # OWL component, photo-scan UI
      photo_barcode_scanner.xml
      photo_decoder.js          # still-image decoding pipeline
    patches/
      barcode_scanner_patch.js  # runtime patch of the stock scanner dialog
    utils/
      camera_env.js             # capability detection (pure functions)
      image_utils.js            # canvas/file to base64 + resize
    guide/
      browser_guide.js          # per-browser guidance data
  static/tests/
    camera_env.test.js
    camera_capture.test.js
    photo_decoder.test.js
  i18n/
    camera_secure_context_bypass.pot
```

Assets: register all files under `web.assets_backend` in the manifest. Also register under `web.assets_frontend` ONLY if it needs to work on website pages (assumption: backend only in v1).

The component is exposed through the Odoo module system, e.g. `@camera_secure_context_bypass/camera_capture/camera_capture`, so other modules can `import { CameraCapture } from ...` and list it in their component `static components`.

## 8. Functional Requirements

### 8.1 Capability detection (`camera_env.js`)

- FR-1: Export `detectCameraEnv()` returning an object:
  - `isSecureContext` (boolean, from `window.isSecureContext`)
  - `hasMediaDevices` (boolean, `!!navigator.mediaDevices?.getUserMedia`)
  - `canLive` (boolean, true only if secure context AND hasMediaDevices)
  - `canNativeCapture` (boolean, true on touch/mobile user agents where `capture` is honored; detect via `navigator.maxTouchPoints > 0` and mobile UA hints; false means the file picker only)
  - `browser` (`chrome | brave | edge | firefox | safari | other`) and `os` (`windows | linux | macos | android | ios | other`)
  - `origin` (`location.origin`)
- FR-2: Brave detection MUST use `navigator.brave?.isBrave()` (async) and fall back to chrome if unavailable.
- FR-3: iOS detection MUST include iPadOS reporting as Mac with touch points. Every iOS/iPadOS browser MUST be treated as WebKit.
- FR-4: Detection functions MUST be pure and unit-testable (inputs injected for testing).

### 8.2 Mode selection

| Condition | Mode |
| --- | --- |
| `canLive` is true | `live` |
| `canLive` false and `canNativeCapture` true | `native` |
| `canLive` false and `canNativeCapture` false | `file` |

- FR-5: The component MUST choose the mode automatically on mount and expose it through the `onModeResolved` callback prop.
- FR-6: If `live` mode is chosen but `getUserMedia` rejects (`NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError`), the component MUST fall back to `native` or `file` and show a message mapped to the error. It MUST NOT show raw error text only.

### 8.3 Component API (`CameraCapture`)

Props:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `facingMode` | `'user' \| 'environment'` | `'environment'` | Preferred camera |
| `maxWidth` | number | 1280 | Output image max width in px |
| `maxHeight` | number | 1280 | Output image max height in px |
| `quality` | number 0 to 1 | 0.85 | JPEG quality |
| `outputFormat` | `'dataUrl' \| 'base64' \| 'blob'` | `'base64'` | Shape of returned image |
| `showGuide` | boolean | true | Show the insecure-context help panel |
| `onCapture` | function | required | Called with `{ data, mimeType, width, height, mode }` |
| `onError` | function | optional | Called with `{ code, message }` |
| `onModeResolved` | function | optional | Called with the resolved mode |

Behavior:

- FR-7: `live` mode renders a `<video autoplay playsinline muted>`, a capture button, and a camera-switch button when more than one video input exists.
- FR-8: On capture, draw the video frame to a canvas, resize to fit `maxWidth` and `maxHeight` keeping aspect ratio, export JPEG at `quality`, and call `onCapture`.
- FR-9: `native` and `file` modes render a button that triggers a hidden `<input type="file" accept="image/*">`. In `native` mode the input MUST have `capture` set from `facingMode` (`user` or `environment`).
- FR-10: Images chosen through the input MUST go through the same resize/compress pipeline as live capture so the output is consistent.
- FR-11: The component MUST stop all media tracks (`track.stop()`) on unmount, on successful capture when `keepOpen` is not set, and on mode change. No leaked camera streams.
- FR-12: Output MUST include `mode` (`live`, `native`, or `file`) so the host module knows how the image was obtained.

### 8.4 Guidance panel

- FR-13: When `isSecureContext` is false and `showGuide` is true, show a collapsible panel titled "Camera needs a secure connection" with: why it happens, the recommended fix (HTTPS), and the per-browser workaround for the detected browser/OS.
- FR-14: Guidance content MUST come from a data file (`browser_guide.js`) so it can be edited without touching component logic. See Section 9 for content.
- FR-15: The panel MUST provide a "Copy origin" button that copies `location.origin` to the clipboard, because the browser flags require pasting the exact origin. Clipboard copy MUST work in insecure context using a `document.execCommand('copy')` fallback via a temporary textarea, since `navigator.clipboard` is also restricted on insecure origins.
- FR-16: The panel MUST NOT block the capture button. Users can still use `native` or `file` mode.

### 8.5 Error and message mapping

| Error | User message |
| --- | --- |
| `NotAllowedError` | Camera permission was denied. Allow camera access for this site in the browser settings and try again. |
| `NotFoundError` | No camera was found on this device. |
| `NotReadableError` | The camera is in use by another app. Close it and try again. |
| `OverconstrainedError` | The requested camera is not available. Using the default camera instead. |
| insecure context | This page is not secure (HTTP), so live camera is blocked by your browser. Use the button to take a photo with your camera app, or see the setup guide. |

All strings MUST use Odoo's `_t()` so they are translatable and listed in the `.pot` file.

### 8.6 Photo-Scan Mode (Barcode Scanning Without HTTPS)

Purpose: let users scan 1D barcodes on iPad, iPhone, Android and desktop over plain HTTP, where live video scanning is blocked by the browser.

Flow:

1. The user taps "Scan barcode". The tap handler MUST directly trigger a hidden `<input type="file" accept="image/*" capture="environment">`, because browsers only open the camera app from a user gesture.
2. The native camera app opens. The user photographs the barcode and confirms.
3. The module receives the image, downsizes it so the longest side is at most 1600 px, and decodes it offline.
4. On success the barcode value is delivered to Odoo (Section 8.7) and the user sees a success state.
5. On failure the user sees a retry message and a manual entry field.

Requirements:

- FR-17: Provide a reusable OWL component `PhotoBarcodeScanner` with props `onScan({ barcode, format, mode: 'photo' })`, `onError({ code, message })`, `formats` (default: the list in FR-18) and `facingMode` (default `'environment'`).
- FR-18: Supported formats are **1D only**: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39 and ITF. QR Code and other 2D formats MUST NOT be enabled in v1, to reduce false positives.
- FR-19: Decoding MUST run fully offline in the browser. The agent MUST first check whether the installed Odoo 17 already ships a ZXing library under `web/static/lib/` (it is expected to, as a fallback for the BarcodeDetector API) and reuse it if present. Only if none exists may the agent ship a local decoder, which MUST be Apache-2.0 or MIT licensed, stored in `static/lib/` with its license text, and lazy-loaded only when photo-scan starts. Verify before assuming.
- FR-20: If the browser exposes `BarcodeDetector` and it supports the requested formats, the decoder MAY use it on the still image first. Otherwise it MUST fall back to the ZXing-based decoder. Feature-detect, never browser-sniff.
- FR-21: Decode strategy. Try in order and stop at the first valid result: the resized original, a grayscale image with contrast normalization, the same image rotated 90 degrees, and a 1200 px downscale. Run decoding in a Web Worker when available, otherwise on the main thread with a visible spinner.
- FR-22: Validate EAN/UPC checksums. A result that fails its checksum MUST be rejected. If several barcodes are found, return the first as `barcode` and the rest in an `all` array.
- FR-23: Target decode time is under 2 seconds on a recent iPad for a 1600 px image. If decoding takes longer than 8 seconds, abort and show the failure message.
- FR-24: Failure message: "No barcode found. Retake the photo closer to the barcode, in focus and with good light, so the barcode fills most of the frame." Provide "Retake" and "Enter manually" actions. Manual entry delivers the typed value through the same path as a scan.
- FR-25: Show a short hint explaining why photo mode is used: "Live scanning needs a secure (HTTPS) connection, so this mode takes a photo instead." The hint MUST NOT appear when live scanning is available.
- FR-26: Privacy. Images stay on the device, are never uploaded or stored, and object URLs and canvases MUST be released after decoding.

### 8.7 Integration With the Built-in Odoo Scanner Dialog

- FR-27: The agent MUST first inspect the installed Odoo 17 source to find the camera barcode scanner dialog, its video scanner component, and the service that receives scanned values. They are expected in the Community `web` module (under `webclient/barcode/`) and the `barcodes` module. Exact file names, class names and event names MUST be verified in the installed version, not assumed.
- FR-28: Extend those components at runtime with Odoo's `patch()` utility from `@web/core/utils/patch`. The agent MUST NOT edit or copy any core or Enterprise file. Uninstalling the module MUST remove the behavior completely.
- FR-29: Patched behavior: when `detectCameraEnv().canLive` is false, the scanner dialog MUST render `PhotoBarcodeScanner` instead of trying to start a video stream. When `canLive` is true, the original behavior MUST run unchanged.
- FR-30: A successful photo-scan MUST reach Odoo through the same path as a live scan or a hardware (keyboard-type) scanner, so every screen that listens for scans works without changes. Close the dialog the way the original does.
- FR-31: Fail safe. If a patch target cannot be found in the installed build, log one console warning and leave stock behavior untouched. The module MUST NEVER break the web client.
- FR-32: Dependencies stay `['web']`. Add `'barcodes'` only if verified to be necessary.
- FR-33: Coverage. The patch covers screens that reuse the generic scanner dialog. The README MUST list which Enterprise screens were tested (for example inventory barcode and attendance kiosk) and which were not, and MUST NOT claim coverage that was not tested.
- FR-34: The README MUST state the limitations: photo-scan is not live, one photo equals one scan, good light and focus are needed, a Bluetooth or USB keyboard-type scanner is recommended for high-volume work, and HTTPS remains the long-term fix.

## 9. Guidance Content (data for `browser_guide.js`)

The guide MUST state accurately what is possible. Use this content:

- **Chrome, Brave, Edge (Windows, Linux, macOS, Android):**
  1. Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure` (Brave: `brave://flags/...`, Edge: `edge://flags/...`).
  2. Set the flag to Enabled and enter the exact origin, for example `http://192.168.1.10:8069`.
  3. Relaunch the browser. Note: per device, per browser. Flag availability may change between versions.
- **Firefox (desktop and Android):**
  1. Open `about:config` and accept the warning.
  2. Set `media.devices.insecure.enabled` and `media.getusermedia.insecure.enabled` to `true`.
  3. Reload the page. Availability may change between versions, and Firefox Android may require a Nightly or configurable build.
- **Safari (macOS) and all iOS/iPadOS browsers:** No setting exists. Live camera requires HTTPS. On iOS the "Take photo" button opens the native camera app and works over HTTP.
- **Permanent fix (all devices):** Put Odoo behind an HTTPS reverse proxy (for example Nginx) using a certificate the clients trust: either a certificate from an internal CA installed on each device, a locally trusted development CA such as mkcert, or a real domain with a public certificate. Access Odoo by the HTTPS hostname. Also set `proxy_mode = True` in odoo.conf and pass `X-Forwarded-Proto`.

The module MUST NOT claim the flags are guaranteed. Wording should say "may" where browser behavior can change.

## 10. UX Specification

- The component uses Odoo 17 standard classes (Bootstrap 5, `btn btn-primary`) and MUST support RTL and dark mode via Odoo variables.
- States: `idle`, `starting`, `live`, `captured`, `error`. Show a loading indicator in `starting`.
- After capture, show a preview with "Retake" and "Use photo" buttons unless `autoConfirm` is set.
- Mobile layout: the capture button MUST be at least 44px tall and reachable with one thumb.
- Accessibility: all buttons have `aria-label`, and the guidance panel is keyboard operable.

## 11. Non-Functional Requirements

- NFR-1: No external requests, CDNs, or telemetry. Fully LAN-capable.
- NFR-2: Bundle size under 40 KB minified for the module's own code. The offline decoder is excluded from this budget, MUST be lazy-loaded only when photo-scan starts, and its size MUST be reported in the README.
- NFR-3: Works with Odoo 17 OWL 2 APIs only (`useState`, `useRef`, `onMounted`, `onWillUnmount`). No jQuery in new code.
- NFR-4: Image processing for a 12 MP photo MUST complete in under 1.5 seconds on a mid-range phone.
- NFR-5: Never persist or transmit captured images inside this module. It only returns data to the host module through callbacks.
- NFR-6: Code style follows Odoo guidelines and ESLint with the Odoo config. Every public function has JSDoc.
- NFR-7: No access to the camera before the user clicks a button (no auto-start of the stream on page load), to respect user privacy.

## 12. Security and Privacy

- The module MUST NOT weaken any server security setting and MUST NOT disable any browser security feature programmatically.
- Captured images are handled in memory only and not logged to the console.
- The guidance panel MUST warn that treating an HTTP origin as secure lowers protection and should only be done on trusted private networks.
- Do not embed any real internal IP in source code. The origin is read at runtime.

## 13. Acceptance Criteria and Test Plan

- AC-1: On `http://<LAN-IP>:8069` with desktop Chrome and no flag, the component renders in `file` mode and returns a resized JPEG from a chosen file, with the guidance panel visible.
- AC-2: On the same URL with the Chrome flag enabled for that origin, the component renders in `live` mode and captures a frame.
- AC-3: On Android Chrome over HTTP, the component renders in `native` mode and the button opens the camera app.
- AC-4: On iPhone Safari over HTTP, `native` mode works and the panel says live camera needs HTTPS.
- AC-5: On HTTPS or `localhost`, all supported browsers use `live` mode with no guidance panel.
- AC-6: Permission denial triggers the correct message and a fallback to `native` or `file`.
- AC-7: Media tracks are stopped after capture and on unmount (verified by checking `track.readyState === 'ended'`).
- AC-8: Module installs and uninstalls cleanly on Odoo 17 with no Python errors, and the manifest declares OPL-1 and the author.
- AC-9: Unit tests cover `detectCameraEnv` for the full matrix in Section 5 using mocked `navigator` and `window`.
- AC-10: Translation template generated, with all strings wrapped in `_t()`.

* AC-11: On an iPad with Safari over HTTP, tapping the camera scan button in the scanner dialog opens the native camera app instead of failing. After photographing a clear EAN-13, the value reaches the host screen within 3 seconds of returning to the page.
* AC-12: Clear photos of EAN-8, UPC-A, Code 128, Code 39 and ITF barcodes decode correctly. A QR Code photo is ignored with the failure message.
* AC-13: A blurry photo or a photo without a barcode shows the failure message with Retake and Enter manually, and never crashes.
* AC-14: Over HTTPS or localhost the stock live scanner behaves exactly as before.
* AC-15: If a patch target is missing, one console warning is logged and stock behavior is untouched.
* AC-16: No network request is made during a scan and no image is stored (verified in browser developer tools).
* AC-17: Uninstalling the module removes the patch and the scanner returns to stock behavior.

Test approach: Odoo JS unit tests (QUnit) for detection and component states, plus a manual checklist run on each browser/OS pair in Section 5.

## 14. Assumptions and Defaults (change if needed)

- A1: Technical name is `camera_secure_context_bypass`.
- A2: Backend assets only in v1.
- A3: Default output is base64 JPEG without the data-URL prefix.
- A4: One image per capture, no multi-shot gallery in v1.
- A5: No Python models or database changes. The module is front-end only.
- A6: Odoo Enterprise code is never copied or modified. The v1 integration patches only the scanner component found in the installed Odoo (Section 8.7). A future v2 MAY add optional runtime `patch()` integrations for Enterprise features, subject to a license review.

## 15. Roadmap (informational, not in v1)

- v1.1: Optional helper docs and a sample Nginx config in the README for HTTPS.
- v1.2: Optional integration patches for the Attendance kiosk (photo capture only). Barcode scanner integration already ships in v1.
- v1.3: Multi-shot capture and per-field compression settings.

## 16. Instructions to the Implementing Agent

1. Build only what is listed in Sections 6 to 12.
2. Write `camera_env.js` and its tests first, then the component, then the guidance panel, then the photo-scan decoder, then the scanner patch.
3. Do not add features, dependencies, or Python code that are not specified.
4. Do not claim in code comments or the README that the module "bypasses" browser security. Describe it as a compatibility and fallback layer.
5. Deliver: module source, README with install steps and the HTTPS recommendation, `.pot` file, test files, and a short list of any assumptions you changed.
6. Definition of done: every AC in Section 13 passes.
