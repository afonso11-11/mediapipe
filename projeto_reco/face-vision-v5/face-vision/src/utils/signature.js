/**
 * Assinatura geométrica do rosto: coordenadas de landmarks estáveis, alinhadas
 * (centro, rotação e escala pela distância entre os olhos). Não contém imagem.
 * É uma comparação aproximada, adequada para demonstração, não para segurança.
 */

const SIGNATURE_LANDMARKS = [
  // contorno do rosto
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
  148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  // olhos
  33, 133, 160, 159, 158, 157, 173, 153, 145, 144, 163, 7,
  263, 362, 387, 386, 385, 384, 398, 380, 374, 373, 390, 249,
  // sobrancelhas
  70, 63, 105, 66, 107, 336, 296, 334, 293, 300,
  // nariz
  168, 6, 197, 195, 5, 4, 1, 2, 98, 97, 326, 327, 129, 358, 64, 294,
  // boca
  61, 291, 0, 17, 37, 39, 40, 185, 267, 269, 270, 409, 13, 14, 78, 308,
];

export const SIGNATURE_LENGTH = SIGNATURE_LANDMARKS.length * 3;

/** @param aspect largura/altura do vídeo, para corrigir a deformação das coordenadas normalizadas */
export function faceSignature(landmarks, aspect) {
  const a = landmarks[33], b = landmarks[263];
  const ax = a.x * aspect, bx = b.x * aspect;
  const cx = (ax + bx) / 2, cy = (a.y + b.y) / 2, cz = ((a.z + b.z) / 2) * aspect;
  const iod = Math.hypot(bx - ax, b.y - a.y) || 1e-6;
  const angle = Math.atan2(b.y - a.y, bx - ax);
  const cos = Math.cos(-angle), sin = Math.sin(-angle);

  const out = new Array(SIGNATURE_LENGTH);
  SIGNATURE_LANDMARKS.forEach((index, i) => {
    const p = landmarks[index];
    const x = p.x * aspect - cx, y = p.y - cy;
    out[i * 3] = (x * cos - y * sin) / iod;
    out[i * 3 + 1] = (x * sin + y * cos) / iod;
    out[i * 3 + 2] = ((p.z * aspect) - cz) / iod;
  });
  return out;
}

export function averageSignatures(list) {
  const mean = new Array(SIGNATURE_LENGTH).fill(0);
  for (const sig of list) for (let i = 0; i < SIGNATURE_LENGTH; i++) mean[i] += sig[i] / list.length;
  return mean.map((v) => Math.round(v * 1e5) / 1e5);
}

/** Distância RMS entre duas assinaturas (em unidades de distância entre os olhos). */
export function signatureDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < SIGNATURE_LENGTH; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / SIGNATURE_LENGTH);
}
