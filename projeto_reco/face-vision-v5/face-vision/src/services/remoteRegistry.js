import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../supabaseConfig.js";

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const TABLE = "face_registry";

export const supabaseConfigured = /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20
  && !SUPABASE_ANON_KEY.startsWith("COLE_");

let clientPromise = null;
function getClient() {
  clientPromise ??= import(SUPABASE_JS).then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return clientPromise;
}

function toPerson(row) {
  return {
    id: row.id, name: row.name, createdAt: row.created_at, consent: row.consent,
    samples: row.samples, signature: row.signature,
  };
}

/** Acesso à tabela face_registry (RLS: cada usuário vê só os próprios cadastros). */
export const remoteRegistry = {
  async currentUser() {
    const client = await getClient();
    const { data } = await client.auth.getSession();
    return data.session?.user ?? null;
  },

  async signIn(email, password) {
    const client = await getClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  /** @returns {Promise<boolean>} true se já entrou; false se precisa confirmar o e-mail */
  async signUp(email, password) {
    const client = await getClient();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return data.session !== null;
  },

  async signOut() {
    const client = await getClient();
    await client.auth.signOut();
  },

  async list() {
    const client = await getClient();
    const { data, error } = await client.from(TABLE).select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toPerson);
  },

  async insert(person) {
    const client = await getClient();
    const { data, error } = await client.from(TABLE).insert({
      name: person.name, signature: person.signature, samples: person.samples,
      consent: true, consent_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return toPerson(data);
  },

  async remove(id) {
    const client = await getClient();
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },

  async clear() {
    const client = await getClient();
    const { error } = await client.from(TABLE).delete().not("id", "is", null);
    if (error) throw error;
  },
};
