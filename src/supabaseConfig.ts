/**
 * Öffentliche Supabase-Verbindung für den GETEILTEN Modus.
 *
 * Hier die zwei Werte aus dem Supabase-Dashboard eintragen
 * (Project Settings → API):
 *   url     = "Project URL"
 *   anonKey = "anon public" Key
 *
 * Der anon-Key ist bewusst öffentlich (Client-Key) und darf hier stehen;
 * der Zugriff wird über RLS und den geteilten Zugangscode geregelt.
 *
 * Solange beide Felder leer sind, läuft die App im lokalen Modus
 * (Daten nur auf diesem Gerät). Alternativ können die Werte auch über
 * die Env-Variablen VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY gesetzt werden.
 */
export const SUPABASE = {
  url: '',
  anonKey: '',
}
