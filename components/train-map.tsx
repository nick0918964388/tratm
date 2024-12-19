import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { ProcessedTrain } from '@/types/train'

// 引入 Leaflet 的 CSS
import 'leaflet/dist/leaflet.css'

// 修復 Leaflet 默認圖標問題
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
})

L.Marker.prototype.options.icon = DefaultIcon

// 自定義列車圖標
const trainIcon = new L.Icon({
  iconUrl: '/train-icon.png',
  iconSize: [25, 25],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
})

interface TrainMapProps {
  trains: ProcessedTrain[]
}

export default function TrainMap({ trains }: TrainMapProps) {
  const [stationPositions, setStationPositions] = useState<{
    [key: string]: { lat: number; lng: number }
  }>({})

  useEffect(() => {
    // 這裡可以加載車站位置資料
    setStationPositions({
      '七堵': { lat: 25.0789, lng: 121.7131 },
      '台北': { lat: 25.0478, lng: 121.5170 },
      '板橋': { lat: 25.0145, lng: 121.4635 },
      '樹林': { lat: 24.9912, lng: 121.4152 },
      '桃園': { lat: 24.9892, lng: 121.3133 },
      '中壢': { lat: 24.9538, lng: 121.2256 },
      '新竹': { lat: 24.8015, lng: 120.9718 },
      '基隆': { lat: 25.1321, lng: 121.7391 },
      '松山': { lat: 25.0499, lng: 121.5778 },
      '萬華': { lat: 25.0333, lng: 121.5000 },
      // 可以繼續添加更多車站
    })
  }, [])

  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden">
      <MapContainer
        center={[25.0478, 121.5170]} // 以台北為中心
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {trains.map((train) => {
          const position = stationPositions[train.current_station]
          if (!position) return null

          return (
            <Marker
              key={train.id}
              position={[position.lat, position.lng]}
              icon={trainIcon}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">{train.id}</h3>
                  <p>目前車次: {train.current_train}</p>
                  <p>目前站點: {train.current_station}</p>
                  <p>下一站: {train.next_station}</p>
                  <p>預計到達: {train.estimated_arrival}</p>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
} 