import type { Caravan, Comment, CommentType, Person } from '../types'
import { randomId } from '../lib/hash'
import type { Store } from './index'

/**
 * Lokaler Fallback-Store (localStorage). Daten liegen nur auf diesem Gerät.
 * Dient dazu, dass die App auch ohne Supabase sofort funktioniert.
 */
interface Db {
  caravans: Caravan[]
  comments: Comment[]
  persons: Person[]
}

const KEY = 'campingnotizen:v1'

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch {
    /* ignore */
  }
  return { caravans: [], comments: [], persons: [] }
}

function save(db: Db): void {
  localStorage.setItem(KEY, JSON.stringify(db))
}

export class LocalStore implements Store {
  readonly shared = false
  constructor(private board: string) {}

  async listCaravans(): Promise<Caravan[]> {
    return load()
      .caravans.filter((c) => c.board === this.board)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async addCaravan(label: string, lat: number, lng: number): Promise<Caravan> {
    const db = load()
    const caravan: Caravan = {
      id: randomId(),
      board: this.board,
      label,
      lat,
      lng,
      createdAt: new Date().toISOString(),
    }
    db.caravans.push(caravan)
    save(db)
    return caravan
  }

  async updateCaravanLabel(id: string, label: string): Promise<void> {
    const db = load()
    const c = db.caravans.find((x) => x.id === id)
    if (c) {
      c.label = label
      save(db)
    }
  }

  async deleteCaravan(id: string): Promise<void> {
    const db = load()
    db.caravans = db.caravans.filter((c) => c.id !== id)
    db.comments = db.comments.filter((c) => c.caravanId !== id)
    db.persons = db.persons.filter((p) => p.caravanId !== id)
    save(db)
  }

  async listComments(caravanId: string): Promise<Comment[]> {
    return load()
      .comments.filter((c) => c.caravanId === caravanId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async addComment(caravanId: string, type: CommentType, text: string, author: string): Promise<Comment> {
    const db = load()
    const comment: Comment = {
      id: randomId(),
      caravanId,
      type,
      text,
      author,
      createdAt: new Date().toISOString(),
    }
    db.comments.push(comment)
    save(db)
    return comment
  }

  async deleteComment(id: string): Promise<void> {
    const db = load()
    db.comments = db.comments.filter((c) => c.id !== id)
    save(db)
  }

  async listPersons(caravanId: string): Promise<Person[]> {
    return load()
      .persons.filter((p) => p.caravanId === caravanId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async addPerson(caravanId: string, name: string, age: number | null, comment: string): Promise<Person> {
    const db = load()
    const person: Person = {
      id: randomId(),
      caravanId,
      name,
      age,
      comment,
      createdAt: new Date().toISOString(),
    }
    db.persons.push(person)
    save(db)
    return person
  }

  async deletePerson(id: string): Promise<void> {
    const db = load()
    db.persons = db.persons.filter((p) => p.id !== id)
    save(db)
  }
}
