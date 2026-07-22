/**
 * Öffentliche Supabase-Verbindung für den GETEILTEN Modus.
 *
 * Nur der ÖFFENTLICHE anon-Key gehört hierher (Client-Key). Der geheime
 * service_role-Key darf NIEMALS hier oder sonst im Frontend/Repo stehen.
 * Der Zugriff wird über RLS und den geteilten Zugangscode geregelt.
 *
 * Env-Variablen (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) haben Vorrang.
 */
export const SUPABASE = {
  url: 'https://qiwljrvghsuyvdobvlxh.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpd2xqcnZnaHN1eXZkb2J2bHhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTA3MDgsImV4cCI6MjEwMDI4NjcwOH0.fee9kxPG3r6mqBEZSKlyq3quHGlnWnZgIKs2m8jUvsA',
}
