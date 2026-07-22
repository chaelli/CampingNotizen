import { useState } from 'react'
import { sha256 } from '../lib/hash'
import { supabaseConfigured } from '../store'

interface Props {
  onEnter: (board: string, code: string) => void
}

/**
 * Zugang per gemeinsamem Code. Der Code wird gehasht und dient als "Platz"-ID –
 * wer denselben Code eingibt, sieht dieselben Daten. Der Klartext-Code verlässt
 * das Gerät nie.
 */
export function AccessGate({ onEnter }: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const shared = supabaseConfigured()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length < 3) return
    setBusy(true)
    const board = await sha256(trimmed)
    onEnter(board, trimmed)
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <h1>⛺ CampingNotizen</h1>
        <p>
          Gib den gemeinsamen Zugangscode für euren Campingplatz ein. Alle mit
          demselben Code sehen und bearbeiten dieselben Notizen.
        </p>
        <form className="form" onSubmit={submit}>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="none"
            placeholder="Zugangscode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <button className="primary" type="submit" disabled={code.trim().length < 3 || busy}>
            {busy ? 'Öffne…' : 'Platz öffnen'}
          </button>
        </form>
        <div className="mode">
          {shared
            ? '🔗 Geteilter Modus (Supabase) – Notizen sind für alle mit dem Code sichtbar.'
            : '📱 Lokaler Modus – Daten bleiben nur auf diesem Gerät. Für echtes Teilen Supabase konfigurieren (siehe README).'}
        </div>
      </div>
    </div>
  )
}
