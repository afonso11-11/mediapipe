import { averageSignatures, faceSignature } from "../utils/signature.js";

const SAMPLES_NEEDED = 12;
const SAMPLE_INTERVAL_MS = 120;

/** Painel "Faces cadastradas": cadastro com consentimento, lista, exportar/importar JSON. */
export class Registry {
  constructor(store, { isCameraOn }) {
    this.store = store;
    this.isCameraOn = isCameraOn;
    this.enrolling = null;
    const $ = (id) => document.getElementById(id);
    this.el = {
      name: $("regName"), consent: $("regConsent"), enroll: $("regEnrollBtn"), message: $("regMessage"),
      list: $("regList"), toggle: $("regRecognize"), threshold: $("regThreshold"), thresholdValue: $("regThresholdValue"),
      export: $("regExportBtn"), import: $("regImportBtn"), file: $("regFile"), clear: $("regClearBtn"),
    };
    this.bind();
    this.render();
  }

  get recognitionOn() {
    return this.el.toggle.checked && this.store.count > 0;
  }

  get threshold() {
    return Number(this.el.threshold.value);
  }

  bind() {
    const { el } = this;
    el.enroll.addEventListener("click", () => this.startEnroll());
    el.toggle.addEventListener("change", () => this.setMessage(el.toggle.checked && !this.store.count ? "Cadastre ao menos uma pessoa para reconhecer." : ""));
    el.threshold.addEventListener("input", () => { el.thresholdValue.textContent = this.threshold.toFixed(3); });
    el.export.addEventListener("click", () => this.exportJson());
    el.import.addEventListener("click", () => el.file.click());
    el.file.addEventListener("change", () => this.importFile());
    el.clear.addEventListener("click", () => this.clearAll());
    el.list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button) return;
      this.store.remove(button.dataset.remove);
      this.render();
    });
  }

  setMessage(text) {
    this.el.message.textContent = text;
  }

  startEnroll() {
    const name = this.el.name.value.trim();
    if (!name) return this.setMessage("Digite o nome da pessoa.");
    if (!this.el.consent.checked) return this.setMessage("Marque a confirmação de que a pessoa autorizou o cadastro.");
    if (!this.isCameraOn()) return this.setMessage("Inicie a câmera antes de cadastrar.");
    this.enrolling = { name, samples: [], lastAt: 0 };
    this.el.enroll.disabled = true;
    this.setMessage("Olhe para a câmera, de frente, e mantenha o rosto parado… 0%");
  }

  /** Chamado a cada frame processado enquanto há um cadastro em andamento. */
  feed(faces, aspect) {
    const job = this.enrolling;
    if (!job) return;
    if (faces.length !== 1) {
      this.setMessage(faces.length ? "Apenas uma pessoa pode aparecer durante o cadastro." : "Nenhum rosto detectado. Aguardando…");
      return;
    }
    const now = performance.now();
    if (now - job.lastAt < SAMPLE_INTERVAL_MS) return;
    job.lastAt = now;
    job.samples.push(faceSignature(faces[0], aspect));
    this.setMessage(`Olhe para a câmera, de frente, e mantenha o rosto parado… ${Math.round((job.samples.length / SAMPLES_NEEDED) * 100)}%`);
    if (job.samples.length >= SAMPLES_NEEDED) this.finishEnroll();
  }

  finishEnroll() {
    const { name, samples } = this.enrolling;
    const saved = this.store.add(name, averageSignatures(samples), samples.length);
    this.enrolling = null;
    this.el.enroll.disabled = false;
    this.el.name.value = "";
    this.el.consent.checked = false;
    this.setMessage(saved ? `“${name}” cadastrado(a).` : `“${name}” cadastrado(a) só nesta sessão (o navegador não permitiu salvar). Use Exportar JSON.`);
    this.render();
  }

  /** @returns {{name: string, distance: number, matched: boolean} | null} */
  recognize(landmarks, aspect) {
    if (!this.recognitionOn) return null;
    const best = this.store.nearest(faceSignature(landmarks, aspect));
    if (!best) return null;
    return { name: best.person.name, distance: best.distance, matched: best.distance <= this.threshold };
  }

  exportJson() {
    if (!this.store.count) return this.setMessage("Não há rostos cadastrados para exportar.");
    const blob = new Blob([JSON.stringify(this.store.toJson(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "faces-cadastradas.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async importFile() {
    const file = this.el.file.files[0];
    this.el.file.value = "";
    if (!file) return;
    try {
      const added = this.store.importJson(await file.text());
      this.setMessage(`${added} cadastro(s) importado(s).`);
      this.render();
    } catch {
      this.setMessage("Não foi possível importar: JSON inválido ou sem consentimento registrado.");
    }
  }

  clearAll() {
    if (!this.store.count) return;
    if (this.el.clear.dataset.armed !== "1") {
      this.el.clear.dataset.armed = "1";
      this.el.clear.textContent = "CONFIRMAR APAGAR TUDO";
      setTimeout(() => { this.el.clear.dataset.armed = ""; this.el.clear.textContent = "APAGAR TUDO"; }, 4000);
      return;
    }
    this.el.clear.dataset.armed = "";
    this.el.clear.textContent = "APAGAR TUDO";
    this.store.clear();
    this.setMessage("Todos os cadastros foram apagados.");
    this.render();
  }

  render() {
    const { list } = this.el;
    list.replaceChildren();
    if (!this.store.count) {
      const empty = document.createElement("li");
      empty.className = "reg-empty";
      empty.textContent = "Nenhuma pessoa cadastrada.";
      list.appendChild(empty);
      return;
    }
    for (const person of this.store.people) {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = `${person.name} · ${new Date(person.createdAt).toLocaleDateString("pt-BR")}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-outline btn-sm";
      remove.dataset.remove = person.id;
      remove.textContent = "Remover";
      remove.setAttribute("aria-label", `Remover cadastro de ${person.name}`);
      li.append(name, remove);
      list.appendChild(li);
    }
  }
}
