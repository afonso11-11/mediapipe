import { MEDIAPIPE } from "../config.js";

/** Encapsula o MediaPipe Face Landmarker (modo VIDEO). Não conhece nada da interface. */
export class FaceTracker {
  constructor() {
    this.landmarker = null;
    this.delegate = null;
    this.connections = null;
  }

  async load() {
    const { FaceLandmarker, FilesetResolver } = await import(MEDIAPIPE.bundleUrl);
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmUrl);

    const create = (delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE.modelUrl, delegate },
        runningMode: "VIDEO",
        numFaces: MEDIAPIPE.maxFaces,
        outputFaceBlendshapes: true,
      });

    try {
      this.landmarker = await create("GPU");
      this.delegate = "GPU";
    } catch (gpuError) {
      console.warn("Delegate GPU indisponível, usando CPU.", gpuError);
      this.landmarker = await create("CPU");
      this.delegate = "CPU";
    }

    this.connections = {
      tesselation: FaceLandmarker.FACE_LANDMARKS_TESSELATION,
      faceOval: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
      lips: FaceLandmarker.FACE_LANDMARKS_LIPS,
      leftEye: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      rightEye: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
      leftBrow: FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
      rightBrow: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
      leftIris: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
      rightIris: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
    };
  }

  get ready() {
    return this.landmarker !== null;
  }

  /** @returns {{faceLandmarks: Array, faceBlendshapes: Array}} */
  detect(video, timestampMs) {
    return this.landmarker.detectForVideo(video, timestampMs);
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
