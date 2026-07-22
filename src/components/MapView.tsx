import L from 'leaflet'
import { MapContainer, TileLayer, LayersControl, Marker, useMapEvents } from 'react-leaflet'
import type { Caravan, DetectionCandidate } from '../types'
import { CAMPGROUND } from '../config'

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
}

function ClickHandler({ addMode, onMapClick }: { addMode: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (addMode) onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
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
}: Props) {
  return (
    <MapContainer
      center={CAMPGROUND.center}
      zoom={CAMPGROUND.zoom}
      maxZoom={21}
      style={{ cursor: addMode ? 'crosshair' : '' }}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Luftbild">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles © Esri – Source: Esri, Maxar, Earthstar Geographics"
            maxNativeZoom={19}
            maxZoom={21}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Karte (OpenStreetMap)">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap-Mitwirkende"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <ClickHandler addMode={addMode} onMapClick={onMapClick} />

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
