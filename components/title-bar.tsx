"use client"

import { useState, useEffect } from 'react'
import { Train } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { RefreshCw } from 'lucide-react'
import { updateTrainStatus } from "@/lib/api"
import { supabase } from '@/lib/supabase'
import { useToast } from "@/hooks/use-toast"
import { UpdateProgressModal } from "./update-progress-modal"

interface TitleBarProps {
  onRefresh: () => Promise<void>
  refreshing: boolean
  schedules: string[]
}

export function TitleBar({ onRefresh, refreshing, schedules }: TitleBarProps) {
  const [showProgress, setShowProgress] = useState(false)
  const [currentTrain, setCurrentTrain] = useState("")
  const [progress, setProgress] = useState(0)

  const handleRefreshClick = async () => {
    setShowProgress(true)
    setProgress(0)
    
    try {
      await onRefresh()
    } finally {
      setShowProgress(false)
      setProgress(0)
      setCurrentTrain("")
    }
  }

  useEffect(() => {
    if (refreshing) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 1
        })
      }, 50)

      return () => clearInterval(interval)
    }
  }, [refreshing])

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Train className="mr-2 h-6 w-6" />
        <h2 className="text-lg font-semibold">列車監控系統</h2>
        <div className="ml-auto flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshClick}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                更新中 ({progress}%)
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                更新資料
              </>
            )}
          </Button>
        </div>
      </div>
      {showProgress && (
        <div className="h-1 bg-gray-200">
          <div
            className="h-1 bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
} 