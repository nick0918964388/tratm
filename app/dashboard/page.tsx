import { Suspense } from 'react'
import { TrainDashboard } from '@/components/train-dashboard'
import { supabase } from '@/lib/supabase'
import { Station, TrainGroup } from '@/types/train'

async function getTrainData() {
  const { data: groups } = await supabase
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

  const { data: stationSchedules } = await supabase
    .from('station_schedules')
    .select('*')

  return {
    groups: (groups || []) as TrainGroup[],
    stationSchedules: (stationSchedules || []) as Station[]
  }
}

export default async function DashboardPage() {
  const data = await getTrainData()
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TrainDashboard initialData={data} />
    </Suspense>
  )
} 