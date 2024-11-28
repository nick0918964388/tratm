import { useState, useCallback } from 'react'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastOptions[]>([])

  const toast = useCallback((options: ToastOptions) => {
    const id = Date.now()
    setToasts(prev => [...prev, options])

    if (options.duration !== Infinity) {
      setTimeout(() => {
        setToasts(prev => prev.filter((_, index) => index !== prev.length - 1))
      }, options.duration || 3000)
    }
  }, [])

  return { toast, toasts }
} 