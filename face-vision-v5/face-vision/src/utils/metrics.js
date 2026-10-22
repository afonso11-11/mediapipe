import { DETECTION_WINDOW } from "../config.js";

/** Métricas reais calculadas a partir dos frames processados. */
export class Metrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.fps = 0;
    this.inferenceMs = 0;
    this.frameMs = 0;
    this.windowStart = performance.now();
    this.windowFrames = 0;
    this.history = new Array(DETECTION_WINDOW).fill(false);
    this.historyCount = 0;
    this.historyIndex = 0;
    this.hits = 0;
  }

  recordFrame({ inferenceMs, frameMs, faceFound }) {
    const smooth = (prev, next) => (prev === 0 ? next : prev * 0.85 + next * 0.15);
    this.inferenceMs = smooth(this.inferenceMs, inferenceMs);
    this.frameMs = smooth(this.frameMs, frameMs);

    if (this.historyCount === DETECTION_WINDOW && this.history[this.historyIndex]) this.hits--;
    this.history[this.historyIndex] = faceFound;
    if (faceFound) this.hits++;
    this.historyIndex = (this.historyIndex + 1) % DETECTION_WINDOW;
    this.historyCount = Math.min(this.historyCount + 1, DETECTION_WINDOW);

    this.windowFrames++;
    const now = performance.now();
    const elapsed = now - this.windowStart;
    if (elapsed >= 500) {
      const instant = (this.windowFrames * 1000) / elapsed;
      this.fps = this.fps === 0 ? instant : this.fps * 0.5 + instant * 0.5;
      this.windowFrames = 0;
      this.windowStart = now;
    }
  }

  /** Fração (0–1) dos últimos frames em que havia rosto. */
  get detectionRate() {
    return this.historyCount ? this.hits / this.historyCount : 0;
  }
}
