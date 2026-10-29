/**
 * Desenha landmarks no canvas. O vídeo é espelhado via CSS; aqui o espelhamento
 * é feito nas coordenadas (x = 1 - lm.x), assim os textos permanecem legíveis.
 */

const COLORS = {
  mesh: "rgba(56, 189, 248, 0.22)",
  oval: "#38bdf8",
  eyes: "#22d3ee",
  brows: "#60a5fa",
  iris: "#34d399",
  lips: "#4ade80",
  nose: "#67e8f9",
  points: "rgba(224, 242, 254, 0.9)",
  highlight: "#fbbf24",
};

const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4];
const NOSE_BASE = [98, 97, 2, 326, 327];

// Âncoras dos rótulos: [texto, landmark, lado]
const REGION_LABELS = [
  // Com a imagem espelhada, os índices 33/172 caem à direita da tela e 336/358/291 à esquerda.
  ["OLHOS", 33, "right"],
  ["CONTORNO FACIAL", 172, "right"],
  ["SOBRANCELHAS", 336, "left"],
  ["NARIZ", 358, "left"],
  ["BOCA", 291, "left"],
  ["QUEIXO", 152, "bottom"],
];

export class Renderer {
  constructor(canvas, connections) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.connections = connections;
    this.pts = new Float32Array(478 * 2);
  }

  /** Mantém a resolução do canvas igual à do vídeo. */
  syncSize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Posição em pixels do canvas de um landmark (já espelhada). */
  pointOf(landmark) {
    return { x: (1 - landmark.x) * this.canvas.width, y: landmark.y * this.canvas.height };
  }

  /** Índice do landmark mais próximo de (px, py) em pixels do canvas, ou -1. */
  nearest(landmarks, px, py, maxDistance) {
    let best = -1;
    let bestDist = maxDistance * maxDistance;
    const { width, height } = this.canvas;
    for (let i = 0; i < landmarks.length; i++) {
      const dx = (1 - landmarks[i].x) * width - px;
      const dy = landmarks[i].y * height - py;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  render(faces, options, hoverIndex = -1) {
    const { width, height } = this.canvas;
    this.clear();
    if (!faces?.length) return;

    const scale = Math.max(0.8, width / 960) * (options.boost ? 1.6 : 1);
    faces.forEach((landmarks, faceIndex) => {
      const pts = this.fillPoints(landmarks, width, height);
      const primary = faceIndex === 0;
      this.ctx.globalAlpha = primary ? 1 : 0.55;

      if (options.mesh) this.stroke(this.connections.tesselation, pts, COLORS.mesh, 0.7 * scale);
      if (options.contours) this.drawContours(pts, scale);
      if (options.landmarks) this.drawPoints(pts, landmarks.length, scale);
      if (options.labels && primary) this.drawLabels(pts, width, height, scale);
      if (options.name && primary) this.drawNameTag(options.name, pts, width, scale);
    });
    this.ctx.globalAlpha = 1;

    if (hoverIndex >= 0 && faces[0]?.[hoverIndex]) this.drawHighlight(faces[0][hoverIndex], hoverIndex, scale);
  }

  fillPoints(landmarks, width, height) {
    const pts = this.pts;
    for (let i = 0; i < landmarks.length; i++) {
      pts[i * 2] = (1 - landmarks[i].x) * width;
      pts[i * 2 + 1] = landmarks[i].y * height;
    }
    return pts;
  }

  stroke(connections, pts, color, lineWidth) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (const { start, end } of connections) {
      ctx.moveTo(pts[start * 2], pts[start * 2 + 1]);
      ctx.lineTo(pts[end * 2], pts[end * 2 + 1]);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  strokePolyline(indices, pts, color, lineWidth) {
    const ctx = this.ctx;
    ctx.beginPath();
    indices.forEach((index, i) => {
      const x = pts[index * 2], y = pts[index * 2 + 1];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  drawContours(pts, scale) {
    const c = this.connections;
    const w = 1.6 * scale;
    this.stroke(c.faceOval, pts, COLORS.oval, w * 1.2);
    this.stroke([...c.leftEye, ...c.rightEye], pts, COLORS.eyes, w);
    this.stroke([...c.leftBrow, ...c.rightBrow], pts, COLORS.brows, w);
    this.stroke(c.lips, pts, COLORS.lips, w);
    this.stroke([...c.leftIris, ...c.rightIris], pts, COLORS.iris, w);
    this.strokePolyline(NOSE_BRIDGE, pts, COLORS.nose, w);
    this.strokePolyline(NOSE_BASE, pts, COLORS.nose, w);
  }

  drawPoints(pts, count, scale) {
    const size = 1.8 * scale;
    this.ctx.fillStyle = COLORS.points;
    for (let i = 0; i < count; i++) {
      this.ctx.fillRect(pts[i * 2] - size / 2, pts[i * 2 + 1] - size / 2, size, size);
    }
  }

  drawLabels(pts, width, height, scale) {
    const ctx = this.ctx;
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < 468; i++) {
      const x = pts[i * 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    const fontSize = Math.round(11 * Math.max(1, scale * 0.95));
    ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textBaseline = "middle";
    const pad = 6 * Math.max(1, scale * 0.8);
    const gap = 26 * scale;

    for (const [text, index, side] of REGION_LABELS) {
      const ax = pts[index * 2], ay = pts[index * 2 + 1];
      const textWidth = ctx.measureText(text).width;
      const boxW = textWidth + pad * 2, boxH = fontSize + pad;
      let bx, by = ay - boxH / 2;
      if (side === "left") bx = minX - gap - boxW;
      else if (side === "right") bx = maxX + gap;
      else { bx = ax - boxW / 2; by = ay + gap * 0.6; }
      bx = Math.min(Math.max(bx, 4), width - boxW - 4);
      by = Math.min(Math.max(by, 4), height - boxH - 4);

      const tx = side === "left" ? bx + boxW : side === "right" ? bx : ax;
      const ty = side === "bottom" ? by : by + boxH / 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = "rgba(34, 211, 238, 0.55)";
      ctx.lineWidth = Math.max(1, scale * 0.9);
      ctx.stroke();

      ctx.fillStyle = "rgba(5, 11, 24, 0.78)";
      ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#bff3ff";
      ctx.fillText(text, bx + pad, by + boxH / 2 + 0.5);
    }
  }

  /** Etiqueta digitada pelo usuário, centralizada acima da testa (landmark 10). */
  drawNameTag(name, pts, width, scale) {
    const ctx = this.ctx;
    const fontSize = Math.round(15 * Math.max(1, scale));
    ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    const pad = fontSize * 0.6;
    const boxW = ctx.measureText(name).width + pad * 2;
    const boxH = fontSize + pad * 1.2;
    const x = Math.min(Math.max(pts[10 * 2] - boxW / 2, 4), width - boxW - 4);
    const y = Math.max(pts[10 * 2 + 1] - boxH - 14 * scale, 4);

    ctx.fillStyle = "rgba(5, 11, 24, 0.85)";
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e6fff6";
    ctx.fillText(name, x + pad, y + boxH / 2 + 0.5);
  }

  drawHighlight(landmark, index, scale) {
    const { x, y } = this.pointOf(landmark);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 6 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.highlight;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.fillStyle = COLORS.highlight;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}
