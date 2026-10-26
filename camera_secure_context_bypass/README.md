# Camera Secure Context Bypass (Odoo 17)

**Odoo 17 Community & Enterprise Camera & Barcode Scanning Bypass for Insecure / LAN HTTP Contexts**  
**Author:** Arif N Ramadhan | **License:** OPL-1 | **Target:** Odoo 17.0

---

## 1. Problem Statement

Modern web browsers enforce **Secure Contexts (`window.isSecureContext`)** for accessing device media hardware via `navigator.mediaDevices.getUserMedia`. When accessing an on-premise Odoo server over a local network IP (e.g. `http://192.168.1.50:8069`) without SSL/TLS:
- `navigator.mediaDevices` is `undefined`.
- Odoo's built-in barcode scanner fails immediately with `Could not start scanning. undefined` or fails silently.
- On iPadOS/iOS (Safari / WebKit), no browser flags exist to bypass this security barrier.

## 2. Solution: How This Module Solves It

This module provides a **privacy-first, fully offline secure-context bypass layer**:

1. **Automatic Environment Capability Detection (`camera_env.js`):**
   - Distinguishes between `live` (HTTPS/localhost), `native` (mobile/tablet camera app capture), and `file` picker.
   - Accurately detects iPadOS 13+ devices masquerading as macOS desktop.
2. **Offline 1D Photo-Barcode Scanner (`PhotoBarcodeScanner`):**
   - Enables iPad and mobile users to scan 1D barcodes over plain HTTP by taking still photos via `<input type="file" capture="environment">`.
   - Still images are processed locally in the browser using Odoo's built-in ZXing library / BarcodeDetector API.
   - Supports: **EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF**. Includes checksum validation.
3. **Seamless Stock Scanner Patch (`barcode_scanner_patch.js`):**
   - Patches `BarcodeDialog` at runtime using Odoo's official OWL `patch()` utility.
   - When on HTTP/insecure context, switches seamlessly to `PhotoBarcodeScanner`. When on HTTPS/secure context, preserves stock live video behavior.
4. **Reusable OWL Component (`CameraCapture`):**
   - Provides an embeddable component for other custom modules needing camera input with automatic fallback.
5. **Interactive Guidance Panel (`GuidancePanel`):**
   - Explains the insecure context restriction, provides step-by-step browser flag workarounds with a one-click **"Copy Origin"** helper (with insecure `document.execCommand` fallback), and details the permanent HTTPS setup.

---

## 3. Supported Environments & Expected Behavior

| Environment | Secure Context (HTTPS / localhost) | Insecure Context (HTTP + LAN IP) |
|---|---|---|
| **Chrome / Brave / Edge** (Win / Linux / Mac) | Live Video | File Picker, or Live after setting browser flag |
| **Chrome / Brave** (Android) | Live Video | Native Camera App, or Live after setting flag |
| **Firefox** (Desktop / Android) | Live Video | File Picker / Native, or Live after `about:config` |
| **Safari** (macOS) | Live Video | File Picker. HTTPS required for Live |
| **Safari / All iOS & iPadOS browsers** | Live Video | **Native Camera App (Photo-Scan)**. HTTPS required for Live |

---

## 4. Workarounds vs Permanent Fix

### Chromium Browser Flag (Chrome, Brave, Edge)
1. Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure` (or `brave://...`, `edge://...`).
2. Set the flag to **Enabled**.
3. Add the exact Odoo origin, e.g. `http://192.168.1.50:8069`.
4. Relaunch the browser.

### Firefox
1. Open `about:config` and accept the risk notice.
2. Set `media.devices.insecure.enabled` = `true`.
3. Set `media.getusermedia.insecure.enabled` = `true`.
4. Reload Odoo.

### Permanent Production Fix (Recommended)
Place Odoo behind an HTTPS reverse proxy (e.g. Nginx, Caddy, Traefik) with a trusted TLS certificate.
In `/etc/odoo/odoo.conf`:
```ini
proxy_mode = True
```

Sample Nginx configuration snippet:
```nginx
server {
    listen 443 ssl http2;
    server_name odoo.yourcompany.local;

    ssl_certificate /etc/ssl/certs/odoo.crt;
    ssl_certificate_key /etc/ssl/private/odoo.key;

    location / {
        proxy_pass http://127.0.0.1:8069;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## 5. Technical Details & Compliance

- **No External Network Calls:** 100% offline and LAN compliant. Reuses Odoo's local `/web/static/lib/zxing-library/zxing-library.js`.
- **Zero Enterprise Modifications:** No Odoo core or Enterprise files are altered. Runtime patching is used.
- **Privacy First:** Photo images are analyzed purely in-browser memory. Nothing is uploaded or stored.
- **Safe Bypass:** Uses native camera app capture over insecure contexts via standard HTML file input with `capture` attribute; no bypass of TLS or browser security enforcement.

---

## 6. Installation

1. Copy or clone `camera_secure_context_bypass` to your custom addons directory (e.g. `/mnt/extra-addons`).
2. Update the apps list in Odoo (or execute `odoo -u camera_secure_context_bypass -d <db_name>`).
3. Install **Camera Secure Context Bypass**.

