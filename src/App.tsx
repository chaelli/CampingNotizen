import { useEffect, useMemo, useState } from 'react'
import type { Caravan } from './types'
import { createStore, supabaseConfigured, type Store } from './store'
import { CAMPGROUND } from './config'
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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
  }

  function editAuthor() {
    const name = prompt('Dein Name (erscheint bei deinen Kommentaren):', author)
    if (name != null) {
      const v = name.trim()
      setAuthor(v)
      localStorage.setItem('cn:author', v)
    }
  }

  async function handleMapClick(lat: number, lng: number) {
    if (!store) return
    const name = `Wohnwagen ${caravans.length + 1}`
    try {
      const c = await store.addCaravan(name, lat, lng)
      setCaravans((prev) => [...prev, c])
      setSelectedId(c.id)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  if (!board || !store) {
    return <AccessGate onEnter={enter} />
  }

  const selected = caravans.find((c) => c.id === selectedId) ?? null

  return (
    <div className="app">
      <div className="topbar">
        <h1>⛺ {CAMPGROUND.name}</h1>
        <span className="badge">{supabaseConfigured() ? '🔗 geteilt' : '📱 lokal'}</span>
        <button onClick={editAuthor} title="Name setzen">
          👤 {author || 'Name'}
        </button>
        <button
          className={`primary ${addMode ? 'active' : ''}`}
          onClick={() => setAddMode((v) => !v)}
        >
          {addMode ? '✓ Tippen' : '＋ Wohnwagen'}
        </button>
        <button onClick={leave} title="Platz wechseln">Abmelden</button>
      </div>

      <div className="map-wrap">
        {addMode && <div className="hint">Auf die Karte tippen, um einen Wohnwagen zu setzen</div>}
        {error && (
          <div className="hint" style={{ background: 'rgba(192,57,43,0.9)', pointerEvents: 'auto' }} onClick={() => setError(null)}>
            {error} ✕
          </div>
        )}
        {loading && <div className="hint">Lade Wohnwagen…</div>}

        <MapView
          caravans={caravans}
          selectedId={selectedId}
          addMode={addMode}
          onMapClick={handleMapClick}
          onSelect={setSelectedId}
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
