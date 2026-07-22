export type CommentType = 'fakt' | 'vermutung'

export interface Caravan {
  id: string
  /** SHA-256-Hash des Zugangscodes – trennt die geteilten "Plätze". */
  board: string
  label: string
  lat: number
  lng: number
  createdAt: string
}

export interface Comment {
  id: string
  caravanId: string
  type: CommentType
  text: string
  author: string
  createdAt: string
}

export interface Person {
  id: string
  caravanId: string
  name: string
  /** Jahrgang (Geburtsjahr), z. B. 1985. */
  birthYear: number | null
  comment: string
  createdAt: string
}

/** Ein Wohnwagen samt seiner Kommentare und Personen (für die Detailansicht). */
export interface CaravanDetail extends Caravan {
  comments: Comment[]
  persons: Person[]
}
