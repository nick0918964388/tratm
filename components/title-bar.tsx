"use client"

import { useState } from 'react'
import { Train } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { RefreshCw } from 'lucide-react'
import { getTrainLive, getTrainSchedule, updateTrainStatus } from "@/lib/api"
import { supabase } from '@/lib/supabase'
import { useToast } from "@/hooks/use-toast"
import { UpdateProgressModal } from "./update-progress-modal"

interface TitleBarProps {
  onRefresh: () => void
  refreshing: boolean
  schedules: string[]  // 添加所有車次清單
}

export function TitleBar({ onRefresh, refreshing, schedules }: TitleBarProps) {
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState({
    totalTrains: 0,
    updatedCount: 0,
    currentTrain: '',
    logs: [] as string[]
  })
  const { toast } = useToast()

  const updateLiveData = async () => {
    try {
      setUpdating(true)
      
      // 獲取所有列車
      const { data: trains } = await supabase
        .from('trains')
        .select('id, current_train, status')

      if (!trains) {
        throw new Error('無法獲取列車資料')
      }

      setUpdateProgress(prev => ({
        ...prev,
        totalTrains: trains.length,
        updatedCount: 0,
        logs: ['開始更新列車資料...']
      }))

      let totalUpdated = 0

      // 使用 Promise.all 來並行處理所有更新
      await Promise.all(trains.map(async (train) => {
        setUpdateProgress(prev => ({
          ...prev,
          currentTrain: train.id,
          logs: [...prev.logs, `正在更新列車 ${train.id}...`]
        }))

        try {
          const { data: schedules } = await supabase
            .from('train_schedules')
            .select('train_number')
            .eq('train_id', train.id)

          if (!schedules || schedules.length === 0) {
            console.log(`列車 ${train.id} 沒有車次清單，跳過更新`)
            return
          }

          const trainNumbers = schedules.map(s => s.train_number)
          await updateTrainStatus(train.id, train.current_train, trainNumbers)
          totalUpdated++
          setUpdateProgress(prev => ({
            ...prev,
            updatedCount: totalUpdated,
            logs: [...prev.logs, `列車 ${train.id} 更新完成`]
          }))
        } catch (error) {
          setUpdateProgress(prev => ({
            ...prev,
            logs: [...prev.logs, `列車 ${train.id} 更新失敗: ${error}`]
          }))
        }
      }))

      toast({
        title: "更新完成",
        description: `成功更新 ${totalUpdated} 個車次的即時資訊`,
        duration: 3000,
      })

      // 重新整理頁面資料
      onRefresh()
    } catch (error) {
      console.error('更新即時資訊失敗:', error)
      toast({
        title: "更新失敗",
        description: "無法獲取最新資訊，請稍後再試",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <div className="sticky top-0 z-50 border-b bg-white dark:bg-gray-800">
        <div className="flex h-14 items-center px-4">
          <Train className="mr-2 h-6 w-6" />
          <h2 className="text-lg font-semibold">車輛運用管理</h2>
          <div className="ml-auto flex items-center space-x-4">
            <Button
              variant="outline"
              size="icon"
              onClick={updateLiveData}
              disabled={updating}
              className={updating ? "animate-pulse" : ""}
            >
              <RefreshCw className={`h-4 w-4 ${updating ? "animate-spin" : ""}`} />
            </Button>            
          </div>
        </div>
      </div>
      <UpdateProgressModal
        isOpen={updating}
        onClose={() => setUpdating(false)}
        {...updateProgress}
      />
    </>
  )
} 