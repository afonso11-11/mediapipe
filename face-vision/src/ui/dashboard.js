import { EXPRESSIONS } from "../utils/analysis.js";

/** Atualiza o DOM. Só escreve quando o valor muda para evitar reflows desnecessários. */
export class Dashboard {
  constructor(root = document) {
    this.root = root;
    this.text = this.mapBy("[data-bind]", "bind");
    this.widths = this.mapBy("[data-bind-width]", "bindWidth");
    this.positions = this.mapBy("[data-bind-pos]", "bindPos");
    this.hud = this.mapBy("[data-hud]", "hud");
    this.cache = new Map();
    this.bars = this.buildExpressionBars(root.getElementById("expressionBars"));
  }

  mapBy(selector, key) {
    const map = {};
    this.root.querySelectorAll(selector).forEach((el) => { map[el.dataset[key]] = el; });
    return map;
  }

  buildExpressionBars(list) {
    const bars = {};
    for (const { key, label } of EXPRESSIONS) {
      const li = document.createElement("li");
      li.innerHTML = `<div class="bar-head"><span>${label}</span><b>0%</b></div><div class="bar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>`;
      list.appendChild(li);
      bars[key] = { value: li.querySelector("b"), fill: li.querySelector("i"), track: li.querySelector(".bar") };
    }
    return bars;
  }

  set(key, value) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    const el = this.text[key];
    if (el) el.textContent = value;
    const hud = this.hud[key];
    if (hud) hud.textContent = value;
  }

  setStatus(label, state) {
    this.set("status", label);
    this.text.status.dataset.state = state;
    this.hud.status.textContent = label;
  }

  setHud(fps, faces) {
    this.hud.fps.textContent = fps;
    this.hud.faces.textContent = faces;
  }

  setMeter(key, fraction) {
    const el = this.widths[key];
    if (el) el.style.width = `${Math.round(fraction * 100)}%`;
  }

  setMarker(key, fraction) {
    const el = this.positions[key];
    if (el) el.style.left = `${(fraction * 100).toFixed(1)}%`;
  }

  setExpressions(scores) {
    for (const { key } of EXPRESSIONS) {
      const percent = Math.round((scores?.[key] ?? 0) * 100);
      const bar = this.bars[key];
      bar.fill.style.width = `${percent}%`;
      bar.track.setAttribute("aria-valuenow", percent);
      bar.value.textContent = `${percent}%`;
    }
  }

  resetMovement() {
    ["yaw", "tilt", "pitch", "mouth", "eyes", "gaze"].forEach((key) => this.set(key, "--"));
    ["yaw", "tilt", "pitch"].forEach((key) => this.setMarker(key, 0.5));
    this.setExpressions(null);
  }
}

export function setPill(pill, state, label) {
  pill.dataset.state = state;
  pill.lastElementChild.textContent = label;
}
