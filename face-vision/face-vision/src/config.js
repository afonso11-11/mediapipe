const MEDIAPIPE_VERSION = "0.10.14";

export const MEDIAPIPE = {
  bundleUrl: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`,
  wasmUrl: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  modelUrl: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  // O modelo detecta até 2 rostos só para avisar quando há mais de um; a análise usa a 1ª face.
  maxFaces: 2,
};

export const UI_REFRESH_MS = 120;
export const DETECTION_WINDOW = 30;

export const MESSAGES = {
  cameraDenied: "Permissão para acessar a câmera foi negada. Verifique as permissões do navegador.",
  cameraMissing: "Nenhuma câmera disponível foi encontrada.",
  cameraBusy: "A câmera está em uso por outro aplicativo ou não pôde ser aberta.",
  modelFailed: "Não foi possível carregar o modelo MediaPipe.",
  unsupported: "Seu navegador pode não oferecer suporte a todos os recursos necessários.",
  insecure: "O acesso à câmera exige HTTPS ou localhost. Abra o site por um servidor local (veja o README).",
  noFace: "Nenhum rosto detectado.",
  multiFace: "Mais de um rosto detectado. Rastreando apenas a primeira face.",
};
