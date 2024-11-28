import { TrainDashboard } from "@/components/train-dashboard"
import { Suspense } from "react"
import { supabase } from "@/lib/supabase"
import { Station, TrainGroup } from "@/types/train"

async function getTrainData() {
  console.log('開始獲取資料...')
  
  const { data: groups, error: groupsError } = await supabase
    .from('train_groups')
    .select(`
      *,
      trains:trains (
        *,
        schedules:train_schedules (
          *
        )
      )
    `)

  if (groupsError) {
    console.error('獲取車組資料錯誤:', groupsError)
  }
  console.log('車組資料:', groups)

  const { data: stationSchedules, error: stationError } = await supabase
    .from('station_schedules')
    .select('*')

  if (stationError) {
    console.error('獲取站點時刻表錯誤:', stationError)
  }
  console.log('站點時刻表:', stationSchedules)

  const result = {
    groups: (groups || []) as TrainGroup[],
    stationSchedules: (stationSchedules || []) as Station[]
  }
  
  console.log('最終返回資料:', result)
  return result
}

export default async function Page() {
  const data = await getTrainData()
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TrainDashboard initialData={data} />
    </Suspense>
  )
}