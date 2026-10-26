/** @odoo-module **/

import { Component, onMounted, onWillUnmount, useRef, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { detectCameraEnv } from "../utils/camera_env";
import { processMediaFrame, processImageFile } from "../utils/image_utils";
import { GuidancePanel } from "../guide/guidance_panel";

export class CameraCapture extends Component {
    setup() {
        this.videoRef = useRef("videoPreview");
        this.fileInputRef = useRef("fileInput");

        this.envInfo = detectCameraEnv();
        this.stream = null;
        this.availableVideoInputs = [];

        this.state = useState({
            mode: this.envInfo.mode, // 'live' | 'native' | 'file'
            status: "idle", // 'idle' | 'starting' | 'live' | 'captured' | 'error'
            facingMode: this.props.facingMode || "environment",
            hasMultipleCameras: false,
            capturedImage: null,
            capturedMeta: null,
            errorMessage: "",
        });

        onMounted(async () => {
            if (this.props.onModeResolved) {
                this.props.onModeResolved(this.state.mode);
            }
            if (this.state.mode === "live") {
                await this.checkVideoDevices();
                await this.startLiveStream();
            }
        });

        onWillUnmount(() => {
            this.stopStream();
        });
    }

    async checkVideoDevices() {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                this.availableVideoInputs = devices.filter((d) => d.kind === "videoinput");
                this.state.hasMultipleCameras = this.availableVideoInputs.length > 1;
            } catch (_) {
                this.state.hasMultipleCameras = false;
            }
        }
    }

    stopStream() {
        if (this.stream) {
            this.stream.getTracks().forEach((track) => {
                track.stop();
            });
            this.stream = null;
        }
    }

    async startLiveStream() {
        this.stopStream();
        this.state.status = "starting";
        this.state.errorMessage = "";

        const constraints = {
            video: {
                facingMode: { ideal: this.state.facingMode },
                width: { ideal: this.props.maxWidth || 1280 },
                height: { ideal: this.props.maxHeight || 1280 },
            },
            audio: false,
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (!this.videoRef.el) {
                this.stopStream();
                return;
            }
            this.videoRef.el.srcObject = this.stream;
            await this.videoRef.el.play();
            this.state.status = "live";
        } catch (err) {
            this.stopStream();
            const errorMap = {
                NotAllowedError: _t(
                    "Camera permission was denied. Allow camera access for this site in the browser settings and try again."
                ),
                NotFoundError: _t("No camera was found on this device."),
                NotReadableError: _t("The camera is in use by another app. Close it and try again."),
                OverconstrainedError: _t(
                    "The requested camera is not available. Using the default camera instead."
                ),
            };

            const userMessage =
                errorMap[err.name] ||
                _t("Could not start camera: ") + (err.message || _t("Unknown error"));

            this.state.errorMessage = userMessage;

            // Fallback mode as mandated by FR-6
            this.state.mode = this.envInfo.canNativeCapture ? "native" : "file";
            this.state.status = "error";

            if (this.props.onError) {
                this.props.onError({ code: err.name || "CameraError", message: userMessage });
            }
        }
    }

    async switchCamera() {
        this.state.facingMode = this.state.facingMode === "environment" ? "user" : "environment";
        await this.startLiveStream();
    }

    async takePhoto() {
        if (!this.videoRef.el || this.state.status !== "live") {
            return;
        }

        try {
            const result = await processMediaFrame(this.videoRef.el, {
                maxWidth: this.props.maxWidth,
                maxHeight: this.props.maxHeight,
                quality: this.props.quality,
                outputFormat: this.props.outputFormat,
            });

            this.handleCapturedResult(result);
        } catch (err) {
            this.state.errorMessage = _t("Failed to capture photo: ") + err.message;
            if (this.props.onError) {
                this.props.onError({ code: "CaptureError", message: err.message });
            }
        }
    }

    triggerFileInput() {
        if (this.fileInputRef.el) {
            this.fileInputRef.el.click();
        }
    }

    async onFileSelected(ev) {
        const file = ev.target.files && ev.target.files[0];
        if (!file) {
            return;
        }

        try {
            const result = await processImageFile(file, {
                maxWidth: this.props.maxWidth,
                maxHeight: this.props.maxHeight,
                quality: this.props.quality,
                outputFormat: this.props.outputFormat,
            });

            this.handleCapturedResult(result);
        } catch (err) {
            this.state.errorMessage = _t("Failed to process image file: ") + err.message;
            if (this.props.onError) {
                this.props.onError({ code: "FileError", message: err.message });
            }
        } finally {
            if (this.fileInputRef.el) {
                this.fileInputRef.el.value = "";
            }
        }
    }

    handleCapturedResult(result) {
        const payload = {
            ...result,
            mode: this.state.mode,
        };

        if (!this.props.keepOpen) {
            this.stopStream();
        }

        if (this.props.autoConfirm) {
            this.props.onCapture(payload);
        } else {
            // Preview before confirming
            const previewSrc =
                result.mimeType && typeof result.data === "string" && !result.data.startsWith("data:")
                    ? `data:${result.mimeType};base64,${result.data}`
                    : result.data;

            this.state.capturedImage = previewSrc;
            this.state.capturedMeta = payload;
            this.state.status = "captured";
        }
    }

    confirmCapture() {
        if (this.state.capturedMeta) {
            this.props.onCapture(this.state.capturedMeta);
        }
    }

    retake() {
        this.state.capturedImage = null;
        this.state.capturedMeta = null;
        if (this.state.mode === "live") {
            this.startLiveStream();
        } else {
            this.state.status = "idle";
        }
    }
}

CameraCapture.template = "camera_secure_context_bypass.CameraCapture";
CameraCapture.components = { GuidancePanel };
CameraCapture.defaultProps = {
    facingMode: "environment",
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.85,
    outputFormat: "base64",
    showGuide: true,
    autoConfirm: false,
    keepOpen: false,
};
CameraCapture.props = {
    facingMode: { type: String, optional: true },
    maxWidth: { type: Number, optional: true },
    maxHeight: { type: Number, optional: true },
    quality: { type: Number, optional: true },
    outputFormat: { type: String, optional: true },
    showGuide: { type: Boolean, optional: true },
    autoConfirm: { type: Boolean, optional: true },
    keepOpen: { type: Boolean, optional: true },
    onCapture: { type: Function },
    onError: { type: Function, optional: true },
    onModeResolved: { type: Function, optional: true },
};

