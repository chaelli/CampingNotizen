import { useEffect, useMemo, useState } from 'react'
import type { Caravan } from './types'
import { createStore, type Store } from './store'
import { CAMPGROUND } from './config'
import { AccessGate } from './components/AccessGate'
import { MapView } from './components/MapView'
import { CaravanPanel } from './components/CaravanPanel'

export function App() {
  // Zugang bleibt dauerhaft gespeichert (localStorage), damit man den Code
  // nicht bei jedem Besuch neu eingeben muss. "Abmelden" löscht ihn wieder.
  const [board, setBoard] = useState<string | null>(
    () => localStorage.getItem('cn:board') ?? sessionStorage.getItem('cn:board'),
  )
  const [author, setAuthor] = useState<string>(() => localStorage.getItem('cn:author') ?? '')

  const store = useMemo<Store | null>(() => (board ? createStore(board) : null), [board])

  const [caravans, setCaravans] = useState<Caravan[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Ein per langem Drücken angelegter Wohnwagen ist "provisorisch": Er wird
  // erst dann behalten, wenn Name geändert / Kommentar / Person hinzukommt.
  // Sonst wird er beim Verlassen wieder gelöscht.
  const [provisionalId, setProvisionalId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(() => localStorage.getItem('cn:hintLongpress') === '1')

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
    localStorage.setItem('cn:board', b)
    localStorage.setItem('cn:code', c)
    setBoard(b)
  }

  function dismissHint() {
    localStorage.setItem('cn:hintLongpress', '1')
    setHintDismissed(true)
  }

  async function discardProvisional() {
    if (!provisionalId || !store) return
    const id = provisionalId
    setProvisionalId(null)
    setCaravans((prev) => prev.filter((c) => c.id !== id))
    if (selectedId === id) setSelectedId(null)
    try {
      await store.deleteCaravan(id)
    } catch {
      /* egal – war nur ein leerer Entwurf */
    }
  }

  async function leave() {
    await discardProvisional()
    localStorage.removeItem('cn:board')
    localStorage.removeItem('cn:code')
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

  async function handleLongPress(lat: number, lng: number) {
    if (!store) return
    if (!hintDismissed) dismissHint()
    await discardProvisional()
    const name = `Wohnwagen ${caravans.length + 1}`
    try {
      const c = await store.addCaravan(name, lat, lng)
      setCaravans((prev) => [...prev, c])
      setProvisionalId(c.id)
      setSelectedId(c.id)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  async function selectCaravan(id: string) {
    if (provisionalId && provisionalId !== id) await discardProvisional()
    setSelectedId(id)
  }

  async function closePanel() {
    if (selectedId && selectedId === provisionalId) {
      await discardProvisional()
    } else {
      setSelectedId(null)
    }
  }

  // Der provisorische Wohnwagen hat "echten" Inhalt bekommen -> behalten.
  function commitProvisional() {
    setProvisionalId(null)
  }

  if (!board || !store) {
    return <AccessGate onEnter={enter} />
  }

  const selected = caravans.find((c) => c.id === selectedId) ?? null

  return (
    <div className="app">
      <div className="topbar">
        <h1>{CAMPGROUND.name}</h1>
        <button onClick={editAuthor} title="Name setzen">
          👤 {author || 'Name'}
        </button>
        <button onClick={leave} title="Platz wechseln">Abmelden</button>
      </div>

      <div className="map-wrap">
        {!hintDismissed && (
          <div className="hint" style={{ pointerEvents: 'auto' }} onClick={dismissHint}>
            Tipp: <b>lange auf die Karte drücken</b>, um einen Wohnwagen hinzuzufügen ✕
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
          selectedId={selectedId}
          onLongPress={handleLongPress}
          onSelect={selectCaravan}
        />

        {selected && (
          <CaravanPanel
            key={selected.id}
            store={store}
            caravan={selected}
            author={author}
            onContentAdded={commitProvisional}
            onClose={closePanel}
            onRenamed={(id, label) => setCaravans((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)))}
            onDeleted={(id) => {
              if (provisionalId === id) setProvisionalId(null)
              setCaravans((prev) => prev.filter((c) => c.id !== id))
              setSelectedId(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
