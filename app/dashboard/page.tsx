import { Suspense } from 'react'
import { TrainDashboard } from '@/components/train-dashboard'
import { supabase } from '@/lib/supabase'

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
    groups,
    stationSchedules
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