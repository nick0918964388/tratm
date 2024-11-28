"use client"

import { useState } from 'react'
import { Train } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { RefreshCw } from 'lucide-react'
import { getTrainLive, getTrainSchedule, updateTrainStatus } from "@/lib/api"
import { supabase } from '@/lib/supabase'
import { useToast } from "@/hooks/use-toast"

interface TitleBarProps {
  onRefresh: () => void
  refreshing: boolean
  schedules: string[]  // 添加所有車次清單
}

export function TitleBar({ onRefresh, refreshing, schedules }: TitleBarProps) {
  const [updating, setUpdating] = useState(false)
  const { toast } = useToast()

  const updateLiveData = async () => {
    try {
      setUpdating(true)
      toast({
        title: "更新資料中",
        description: "正在獲取最新列車運行資訊...",
        duration: 5000,
      })

      // 獲取所有列車
      const { data: trains } = await supabase
        .from('trains')
        .select('id, current_train')

      if (!trains) {
        throw new Error('無法獲取列車資料')
      }

      let totalUpdated = 0

      for (const train of trains) {
        try {
          // 獲取該車號的所有車次
          const { data: schedules } = await supabase
            .from('train_schedules')
            .select('train_number')
            .eq('train_id', train.id)

          if (!schedules || schedules.length === 0) {
            console.log(`列車 ${train.id} 沒有車次清單，跳過更新`)
            continue
          }

          const trainNumbers = schedules.map(s => s.train_number)
          console.log(`列車 ${train.id} 的車次清單:`, trainNumbers)

          await updateTrainStatus(
            train.id,
            train.current_train,
            trainNumbers
          )
          
          totalUpdated++
        } catch (error) {
          console.error(`更新列車 ${train.id} 失敗:`, error)
        }
      }

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
    <div className="sticky top-0 z-50 border-b bg-white dark:bg-gray-800">
      <div className="flex h-14 items-center px-4">
        <Train className="mr-2 h-6 w-6" />
        <h2 className="text-lg font-semibold">七堵機務段出車監控系統</h2>
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
          {/* ... 其他按鈕 */}
        </div>
      </div>
    </div>
  )
} 