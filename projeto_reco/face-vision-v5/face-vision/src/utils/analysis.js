/**
 * Análises geométricas simples sobre os landmarks do MediaPipe.
 * Todas as direções seguem a imagem espelhada exibida na tela (xTela = 1 - x).
 * São estimativas aproximadas para fins educacionais.
 */

const LM = {
  noseTip: 1, forehead: 10, chin: 152, faceLeft: 234, faceRight: 454,
  eyeOuterA: 33, eyeOuterB: 263,
  rightIris: 468, leftIris: 473,
  rightEyeCorners: [33, 133], leftEyeCorners: [362, 263],
  rightEyeLids: [159, 145], leftEyeLids: [386, 374],
  lipUpper: 13, lipLower: 14,
};

const screenX = (lm) => 1 - lm.x;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function blendshapesToMap(blendshapes) {
  const map = {};
  for (const { categoryName, score } of blendshapes?.categories ?? []) map[categoryName] = score;
  return map;
}

export const EXPRESSIONS = [
  { key: "neutral", label: "Neutro (derivado)" },
  { key: "smile", label: "Smile" },
  { key: "blink", label: "Blink" },
  { key: "mouthOpen", label: "Mouth Open" },
  { key: "browUp", label: "Brow Raise" },
  { key: "pucker", label: "Mouth Pucker" },
];

export function computeExpressions(shapes) {
  const get = (name) => shapes[name] ?? 0;
  const scores = {
    smile: (get("mouthSmileLeft") + get("mouthSmileRight")) / 2,
    blink: (get("eyeBlinkLeft") + get("eyeBlinkRight")) / 2,
    mouthOpen: get("jawOpen"),
    browUp: get("browInnerUp"),
    pucker: get("mouthPucker"),
  };
  scores.neutral = clamp(1 - Math.max(...Object.values(scores)), 0, 1);
  return scores;
}

/** Rotação (yaw), inclinação (roll) e pitch aproximados. aspect = largura/altura do vídeo. */
export function computeHead(lms, aspect) {
  const left = Math.min(screenX(lms[LM.faceLeft]), screenX(lms[LM.faceRight]));
  const right = Math.max(screenX(lms[LM.faceLeft]), screenX(lms[LM.faceRight]));
  const yawRatio = (screenX(lms[LM.noseTip]) - left) / Math.max(right - left, 1e-6);

  const top = lms[LM.forehead].y;
  const pitchRatio = (lms[LM.noseTip].y - top) / Math.max(lms[LM.chin].y - top, 1e-6);

  const [a, b] = [lms[LM.eyeOuterA], lms[LM.eyeOuterB]].sort((p, q) => screenX(p) - screenX(q));
  const rollDeg = (Math.atan2((b.y - a.y), (screenX(b) - screenX(a)) * aspect) * 180) / Math.PI;

  return {
    yaw: { pos: clamp((yawRatio - 0.5) * 4 + 0.5, 0, 1), label: yawRatio > 0.57 ? "RIGHT" : yawRatio < 0.43 ? "LEFT" : "CENTER" },
    tilt: { pos: clamp(rollDeg / 40 + 0.5, 0, 1), label: rollDeg > 8 ? "RIGHT" : rollDeg < -8 ? "LEFT" : "CENTER", deg: rollDeg },
    pitch: { pos: clamp((pitchRatio - 0.6) * 3 + 0.5, 0, 1), label: pitchRatio < 0.52 ? "UP" : pitchRatio > 0.68 ? "DOWN" : "CENTER" },
  };
}

export function computeMouth(lms, shapes) {
  const jaw = shapes.jawOpen;
  if (jaw !== undefined) return { open: jaw > 0.2, amount: jaw };
  const faceHeight = Math.max(lms[LM.chin].y - lms[LM.forehead].y, 1e-6);
  const gap = (lms[LM.lipLower].y - lms[LM.lipUpper].y) / faceHeight;
  return { open: gap > 0.04, amount: clamp(gap * 5, 0, 1) };
}

export function computeEyes(shapes) {
  const left = shapes.eyeBlinkLeft ?? 0;
  const right = shapes.eyeBlinkRight ?? 0;
  const closed = (left + right) / 2 > 0.5;
  return { closed };
}

function irisRatio(lms, iris, corners, lids) {
  const [c1, c2] = corners.map((i) => screenX(lms[i])).sort((p, q) => p - q);
  const h = (screenX(lms[iris]) - c1) / Math.max(c2 - c1, 1e-6);
  const [top, bottom] = lids.map((i) => lms[i].y);
  const v = (lms[iris].y - top) / Math.max(bottom - top, 1e-6);
  return { h, v };
}

/** Posição da íris dentro do olho (landmarks 468–477 exigem 478 pontos). */
export function computeGaze(lms) {
  if (lms.length < 478) return null;
  const r = irisRatio(lms, LM.rightIris, LM.rightEyeCorners, LM.rightEyeLids);
  const l = irisRatio(lms, LM.leftIris, LM.leftEyeCorners, LM.leftEyeLids);
  const h = (r.h + l.h) / 2;
  const v = (r.v + l.v) / 2;
  const horizontal = h > 0.56 ? "RIGHT" : h < 0.44 ? "LEFT" : "CENTER";
  const vertical = v < 0.38 ? "UP" : v > 0.62 ? "DOWN" : "CENTER";
  return { horizontal, vertical };
}
