import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, LayersControl, Marker, useMap, useMapEvents } from 'react-leaflet'
import type { Caravan, DetectionCandidate } from '../types'

const caravanIcon = L.divIcon({
  className: '',
  html: '<div class="marker-caravan"></div>',
  iconSize: [22, 16],
  iconAnchor: [11, 8],
})
const caravanIconSel = L.divIcon({
  className: '',
  html: '<div class="marker-caravan" style="outline:3px solid #ffe08a;"></div>',
  iconSize: [22, 16],
  iconAnchor: [11, 8],
})
const candidateIcon = L.divIcon({
  className: '',
  html: '<div class="marker-candidate"></div>',
  iconSize: [20, 14],
  iconAnchor: [10, 7],
})

interface Props {
  caravans: Caravan[]
  candidates: DetectionCandidate[]
  selectedId: string | null
  addMode: boolean
  onMapClick: (lat: number, lng: number) => void
  onSelect: (id: string) => void
  onAddCandidate: (c: DetectionCandidate) => void
  onBoundsRef: (getter: () => L.LatLngBounds) => void
}

function ClickHandler({ addMode, onMapClick }: { addMode: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (addMode) onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Stellt den aktuellen Kartenausschnitt der Elternkomponente bereit (für die Erkennung). */
function BoundsBridge({ onBoundsRef }: { onBoundsRef: (getter: () => L.LatLngBounds) => void }) {
  const map = useMap()
  useEffect(() => {
    onBoundsRef(() => map.getBounds())
  }, [map, onBoundsRef])
  return null
}

/** Zentriert die Karte beim ersten Laden auf vorhandene Wohnwagen. */
function FitOnce({ caravans }: { caravans: Caravan[] }) {
  const map = useMap()
  useEffect(() => {
    if (caravans.length > 0) {
      const bounds = L.latLngBounds(caravans.map((c) => [c.lat, c.lng] as [number, number]))
      map.fitBounds(bounds.pad(0.3), { maxZoom: 18 })
    }
    // Nur einmal beim Mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export function MapView({
  caravans,
  candidates,
  selectedId,
  addMode,
  onMapClick,
  onSelect,
  onAddCandidate,
  onBoundsRef,
}: Props) {
  const initialCenter = useMemo<[number, number]>(() => {
    if (caravans.length > 0) return [caravans[0].lat, caravans[0].lng]
    return [46.8182, 8.2275] // Schweiz als Fallback
  }, [caravans])

  return (
    <MapContainer
      center={initialCenter}
      zoom={caravans.length > 0 ? 18 : 8}
      maxZoom={21}
      style={{ cursor: addMode ? 'crosshair' : '' }}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer name="Luftbild">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles © Esri – Source: Esri, Maxar, Earthstar Geographics"
            maxNativeZoom={19}
            maxZoom={21}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked name="Karte (OpenStreetMap)">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap-Mitwirkende"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <ClickHandler addMode={addMode} onMapClick={onMapClick} />
      <BoundsBridge onBoundsRef={onBoundsRef} />
      <FitOnce caravans={caravans} />

      {caravans.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat, c.lng]}
          icon={c.id === selectedId ? caravanIconSel : caravanIcon}
          eventHandlers={{ click: () => onSelect(c.id) }}
          title={c.label}
        />
      ))}

      {candidates.map((c, i) => (
        <Marker
          key={`cand-${i}`}
          position={[c.lat, c.lng]}
          icon={candidateIcon}
          eventHandlers={{ click: () => onAddCandidate(c) }}
          title={`Vorschlag ~${c.lengthM}×${c.widthM} m – tippen zum Übernehmen`}
        />
      ))}
    </MapContainer>
  )
}
