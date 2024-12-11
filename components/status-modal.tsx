import { Train, TrainSchedule, TrainNextDaySchedule, TrainStatus, StationStatus } from "@/types/train"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { X, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { getTrainSchedule, TrainDetail, getOtherDepotTrains, getMaintenanceTrainDetails } from "@/lib/api"
import { formatDistanceToNow, differenceInMinutes, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useEffect, useState } from "react"
import { TrainScheduleDetail } from "@/components/train-schedule"

interface StatusModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  trains: Train[]
  status: string
  handleScheduleClick: (trainId: string, trainNo: string) => void
  expandedSchedules: {
    trainId: string;
    trainNumber: string;
    stations?: Array<{
      name: string;
      scheduledArrival: string;
      scheduledDeparture: string;
      actualArrival?: string;
      actualDeparture?: string;
      status: StationStatus;
      delay?: number;
    }>;
  } | null;
  selectedSchedule: TrainDetail | null;
  loadingSchedule: boolean;
}

interface EnhancedTrain extends Train {
  startStation?: string;
  endStation?: string;
  runningTime?: string;
  timeToDestination?: string;
  endTimeDate?: Date;
  sortedSchedules?: {
    todaySchedules: TrainSchedule[];
    firstSchedule: TrainSchedule | null;
    lastSchedule: TrainSchedule | null;
    nextDaySchedules: TrainNextDaySchedule[];
  };
  otherDepotTrains?: EnhancedTrain[];
  maintenanceDetails?: {
    location: string;
    entry_time: string;
    start_time: string;
    end_time: string;
    duration_days: number;
  };
}

export function StatusModal({ isOpen, onClose, title, trains, status, handleScheduleClick, expandedSchedules, selectedSchedule, loadingSchedule }: StatusModalProps) {
  const [enhancedTrains, setEnhancedTrains] = useState<EnhancedTrain[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [otherDepotTrains, setOtherDepotTrains] = useState<Train[]>([]);
  const [showOtherDepot, setShowOtherDepot] = useState(false);

  useEffect(() => {
    async function fetchScheduleDetails() {
      setIsLoading(true);
      try {
        const updatedTrains = await Promise.all(
          trains.map(async (train) => {
            console.log('處理列車:',{"id:":train.id, "status:":train.status, "prepare_train:":train.prepare_train, "current_train:":train.current_train});
            try {
              // 如果是維修狀態，獲取維修資訊
              if (["在段待修", "臨修(C2)", "進廠檢修(3B)", "在段保養(2A)", "維修中"].includes(train.status)) {
                const maintenanceDetails = await getMaintenanceTrainDetails(train.id);
                return {
                  ...train,
                  maintenanceDetails
                };
              }

              // 獲取時刻表資訊（運行中、等待出車、已出車完畢都需要）
              if (["運行中", "等待出車", "已出車完畢"].includes(train.status)) {
                const scheduleToUse = train.status === "已出車完畢" 
                  ? train.current_train 
                  : train.status === "運行中"
                    ? train.current_train
                    : train.current_train || train.prepare_train;

                console.log('使用車次:', {
                  trainId: train.id,
                  status: train.status,
                  current_train: train.current_train,
                  prepare_train: train.prepare_train,
                  scheduleToUse
                });

                if (!scheduleToUse) {
                  return { ...train };
                }

                const schedule = await getTrainSchedule(scheduleToUse);
                const now = new Date();
                
                // 計算運行時間（考慮跨日）
                const runningTime = (() => {
                  if (!schedule.startingTime || !schedule.endingTime) return '-';
                  const startTime = new Date(`2024-01-01 ${schedule.startingTime}`);
                  const endTime = new Date(`2024-01-01 ${schedule.endingTime}`);
                  
                  let diffInMinutes = differenceInMinutes(endTime, startTime);
                  
                  if (diffInMinutes < 0) {
                    const nextDayEndTime = new Date(`2024-01-02 ${schedule.endingTime}`);
                    diffInMinutes = differenceInMinutes(nextDayEndTime, startTime);
                  }
                  
                  return `${Math.floor(diffInMinutes / 60)}小時${diffInMinutes % 60}分鐘`;
                })();

                // 計算預計時間
                let timeToDestination = '-';
                let startTimeDate: Date | undefined;
                let endTimeDate: Date | undefined;

                if (schedule.startingTime) {
                  startTimeDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    parseInt(schedule.startingTime.split(':')[0]),
                    parseInt(schedule.startingTime.split(':')[1])
                  );                                 
                }

                if (schedule.endingTime) {
                  endTimeDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    parseInt(schedule.endingTime.split(':')[0]),
                    parseInt(schedule.endingTime.split(':')[1])
                  );

                  
                }
                console.log('等待出車:', {
                  trainId: train.id,
                  trainNumber: train.prepare_train,                                    
                });

                // 根據不同狀態計算時間
                if (train.status === "運行中" && endTimeDate && endTimeDate > now) {
                  // 先計算計畫運行時間
                  const startTime = new Date(`2024-01-01 ${schedule.startingTime}`);
                  const endTime = new Date(`2024-01-01 ${schedule.endingTime}`);
                  let plannedDiffInMinutes = differenceInMinutes(endTime, startTime);
                  console.log('計畫運行時間:', {
                    trainId: train.id,
                    trainNumber: train.current_train,
                    startTime: schedule.startingTime,
                    endTime: schedule.endingTime,
                    plannedDiffInMinutes
                  });
                  // 如果計畫運行時間為負，表示跨日
                  if (plannedDiffInMinutes < 0) {
                    plannedDiffInMinutes = differenceInMinutes(
                      new Date(`2024-01-02 ${schedule.endingTime}`),
                      new Date(`2024-01-01 ${schedule.startingTime}`)
                    );
                  }

                  // 計算預計抵達時間
                  let targetEndTime = endTimeDate;
                  if (endTimeDate < now) {
                    // 只有在以下情況才加一：
                    // 1. 計畫運行時間跨日
                    // 2. 或者 當前時間已經超過今天的結束時間，但計畫運行時間小於24小時
                    if (plannedDiffInMinutes > 1440 || // 超過24小時
                        (plannedDiffInMinutes < 1440 && endTimeDate < now)) { // 小於24小時但已過當前時間
                      targetEndTime = new Date(endTimeDate);
                      targetEndTime.setDate(targetEndTime.getDate() + 1);
                    }
                  }

                  const diffInMinutes = differenceInMinutes(targetEndTime, now);
                  console.log('時間計算:', {
                    trainId: train.id,
                    trainNumber: train.current_train,
                    now: now.toLocaleString(),
                    endTime: endTimeDate.toLocaleString(),
                    targetEndTime: targetEndTime.toLocaleString(),
                    plannedDiffInMinutes,
                    actualDiffInMinutes: diffInMinutes,
                    startingTime: schedule.startingTime,
                    endingTime: schedule.endingTime
                  });

                  if (diffInMinutes < 60) {
                    timeToDestination = `約 ${diffInMinutes} 分鐘後`;
                  } else if (diffInMinutes < 1440) { // 24小時 = 1440分鐘
                    const hours = Math.floor(diffInMinutes / 60);
                    const minutes = diffInMinutes % 60;
                    timeToDestination = minutes > 0 
                      ? `約 ${hours} 小時 ${minutes} 分鐘後`
                      : `約 ${hours} 小時後`;
                  } else {
                    const days = Math.floor(diffInMinutes / 1440);
                    const remainingHours = Math.floor((diffInMinutes % 1440) / 60);
                    timeToDestination = remainingHours > 0
                      ? `約 ${days} 天 ${remainingHours} 小時後`
                      : `約 ${days} 天後`;
                  }
                } else if (train.status === "等待出車" && startTimeDate && startTimeDate > now) {
                  timeToDestination = formatDistanceToNow(startTimeDate, { locale: zhTW, addSuffix: true });
                } else if (train.status === "已出車完畢" && endTimeDate && endTimeDate <= now) {
                  timeToDestination = format(endTimeDate, 'HH:mm', { locale: zhTW });
                }

                // 如果是運行中且已過期，返回 null
                if (train.status === "運行中" && endTimeDate && endTimeDate < now) {
                  return null;
                }

                // 已出車完畢的車輛特殊處理
                if (train.status === "已出車完畢") {
                  if (schedule.endingTime) {
                    const endTime = new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      now.getDate(),
                      parseInt(schedule.endingTime.split(':')[0]),
                      parseInt(schedule.endingTime.split(':')[1])
                    );

                    // 如果結束時間比現在早，表��是今天完成的
                    if (endTime <= now) {
                      timeToDestination = format(endTime, 'HH:mm', { locale: zhTW });
                    }
                  }
                }

                

                return {
                  ...train,
                  startStation: schedule.startingStationName,
                  endStation: schedule.endingStationName,
                  runningTime,
                  timeToDestination,
                  endTimeDate
                };
              }

              return { ...train };
            } catch (error) {
              console.error(`處理列車 ${train.id} 資料失敗:`, error);
              return { ...train };
            }
          })
        );

        // 排序邏輯：已出車完畢的車輛按照完成時間倒序排列（最晚完成的前面）
        const filteredAndSortedTrains = updatedTrains
          .filter((train): train is EnhancedTrain => train !== null)
          .sort((a, b) => {
            // 運行中的車輛按照抵達終點時間排序
            if (a.status === "運行中" && b.status === "運行中") {
              if (!a.endTimeDate) return 1;
              if (!b.endTimeDate) return -1;
              return a.endTimeDate.getTime() - b.endTimeDate.getTime();
            }

            // 等待出車的車輛按照開車時間排序
            if (a.status === "等待出車" && b.status === "等待出車") {
              // 如果兩者都有 current_train 或 prepare_train，保持原順序
              if ((a.current_train && b.current_train) || (a.prepare_train && b.prepare_train)) return 0;
              
              // 如果 a 有任一個而 b 都沒有，a 排前面
              if ((a.current_train || a.prepare_train) && (!b.current_train && !b.prepare_train)) return -1;
              
              // 如果 b 有任一個而 a 都沒有，b 排前面 
              if ((!a.current_train && !a.prepare_train) && (b.current_train || b.prepare_train)) return 1;
              
              // 都沒有的情況，保持原順序
              return 0;
            }

            // 已出車完畢的車輛按照完成時間倒序排列
            if (a.status === "已出車完畢" && b.status === "已出車完畢") {
              const timeA = a.timeToDestination || '00:00';
              const timeB = b.timeToDestination || '00:00';
              return timeB.localeCompare(timeA); // 倒序排列
            }

            // 維修車輛按照預計完工時間排序
            if (["在段待修", "臨修(C2)", "進廠檢修(3B)", "在段保養(2A)", "維修中"].includes(a.status) &&
                ["在段待修", "臨修(C2)", "進廠檢修(3B)", "在段保養(2A)", "維修中"].includes(b.status)) {
              const timeA = a.maintenanceDetails?.end_time || '';
              const timeB = b.maintenanceDetails?.end_time || '';
              return timeA.localeCompare(timeB);
            }

            // 預設排序（保持原有順序）
            return 0;
          });

        setEnhancedTrains(filteredAndSortedTrains);
      } catch (error) {
        console.error('獲取資料失敗:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchScheduleDetails();
  }, [trains]);

  useEffect(() => {
    if (status === "預備") {
      const fetchOtherDepotTrains = async () => {
        try {
          console.log('開始取其他段預備車...');
          const trains = await getOtherDepotTrains();
          console.log('獲取到其他段預備車:', trains);
          setOtherDepotTrains(trains);
        } catch (error) {
          console.error('獲取其他段預備車失敗:', error);
        }
      };
      fetchOtherDepotTrains();
    }
  }, [status]);

  if (!isOpen) return null;

  const toggleGroup = (trainId: string) => {
    setExpandedGroups(prev => 
      prev.includes(trainId) 
        ? prev.filter(id => id !== trainId)
        : [...prev, trainId]
    );
  };

  // LoadingSkeleton 組件
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-7 gap-4">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );

  // Title Skeleton 組件
  const TitleSkeleton = () => (
    <div className="animate-pulse flex items-center space-x-2">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
    </div>
  );

  // 渲染表頭
  const renderTableHeader = (status: string) => {
    // console.log(status)
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
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">目前所在地</TableHead>
          </TableRow>
        );
      case "在段待修":
      case "臨修(C2)":
      case "進廠檢修(3B)":
      case "在段保養(2A)":
      case "維修中":
        return (
          
            
            <TableRow>
              <TableHead className="w-[100px] sticky top-0 bg-white dark:bg-gray-800 pl-4">車號</TableHead>
              <TableHead className="sticky top-0 bg-white dark:bg-gray-800">狀態</TableHead>
              <TableHead className="sticky top-0 bg-white dark:bg-gray-800">所在段/廠</TableHead>
              <TableHead className="sticky top-0 bg-white dark:bg-gray-800">預計進廠</TableHead>
              <TableHead className="sticky top-0 bg-white dark:bg-gray-800">預計開工時間</TableHead>
              <TableHead className="sticky top-0 bg-white dark:bg-gray-800 pr-4">預計完工時間</TableHead>
              <TableHead className="sticky top-0 bg-white dark:bg-gray-800">預計工期</TableHead>
            </TableRow>
          
        );
      case "已出車完畢":
        return (
          <TableRow>
            <TableHead className="w-[100px] sticky top-0 bg-white dark:bg-gray-800 pl-4">車號</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">狀態</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">最後運行車次</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">起始站</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">終點站</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800">運行時間</TableHead>
            <TableHead className="sticky top-0 bg-white dark:bg-gray-800 pr-4">完成時間</TableHead>
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
          <>
            <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <TableCell className="font-medium pl-4">{train.id}</TableCell>
              <TableCell>
                <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                  {train.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    expandedSchedules?.trainId === train.id &&
                    expandedSchedules?.trainNumber === train.current_train
                      ? "ring-2 ring-sky-500"
                      : "bg-sky-500 text-white dark:bg-sky-600"
                  }`}
                  onClick={() => handleScheduleClick(train.id, train.current_train)}
                >
                  {loadingSchedule && 
                   expandedSchedules?.trainId === train.id && 
                   expandedSchedules?.trainNumber === train.current_train 
                    ? "載入中..." 
                    : train.current_train || '-'
                  }
                </Badge>
              </TableCell>
              <TableCell>{train.startStation || '-'}</TableCell>
              <TableCell>{train.endStation || '-'}</TableCell>
              <TableCell>{train.runningTime || '-'}</TableCell>
              <TableCell className="pr-4">{train.timeToDestination || '-'}</TableCell>
            </TableRow>
            {expandedSchedules?.trainId === train.id && selectedSchedule && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <TrainScheduleDetail
                    schedule={{
                      trainNumber: selectedSchedule.no,
                      stations: expandedSchedules.stations || []
                    }}
                  />
                </TableCell>
              </TableRow>
            )}
          </>
        );
      case "等待出車":
        return (
          <>
            <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <TableCell className="font-medium pl-4">{train.id}</TableCell>
              <TableCell>
                <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                  {train.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    expandedSchedules?.trainId === train.id &&
                    expandedSchedules?.trainNumber === (train.current_train || train.prepare_train)
                      ? "ring-2 ring-sky-500"
                      : "bg-sky-500 text-white dark:bg-sky-600"
                  }`}
                  onClick={() => handleScheduleClick(train.id, train.current_train || train.prepare_train)}
                >
                  {loadingSchedule && 
                   expandedSchedules?.trainId === train.id && 
                   expandedSchedules?.trainNumber === (train.current_train || train.prepare_train)
                    ? "載入中..." 
                    : train.current_train || train.prepare_train || '-'
                  }
                </Badge>
              </TableCell>
              <TableCell>{train.startStation || '-'}</TableCell>
              <TableCell>{train.endStation || '-'}</TableCell>
              <TableCell>{train.runningTime || '-'}</TableCell>
              <TableCell className="pr-4">{train.timeToDestination || '-'}</TableCell>
            </TableRow>
            {expandedSchedules?.trainId === train.id && selectedSchedule && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <TrainScheduleDetail
                    schedule={{
                      trainNumber: selectedSchedule.no,
                      stations: expandedSchedules.stations || []
                    }}
                  />
                </TableCell>
              </TableRow>
            )}
          </>
        );
      case "預備":
        return (
          <>
            <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <TableCell className="font-medium pl-4">{train.id}</TableCell>
              <TableCell>
                <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                  {train.status}
                </Badge>
              </TableCell>
              <TableCell>{train.current_station || '-'}</TableCell>
            </TableRow>

            {train.id === enhancedTrains[enhancedTrains.length - 1].id && (
              <>
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    <button
                      onClick={() => setShowOtherDepot(!showOtherDepot)}
                      className="flex items-center justify-center gap-2 w-full py-2 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                    >
                      {showOtherDepot ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      其他段預備車 ({otherDepotTrains.length})
                    </button>
                  </TableCell>
                </TableRow>

                {showOtherDepot && (
                  <TableRow>
                    <TableCell colSpan={3} className="p-0">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4">
                        <h4 className="text-sm font-semibold mb-2">其他段預備車列表</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">車號</TableHead>
                              <TableHead>狀態</TableHead>
                              <TableHead>所在地點</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {otherDepotTrains.map(otherTrain => (
                              <TableRow key={otherTrain.id}>
                                <TableCell className="font-medium">{otherTrain.id}</TableCell>
                                <TableCell>
                                  <Badge className={`${getStatusColor(otherTrain.status)} text-white px-3 py-1`}>
                                    {otherTrain.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{otherTrain.current_station || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </>
        );
      case "在段待修":
      case "臨修(C2)":
      case "進廠檢修(3B)":
      case "在段保養(2A)":
      case "維修中":
        // console.log('維修車輛料:', train.maintenanceDetails);
        return (
          <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="font-medium pl-4">{train.id}</TableCell>
            <TableCell>
              <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                {train.status}
              </Badge>
            </TableCell>
            <TableCell>{train.maintenanceDetails?.location || '-'}</TableCell>
            <TableCell>{train.maintenanceDetails?.entry_time || '-'}</TableCell>
            <TableCell>{train.maintenanceDetails?.start_time || '-'}</TableCell>
            <TableCell>{train.maintenanceDetails?.end_time || '-'}</TableCell>
            <TableCell className="pr-4">
              {train.maintenanceDetails?.duration_days ? `${train.maintenanceDetails.duration_days} 天` : '-'}
            </TableCell>
          </TableRow>
        );
      case "已出車完畢":
        return (
          <TableRow key={train.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <TableCell className="font-medium pl-4">{train.id}</TableCell>
            <TableCell>
              <Badge className={`${getStatusColor(train.status)} text-white px-3 py-1`}>
                {train.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  expandedSchedules?.trainId === train.id &&
                  expandedSchedules?.trainNumber === train.current_train
                    ? "ring-2 ring-sky-500"
                    : ""
                }`}
                onClick={() => handleScheduleClick(train.id, train.current_train)}
              >
                {loadingSchedule && 
                 expandedSchedules?.trainId === train.id && 
                 expandedSchedules?.trainNumber === train.current_train 
                  ? "載入中..." 
                  : train.current_train || '-'
                }
              </Badge>
            </TableCell>
            <TableCell>{train.startStation || '-'}</TableCell>
            <TableCell>{train.endStation || '-'}</TableCell>
            <TableCell>{train.runningTime || '-'}</TableCell>
            <TableCell className="pr-4">{train.timeToDestination || '-'}</TableCell>
          </TableRow>
        );
      default:
        return null;
    }
  };

  

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
            {isLoading ? (
              <TitleSkeleton />
            ) : (
              `${title} - 共 ${enhancedTrains.length} 輛`
            )}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="overflow-auto max-h-[calc(80vh-8rem)] p-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              
              <Table>
                <TableHeader>
                  {renderTableHeader(status)}
                </TableHeader>
                <TableBody>
                  {enhancedTrains.map(train => renderTableRow(train))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 從 train-dashboard.tsx 複製的 sortTrainNumbers 函數
async function sortTrainNumbers(schedules: TrainSchedule[], nextDaySchedules: TrainNextDaySchedule[]) {
  try {
    const schedulePromises = schedules.map(async (schedule) => {
      try {
        const data = await getTrainSchedule(schedule.train_number);
        return {
          ...schedule,
          departure_time: data.startingTime || '99:99',
          start_station: data.startingStationName || '-',
          end_station: data.endingStationName || '-',
          arrival_time: data.endingTime || '-'
        };
      } catch (error) {
        console.error(`獲取車次 ${schedule.train_number} 時刻表失敗:`, error);
        return {
          ...schedule,
          departure_time: '99:99',
          start_station: '-',
          end_station: '-',
          arrival_time: '-'
        };
      }
    });

    const schedulesWithTime = await Promise.all(schedulePromises);
    
    const sortedSchedules = schedulesWithTime.sort((a, b) => {
      const timeA = a.departure_time || '99:99';
      const timeB = b.departure_time || '99:99';
      return timeA.localeCompare(timeB);
    });

    return {
      todaySchedules: sortedSchedules,
      firstSchedule: sortedSchedules[0] || null,
      lastSchedule: sortedSchedules[sortedSchedules.length - 1] || null,
      nextDaySchedules: nextDaySchedules
    };
  } catch (error) {
    console.error('排車次時發生錯誤:', error);
    return {
      todaySchedules: schedules,
      firstSchedule: null,
      lastSchedule: null,
      nextDaySchedules: nextDaySchedules
    };
  }
} 