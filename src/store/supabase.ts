import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Caravan, Comment, CommentType, Person } from '../types'
import type { Store } from './index'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

export function supabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(url as string, anonKey as string)
  }
  return client
}

// DB-Zeilen (snake_case) <-> App-Objekte (camelCase)
interface CaravanRow {
  id: string
  board: string
  label: string
  lat: number
  lng: number
  created_at: string
}
interface CommentRow {
  id: string
  caravan_id: string
  type: CommentType
  text: string
  author: string
  created_at: string
}
interface PersonRow {
  id: string
  caravan_id: string
  name: string
  age: number | null
  comment: string
  created_at: string
}

const toCaravan = (r: CaravanRow): Caravan => ({
  id: r.id,
  board: r.board,
  label: r.label,
  lat: r.lat,
  lng: r.lng,
  createdAt: r.created_at,
})
const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  caravanId: r.caravan_id,
  type: r.type,
  text: r.text,
  author: r.author,
  createdAt: r.created_at,
})
const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  caravanId: r.caravan_id,
  name: r.name,
  age: r.age,
  comment: r.comment,
  createdAt: r.created_at,
})

function fail(msg: string, error: unknown): never {
  console.error(msg, error)
  throw new Error(`${msg}: ${(error as { message?: string })?.message ?? 'unbekannter Fehler'}`)
}

/** Geteilter Store über Supabase (Postgres). Scope pro "board". */
export class SupabaseStore implements Store {
  readonly shared = true
  constructor(private board: string) {}

  async listCaravans(): Promise<Caravan[]> {
    const { data, error } = await getClient()
      .from('caravans')
      .select('*')
      .eq('board', this.board)
      .order('created_at', { ascending: true })
    if (error) fail('Wohnwagen laden fehlgeschlagen', error)
    return (data as CaravanRow[]).map(toCaravan)
  }

  async addCaravan(label: string, lat: number, lng: number): Promise<Caravan> {
    const { data, error } = await getClient()
      .from('caravans')
      .insert({ board: this.board, label, lat, lng })
      .select()
      .single()
    if (error) fail('Wohnwagen speichern fehlgeschlagen', error)
    return toCaravan(data as CaravanRow)
  }

  async updateCaravanLabel(id: string, label: string): Promise<void> {
    const { error } = await getClient().from('caravans').update({ label }).eq('id', id).eq('board', this.board)
    if (error) fail('Wohnwagen umbenennen fehlgeschlagen', error)
  }

  async deleteCaravan(id: string): Promise<void> {
    const { error } = await getClient().from('caravans').delete().eq('id', id).eq('board', this.board)
    if (error) fail('Wohnwagen löschen fehlgeschlagen', error)
  }

  async listComments(caravanId: string): Promise<Comment[]> {
    const { data, error } = await getClient()
      .from('comments')
      .select('*')
      .eq('caravan_id', caravanId)
      .order('created_at', { ascending: true })
    if (error) fail('Kommentare laden fehlgeschlagen', error)
    return (data as CommentRow[]).map(toComment)
  }

  async addComment(caravanId: string, type: CommentType, text: string, author: string): Promise<Comment> {
    const { data, error } = await getClient()
      .from('comments')
      .insert({ caravan_id: caravanId, type, text, author })
      .select()
      .single()
    if (error) fail('Kommentar speichern fehlgeschlagen', error)
    return toComment(data as CommentRow)
  }

  async deleteComment(id: string): Promise<void> {
    const { error } = await getClient().from('comments').delete().eq('id', id)
    if (error) fail('Kommentar löschen fehlgeschlagen', error)
  }

  async listPersons(caravanId: string): Promise<Person[]> {
    const { data, error } = await getClient()
      .from('persons')
      .select('*')
      .eq('caravan_id', caravanId)
      .order('created_at', { ascending: true })
    if (error) fail('Personen laden fehlgeschlagen', error)
    return (data as PersonRow[]).map(toPerson)
  }

  async addPerson(caravanId: string, name: string, age: number | null, comment: string): Promise<Person> {
    const { data, error } = await getClient()
      .from('persons')
      .insert({ caravan_id: caravanId, name, age, comment })
      .select()
      .single()
    if (error) fail('Person speichern fehlgeschlagen', error)
    return toPerson(data as PersonRow)
  }

  async deletePerson(id: string): Promise<void> {
    const { error } = await getClient().from('persons').delete().eq('id', id)
    if (error) fail('Person löschen fehlgeschlagen', error)
  }
}
