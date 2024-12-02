import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStatusColor(status: string) {
  switch (status) {
    case "運行中":
      return "bg-emerald-500"
    case "準備中":
      return "bg-sky-500"
    case "等待出車":
      return "bg-yellow-500"
    case "已出車完畢":
      return "bg-gray-500"
    case "維修中":
    case "在段待修":
    case "臨修(C2)":
      return "bg-rose-500"
    case "進廠檢修(3B)":
      return "bg-purple-500"
    case "在段保養(2A)":
      return "bg-orange-500"
    case "預備":
      return "bg-blue-500"
    default:
      return "bg-slate-500"
  }
}
