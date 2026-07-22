/**
 * SHA-256-Hash eines Strings als Hex.
 * Wird genutzt, um aus dem Zugangscode eine "Platz"-Kennung zu machen,
 * ohne den Klartext-Code in der Datenbank zu speichern.
 */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Zufällige ID für lokal erzeugte Datensätze. */
export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
