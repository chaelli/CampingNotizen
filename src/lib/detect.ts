import type { DetectionCandidate } from '../types'

/**
 * Assistierte Wohnwagen-Erkennung.
 *
 * Ehrlich eingeordnet: Das ist KEINE perfekte KI-Erkennung. Wir holen für den
 * aktuellen Kartenausschnitt ein Luftbild (ESRI World Imagery) und suchen darin
 * mit klassischer Bildverarbeitung (OpenCV.js) rechteckige, wohnwagengrosse
 * Formen. Das Ergebnis sind VORSCHLÄGE, die die Nutzerin bestätigt oder verwirft.
 */

// OpenCV.js wird bei Bedarf vom CDN geladen (~8 MB), nicht im App-Bundle.
const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js'

declare global {
  interface Window {
    cv?: any
  }
}

let cvPromise: Promise<any> | null = null

function loadOpenCv(): Promise<any> {
  if (cvPromise) return cvPromise
  cvPromise = new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) {
      resolve(window.cv)
      return
    }
    const script = document.createElement('script')
    script.src = OPENCV_URL
    script.async = true
    script.onerror = () => reject(new Error('OpenCV.js konnte nicht geladen werden.'))
    script.onload = async () => {
      try {
        let cv = window.cv
        if (cv instanceof Promise) cv = await cv
        if (cv && cv.Mat) {
          window.cv = cv
          resolve(cv)
          return
        }
        // Warten bis die WASM-Runtime bereit ist.
        const timeout = setTimeout(() => reject(new Error('OpenCV.js Timeout')), 30000)
        cv.onRuntimeInitialized = () => {
          clearTimeout(timeout)
          window.cv = cv
          resolve(cv)
        }
      } catch (e) {
        reject(e as Error)
      }
    }
    document.body.appendChild(script)
  })
  return cvPromise
}

export interface Bounds {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

/** Lädt ein Luftbild (JPG) für den bbox über den ArcGIS-Export-Endpoint. */
function loadAerialImage(bounds: Bounds, width: number, height: number): Promise<HTMLImageElement> {
  const { minLng, minLat, maxLng, maxLat } = bounds
  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`
  const url =
    `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=jpg&transparent=false&f=image`
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Luftbild konnte nicht geladen werden.'))
    img.src = url
  })
}

const EARTH_M_PER_DEG_LAT = 111320

/**
 * Sucht wohnwagenähnliche Rechtecke im aktuellen Ausschnitt.
 * Gibt Kandidaten in Lat/Lng zurück.
 */
export async function detectCaravans(bounds: Bounds): Promise<DetectionCandidate[]> {
  const cv = await loadOpenCv()

  // Bildgrösse an bbox-Seitenverhältnis anpassen (max ~1024 px lange Seite).
  const degW = bounds.maxLng - bounds.minLng
  const degH = bounds.maxLat - bounds.minLat
  const aspect = degW / degH
  let width = 1024
  let height = Math.round(width / aspect)
  if (height > 1024) {
    height = 1024
    width = Math.round(height * aspect)
  }

  const img = await loadAerialImage(bounds, width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  ctx.drawImage(img, 0, 0, width, height)

  const src = cv.imread(canvas)
  const gray = new cv.Mat()
  const edges = new cv.Mat()
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  const midLat = (bounds.minLat + bounds.maxLat) / 2
  const mPerDegLng = EARTH_M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180)
  const mPerPxX = (degW * mPerDegLng) / width
  const mPerPxY = (degH * EARTH_M_PER_DEG_LAT) / height

  const candidates: DetectionCandidate[] = []

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0)
    cv.Canny(gray, edges, 40, 120)
    // Kanten schliessen, damit Dächer zu geschlossenen Konturen werden.
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 2)
    cv.erode(edges, edges, kernel, new cv.Point(-1, -1), 1)

    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i)
      const area = cv.contourArea(cnt)
      if (area < 40) {
        cnt.delete()
        continue
      }
      const rect = cv.minAreaRect(cnt)
      const w = rect.size.width
      const h = rect.size.height
      const longPx = Math.max(w, h)
      const shortPx = Math.min(w, h)
      if (shortPx < 1) {
        cnt.delete()
        continue
      }

      // Rechteckigkeit: Konturfläche im Verhältnis zur Rechteckfläche.
      const rectArea = w * h
      const rectangularity = rectArea > 0 ? area / rectArea : 0

      // Reale Grösse abschätzen (grob, Pixel sind je Achse verschieden skaliert).
      const lengthM = longPx * ((mPerPxX + mPerPxY) / 2)
      const widthM = shortPx * ((mPerPxX + mPerPxY) / 2)
      const ratio = longPx / shortPx

      const looksLikeCaravan =
        rectangularity > 0.55 &&
        lengthM >= 3 &&
        lengthM <= 13 &&
        widthM >= 1.8 &&
        widthM <= 5 &&
        ratio >= 1.3 &&
        ratio <= 4.5

      if (looksLikeCaravan) {
        // Mittelpunkt (Pixel) -> Lat/Lng
        const cx = rect.center.x
        const cy = rect.center.y
        const lng = bounds.minLng + (cx / width) * degW
        const lat = bounds.maxLat - (cy / height) * degH
        candidates.push({
          lat,
          lng,
          lengthM: Math.round(lengthM * 10) / 10,
          widthM: Math.round(widthM * 10) / 10,
        })
      }
      cnt.delete()
    }
  } finally {
    src.delete()
    gray.delete()
    edges.delete()
    kernel.delete()
    contours.delete()
    hierarchy.delete()
  }

  return dedupe(candidates)
}

/** Nahe beieinanderliegende Kandidaten zusammenfassen. */
function dedupe(list: DetectionCandidate[]): DetectionCandidate[] {
  const result: DetectionCandidate[] = []
  const minSepM = 3
  for (const c of list) {
    const dup = result.some((r) => haversineM(r.lat, r.lng, c.lat, c.lng) < minSepM)
    if (!dup) result.push(c)
  }
  return result.slice(0, 80)
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
