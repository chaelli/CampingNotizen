import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import type { Caravan } from '../types'
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

interface Props {
  caravans: Caravan[]
  selectedId: string | null
  addMode: boolean
  onMapClick: (lat: number, lng: number) => void
  onSelect: (id: string) => void
}

function ClickHandler({ addMode, onMapClick }: { addMode: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (addMode) onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function MapView({ caravans, selectedId, addMode, onMapClick, onSelect }: Props) {
  return (
    <MapContainer
      center={CAMPGROUND.center}
      zoom={CAMPGROUND.zoom}
      maxZoom={21}
      zoomControl={false}
      attributionControl={false}
      style={{ cursor: addMode ? 'crosshair' : '' }}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={19}
        maxZoom={21}
      />

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
    </MapContainer>
  )
}
