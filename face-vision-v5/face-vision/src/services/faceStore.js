import { SIGNATURE_LENGTH, signatureDistance } from "../utils/signature.js";

const STORAGE_KEY = "fv-face-registry";
const FORMAT_VERSION = 1;

/**
 * Banco de rostos em JSON, guardado só no navegador (localStorage).
 * Formato: { version, people: [{ id, name, createdAt, consent, samples, signature }] }
 */
export class FaceStore {
  constructor() {
    this.people = this.load();
  }

  get count() {
    return this.people.length;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? this.validate(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJson()));
      return true;
    } catch {
      return false;
    }
  }

  toJson() {
    return { version: FORMAT_VERSION, people: this.people };
  }

  /** Aceita só registros bem formados e com consentimento registrado. */
  validate(data) {
    if (data?.version !== FORMAT_VERSION || !Array.isArray(data.people)) throw new Error("Formato de JSON inválido.");
    return data.people
      .filter((p) => typeof p.name === "string" && p.consent === true
        && Array.isArray(p.signature) && p.signature.length === SIGNATURE_LENGTH
        && p.signature.every(Number.isFinite))
      .map((p) => ({
        id: String(p.id ?? crypto.randomUUID()),
        name: p.name.slice(0, 40),
        createdAt: p.createdAt ?? new Date().toISOString(),
        consent: true,
        samples: Number.isFinite(p.samples) ? p.samples : 1,
        signature: p.signature,
      }));
  }

  add(name, signature, samples) {
    const person = {
      id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), consent: true, samples, signature,
    };
    this.people.push(person);
    return this.persist();
  }

  remove(id) {
    this.people = this.people.filter((p) => p.id !== id);
    this.persist();
  }

  clear() {
    this.people = [];
    this.persist();
  }

  /** Junta pessoas de um JSON importado; devolve quantas foram adicionadas. */
  importJson(text) {
    const incoming = this.validate(JSON.parse(text));
    const known = new Set(this.people.map((p) => p.id));
    const fresh = incoming.filter((p) => !known.has(p.id));
    this.people.push(...fresh);
    this.persist();
    return fresh.length;
  }

  nearest(signature) {
    let best = null;
    for (const person of this.people) {
      const distance = signatureDistance(signature, person.signature);
      if (!best || distance < best.distance) best = { person, distance };
    }
    return best;
  }
}
