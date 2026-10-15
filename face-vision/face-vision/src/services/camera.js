import { MESSAGES } from "../config.js";

export function checkBrowserSupport() {
  if (!window.isSecureContext) return MESSAGES.insecure;
  if (!navigator.mediaDevices?.getUserMedia || typeof WebAssembly === "undefined") return MESSAGES.unsupported;
  return null;
}

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) {
    await new Promise((resolve) => video.addEventListener("loadedmetadata", resolve, { once: true }));
  }
  return stream;
}

export function stopCamera(video) {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}

export function describeCameraError(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return MESSAGES.cameraDenied;
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return MESSAGES.cameraMissing;
    default:
      return MESSAGES.cameraBusy;
  }
}
