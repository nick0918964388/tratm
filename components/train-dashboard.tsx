"use client"

import React, { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { 
  Train as TrainIcon,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Wrench
} from 'lucide-react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { TrainScheduleDetail } from "@/components/train-schedule"
import { Train, TrainGroup, Station, TrainNextDaySchedule, TrainSchedule } from "@/types/train"
import { TitleBar } from "@/components/title-bar"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { supabase } from '@/lib/supabase'
import { getTrainSchedule, TrainDetail, getStationDetails, parseLiveData, getTrainLive, getTrainData } from "@/lib/api"
import { StatusModal } from "@/components/status-modal"
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

interface DashboardProps {
  initialData: {
    groups: TrainGroup[]
    stationSchedules: Station[]
  }
}

interface ProcessedTrain extends Omit<Train, 'schedules'> {
  schedules: TrainSchedule[];
  current_train: string;
  prepare_train: string;
  current_station: string;
  next_station: string;
  scheduled_departure: string;
  estimated_arrival: string;
  next_day_schedules: TrainNextDaySchedule[];
  scheduleDetails: Array<{
    trainNumber: string;
    stations: Array<{
      name: string;
      scheduledArrival: string;
      scheduledDeparture: string;
      actualArrival?: string;
      actualDeparture?: string;
      status: "已過站" | "當前站" | "未到站";
      delay?: number;
    }>;
  }>;
}

interface ProcessedTrainGroup extends Omit<TrainGroup, 'trains'> {
  trains: ProcessedTrain[];
}

interface DatabaseChangesPayload {
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: {
    id: string;
    current_train: string;
    prepare_train: string;
    current_station: string;
    next_station: string;
    status: string;
    [key: string]: any;
  };
  old: {
    id: string;
    [key: string]: any;
  };
  schema: string;
  table: string;
}

// 在 TrainDashboard 組義快取
const scheduleCache = new Map<string, {
  data: {
    departure_time: string;
    start_station: string;
    end_station: string;
    arrival_time: string;
  };
  timestamp: number;
}>();

// 首先創建一個新的 TrainRow 組件
const TrainRow = ({ 
  train, 
  expandedSchedules, 
  expandedGroups,
  groupId,
  loadingSchedule, 
  handleScheduleClick,
  selectedSchedule,
  getStatusColor,
  sortTrainNumbers
}: {
  train: ProcessedTrain;
  expandedSchedules: any;
  expandedGroups: string[];
  groupId: string;
  loadingSchedule: boolean;
  handleScheduleClick: (trainId: string, trainNo: string) => void;
  selectedSchedule: TrainDetail | null;
  getStatusColor: (status: string) => string;
  sortTrainNumbers: (schedules: TrainSchedule[], nextDaySchedules: TrainNextDaySchedule[]) => Promise<any>;
}) => {
  const [sortedScheduleInfo, setSortedScheduleInfo] = useState<{
    todaySchedules: TrainSchedule[];
    firstSchedule: TrainSchedule | null;
    lastSchedule: TrainSchedule | null;
    nextDaySchedules: TrainNextDaySchedule[];
  }>({
    todaySchedules: train.schedules || [],
    firstSchedule: null,
    lastSchedule: null,
    nextDaySchedules: train.next_day_schedules || []
  });

  useEffect(() => {
    if (expandedGroups.includes(groupId)) {
      const sortSchedules = async () => {
        try {
          const scheduleInfo = await sortTrainNumbers(
            train.schedules || [], 
            train.next_day_schedules || []
          );
          setSortedScheduleInfo(scheduleInfo);
        } catch (error) {
          console.error('排序車次失敗:', error);
        }
      };
      sortSchedules();
    }
  }, [train.schedules, train.next_day_schedules, expandedGroups, groupId]);

  return (
    <React.Fragment>
      <TableRow>
        <TableCell className="font-medium">{train.id}</TableCell>
        <TableCell>
          <Badge className={`${getStatusColor(train.status)} text-white`}>
            {train.status}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {sortedScheduleInfo.todaySchedules.map((schedule) => (
              <Badge
                key={schedule.train_number}
                variant="outline"
                className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  train.current_train === schedule.train_number && train.status !== "已出車完畢"
                    ? "bg-sky-500 text-white dark:bg-sky-600"
                    : ""
                } ${
                  expandedSchedules?.trainId === train.id &&
                  expandedSchedules?.trainNumber === schedule.train_number
                    ? "ring-2 ring-sky-500"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleScheduleClick(train.id, schedule.train_number);
                }}
              >
                {loadingSchedule && 
                 expandedSchedules?.trainId === train.id && 
                 expandedSchedules?.trainNumber === schedule.train_number 
                  ? "載入中..." 
                  : schedule.train_number
                }
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {sortedScheduleInfo.nextDaySchedules?.map((schedule) => (
              <Badge 
                key={schedule.train_number} 
                variant="outline"
                className="bg-gray-50 dark:bg-gray-800"
              >
                {schedule.train_number}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell className="bg-blue-100/30 dark:bg-blue-950/10">
          {sortedScheduleInfo.firstSchedule?.start_station || '-'}
        </TableCell>
        <TableCell className="bg-blue-100/30 dark:bg-blue-950/10">
          {sortedScheduleInfo.firstSchedule?.departure_time || '-'}
        </TableCell>
        <TableCell className="bg-green-100/30 dark:bg-green-950/10">
          {train.current_station}
        </TableCell>
        <TableCell className="bg-green-100/30 dark:bg-green-950/10">
          {train.next_station}
        </TableCell>
        <TableCell className="bg-green-100/30 dark:bg-green-950/10">
          {train.estimated_arrival}
        </TableCell>
        <TableCell className="bg-green-100/30 dark:bg-green-950/10">
          {train.scheduled_departure}
        </TableCell>
        <TableCell className="bg-purple-100/30 dark:bg-purple-950/10">
          {sortedScheduleInfo.lastSchedule?.end_station || '-'}
        </TableCell>
        <TableCell className="bg-purple-100/30 dark:bg-purple-950/10">
          {sortedScheduleInfo.lastSchedule?.arrival_time || '-'}
        </TableCell>
        <TableCell>{train.driver}</TableCell>
      </TableRow>
      {expandedSchedules?.trainId === train.id && selectedSchedule && (
        <TableRow>
          <TableCell colSpan={9} className="p-0">
            <TrainScheduleDetail
              schedule={{
                trainNumber: selectedSchedule.no,
                stations: expandedSchedules.stations || []
              }}
            />
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
};

// 動態導入地圖組件以避免 SSR 問題
const TrainMap = dynamic(() => import('@/components/train-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>
  )
})

export function TrainDashboard({ initialData }: DashboardProps) {
  // console.log('TrainDashboard 初始化')
  // console.log('接收到初始資料:', initialData)

  const [searchTerm, setSearchTerm] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => 
    []  // 預設展開的車型列表
  )
  const [expandedSchedules, setExpandedSchedules] = useState<{
    trainId: string;
    trainNumber: string;
    stations?: Array<{
      name: string;
      scheduledArrival: string;
      scheduledDeparture: string;
      actualArrival?: string;
      actualDeparture?: string;
      status: "已過站" | "當前站" | "未到站";
      delay?: number;
    }>;
  } | null>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [selectedSchedule, setSelectedSchedule] = useState<TrainDetail | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [stationMap, setStationMap] = useState<{ [key: string]: string }>({})
  const [selectedStatus, setSelectedStatus] = useState<{
    title: string;
    status: string;
    trains: Train[];
  } | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({
    key: 'status',
    direction: 'asc'
  });

  useEffect(() => {
    // 立即更新一次時間，確保客戶端和服務器端同步
    setCurrentTime(new Date())
    
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // 設置實時訂閱
    const trainsSubscription = supabase
      .channel('trains-changes')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'trains'
        },
        async (payload: DatabaseChangesPayload) => {
          console.log('收到列車狀態更新:', payload);
          
          try {
            // 獲取最新的列車資料，含所有關聯資料
            const { data: updatedTrainData, error } = await supabase
              .from('trains')
              .select(`
                *,
                schedules:train_schedules (*),
                next_day_schedules:train_next_day_schedules (*),
                station_schedules (*)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) {
              console.error('獲取更新資料失敗:', error);
              return;
            }

            if (updatedTrainData) {
              // 更新本地狀態
              setGroups(currentGroups => {
                return currentGroups.map(group => ({
                  ...group,
                  trains: group.trains.map(train => {
                    if (train.id === payload.new.id) {
                      // 處理更新的列車資料
                      const processedTrain: ProcessedTrain = {
                        ...train,
                        ...updatedTrainData,
                        schedules: updatedTrainData.schedules?.map((s: TrainSchedule) => s.train_number) || [],
                        current_train: updatedTrainData.current_train,
                        prepare_train: updatedTrainData.prepare_train,
                        current_station: updatedTrainData.current_station,
                        next_station: updatedTrainData.next_station,
                        scheduled_departure: updatedTrainData.scheduled_departure,
                        estimated_arrival: updatedTrainData.estimated_arrival,
                        next_day_schedules: updatedTrainData.next_day_schedules || [],
                        scheduleDetails: updatedTrainData.station_schedules ? [{
                          trainNumber: updatedTrainData.current_train,
                          stations: updatedTrainData.station_schedules.map((s: Station) => ({
                            name: s.station_name,
                            scheduledArrival: s.scheduled_arrival,
                            scheduledDeparture: s.scheduled_departure,
                            actualArrival: s.actual_arrival,
                            actualDeparture: s.actual_departure,
                            status: s.status,
                            delay: s.delay
                          }))
                        }] : []
                      };
                      return processedTrain;
                    }
                    return train;
                  })
                }));
              });
            }
          } catch (error) {
            console.error('處理更新資料時發生錯誤:', error);
          }
        }
      )
      .subscribe();

    // 清理訂閱
    return () => {
      supabase.removeChannel(trainsSubscription);
    };
  }, []);

  useEffect(() => {
    async function loadStationDetails() {
      try {
        const stations = await getStationDetails()
        const map = stations.reduce((acc, station) => {
          acc[station.station_id] = station.station_name
          return acc
        }, {} as { [key: string]: string })
        setStationMap(map)
      } catch (error) {
        console.error('獲取站點資料失敗:', error)
      }
    }
    loadStationDetails()
  }, [])

  const refreshData = async () => {
    try {
      const data = await getTrainData()
      console.log('新的資料:', data)
      
      // 更新本地狀態
      setGroups(processGroupData(data.groups))
      setStationSchedules(data.stationSchedules)

      // 更新 Supabase 資料表
      const updatePromises = data.groups.flatMap(group =>
        (group.trains || []).map(async (train) => {
          try {
            const { error } = await supabase
              .from('trains')
              .update({
                status: train.status,
                current_train: train.current_train,
                current_station: train.current_station,
                next_station: train.next_station,
                scheduled_departure: train.scheduled_departure,
                estimated_arrival: train.estimated_arrival,
                driver: train.driver
              })
              .eq('id', train.id)

            if (error) {
              console.error(`更新列車 ${train.id} 資料失敗:`, error)
            }
          } catch (error) {
            console.error(`更新列車 ${train.id} 時發生錯誤:`, error)
          }
        })
      )

      // 等待所有更新完成
      await Promise.all(updatePromises)
      
    } catch (error) {
      console.error('重新獲取資料失敗:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshData()
    } finally {
      setRefreshing(false)
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
  }

  const toggleSchedule = (trainId: string, trainNumber: string) => {
    setExpandedSchedules((prev) =>
      prev?.trainId === trainId && prev.trainNumber === trainNumber
        ? null
        : { trainId, trainNumber }
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "運行中":
        return "bg-emerald-500"
      case "準備中":
        return "bg-sky-500"
      case "等待出車":
        return "bg-yellow-500"
      case "出車完畢":
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

  const filterTrainGroups = (groups: ProcessedTrainGroup[]) => {
    return groups
      .map((group) => ({
        ...group,
        trains: (group.trains ?? [])
          .filter((train) => {
            // 只示運行中、等待出車和已出車完畢的車輛
            const visibleStatuses = ["運行中", "等待出車", "已出車完畢"];
            return (
              visibleStatuses.includes(train.status) &&
              train.id.toLowerCase().includes(searchTerm.toLowerCase())
            );
          })
          .sort((a, b) => {
            // 先按照車型分類
            const typeA = a.id.match(/^[A-Za-z]+/)?.[0] || '';
            const typeB = b.id.match(/^[A-Za-z]+/)?.[0] || '';
            if (typeA !== typeB) {
              return typeA.localeCompare(typeB);
            }
            // 再按照數字排序
            const numA = parseInt(a.id.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.id.match(/\d+/)?.[0] || '0');
            return numA - numB;
          })
      }))
      .filter((group) => group.trains.length > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  const processTrainData = (trains: Train[]): ProcessedTrain[] => {
    console.log('開始處理列車資料，數量:', trains.length)
    
    return trains.map(train => {
      console.log(`處理列車 ${train.id} 的資料`)
      const processed = {
        ...train,
        schedules: train.schedules || [],  // 確保有預設值
        current_train: train.current_train || '',  // 確保有預設值
        prepare_train: train.prepare_train || '',
        current_station: train.current_station || '',
        next_station: train.next_station || '',
        scheduled_departure: train.scheduled_departure || '',
        estimated_arrival: train.estimated_arrival || '',
        next_day_schedules: train.next_day_schedules || [],
        scheduleDetails: train.station_schedules ? [{
          trainNumber: train.current_train || '',
          stations: train.station_schedules.map((s: Station) => ({
            name: s.station_name,
            scheduledArrival: s.scheduled_arrival,
            scheduledDeparture: s.scheduled_departure,
            actualArrival: s.actual_arrival,
            actualDeparture: s.actual_departure,
            status: s.status,
            delay: s.delay
          }))
        }] : []
      }
      console.log(`列車 ${train.id} 處理完成:`, processed)
      return processed
    })
  }

  const processGroupData = (groups: TrainGroup[]): ProcessedTrainGroup[] => {
    return groups.map(group => ({
      ...group,
      trains: processTrainData(group.trains || [])
    }))
  }

  const [groups, setGroups] = useState<ProcessedTrainGroup[]>(() => {
    console.log('處理初始資料中...')    
    const processedGroups = processGroupData(initialData.groups)
    console.log('初始資料處理完成:', processedGroups)
    return processedGroups
  })
  const [stationSchedules, setStationSchedules] = useState<Station[]>(() => {
    console.log('設置初始站點時刻表...')
    return initialData.stationSchedules
  })

  const filteredGroups = filterTrainGroups(groups)
  const allTrains = groups.flatMap((group) => group.trains || [])

  const handleScheduleClick = async (trainId: string, trainNo: string) => {
    try {
      // 如果已經展，就關閉
      if (expandedSchedules?.trainId === trainId && expandedSchedules?.trainNumber === trainNo) {
        setExpandedSchedules(null)
        return
      }

      setLoadingSchedule(true)
      console.log('點擊車次:', trainNo)
      
      // 同時獲取時刻表和即時資訊
      const [scheduleData, liveData] = await Promise.all([
        getTrainSchedule(trainNo),
        getTrainLive(trainNo)
      ])
      
      console.log('獲取到時刻表:', scheduleData)
      console.log('獲取即時資訊:', liveData)
      
      // 解析即時資訊
      const { currentStationId, nextStationId, delayMap } = parseLiveData(trainNo, liveData)
      
      // 合併時刻表和即時資訊
      const combinedStations = scheduleData.stopTimes.map(stop => {
        const stationName = stationMap[stop.stationId] || stop.stationId
        const delay = delayMap[stop.stationId]
        
        // 判斷站點狀態
        let status: "已過站" | "當前站" | "未到站" = "未到站"
        
        // 解析即時更新時間和發車時間
        const now = new Date(liveData.liveUpdateTime.replace(/\//g, '-'))
        const departureTime = new Date(now.toDateString() + ' ' + stop.departureTime)
        
        // 取得最後一站的發車時間
        const lastStop = scheduleData.stopTimes[scheduleData.stopTimes.length - 1]
        const lastDepartureTime = new Date(now.toDateString() + ' ' + lastStop.departureTime)

        // 如果有誤點資訊，表示列車已經過站或正在該站
        if (typeof delay !== 'undefined') {
          if (stop.stationId === currentStationId) {
            status = "當前站"
          } else {
            status = "已過站"
          }
        } else {
          status = "未到站"
        }

        return {
          name: `${stationName}(${stop.stationId})`,
          scheduledArrival: stop.arrivalTime,
          scheduledDeparture: stop.departureTime,
          actualArrival: status === "已過站" || status === "當前站" ? stop.arrivalTime : undefined,
          actualDeparture: status === "已過站" ? stop.departureTime : undefined,
          status,
          delay: typeof delay !== 'undefined' ? delay : undefined
        }
      })

      // 更新選中的時刻表資料
      setSelectedSchedule({
        ...scheduleData,
        stopTimes: scheduleData.stopTimes.map(stop => ({
          ...stop,
          stationName: stationMap[stop.stationId] || stop.stationId
        }))
      })

      // 傳遞合併後的資料給 TrainScheduleDetail
      setExpandedSchedules({ 
        trainId, 
        trainNumber: trainNo,
        stations: combinedStations || []
      })

    } catch (error) {
      console.error('獲取列車資訊失敗:', error)
      alert('獲取列車資訊失敗，請稍後再試')
    } finally {
      setLoadingSchedule(false)
    }
  }

  // 在 handleCardClick 函數中添加排序邏輯
  const handleCardClick = (status: string, title: string) => {
    const filteredTrains = allTrains
      .filter((t) => {
        if (status === "維修中") {
          return ["在段待修", "臨修(C2)", "進廠檢修(3B)", "��段保養(2A)"].includes(t.status);
        }
        return t.status === status;
      })
      .sort((a, b) => {
        // 如果是等待出車狀態，則按預計發車時間排序
        if (status === "等待出車") {
          // 將時間字轉換為 Date 對象進行比較
          const timeA = a.scheduled_departure ? new Date(`2000/01/01 ${a.scheduled_departure}`) : new Date(9999, 11, 31);
          const timeB = b.scheduled_departure ? new Date(`2000/01/01 ${b.scheduled_departure}`) : new Date(9999, 11, 31);
          return timeA.getTime() - timeB.getTime();
        }

        // 其他狀態保持原有的排序邏輯
        const typeA = a.id.match(/^[A-Za-z]+/)?.[0] || '';
        const typeB = b.id.match(/^[A-Za-z]+/)?.[0] || '';
        if (typeA !== typeB) {
          return typeA.localeCompare(typeB);
        }
        const numA = parseInt(a.id.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.id.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });

    setSelectedStatus({
      title,
      status,
      trains: filteredTrains
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: groups } = await supabase
        .from('train_groups')
        .select(`
          *,
          trains:trains (
            *,
            schedules:train_schedules (*),
            next_day_schedules:train_next_day_schedules (*)
          )
        `)
      console.log('獲取到的資料:', groups)      
    }
    fetchData()
  }, [])

  const sortTrains = (trains: ProcessedTrain[], key: string, direction: 'asc' | 'desc') => {
    return [...trains].sort((a: any, b: any) => {
      if (a[key] === null || a[key] === undefined) return 1;
      if (b[key] === null || b[key] === undefined) return -1;
      
      // 特殊處理狀態排序
      if (key === 'status') {
        const statusOrder: { [key: string]: number } = {
          '運行中': 1,
          '等待出車': 2,
          '已出車完畢': 3,
          '預備': 4,
          '在段待修': 5,
          '臨修(C2)': 6,
          '進廠檢修(3B)': 7,
          '在段保養(2A)': 8
        };
        
        const orderA = statusOrder[a[key] as string] || 999;
        const orderB = statusOrder[b[key] as string] || 999;
        
        if (direction === 'asc') {
          return orderA - orderB;
        }
        return orderB - orderA;
      }
      
      // 特殊處理車號排序
      if (key === 'id') {
        const typeA = a.id.match(/^[A-Za-z]+/)?.[0] || '';
        const typeB = b.id.match(/^[A-Za-z]+/)?.[0] || '';
        if (typeA !== typeB) {
          return direction === 'asc' 
            ? typeA.localeCompare(typeB)
            : typeB.localeCompare(typeA);
        }
        const numA = parseInt(a.id.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.id.match(/\d+/)?.[0] || '0');
        return direction === 'asc' ? numA - numB : numB - numA;
      }
      
      return direction === 'asc'
        ? a[key]?.toString().localeCompare(b[key]?.toString())
        : b[key]?.toString().localeCompare(a[key]?.toString());
    });
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 修改 sortTrainNumbers 函，加入快取機制
  const sortTrainNumbers = async (schedules: TrainSchedule[], nextDaySchedules: TrainNextDaySchedule[]) => {
    try {
      // 處理今日車次
      const schedulePromises = schedules.map(async (schedule) => {
        try {
          const cacheKey = schedule.train_number;
          const now = Date.now();
          const cached = scheduleCache.get(cacheKey);
          
          // 如果快取存在且未過期（5分鐘）
          if (cached && (now - cached.timestamp) < 5 * 60 * 1000) {
            console.log(`使用快取資料: ${cacheKey}`);
            return {
              ...schedule,
              ...cached.data
            };
          }

          // 如果沒有快取或已過期，則獲取新資料
          console.log(`獲取新資料: ${cacheKey}`);
          const data = await getTrainSchedule(schedule.train_number);
          const scheduleData = {
            departure_time: data.startingTime || '99:99',
            start_station: `${data.startingStationName}(${data.stopTimes[0]?.stationId || ''})` || '-',
            end_station: `${data.endingStationName}(${data.stopTimes[data.stopTimes.length - 1]?.stationId || ''})` || '-',
            arrival_time: data.endingTime || '-'
          };

          // 存到快取
          scheduleCache.set(cacheKey, {
            data: scheduleData,
            timestamp: now
          });

          return {
            ...schedule,
            ...scheduleData
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

      // 處理明日車次
      const nextDaySchedulePromises = nextDaySchedules.map(async (schedule) => {
        try {
          const cacheKey = `next_${schedule.train_number}`;
          const now = Date.now();
          const cached = scheduleCache.get(cacheKey);
          
          if (cached && (now - cached.timestamp) < 5 * 60 * 1000) {
            console.log(`使用快取資料: ${cacheKey}`);
            return {
              ...schedule,
              ...cached.data
            };
          }

          console.log(`獲取新資料: ${cacheKey}`);
          const data = await getTrainSchedule(schedule.train_number);
          const scheduleData = {
            departure_time: data.startingTime || '99:99',
            start_station: `${data.startingStationName}(${data.stopTimes[0]?.stationId || ''})` || '-',
            end_station: `${data.endingStationName}(${data.stopTimes[data.stopTimes.length - 1]?.stationId || ''})` || '-',
            arrival_time: data.endingTime || '-'
          };

          scheduleCache.set(cacheKey, {
            data: scheduleData,
            timestamp: now
          });

          return {
            ...schedule,
            ...scheduleData
          };
        } catch (error) {
          console.error(`獲取明日車次 ${schedule.train_number} 時刻表失敗:`, error);
          return {
            ...schedule,
            departure_time: '99:99'
          };
        }
      });

      // 等待所有請求完成
      const [schedulesWithTime, nextDaySchedulesWithTime] = await Promise.all([
        Promise.all(schedulePromises),
        Promise.all(nextDaySchedulePromises)
      ]);

      // 根據發車時間排序
      const sortedSchedules = schedulesWithTime.sort((a, b) => {
        const timeA = a.departure_time || '99:99';
        const timeB = b.departure_time || '99:99';
        return timeA.localeCompare(timeB);
      });

      const sortedNextDaySchedules = nextDaySchedulesWithTime.sort((a, b) => {
        const timeA = a.departure_time || '99:99';
        const timeB = b.departure_time || '99:99';
        return timeA.localeCompare(timeB);
      });

      return {
        todaySchedules: sortedSchedules,
        firstSchedule: sortedSchedules[0] || null,
        lastSchedule: sortedSchedules[sortedSchedules.length - 1] || null,
        nextDaySchedules: sortedNextDaySchedules
      };
    } catch (error) {
      console.error('排序車次時發生錯誤:', error);
      return {
        todaySchedules: schedules,
        firstSchedule: null,
        lastSchedule: null,
        nextDaySchedules: nextDaySchedules
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TitleBar 
        onRefresh={handleRefresh} 
        refreshing={refreshing}
        schedules={allTrains.flatMap(train => train.schedules.map(s => s.train_number))}
      />
      
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              七堵機務段
            </h2>
            <p className="text-sm text-muted-foreground">
              配置車輛：{allTrains.length} 輛
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="搜尋車號..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[150px] md:w-[200px]"
            />
            <Search className="h-4 w-4 text-gray-500" />
          </div>
        </div>

        <Tabs defaultValue="monitor" className="space-y-4">
          <TabsList className="bg-white dark:bg-gray-800 p-1 rounded-lg">
            <TabsTrigger value="monitor" className="data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-700">
              即時24點報監控
            </TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-700">
              運轉明細
            </TabsTrigger>
            <TabsTrigger value="map" className="data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-700">
              列車地圖
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitor">
            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle>七堵機務段 即時24點報監控</CardTitle>
                <CardDescription>
                  即時顯示各類型車輛數量統計
                </CardDescription>
              </CardHeader>
              <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* 運行中車輛卡片 */}
                <Card 
                  className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCardClick("運行中", "運行中車輛")}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">運行中車輛</CardTitle>
                    <TrainIcon className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {allTrains.filter((t) => t.status === "運行中").length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      正常運行中的車輛數量
                    </p>
                  </CardContent>
                </Card>

                {/* 等待出車卡片 */}
                <Card 
                  className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCardClick("等待出車", "等待出車")}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">等待出車</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {allTrains.filter((t) => t.status === "等待出車").length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      等待出車的車輛數量
                    </p>
                  </CardContent>
                </Card>

                {/* 預備車輛卡片 */}
                <Card 
                  className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCardClick("預備", "預備車輛")}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">預備車輛</CardTitle>
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {allTrains.filter((t) => t.status === "預備").length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      預備中的車輛數量
                    </p>
                  </CardContent>
                </Card>

                {/* 維修中車輛卡片 */}
                <Card 
                  className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCardClick("維修中", "維修中車輛")}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">維修中車輛</CardTitle>
                    <Wrench className="h-4 w-4 text-rose-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {allTrains.filter((t) => 
                        ["在段待修", "臨修(C2)", "進廠檢修(3B)", "在段保養(2A)"].includes(t.status)
                      ).length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      所有維修保養中的車輛數量
                    </p>
                  </CardContent>
                </Card>

                {/* 已出車畢卡片 */}
                <Card 
                  className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCardClick("已出車完畢", "已出車完畢車輛")}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">已出車完畢</CardTitle>
                    <Clock className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {allTrains.filter(t => t.status === "已出車完畢").length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      顯示今日已完成運行的車輛
                    </p>
                  </CardContent>
                </Card>
              </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card className="bg-white dark:bg-gray-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>車輛運轉現況</CardTitle>
                  <CardDescription>
                    即時顯示本日目前 七堵機務段 所有車的運行狀態與位置資訊
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" suppressHydrationWarning>
                    {format(currentTime, "HH:mm:ss")}
                  </div>
                  <div className="text-sm text-muted-foreground" suppressHydrationWarning>
                    {format(currentTime, "yyyy年MM月dd日 EEEE", { locale: zhTW })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredGroups.map((group) => {
                    // 在這裡應用排序
                    const sortedTrains = sortConfig 
                      ? sortTrains(group.trains, sortConfig.key, sortConfig.direction)
                      : group.trains;

                    return (
                      <div key={group.id} className="border rounded-lg">                  
                        <button
                          onClick={() => toggleGroup(group.id)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedGroups.includes(group.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-medium">{group.name}</span>
                            <Badge variant="outline">
                              {group.trains.length} 輛列車
                            </Badge>
                          </div>
                        </button>
                        {expandedGroups.includes(group.id) && (
                          <div className="border-t bg-white dark:bg-gray-800">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead 
                                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    onClick={() => handleSort('id')}
                                  >
                                    號 {sortConfig?.key === 'id' && (
                                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                  </TableHead>
                                  <TableHead 
                                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    onClick={() => handleSort('status')}
                                  >
                                    狀態 {sortConfig?.key === 'status' && (
                                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                  </TableHead>
                                  <TableHead>今日車次</TableHead>
                                  <TableHead>明日車次</TableHead>
                                  <TableHead className="bg-blue-100/50 dark:bg-blue-950/40">起始站</TableHead>
                                  <TableHead className="bg-blue-100/50 dark:bg-blue-950/40">始發時刻</TableHead>
                                  <TableHead className="bg-green-100/50 dark:bg-green-950/40">目前車站</TableHead>
                                  <TableHead className="bg-green-100/50 dark:bg-green-950/40">下一站</TableHead>
                                  <TableHead className="bg-green-100/50 dark:bg-green-950/40">預計到達時間</TableHead>
                                  <TableHead className="bg-green-100/50 dark:bg-green-950/40">預計發車時間</TableHead>
                                  <TableHead className="bg-purple-100/50 dark:bg-purple-950/40">終點站</TableHead>
                                  <TableHead className="bg-purple-100/50 dark:bg-purple-950/40">終點站時間</TableHead>
                                  <TableHead>司機員</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedTrains.map((train) => (
                                  <TrainRow
                                    key={train.id}
                                    train={train}
                                    expandedSchedules={expandedSchedules}
                                    expandedGroups={expandedGroups}
                                    groupId={group.id}
                                    loadingSchedule={loadingSchedule}
                                    handleScheduleClick={handleScheduleClick}
                                    selectedSchedule={selectedSchedule}
                                    getStatusColor={getStatusColor}
                                    sortTrainNumbers={sortTrainNumbers}
                                  />
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map">
            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle>列車即時位置地圖</CardTitle>
                <CardDescription>
                  顯示目前運行中列車的即時位置
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrainMap trains={allTrains.filter(train => train.status === "運行中")} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedStatus && (
        <StatusModal
          isOpen={!!selectedStatus}
          onClose={() => setSelectedStatus(null)}
          title={selectedStatus.title}
          trains={selectedStatus.trains}
          status={selectedStatus.status}
          handleScheduleClick={handleScheduleClick}
          expandedSchedules={expandedSchedules}
          selectedSchedule={selectedSchedule}
          loadingSchedule={loadingSchedule}
        />
      )}
    </div>
  )
}

