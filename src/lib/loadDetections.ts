import type { DetectionCandidate } from '../types'
import { DETECTIONS_URL } from '../config'

interface DetectionFile {
  generatedAt?: string
  count?: number
  candidates: DetectionCandidate[]
}

export interface DetectionResult {
  candidates: DetectionCandidate[]
  generatedAt: string | null
}

/**
 * Lädt die vorberechneten Erkennungs-Vorschläge, die die GitHub Action
 * (scripts/detect_caravans.py) beim Deploy erzeugt und in
 * public/detections/ruderbaum.json ablegt.
 */
export async function loadDetections(): Promise<DetectionResult> {
  const res = await fetch(DETECTIONS_URL, { cache: 'no-store' })
  if (res.status === 404) {
    throw new Error(
      'Noch keine Erkennung vorhanden. Sie wird beim nächsten Deploy in der GitHub Action erzeugt.',
    )
  }
  if (!res.ok) {
    throw new Error(`Erkennung konnte nicht geladen werden (HTTP ${res.status}).`)
  }
  const data = (await res.json()) as DetectionFile
  return {
    candidates: Array.isArray(data.candidates) ? data.candidates : [],
    generatedAt: data.generatedAt ?? null,
  }
}
