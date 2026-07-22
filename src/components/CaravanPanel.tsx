import { useEffect, useState } from 'react'
import type { Caravan, Comment, CommentType, Person } from '../types'
import type { Store } from '../store'

interface Props {
  store: Store
  caravan: Caravan
  author: string
  onClose: () => void
  onRenamed: (id: string, label: string) => void
  onDeleted: (id: string) => void
}

export function CaravanPanel({ store, caravan, author, onClose, onRenamed, onDeleted }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const [label, setLabel] = useState(caravan.label)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([store.listComments(caravan.id), store.listPersons(caravan.id)])
      .then(([c, p]) => {
        if (!active) return
        setComments(c)
        setPersons(p)
      })
      .catch((e) => active && setError(String(e.message ?? e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [store, caravan.id])

  function wrap<T>(p: Promise<T>): Promise<T | undefined> {
    return p.catch((e) => {
      setError(String(e.message ?? e))
      return undefined
    })
  }

  async function saveLabel() {
    const trimmed = label.trim() || caravan.label
    await wrap(store.updateCaravanLabel(caravan.id, trimmed))
    onRenamed(caravan.id, trimmed)
    setEditingLabel(false)
  }

  async function addComment(type: CommentType, text: string) {
    const c = await wrap(store.addComment(caravan.id, type, text, author))
    if (c) setComments((prev) => [...prev, c])
  }
  async function delComment(id: string) {
    await wrap(store.deleteComment(id))
    setComments((prev) => prev.filter((c) => c.id !== id))
  }
  async function addPerson(name: string, birthYear: number | null, comment: string) {
    const p = await wrap(store.addPerson(caravan.id, name, birthYear, comment))
    if (p) setPersons((prev) => [...prev, p])
  }
  async function editPerson(id: string, name: string, birthYear: number | null, comment: string) {
    await wrap(store.updatePerson(id, name, birthYear, comment))
    setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, name, birthYear, comment } : p)))
  }
  async function delPerson(id: string) {
    await wrap(store.deletePerson(id))
    setPersons((prev) => prev.filter((p) => p.id !== id))
  }

  async function deleteCaravan() {
    if (!confirm(`Wohnwagen «${caravan.label}» inkl. aller Notizen löschen?`)) return
    await wrap(store.deleteCaravan(caravan.id))
    onDeleted(caravan.id)
  }

  return (
    <div className="panel">
      <div className="panel-head">
        {editingLabel ? (
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveLabel()} autoFocus />
        ) : (
          <h2 onClick={() => setEditingLabel(true)} title="Zum Umbenennen tippen" style={{ cursor: 'pointer' }}>
            {caravan.label}
          </h2>
        )}
        {editingLabel ? (
          <button className="primary" onClick={saveLabel}>Speichern</button>
        ) : (
          <button onClick={() => setEditingLabel(true)}>✏️</button>
        )}
        <button className="close-x" onClick={onClose} aria-label="Schliessen">×</button>
      </div>

      <div className="panel-body">
        {error && <div className="error">{error}</div>}
        {loading ? (
          <p className="empty">Lade…</p>
        ) : (
          <>
            <h3>Kommentare</h3>
            <CommentForm onAdd={addComment} />
            {comments.length === 0 && <p className="empty">Noch keine Kommentare.</p>}
            {comments.map((c) => (
              <div className="item" key={c.id}>
                <button className="del" onClick={() => delComment(c.id)} aria-label="Löschen">🗑</button>
                <span className={`tag ${c.type}`}>{c.type === 'fakt' ? 'Fakt' : 'Vermutung'}</span>
                <p>{c.text}</p>
                <div className="meta">
                  {c.author ? `${c.author} · ` : ''}
                  {formatDate(c.createdAt)}
                </div>
              </div>
            ))}

            <h3>Personen</h3>
            <PersonForm onAdd={addPerson} />
            {persons.length === 0 && <p className="empty">Noch keine Personen erfasst.</p>}
            {persons.map((p) => (
              <PersonItem key={p.id} person={p} onSave={editPerson} onDelete={delPerson} />
            ))}

            <h3>Wohnwagen</h3>
            <button style={{ color: 'var(--danger)' }} onClick={deleteCaravan}>
              Diesen Wohnwagen löschen
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CommentForm({ onAdd }: { onAdd: (type: CommentType, text: string) => void }) {
  const [type, setType] = useState<CommentType>('fakt')
  const [text, setText] = useState('')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onAdd(type, t)
    setText('')
  }
  return (
    <form className="form" onSubmit={submit}>
      <div className="type-toggle">
        <button type="button" className={`fakt ${type === 'fakt' ? 'sel' : ''}`} onClick={() => setType('fakt')}>
          Fakt
        </button>
        <button type="button" className={`vermutung ${type === 'vermutung' ? 'sel' : ''}`} onClick={() => setType('vermutung')}>
          Vermutung
        </button>
      </div>
      <textarea rows={2} placeholder="Kommentar…" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="primary" type="submit" disabled={!text.trim()}>
        Kommentar hinzufügen
      </button>
    </form>
  )
}

function PersonForm({ onAdd }: { onAdd: (name: string, birthYear: number | null, comment: string) => void }) {
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [comment, setComment] = useState('')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    const parsed = birthYear.trim() === '' ? null : Number(birthYear)
    const year = parsed != null && Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null
    onAdd(n, year, comment.trim())
    setName('')
    setBirthYear('')
    setComment('')
  }
  return (
    <form className="form" onSubmit={submit}>
      <div className="row">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          style={{ maxWidth: 110 }}
          type="number"
          min={1900}
          max={2100}
          placeholder="Jahrgang"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
        />
      </div>
      <textarea rows={2} placeholder="Kommentar zur Person…" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="primary" type="submit" disabled={!name.trim()}>
        Person hinzufügen
      </button>
    </form>
  )
}

function PersonItem({
  person,
  onSave,
  onDelete,
}: {
  person: Person
  onSave: (id: string, name: string, birthYear: number | null, comment: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(person.name)
  const [birthYear, setBirthYear] = useState(person.birthYear != null ? String(person.birthYear) : '')
  const [comment, setComment] = useState(person.comment)

  function save() {
    const n = name.trim()
    if (!n) return
    const parsed = birthYear.trim() === '' ? null : Number(birthYear)
    const year = parsed != null && Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null
    onSave(person.id, n, year, comment.trim())
    setEditing(false)
  }

  function cancel() {
    setName(person.name)
    setBirthYear(person.birthYear != null ? String(person.birthYear) : '')
    setComment(person.comment)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="item">
        <div className="form">
          <div className="row">
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <input
              style={{ maxWidth: 110 }}
              type="number"
              min={1900}
              max={2100}
              placeholder="Jahrgang"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </div>
          <textarea rows={2} placeholder="Kommentar zur Person…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="row">
            <button className="primary" onClick={save} disabled={!name.trim()}>Speichern</button>
            <button onClick={cancel}>Abbrechen</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="item">
      <button className="del" onClick={() => setEditing(true)} aria-label="Bearbeiten" style={{ right: 34 }}>✏️</button>
      <button className="del" onClick={() => onDelete(person.id)} aria-label="Löschen">🗑</button>
      <div>
        <span className="person-name">{person.name}</span>
        {person.birthYear != null && <span className="meta"> · Jg. {person.birthYear}</span>}
      </div>
      {person.comment && <p>{person.comment}</p>}
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}
