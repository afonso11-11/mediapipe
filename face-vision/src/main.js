import { MESSAGES, UI_REFRESH_MS } from "./config.js";
import { FaceTracker } from "./services/faceTracker.js";
import { checkBrowserSupport, describeCameraError, startCamera, stopCamera } from "./services/camera.js";
import { Metrics } from "./utils/metrics.js";
import {
  blendshapesToMap, computeExpressions, computeEyes, computeGaze, computeHead, computeMouth,
} from "./utils/analysis.js";
import { Renderer } from "./ui/renderer.js";
import { Dashboard, setPill } from "./ui/dashboard.js";

const $ = (id) => document.getElementById(id);
const els = {
  video: $("video"), canvas: $("overlay"), viewport: $("viewport"), stage: $("stage"),
  placeholder: $("placeholder"), notice: $("notice"),
  cameraPill: $("cameraPill"), modelPill: $("modelPill"),
  alertBox: $("alertBox"), alertText: $("alertText"), tooltip: $("tooltip"),
  start: $("startBtn"), stop: $("stopBtn"), pause: $("pauseBtn"), restart: $("restartBtn"),
  fullscreen: $("fullscreenBtn"), capture: $("captureBtn"),
  nameInput: $("nameInput"), inspect: $("inspectBtn"), demo: $("demoModeBtn"), presentation: $("presentationBtn"),
  layers: { landmarks: $("optLandmarks"), mesh: $("optMesh"), contours: $("optContours"), labels: $("optLabels") },
};

const tracker = new FaceTracker();
const metrics = new Metrics();
const dashboard = new Dashboard();
let renderer = null;

const state = {
  cameraOn: false, starting: false, paused: false,
  loopId: 0, lastVideoTime: -1, lastUiUpdate: 0,
  lastResult: null, hoverIndex: -1, pointer: null,
};

/* ---------- Mensagens e estado visual ---------- */

function showAlert(message) {
  els.alertText.textContent = message;
  els.alertBox.hidden = false;
}

function hideAlert() {
  els.alertBox.hidden = true;
}

function setNotice(message) {
  els.notice.hidden = !message;
  if (message && els.notice.textContent !== message) els.notice.textContent = message;
}

function syncButtons() {
  const { cameraOn, starting, paused } = state;
  els.start.disabled = cameraOn || starting;
  els.stop.disabled = !cameraOn;
  els.pause.disabled = !cameraOn;
  els.capture.disabled = !cameraOn;
  els.pause.textContent = paused ? "RETOMAR ANÁLISE" : "PAUSAR ANÁLISE";
  els.placeholder.hidden = cameraOn;
  els.viewport.classList.toggle("live", cameraOn && !paused);
}

function setCameraPill() {
  if (state.starting) setPill(els.cameraPill, "loading", "SOLICITANDO CÂMERA");
  else if (!state.cameraOn) setPill(els.cameraPill, "off", "CÂMERA DESATIVADA");
  else if (state.paused) setPill(els.cameraPill, "loading", "ANÁLISE PAUSADA");
  else setPill(els.cameraPill, "on", "CÂMERA ATIVA");
}

function resetDashboard() {
  metrics.reset();
  dashboard.set("faces", "0");
  dashboard.set("landmarks", "--");
  dashboard.set("fps", "--");
  dashboard.set("latency", "--");
  dashboard.set("rate", "--");
  dashboard.set("perfFps", "--");
  dashboard.set("perfFrame", "--");
  dashboard.set("perfLatency", "--");
  dashboard.setMeter("rate", 0);
  dashboard.setStatus(state.cameraOn ? "AGUARDANDO FRAME" : "AGUARDANDO CÂMERA", "idle");
  dashboard.resetMovement();
  setNotice("");
}

/* ---------- Modelo ---------- */

async function loadModel() {
  setPill(els.modelPill, "loading", "CARREGANDO MODELO");
  dashboard.set("perfModel", "Carregando…");
  try {
    await tracker.load();
    renderer = new Renderer(els.canvas, tracker.connections);
    setPill(els.modelPill, "on", "SISTEMA ONLINE");
    dashboard.set("perfModel", "Pronto");
    dashboard.set("perfDelegate", tracker.delegate);
    return true;
  } catch (error) {
    console.error(error);
    setPill(els.modelPill, "error", "ERRO NO MODELO");
    dashboard.set("perfModel", "Erro ao carregar");
    showAlert(MESSAGES.modelFailed);
    return false;
  }
}

let modelPromise = null;
function ensureModel() {
  if (tracker.ready) return Promise.resolve(true);
  modelPromise ??= loadModel().then((ok) => { if (!ok) modelPromise = null; return ok; });
  return modelPromise;
}

/* ---------- Câmera ---------- */

async function handleStart() {
  if (state.cameraOn || state.starting) return;
  hideAlert();
  const unsupported = checkBrowserSupport();
  if (unsupported) return showAlert(unsupported);

  state.starting = true;
  syncButtons();
  setCameraPill();
  try {
    await startCamera(els.video);
    const { videoWidth: w, videoHeight: h } = els.video;
    els.viewport.style.setProperty("--ar", (w / h).toFixed(4));
    renderer?.syncSize(w, h);
    dashboard.set("perfRes", `${w}×${h}`);
    state.cameraOn = true;
    state.paused = false;
    state.lastVideoTime = -1;
    resetDashboard();
  } catch (error) {
    console.error(error);
    showAlert(describeCameraError(error));
    state.starting = false;
    syncButtons();
    setCameraPill();
    return;
  }
  state.starting = false;
  syncButtons();
  setCameraPill();

  if (!(await ensureModel())) {
    handleStop();
    return;
  }
  if (state.cameraOn && !state.loopId) {
    renderer.syncSize(els.video.videoWidth, els.video.videoHeight);
    state.loopId = requestAnimationFrame(loop);
  }
}

function handleStop() {
  cancelAnimationFrame(state.loopId);
  state.loopId = 0;
  stopCamera(els.video);
  state.cameraOn = false;
  state.paused = false;
  state.lastResult = null;
  renderer?.clear();
  hideTooltip();
  syncButtons();
  setCameraPill();
  resetDashboard();
  dashboard.set("perfRes", "--");
}

function handlePause() {
  if (!state.cameraOn) return;
  state.paused = !state.paused;
  if (state.paused) {
    els.video.pause();
    dashboard.setStatus("ANÁLISE PAUSADA", "warn");
  } else {
    els.video.play();
    state.lastVideoTime = -1;
  }
  syncButtons();
  setCameraPill();
}

async function handleRestart() {
  const wasOn = state.cameraOn;
  handleStop();
  hideAlert();
  if (wasOn) await handleStart();
}

/* ---------- Loop principal ---------- */

function loop() {
  state.loopId = requestAnimationFrame(loop);
  const video = els.video;
  if (state.paused || video.readyState < 2 || video.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = video.currentTime;

  const frameStart = performance.now();
  let result;
  try {
    result = tracker.detect(video, frameStart);
  } catch (error) {
    console.error(error);
    showAlert(MESSAGES.modelFailed);
    handleStop();
    return;
  }
  const inferenceEnd = performance.now();

  state.lastResult = result;
  renderer.syncSize(video.videoWidth, video.videoHeight);
  drawCurrent();

  const faceCount = result.faceLandmarks.length;
  metrics.recordFrame({
    inferenceMs: inferenceEnd - frameStart,
    frameMs: performance.now() - frameStart,
    faceFound: faceCount > 0,
  });

  if (frameStart - state.lastUiUpdate >= UI_REFRESH_MS) {
    state.lastUiUpdate = frameStart;
    updateDashboard(result);
  }
}

function drawOptions() {
  const boost = document.body.classList.contains("presentation") || document.body.classList.contains("demo-mode");
  const { landmarks, mesh, contours, labels } = els.layers;
  return {
    landmarks: landmarks.checked, mesh: mesh.checked, contours: contours.checked, labels: labels.checked, boost,
    name: els.nameInput.value.trim(),
  };
}

function drawCurrent() {
  if (!renderer) return;
  renderer.render(state.lastResult?.faceLandmarks, drawOptions(), state.hoverIndex);
}

/* ---------- Dashboard ---------- */

function updateDashboard(result) {
  const faces = result.faceLandmarks;
  const fpsText = metrics.fps ? `${Math.round(metrics.fps)} FPS` : "--";
  const latencyText = `${metrics.inferenceMs.toFixed(1)} ms`;
  const frameText = `${metrics.frameMs.toFixed(1)} ms`;
  const rate = metrics.detectionRate;

  dashboard.set("faces", String(faces.length));
  dashboard.set("fps", fpsText);
  dashboard.set("perfFps", fpsText);
  dashboard.set("latency", latencyText);
  dashboard.set("perfLatency", latencyText);
  dashboard.set("perfFrame", frameText);
  dashboard.set("rate", `${Math.round(rate * 100)}%`);
  dashboard.setMeter("rate", rate);

  if (faces.length === 0) {
    dashboard.setStatus("NO FACE DETECTED", "warn");
    dashboard.set("landmarks", "--");
    dashboard.resetMovement();
    setNotice(MESSAGES.noFace);
    return;
  }

  dashboard.set("landmarks", String(faces[0].length));
  if (faces.length > 1) {
    dashboard.setStatus("MULTIPLE FACES", "warn");
    setNotice(MESSAGES.multiFace);
  } else {
    dashboard.setStatus("FACE DETECTED", "ok");
    setNotice("");
  }
  updateMovement(faces[0], blendshapesToMap(result.faceBlendshapes?.[0]));
}

function updateMovement(landmarks, shapes) {
  const aspect = els.video.videoWidth / els.video.videoHeight;
  const head = computeHead(landmarks, aspect);
  const mouth = computeMouth(landmarks, shapes);
  const eyes = computeEyes(shapes);
  const gaze = computeGaze(landmarks);

  dashboard.set("yaw", head.yaw.label);
  dashboard.set("tilt", `${head.tilt.label} (${Math.round(head.tilt.deg)}°)`);
  dashboard.set("pitch", head.pitch.label);
  dashboard.setMarker("yaw", head.yaw.pos);
  dashboard.setMarker("tilt", head.tilt.pos);
  dashboard.setMarker("pitch", head.pitch.pos);
  dashboard.set("mouth", mouth.open ? "OPEN" : "CLOSED");
  dashboard.set("eyes", eyes.closed ? "CLOSED" : "OPEN");
  dashboard.set("gaze", gaze ? `${gaze.horizontal} · ${gaze.vertical}` : "--");
  dashboard.setExpressions(computeExpressions(shapes));
}

/* ---------- Inspector de landmarks ---------- */

function hideTooltip() {
  els.tooltip.hidden = true;
  state.hoverIndex = -1;
}

function handlePointerMove(event) {
  const landmarks = state.lastResult?.faceLandmarks?.[0];
  if (!landmarks || !renderer) return hideTooltip();

  const rect = els.canvas.getBoundingClientRect();
  const scaleX = els.canvas.width / rect.width;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleX;
  const index = renderer.nearest(landmarks, px, py, 16 * scaleX);

  if (index !== state.hoverIndex) {
    state.hoverIndex = index;
    if (state.paused) drawCurrent();
  }
  if (index < 0) {
    els.tooltip.hidden = true;
    return;
  }
  const { x, y, z } = landmarks[index];
  els.tooltip.textContent = `Landmark #${index}\nX: ${x.toFixed(3)}\nY: ${y.toFixed(3)}\nZ: ${z.toFixed(3)}`;
  els.tooltip.hidden = false;
  const left = Math.min(event.clientX + 16, window.innerWidth - 150);
  els.tooltip.style.left = `${Math.max(8, left)}px`;
  els.tooltip.style.top = `${event.clientY + 16}px`;
}

function toggleInspect() {
  const active = els.inspect.getAttribute("aria-pressed") !== "true";
  els.inspect.setAttribute("aria-pressed", String(active));
  document.body.classList.toggle("inspecting", active);
  if (!active) {
    hideTooltip();
    if (state.paused) drawCurrent();
  }
}

/* ---------- Modos, fullscreen e captura ---------- */

function setMode(button, className, active) {
  button.setAttribute("aria-pressed", String(active));
  document.body.classList.toggle(className, active);
  if (state.paused) drawCurrent();
}

function toggleDemoMode() {
  setMode(els.demo, "demo-mode", els.demo.getAttribute("aria-pressed") !== "true");
}

function setPresentation(active) {
  setMode(els.presentation, "presentation", active);
  if (active) {
    els.stage.scrollIntoView({ block: "center" });
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (document.fullscreenElement) {
    document.exitFullscreen();
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else els.stage.requestFullscreen?.().catch(() => showAlert(MESSAGES.unsupported));
}

function captureFrame() {
  const { videoWidth: w, videoHeight: h } = els.video;
  if (!w) return;
  const shot = document.createElement("canvas");
  shot.width = w;
  shot.height = h;
  const ctx = shot.getContext("2d");
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(els.video, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(els.canvas, 0, 0, w, h);
  shot.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `face-vision-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, "image/png");
}

/* ---------- Tema ---------- */

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("fv-theme"); } catch { /* armazenamento indisponível */ }
  if (saved) document.documentElement.dataset.theme = saved;
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("fv-theme", next); } catch { /* ignorar */ }
}

/* ---------- Inicialização ---------- */

function bindEvents() {
  [$("heroStartBtn"), $("placeholderStartBtn"), els.start].forEach((b) => b.addEventListener("click", handleStart));
  els.stop.addEventListener("click", handleStop);
  els.pause.addEventListener("click", handlePause);
  els.restart.addEventListener("click", handleRestart);
  els.fullscreen.addEventListener("click", toggleFullscreen);
  els.capture.addEventListener("click", captureFrame);
  els.inspect.addEventListener("click", toggleInspect);
  els.demo.addEventListener("click", toggleDemoMode);
  els.presentation.addEventListener("click", () => setPresentation(!document.body.classList.contains("presentation")));
  $("exitPresentationBtn").addEventListener("click", () => setPresentation(false));
  $("alertClose").addEventListener("click", hideAlert);
  $("aboutBtn").addEventListener("click", () => $("aboutDialog").showModal());
  $("themeBtn").addEventListener("click", toggleTheme);

  Object.values(els.layers).forEach((input) => input.addEventListener("change", () => state.paused && drawCurrent()));
  els.nameInput.addEventListener("input", () => state.paused && drawCurrent());
  els.canvas.addEventListener("pointermove", handlePointerMove);
  els.canvas.addEventListener("pointerleave", hideTooltip);

  // Esc sai do fullscreen nativamente; mantém o modo apresentação coerente.
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && document.body.classList.contains("presentation")) setPresentation(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("presentation")) setPresentation(false);
  });
  window.addEventListener("pagehide", () => stopCamera(els.video));
}

function init() {
  initTheme();
  bindEvents();
  dashboard.resetMovement();
  syncButtons();
  setCameraPill();

  const unsupported = checkBrowserSupport();
  if (unsupported) showAlert(unsupported);
  ensureModel();
}

init();
