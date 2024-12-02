import { TrainDashboard } from "@/components/train-dashboard"
import { Suspense } from "react"
import { supabase } from "@/lib/supabase"
import { Station, TrainGroup, Train } from "@/types/train"
import { LoadingSpinner } from "@/components/loading"

async function getTrainData() {
  try {
    console.log('開始獲取資料...')
    
    // 並行獲取資料
    const [groupsResponse, stationSchedulesResponse] = await Promise.all([
      supabase
        .from('train_groups')
        .select(`
          *,
          trains:trains (
            *,
            schedules:train_schedules (
              *
            )
          )
        `),
      supabase
        .from('station_schedules')
        .select('*')
    ]);

    // 檢查錯誤
    if (groupsResponse.error) {
      console.error('獲取車組資料錯誤:', groupsResponse.error)
      throw groupsResponse.error
    }

    if (stationSchedulesResponse.error) {
      console.error('獲取站點時刻表錯誤:', stationSchedulesResponse.error)
      throw stationSchedulesResponse.error
    }

    // 處理空值
    const groups = groupsResponse.data || []
    const stationSchedules = stationSchedulesResponse.data || []

    // 檢查資料完整性
    groups.forEach(group => {
      if (!group.trains) group.trains = []
      group.trains.forEach((train: Train) => {
        if (!train.schedules) train.schedules = []
      })
    })

    const result = {
      groups: groups as TrainGroup[],
      stationSchedules: stationSchedules as Station[]
    }
    
    console.log('資料載入完成')
    return result
  } catch (error) {
    console.error('資料載入失敗:', error)
    // 返回預設值而不是拋出錯誤，確保頁面能夠渲染
    return {
      groups: [] as TrainGroup[],
      stationSchedules: [] as Station[]
    }
  }
}

export default async function Page() {
  const data = await getTrainData()
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TrainDashboard initialData={data} />
    </Suspense>
  )
}