import { Suspense } from 'react'
import { TrainDashboard } from '@/components/train-dashboard'
import { getTrainData } from '@/lib/api'

export default async function DashboardPage() {
  console.log('開始獲取初始資料...')
  const data = await getTrainData()
  console.log('初始資料:', data)
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TrainDashboard initialData={data} />
    </Suspense>
  )
} 