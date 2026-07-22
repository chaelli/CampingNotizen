#!/usr/bin/env python3
"""Assistierte Wohnwagen-Erkennung für Camping Ruderbaum (Altnau).

Läuft in der GitHub Action (nicht im Browser): lädt ein hochauflösendes
Luftbild des Platzes (ESRI World Imagery) und sucht mit OpenCV nach
rechteckigen, wohnwagengrossen Formen. Das Ergebnis sind VORSCHLAEGE, die in
der App bestaetigt werden muessen – keine perfekte Erkennung.

Ausgabe: public/detections/ruderbaum.json
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

OUT_PATH = Path("public/detections/ruderbaum.json")
EARTH_M_PER_DEG_LAT = 111_320.0
MAX_LONG_SIDE_PX = 2048


def fetch_aerial(bbox: dict, width: int, height: int) -> np.ndarray:
    """Holt ein Luftbild fuer den bbox ueber den ArcGIS-Export-Endpoint."""
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


def detect(img: np.ndarray, bbox: dict) -> list[dict]:
    h, w = img.shape[:2]
    deg_w = bbox["maxLng"] - bbox["minLng"]
    deg_h = bbox["maxLat"] - bbox["minLat"]
    mid_lat = (bbox["minLat"] + bbox["maxLat"]) / 2
    m_per_deg_lng = EARTH_M_PER_DEG_LAT * math.cos(math.radians(mid_lat))
    m_per_px_x = deg_w * m_per_deg_lng / w
    m_per_px_y = deg_h * EARTH_M_PER_DEG_LAT / h
    m_per_px = (m_per_px_x + m_per_px_y) / 2

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    # Zwei Signale kombinieren: helle Daecher (Threshold) + Kanten (Canny).
    _, bright = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    edges = cv2.Canny(gray, 40, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.erode(edges, kernel, iterations=1)
    mask = cv2.bitwise_or(bright, edges)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates: list[dict] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 40:
            continue
        rect = cv2.minAreaRect(cnt)  # ((cx, cy), (w, h), angle)
        (cx, cy), (rw, rh), _ = rect
        if min(rw, rh) < 1:
            continue
        long_px, short_px = max(rw, rh), min(rw, rh)
        rectangularity = area / (rw * rh) if rw * rh > 0 else 0
        length_m = long_px * m_per_px
        width_m = short_px * m_per_px
        ratio = long_px / short_px

        if (
            rectangularity > 0.55
            and 3.0 <= length_m <= 13.0
            and 1.8 <= width_m <= 5.0
            and 1.3 <= ratio <= 4.5
        ):
            lng = bbox["minLng"] + (cx / w) * deg_w
            lat = bbox["maxLat"] - (cy / h) * deg_h
            candidates.append(
                {
                    "lat": round(lat, 7),
                    "lng": round(lng, 7),
                    "lengthM": round(length_m, 1),
                    "widthM": round(width_m, 1),
                }
            )

    return dedupe(candidates)


def haversine_m(a: dict, b: dict) -> float:
    r = 6_371_000
    d_lat = math.radians(b["lat"] - a["lat"])
    d_lng = math.radians(b["lng"] - a["lng"])
    s = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a["lat"])) * math.cos(math.radians(b["lat"])) * math.sin(d_lng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(s))


def dedupe(items: list[dict], min_sep_m: float = 3.0, limit: int = 200) -> list[dict]:
    out: list[dict] = []
    for c in items:
        if not any(haversine_m(o, c) < min_sep_m for o in out):
            out.append(c)
    return out[:limit]


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
    candidates = detect(img, BBOX)
    print(f"{len(candidates)} Wohnwagen-Kandidaten gefunden.")

    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "campground": "Camping Ruderbaum, Altnau",
        "bbox": BBOX,
        "count": len(candidates),
        "candidates": candidates,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Geschrieben: {OUT_PATH} ({os.path.getsize(OUT_PATH)} Bytes)")


if __name__ == "__main__":
    main()
