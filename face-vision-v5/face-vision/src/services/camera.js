import { MESSAGES } from "../config.js";

export function checkBrowserSupport() {
  if (!window.isSecureContext) return MESSAGES.insecure;
  if (!navigator.mediaDevices?.getUserMedia || typeof WebAssembly === "undefined") return MESSAGES.unsupported;
  return null;
}

const CONSTRAINT_ATTEMPTS = [
  { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
  { video: { facingMode: "user" }, audio: false },
  { video: true, audio: false },
];

/** Tenta configurações cada vez mais simples; permissão negada não é repetida. */
async function openStream() {
  let lastError;
  for (const constraints of CONSTRAINT_ATTEMPTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      if (error.name === "NotAllowedError" || error.name === "SecurityError") throw error;
      lastError = error;
    }
  }
  // Último recurso: tenta cada câmera listada pelo navegador, uma por uma.
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.deviceId);
    for (const { deviceId } of devices) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
      } catch (error) {
        lastError = error;
      }
    }
  } catch { /* enumerateDevices indisponível */ }
  throw lastError;
}

export async function startCamera(video) {
  const stream = await openStream();
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
      return `${MESSAGES.cameraBusy} Feche outros apps ou abas que usam a câmera e tente de novo. (código: ${error?.name ?? "desconhecido"}${error?.message ? " - " + error.message : ""})`;
  }
}
