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
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { getTrainSchedule } from "@/lib/api"
import { formatDistanceToNow, differenceInMinutes } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useEffect, useState } from "react"

interface StatusModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  trains: Train[]
  status: string
}

interface EnhancedTrain extends Train {
  startStation?: string;
  endStation?: string;
  runningTime?: string;
  timeToDestination?: string;
  endTimeDate?: Date;
  nextTrainStartTime?: string;
  maintenanceLocation?: string;
  maintenanceStartTime?: string;
  maintenanceEndTime?: string;
}

export function StatusModal({ isOpen, onClose, title, trains, status }: StatusModalProps) {
  if (!isOpen) return null;

  const [enhancedTrains, setEnhancedTrains] = useState<EnhancedTrain[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // 根據狀態分組列車
  const groupedTrains = enhancedTrains.reduce((acc, train) => {
    const status = train.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(train);
    return acc;
  }, {} as Record<string, EnhancedTrain[]>);

  const toggleGroup = (status: string) => {
    setExpandedGroups(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // 渲染表頭
  const renderTableHeader = (status: string) => {
    switch (status) {
      case "運行中":
        return (
          <TableRow>
            <TableHead className="w-[100px] sticky top-0 bg-white dark:bg-gray-800 pl-4">車號</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">狀態</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">目前運行車次</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">起始站</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">終點站</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">計畫運行時間</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800 pr-4">預計抵達終點</TableHead>
          </TableRow>
        );
      case "等待出車":
        return (
          <TableRow>
            <TableHead className="w-[100px] sticky top-0 bg-white dark:bg-gray-800 pl-4">車號</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">狀態</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">即將運行車次</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">起始站</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">終點站</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">計畫運行時間</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800 pr-4">預計開車時間</TableHead>
          </TableRow>
        );
      case "預備":
        return (
          <TableRow>
            <TableHead className="w-[100px] sticky top-0 bg-white dark:bg-gray-800 pl-4">車號</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">狀態</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">所在位置</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800 pr-4">動作</TableHead>
          </TableRow>
        );
      case "在段待修":
      case "臨修(C2)":
      case "進廠檢修(3B)":
      case "在段保養(2A)":
        return (
          <TableRow>
            <TableHead className="w-[100px] sticky top-0 bg-white dark:bg-gray-800 pl-4">車號</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">狀態</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">所在位置</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">預計開工時間</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800 pr-4">預計完工時間</TableHead>
          </TableRow>
        );
      default:
        return null;
    }
  };

  // 渲染表格行
  const renderTableRow = (train: EnhancedTrain) => {
    switch (train.status) {
      case "運行中":
        return (
          <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="font-medium pl-4">{train.id}</TableCell>
            <TableCell>
              <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                {train.status}
              </Badge>
            </TableCell>
            <TableCell>{train.current_train || '-'}</TableCell>
            <TableCell>{train.startStation || '-'}</TableCell>
            <TableCell>{train.endStation || '-'}</TableCell>
            <TableCell>{train.runningTime || '-'}</TableCell>
            <TableCell className="pr-4">{train.timeToDestination || '-'}</TableCell>
          </TableRow>
        );
      case "等待出車":
        return (
          <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="font-medium pl-4">{train.id}</TableCell>
            <TableCell>
              <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                {train.status}
              </Badge>
            </TableCell>
            <TableCell>{train.prepare_train || '-'}</TableCell>
            <TableCell>{train.startStation || '-'}</TableCell>
            <TableCell>{train.endStation || '-'}</TableCell>
            <TableCell>{train.runningTime || '-'}</TableCell>
            <TableCell className="pr-4">{train.nextTrainStartTime || '-'}</TableCell>
          </TableRow>
        );
      case "預備":
        return (
          <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="font-medium pl-4">{train.id}</TableCell>
            <TableCell>
              <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                {train.status}
              </Badge>
            </TableCell>
            <TableCell>{train.current_station || '-'}</TableCell>
            <TableCell className="pr-4">
              <button
                onClick={() => toggleGroup(train.id)}
                className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
              >
                {expandedGroups.includes(train.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                查看詳情
              </button>
            </TableCell>
          </TableRow>
        );
      case "在段待修":
      case "臨修(C2)":
      case "進廠檢修(3B)":
      case "在段保養(2A)":
        return (
          <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="font-medium pl-4">{train.id}</TableCell>
            <TableCell>
              <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                {train.status}
              </Badge>
            </TableCell>
            <TableCell>{train.maintenanceLocation || '-'}</TableCell>
            <TableCell>{train.maintenanceStartTime || '-'}</TableCell>
            <TableCell className="pr-4">{train.maintenanceEndTime || '-'}</TableCell>
          </TableRow>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    async function fetchScheduleDetails() {
      const updatedTrains = await Promise.all(
        trains.map(async (train) => {
          if (!train.current_train) {
            return { ...train };
          }

          try {
            const schedule = await getTrainSchedule(train.current_train);
            
            // 計算運行時間
            const runningTime = (() => {
              if (!schedule.startingTime || !schedule.endingTime) return '-';
              const startTime = new Date(`2024-01-01 ${schedule.startingTime}`);
              const endTime = new Date(`2024-01-01 ${schedule.endingTime}`);
              const diffInMinutes = differenceInMinutes(endTime, startTime);
              return `${Math.floor(diffInMinutes / 60)}小時${diffInMinutes % 60}分鐘`;
            })();

            // 計算預計到達時間
            const now = new Date();
            const endTimeDate = schedule.endingTime ? new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              parseInt(schedule.endingTime.split(':')[0]),
              parseInt(schedule.endingTime.split(':')[1])
            ) : undefined;

            // 如果已過期，返回 null（稍後會被過濾掉）
            if (endTimeDate && endTimeDate < now) {
              return null;
            }

            const timeToDestination = endTimeDate 
              ? formatDistanceToNow(endTimeDate, { locale: zhTW, addSuffix: true })
              : '-';

            return {
              ...train,
              startStation: schedule.startingStationName,
              endStation: schedule.endingStationName,
              runningTime,
              timeToDestination,
              endTimeDate, // 保存日期用於排序
            };
          } catch (error) {
            console.error(`獲取車次 ${train.current_train} 時刻表失敗:`, error);
            return { ...train };
          }
        })
      );

      // 過濾掉 null 值（已過期的車輛）並排序
      const filteredAndSortedTrains = updatedTrains
        .filter((train): train is EnhancedTrain => train !== null)
        .sort((a, b) => {
          // 如果沒有結束時間的放到最後
          if (!a.endTimeDate) return 1;
          if (!b.endTimeDate) return -1;
          // 按照到達時間升序排序
          return a.endTimeDate.getTime() - b.endTimeDate.getTime();
        });

      setEnhancedTrains(filteredAndSortedTrains);
    }

    fetchScheduleDetails();
  }, [trains]);

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
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {title} - 共 {enhancedTrains.length} 輛
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="overflow-auto max-h-[calc(80vh-8rem)] p-6">
          {Object.entries(groupedTrains).map(([status, trains]) => (
            <div key={status} className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{status}</h3>
              <Table>
                <TableHeader>
                  {renderTableHeader(status)}
                </TableHeader>
                <TableBody>
                  {trains.map(train => renderTableRow(train))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 