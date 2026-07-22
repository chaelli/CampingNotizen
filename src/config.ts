/**
 * Konfiguration des Campingplatzes. Aktuell fest auf Camping Ruderbaum,
 * Altnau (TG) am Bodensee. Der Bereich (bbox) wird auch von der Erkennung
 * in der GitHub Action verwendet (scripts/detect_caravans.py).
 */
export const CAMPGROUND = {
  name: 'Camping Ruderbaum, Altnau',
  center: [47.6238, 9.2623] as [number, number],
  zoom: 18,
  bbox: {
    minLat: 47.622,
    minLng: 9.2595,
    maxLat: 47.6256,
    maxLng: 9.265,
  },
}

/** Pfad zur vorberechneten Erkennungsdatei (von der Action erzeugt). */
export const DETECTIONS_URL = `${import.meta.env.BASE_URL}detections/ruderbaum.json`
