#!/usr/bin/env python3
"""Assistierte Wohnwagen-Erkennung für Camping Ruderbaum (Altnau).

Läuft in der GitHub Action (nicht im Browser): lädt ein hochauflösendes
Luftbild des Platzes (ESRI World Imagery) und sucht mit OpenCV nach
rechteckigen, wohnwagengrossen Formen. Das Ergebnis sind VORSCHLAEGE, die in
der App bestaetigt werden muessen – keine perfekte Erkennung.

Ausgabe:
  public/detections/ruderbaum.json        (Kandidaten)
  public/detections/ruderbaum-debug.jpg    (Luftbild mit eingezeichneten Boxen)
"""
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
import requests

# Bereich des Campingplatzes – muss zu src/config.ts (CAMPGROUND.bbox) passen.
BBOX = {
    "minLat": 47.6220,
    "minLng": 9.2595,
    "maxLat": 47.6256,
    "maxLng": 9.2650,
}

OUT_DIR = Path("public/detections")
JSON_PATH = OUT_DIR / "ruderbaum.json"
DEBUG_PATH = OUT_DIR / "ruderbaum-debug.jpg"
EARTH_M_PER_DEG_LAT = 111_320.0
MAX_LONG_SIDE_PX = 2048

# Filter für "sieht aus wie ein Wohnwagen": helles, kompaktes, rechteckiges Dach
# in Wohnwagen-Grösse. Bewusst auf Präzision getrimmt (lieber ein paar echte
# verpassen als hunderte Fehltreffer).
MIN_RECTANGULARITY = 0.55
MIN_LENGTH_M, MAX_LENGTH_M = 3.0, 10.0
MIN_WIDTH_M, MAX_WIDTH_M = 1.8, 4.0
MIN_RATIO, MAX_RATIO = 1.4, 4.5
MIN_SEP_M = 3.0
# Dach muss deutlich heller als der Szenendurchschnitt sein: mean + K*std.
BRIGHT_STD_K = 0.5
MAX_CANDIDATES = 150


def fetch_aerial(bbox: dict, width: int, height: int) -> np.ndarray:
    url = (
        "https://services.arcgisonline.com/arcgis/rest/services/"
        "World_Imagery/MapServer/export"
    )
    params = {
        "bbox": f"{bbox['minLng']},{bbox['minLat']},{bbox['maxLng']},{bbox['maxLat']}",
        "bboxSR": "4326",
        "imageSR": "4326",
        "size": f"{width},{height}",
        "format": "jpg",
        "transparent": "false",
        "f": "image",
    }
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    data = np.frombuffer(resp.content, dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError("Luftbild konnte nicht dekodiert werden.")
    return img


def haversine_m(a: dict, b: dict) -> float:
    r = 6_371_000
    d_lat = math.radians(b["lat"] - a["lat"])
    d_lng = math.radians(b["lng"] - a["lng"])
    s = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a["lat"])) * math.cos(math.radians(b["lat"])) * math.sin(d_lng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(s))


def detect(img: np.ndarray, bbox: dict) -> tuple[list[dict], list[np.ndarray]]:
    """Gibt (Kandidaten, Boxpunkte-fuer-Debug) zurueck."""
    h, w = img.shape[:2]
    deg_w = bbox["maxLng"] - bbox["minLng"]
    deg_h = bbox["maxLat"] - bbox["minLat"]
    mid_lat = (bbox["minLat"] + bbox["maxLat"]) / 2
    m_per_deg_lng = EARTH_M_PER_DEG_LAT * math.cos(math.radians(mid_lat))
    m_per_px = ((deg_w * m_per_deg_lng / w) + (deg_h * EARTH_M_PER_DEG_LAT / h)) / 2

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 3)
    k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))

    # Szenen-Helligkeit als Referenz: ein Wohnwagen-Dach hebt sich deutlich ab.
    bright_cut = float(gray.mean()) + BRIGHT_STD_K * float(gray.std())

    # Nur lokal helle Dächer (adaptiver Threshold). Der frühere Kanten-Kanal
    # (Canny) lieferte zu viele Fehltreffer (Wege, Autos, Kanten) und ist raus.
    mask = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 41, -10
    )
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k3, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k3, iterations=1)

    candidates: list[dict] = []
    boxes: list[np.ndarray] = []

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 40:
            continue
        rect = cv2.minAreaRect(cnt)
        (cx, cy), (rw, rh), _ = rect
        if min(rw, rh) < 1:
            continue
        long_px, short_px = max(rw, rh), min(rw, rh)
        rectangularity = area / (rw * rh) if rw * rh > 0 else 0
        length_m = long_px * m_per_px
        width_m = short_px * m_per_px
        ratio = long_px / short_px

        if not (
            rectangularity > MIN_RECTANGULARITY
            and MIN_LENGTH_M <= length_m <= MAX_LENGTH_M
            and MIN_WIDTH_M <= width_m <= MAX_WIDTH_M
            and MIN_RATIO <= ratio <= MAX_RATIO
        ):
            continue

        # Helligkeits-Check auf dem Blob (ROI), damit nur wirklich helle Dächer
        # durchkommen – dunkle Flächen/Wege fallen raus.
        bx, by, bw, bh = cv2.boundingRect(cnt)
        roi_mask = np.zeros((bh, bw), np.uint8)
        cv2.drawContours(roi_mask, [cnt], -1, 255, -1, offset=(-bx, -by))
        mean_blob = cv2.mean(gray[by : by + bh, bx : bx + bw], mask=roi_mask)[0]
        if mean_blob < bright_cut:
            continue

        lng = bbox["minLng"] + (cx / w) * deg_w
        lat = bbox["maxLat"] - (cy / h) * deg_h
        cand = {
            "lat": round(lat, 7),
            "lng": round(lng, 7),
            "lengthM": round(length_m, 1),
            "widthM": round(width_m, 1),
        }
        if any(haversine_m(o, cand) < MIN_SEP_M for o in candidates):
            continue
        candidates.append(cand)
        boxes.append(cv2.boxPoints(rect))

    return candidates[:MAX_CANDIDATES], boxes


def main() -> None:
    deg_w = BBOX["maxLng"] - BBOX["minLng"]
    deg_h = BBOX["maxLat"] - BBOX["minLat"]
    aspect = deg_w / deg_h
    if aspect >= 1:
        width = MAX_LONG_SIDE_PX
        height = round(width / aspect)
    else:
        height = MAX_LONG_SIDE_PX
        width = round(height * aspect)

    print(f"Lade Luftbild {width}x{height} für bbox {BBOX} …")
    img = fetch_aerial(BBOX, width, height)
    candidates, boxes = detect(img, BBOX)
    print(f"{len(candidates)} Wohnwagen-Kandidaten gefunden.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Debug-Overlay: gefundene Boxen aufs Luftbild zeichnen.
    dbg = img.copy()
    for pts in boxes:
        cv2.polylines(dbg, [pts.astype(np.int32)], True, (0, 255, 0), 2)
    cv2.imwrite(str(DEBUG_PATH), dbg, [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(f"Debug-Bild: {DEBUG_PATH} ({os.path.getsize(DEBUG_PATH)} Bytes)")

    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "campground": "Camping Ruderbaum, Altnau",
        "bbox": BBOX,
        "count": len(candidates),
        "candidates": candidates,
    }
    JSON_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Geschrieben: {JSON_PATH} ({os.path.getsize(JSON_PATH)} Bytes)")


if __name__ == "__main__":
    main()
