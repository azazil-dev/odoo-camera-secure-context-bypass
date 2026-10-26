# -*- coding: utf-8 -*-
{
    'name': "Camera Secure Context Bypass",
    'summary': "Bypass browser secure-context camera restrictions on plain HTTP (LAN/IP/iPad WebKit) via native capture + offline photo barcode scanning",
    'description': """
Camera Secure Context Bypass (Non-Secure Context)
=========================================================
Author: Arif N Ramadhan | License: OPL-1 | Target: Odoo 19

Solves the camera block on insecure contexts (HTTP over LAN IP) where `navigator.mediaDevices`
is restricted by modern browsers. Provides:
- Reusable `CameraCapture` OWL component with automatic capability detection.
- Native device camera app integration (<input type="file" capture>) for mobile & tablets over HTTP.
- Offline still-photo barcode scanning (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF) using Odoo's built-in ZXing / BarcodeDetector API.
- Seamless runtime patch for Odoo's built-in camera barcode scanner dialog.
- Actionable per-browser guidance panel with one-click origin copy.
    """,
    'author': "Arif N Ramadhan",
    'website': "www.niits.id",
    'category': 'Technical',
    'version': '19.0.1.0.0',
    'license': 'OPL-1',
    'depends': ['web'],
    'data': [],
    'assets': {
        'web.assets_backend': [
            'camera_secure_context_bypass/static/src/utils/camera_env.js',
            'camera_secure_context_bypass/static/src/utils/image_utils.js',
            'camera_secure_context_bypass/static/src/guide/browser_guide.js',
            'camera_secure_context_bypass/static/src/guide/guidance_panel.xml',
            'camera_secure_context_bypass/static/src/guide/guidance_panel.js',
            'camera_secure_context_bypass/static/src/camera_capture/camera_capture.scss',
            'camera_secure_context_bypass/static/src/camera_capture/camera_capture.xml',
            'camera_secure_context_bypass/static/src/camera_capture/camera_capture.js',
            'camera_secure_context_bypass/static/src/photo_scanner/photo_decoder.js',
            'camera_secure_context_bypass/static/src/photo_scanner/photo_barcode_scanner.scss',
            'camera_secure_context_bypass/static/src/photo_scanner/photo_barcode_scanner.xml',
            'camera_secure_context_bypass/static/src/photo_scanner/photo_barcode_scanner.js',
            'camera_secure_context_bypass/static/src/patches/barcode_dialog_patch.xml',
            'camera_secure_context_bypass/static/src/patches/barcode_scanner_patch.js',
        ],
        'web.qunit_suite_tests': [
            'camera_secure_context_bypass/static/tests/camera_env.test.js',
            'camera_secure_context_bypass/static/tests/photo_decoder.test.js',
            'camera_secure_context_bypass/static/tests/barcode_scanner_patch.test.js',
        ],
    },
    'images': ['static/description/banner.png'],
    'installable': True,
    'application': True,
    'auto_install': False,
}
