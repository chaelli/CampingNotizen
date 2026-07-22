import type { Caravan, Comment, CommentType, Person } from '../types'
import { LocalStore } from './local'
import { SupabaseStore, supabaseConfigured } from './supabase'

/**
 * Gemeinsame Schnittstelle für die Datenhaltung. Alle Methoden arbeiten
 * innerhalb eines "Boards" (= Hash des Zugangscodes), das dem Konstruktor
 * übergeben wird.
 */
export interface Store {
  readonly shared: boolean

  listCaravans(): Promise<Caravan[]>
  addCaravan(label: string, lat: number, lng: number): Promise<Caravan>
  updateCaravanLabel(id: string, label: string): Promise<void>
  deleteCaravan(id: string): Promise<void>

  listComments(caravanId: string): Promise<Comment[]>
  addComment(caravanId: string, type: CommentType, text: string, author: string): Promise<Comment>
  deleteComment(id: string): Promise<void>

  listPersons(caravanId: string): Promise<Person[]>
  addPerson(caravanId: string, name: string, age: number | null, comment: string): Promise<Person>
  deletePerson(id: string): Promise<void>
}

/** Wählt je nach Konfiguration den geteilten (Supabase) oder lokalen Store. */
export function createStore(board: string): Store {
  return supabaseConfigured() ? new SupabaseStore(board) : new LocalStore(board)
}

export { supabaseConfigured }
