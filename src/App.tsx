import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type L from 'leaflet'
import type { Caravan, DetectionCandidate } from './types'
import { createStore, supabaseConfigured, type Store } from './store'
import { detectCaravans } from './lib/detect'
import { AccessGate } from './components/AccessGate'
import { MapView } from './components/MapView'
import { CaravanPanel } from './components/CaravanPanel'

export function App() {
  const [board, setBoard] = useState<string | null>(() => sessionStorage.getItem('cn:board'))
  const [author, setAuthor] = useState<string>(() => localStorage.getItem('cn:author') ?? '')

  const store = useMemo<Store | null>(() => (board ? createStore(board) : null), [board])

  const [caravans, setCaravans] = useState<Caravan[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [candidates, setCandidates] = useState<DetectionCandidate[]>([])
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const boundsGetter = useRef<() => L.LatLngBounds>(() => {
    throw new Error('Karte nicht bereit')
  })
  const setBoundsGetter = useCallback((getter: () => L.LatLngBounds) => {
    boundsGetter.current = getter
  }, [])

  // Wohnwagen laden, sobald ein Store existiert.
  useEffect(() => {
    if (!store) return
    let active = true
    setLoading(true)
    setError(null)
    store
      .listCaravans()
      .then((list) => active && setCaravans(list))
      .catch((e) => active && setError(String(e.message ?? e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [store])

  function enter(b: string, c: string) {
    sessionStorage.setItem('cn:board', b)
    sessionStorage.setItem('cn:code', c)
    setBoard(b)
  }

  function leave() {
    sessionStorage.removeItem('cn:board')
    sessionStorage.removeItem('cn:code')
    setBoard(null)
    setCaravans([])
    setSelectedId(null)
    setCandidates([])
  }

  function editAuthor() {
    const name = prompt('Dein Name (erscheint bei deinen Kommentaren):', author)
    if (name != null) {
      const v = name.trim()
      setAuthor(v)
      localStorage.setItem('cn:author', v)
    }
  }

  async function addCaravanAt(lat: number, lng: number, label?: string) {
    if (!store) return
    const name = label ?? `Wohnwagen ${caravans.length + 1}`
    try {
      const c = await store.addCaravan(name, lat, lng)
      setCaravans((prev) => [...prev, c])
      return c
    } catch (e) {
      setError(String((e as Error).message ?? e))
      return undefined
    }
  }

  async function handleMapClick(lat: number, lng: number) {
    const c = await addCaravanAt(lat, lng)
    if (c) setSelectedId(c.id)
  }

  async function addCandidate(cand: DetectionCandidate) {
    const c = await addCaravanAt(cand.lat, cand.lng)
    if (c) {
      setCandidates((prev) => prev.filter((x) => x !== cand))
    }
  }

  async function runDetection() {
    setDetecting(true)
    setError(null)
    try {
      const b = boundsGetter.current()
      const found = await detectCaravans({
        minLat: b.getSouth(),
        minLng: b.getWest(),
        maxLat: b.getNorth(),
        maxLng: b.getEast(),
      })
      setCandidates(found)
      if (found.length === 0) {
        setError('Keine wohnwagenähnlichen Formen gefunden. Näher heranzoomen und erneut versuchen.')
      }
    } catch (e) {
      setError('Erkennung fehlgeschlagen: ' + String((e as Error).message ?? e))
    } finally {
      setDetecting(false)
    }
  }

  if (!board || !store) {
    return <AccessGate onEnter={enter} />
  }

  const selected = caravans.find((c) => c.id === selectedId) ?? null

  return (
    <div className="app">
      <div className="topbar">
        <h1>⛺ CampingNotizen</h1>
        <span className="badge">{supabaseConfigured() ? '🔗 geteilt' : '📱 lokal'}</span>
        <button onClick={editAuthor} title="Name setzen">
          👤 {author || 'Name'}
        </button>
        <button
          className={`primary ${addMode ? 'active' : ''}`}
          onClick={() => {
            setAddMode((v) => !v)
            setCandidates([])
          }}
        >
          {addMode ? '✓ Tippen' : '＋ Wohnwagen'}
        </button>
        <button onClick={runDetection} disabled={detecting} title="Wohnwagen im Ausschnitt vorschlagen">
          {detecting ? <span className="spinner" /> : '🔍 Erkennen'}
        </button>
        <button onClick={leave} title="Platz wechseln">Abmelden</button>
      </div>

      <div className="map-wrap">
        {addMode && <div className="hint">Auf die Karte tippen, um einen Wohnwagen zu setzen</div>}
        {!addMode && candidates.length > 0 && (
          <div className="hint">
            {candidates.length} Vorschläge (gelb gestrichelt) – zum Übernehmen antippen ·{' '}
            <span style={{ textDecoration: 'underline', pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setCandidates([])}>
              verwerfen
            </span>
          </div>
        )}
        {error && (
          <div className="hint" style={{ background: 'rgba(192,57,43,0.9)', pointerEvents: 'auto' }} onClick={() => setError(null)}>
            {error} ✕
          </div>
        )}
        {loading && <div className="hint">Lade Wohnwagen…</div>}

        <MapView
          caravans={caravans}
          candidates={candidates}
          selectedId={selectedId}
          addMode={addMode}
          onMapClick={handleMapClick}
          onSelect={setSelectedId}
          onAddCandidate={addCandidate}
          onBoundsRef={setBoundsGetter}
        />

        {selected && (
          <CaravanPanel
            key={selected.id}
            store={store}
            caravan={selected}
            author={author}
            onClose={() => setSelectedId(null)}
            onRenamed={(id, label) => setCaravans((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)))}
            onDeleted={(id) => {
              setCaravans((prev) => prev.filter((c) => c.id !== id))
              setSelectedId(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
