import { Train } from "@/types/train"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { X } from 'lucide-react'

interface StatusModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  trains: Train[]
  status: string
}

export function StatusModal({ isOpen, onClose, title, trains, status }: StatusModalProps) {
  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {title} - 共 {trains.length} 輛
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-auto max-h-[calc(80vh-8rem)] p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px] sticky top-0 bg-white dark:bg-gray-800 pl-4">車號</TableHead>
                <TableHead className="sticky top-0 bg-white dark:bg-gray-800">狀態</TableHead>
                <TableHead className="sticky top-0 bg-white dark:bg-gray-800">目前車次</TableHead>
                <TableHead className="sticky top-0 bg-white dark:bg-gray-800">下一車次</TableHead>
                <TableHead className="sticky top-0 bg-white dark:bg-gray-800">目前車站</TableHead>
                <TableHead className="sticky top-0 bg-white dark:bg-gray-800">下一站</TableHead>
                <TableHead className="sticky top-0 bg-white dark:bg-gray-800 pr-4">司機員</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trains.map((train) => (
                <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableCell className="font-medium pl-4">{train.id}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                      {train.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{train.current_train || '-'}</TableCell>
                  <TableCell>{train.prepare_train || '-'}</TableCell>
                  <TableCell>{train.current_station || '-'}</TableCell>
                  <TableCell>{train.next_station || '-'}</TableCell>
                  <TableCell className="pr-4">{train.driver || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
} 