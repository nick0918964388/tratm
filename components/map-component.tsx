"use client"

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ProcessedTrain } from '@/types/train'
import { supabase } from '@/lib/supabase'

interface StationPosition {
  [key: string]: [number, number]
}

// 依照車型定義不同的圖示
const trainIcons = {
  'EMU3000': new Icon({
    iconUrl: '/EMU3000.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  }),
  'EMU900': new Icon({
    iconUrl: '/EMU900.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  }),
  'E1000': new Icon({
    iconUrl: '/E1000.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  }),
  'E500': new Icon({
    iconUrl: '/E500.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  }),
  'default': new Icon({
    iconUrl: '/train-icon.png', // 預設圖示
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  })
}

// 判斷車輛類型的函數
function getTrainType(trainId: string): keyof typeof trainIcons {
  if (trainId.startsWith('EMU3')) return 'EMU3000'
  if (trainId.startsWith('EMU9')) return 'EMU900'
  if (trainId.startsWith('E10')) return 'E1000'
  if (trainId.startsWith('E5')) return 'E500'
  return 'default'
}

export default function MapComponent({ 
  trains, 
  stationMap 
}: {
  trains: ProcessedTrain[]
  stationMap: { [key: string]: string }
}) {
  const [mounted, setMounted] = useState(false)
  const [stationPositions, setStationPositions] = useState<StationPosition>({})

  // 獲取車站經緯度資料
  useEffect(() => {
    async function fetchStationPositions() {
      try {
        const { data, error } = await supabase
          .from('train_station_details')
          .select('station_name, longitude, latitude')
        
        if (error) throw error

        const positions: StationPosition = {}
        data?.forEach(station => {
          if (station.longitude && station.latitude) {
            positions[station.station_name] = [station.latitude, station.longitude]
          }
        })

        console.log('車站位置資料:', positions)
        setStationPositions(positions)
      } catch (error) {
        console.error('獲取車站位置資料失敗:', error)
      }
    }

    fetchStationPositions()
  }, [])

  // 初始化 Leaflet
  useEffect(() => {
    delete (Icon.Default.prototype as any)._getIconUrl;
    Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    });

    setMounted(true)
  }, [])

  // 用於開發時的調試
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('目前運行中的列車:', trains)
      console.log('車站對照表:', stationMap)
      
      trains.forEach(train => {
        const stationName = stationMap[train.current_station] || train.current_station
        const position = stationPositions[stationName]
        console.log(`列車 ${train.id} 在站點 ${stationName} 的位置:`, position)
      })
    }
  }, [trains.length, stationPositions])

  if (!mounted) return null

  return (
    <MapContainer
      center={[23.97565, 120.9738]}
      zoom={8}
      style={{ height: '100%', width: '100%' }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {trains.map(train => {
        const stationName = stationMap[train.current_station] || train.current_station
        const position = stationPositions[stationName]
        if (!position) return null

        // 根據車號選擇對應的圖示
        const trainType = getTrainType(train.id)
        const icon = trainIcons[trainType]

        return (
          <Marker 
            key={train.id} 
            position={position}
            icon={icon}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold">{train.id}</h3>
                <p>車型: {trainType}</p>
                <p>目前車次: {train.current_train}</p>
                <p>目前站: {stationName}</p>
                <p>下一站: {stationMap[train.next_station] || train.next_station}</p>
                <p>預計發車: {train.scheduled_departure}</p>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
} 