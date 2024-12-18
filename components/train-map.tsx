"use client"

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Icon } from 'leaflet'
import { ProcessedTrain } from '@/types/train'

// 動態引入整個地圖組件
const Map = dynamic(() => import('./map-component'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      載入地圖中...
    </div>
  )
})

export function TrainMap({ trains, stationMap }: {
  trains: ProcessedTrain[]
  stationMap: { [key: string]: string }
}) {
  return <Map trains={trains} stationMap={stationMap} />
} 