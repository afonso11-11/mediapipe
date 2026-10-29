import { SIGNATURE_LENGTH, signatureDistance } from "../utils/signature.js";

const STORAGE_KEY = "fv-face-registry";
const FORMAT_VERSION = 1;

/**
 * Banco de rostos. A lista fica em memória (comparação rápida a cada frame) e é
 * persistida no Supabase quando há usuário logado, ou no localStorage caso contrário.
 * Formato JSON: { version, people: [{ id, name, createdAt, consent, samples, signature }] }
 */
export class FaceStore {
  constructor() {
    this.remote = null;
    this.people = this.loadLocal();
  }

  get count() {
    return this.people.length;
  }

  get usingRemote() {
    return this.remote !== null;
  }

  /** Passa a usar o Supabase (carrega os cadastros do usuário logado). */
  async attachRemote(remote) {
    this.people = await remote.list();
    this.remote = remote;
  }

  detachRemote() {
    this.remote = null;
    this.people = this.loadLocal();
  }

  loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? this.validate(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  persistLocal() {
    if (this.remote) return true;
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

  async add(name, signature, samples) {
    let person = {
      id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), consent: true, samples, signature,
    };
    if (this.remote) person = await this.remote.insert(person);
    this.people.push(person);
    return this.persistLocal();
  }

  async remove(id) {
    if (this.remote) await this.remote.remove(id);
    this.people = this.people.filter((p) => p.id !== id);
    this.persistLocal();
  }

  async clear() {
    if (this.remote) await this.remote.clear();
    this.people = [];
    this.persistLocal();
  }

  /** Junta pessoas de um JSON importado; devolve quantas foram adicionadas. */
  async importJson(text) {
    const incoming = this.validate(JSON.parse(text));
    const known = new Set(this.people.map((p) => p.id));
    let added = 0;
    for (const person of incoming) {
      if (known.has(person.id)) continue;
      this.people.push(this.remote ? await this.remote.insert(person) : person);
      added++;
    }
    this.persistLocal();
    return added;
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
