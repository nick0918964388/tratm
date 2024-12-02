import { X } from 'lucide-react'

interface UpdateProgressModalProps {
  isOpen: boolean
  onClose: () => void
  totalTrains: number
  updatedCount: number
  currentTrain?: string
  logs: string[]
}

export function UpdateProgressModal({
  isOpen,
  onClose,
  totalTrains,
  updatedCount,
  currentTrain,
  logs
}: UpdateProgressModalProps) {
  if (!isOpen) return null

  const progress = Math.round((updatedCount / totalTrains) * 100)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            更新進度 - {progress}%
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-4">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="mb-4">
            <p>正在更新: {currentTrain || '準備中...'}</p>
            <p>已更新: {updatedCount} / {totalTrains}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 h-48 overflow-auto">
            {logs.map((log, index) => (
              <div key={index} className="text-sm mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 