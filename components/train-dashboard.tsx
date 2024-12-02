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

import { TrainScheduleDetail } from "@/components/train-schedule"
import { Train, TrainGroup, Station, TrainNextDaySchedule, TrainSchedule } from "@/types/train"
import { TitleBar } from "@/components/title-bar"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { supabase } from '@/lib/supabase'
import { getTrainSchedule, TrainDetail, getStationDetails, parseLiveData, getTrainLive, getTrainData } from "@/lib/api"
import { StatusModal } from "@/components/status-modal"

interface DashboardProps {
  initialData: {
    groups: TrainGroup[]
    stationSchedules: Station[]
  }
}

interface ProcessedTrain extends Omit<Train, 'schedules'> {
  schedules: string[];
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

export function TrainDashboard({ initialData }: DashboardProps) {
  // console.log('TrainDashboard 初始化')
  // console.log('接收到初始資料:', initialData)

  const [searchTerm, setSearchTerm] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => 
    ['EMU3000', 'EMU900', 'E1000', 'PP', 'DR']  // 預設展開的車型列表
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
  } | null>(null);

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
            // 獲取最新的列車資料，包含所有關聯資料
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
        console.error('獲取車站資訊失敗:', error)
      }
    }
    loadStationDetails()
  }, [])

  const refreshData = async () => {
    try {
      const data = await getTrainData()
      console.log('更新的資料:', data)
      setGroups(processGroupData(data.groups))
      setStationSchedules(data.stationSchedules)
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

  const filterTrainGroups = (groups: ProcessedTrainGroup[]) => {
    
    return groups
      .map((group) => ({
        ...group,
        trains: (group.trains || [])
          .filter((train) =>
            train.id.toLowerCase().includes(searchTerm.toLowerCase())
          )
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
        schedules: train.schedules?.map((s: TrainSchedule) => s.train_number) || [],
        current_train: train.current_train,
        prepare_train: train.prepare_train,
        current_station: train.current_station,
        next_station: train.next_station,
        scheduled_departure: train.scheduled_departure,
        estimated_arrival: train.estimated_arrival,
        next_day_schedules: train.next_day_schedules || [],
        scheduleDetails: train.station_schedules ? [{
          trainNumber: train.current_train,
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
      // 如果已經展開，就關閉
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
      console.log('獲取到即時資訊:', liveData)
      
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

  // 添加一個通用的卡片點擊處���數
  const handleCardClick = (status: string, title: string) => {
    const filteredTrains = allTrains
      .filter((t) => t.status === status)
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
      }) as unknown as Train[];

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TitleBar 
        onRefresh={handleRefresh} 
        refreshing={refreshing}
        schedules={allTrains.flatMap(train => train.schedules)}
      />
      
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              即時控面板
            </h2>
            <p className="text-sm text-muted-foreground">
              目監控中車輛：{allTrains.length} 輛
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

        {/* 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
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
          <Card 
            className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleCardClick("在段待修", "在段待修")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">在段待修</CardTitle>
              <Wrench className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTrains.filter((t) => t.status === "在段待修").length}
              </div>
              <p className="text-xs text-muted-foreground">
                在段待修的車輛數量
              </p>
            </CardContent>
          </Card>
          <Card 
            className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleCardClick("臨修(C2)", "臨修(C2)")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">臨(C2)</CardTitle>
              <Wrench className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTrains.filter((t) => t.status === "臨修(C2)").length}
              </div>
              <p className="text-xs text-muted-foreground">
                臨修中的車輛數量
              </p>
            </CardContent>
          </Card>
          <Card 
            className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleCardClick("進廠檢修(3B)", "進廠檢修(3B)")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">進廠檢修(3B)</CardTitle>
              <Wrench className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTrains.filter((t) => t.status === "進廠檢修(3B)").length}
              </div>
              <p className="text-xs text-muted-foreground">
                進廠檢修的車輛數量
              </p>
            </CardContent>
          </Card>
          <Card 
            className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleCardClick("在段保養(2A)", "在段保養(2A)")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">在段保養(2A)</CardTitle>
              <Wrench className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTrains.filter((t) => t.status === "在段保養(2A)").length}
              </div>
              <p className="text-xs text-muted-foreground">
                在段保養的車輛數量
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 列表 */}
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>車輛運轉況</CardTitle>
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
                                車號 {sortConfig?.key === 'id' && (
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
                              <TableHead 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                onClick={() => handleSort('current_train')}
                              >
                                目前車次 {sortConfig?.key === 'current_train' && (
                                  <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </TableHead>
                              <TableHead>下一車次</TableHead>
                              <TableHead>今日車次</TableHead>
                              <TableHead>明日車次</TableHead>
                              <TableHead>目前車站</TableHead>
                              <TableHead>下一站</TableHead>
                              <TableHead>預計到達時間</TableHead>
                              <TableHead>預計發車時間</TableHead>
                              <TableHead>司機員</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedTrains.map((train) => (
                              <React.Fragment key={train.id}>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    {train.id}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={`${getStatusColor(
                                        train.status
                                      )} text-white`}
                                    >
                                      {train.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{train.current_train}</TableCell>
                                  <TableCell>{train.prepare_train || '-'}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {train.schedules.map((num) => (
                                        <Badge
                                          key={num}
                                          variant="outline"
                                          className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                            train.current_train === num
                                              ? "bg-sky-50 dark:bg-sky-900/20"
                                              : ""
                                          } ${
                                            expandedSchedules?.trainId === train.id &&
                                            expandedSchedules?.trainNumber === num
                                              ? "ring-1 ring-sky-500"
                                              : ""
                                          }`}
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleScheduleClick(train.id, num)
                                          }}
                                        >
                                          {loadingSchedule && 
                                           expandedSchedules?.trainId === train.id && 
                                           expandedSchedules?.trainNumber === num 
                                            ? "載入中..." 
                                            : num
                                          }
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {train.next_day_schedules && train.next_day_schedules.length > 0 ? (
                                        train.next_day_schedules.map((schedule) => (
                                          <Badge 
                                            key={schedule.train_number} 
                                            variant="outline"
                                            className="bg-gray-50 dark:bg-gray-800"
                                          >
                                            {schedule.train_number}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span className="text-gray-500">-</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>{train.current_station}</TableCell>
                                  <TableCell>{train.next_station}</TableCell>
                                  <TableCell>{train.estimated_arrival}</TableCell>
                                  <TableCell>
                                    {train.scheduled_departure}
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
      </div>
      {selectedStatus && (
        <StatusModal
          isOpen={!!selectedStatus}
          onClose={() => setSelectedStatus(null)}
          title={selectedStatus.title}
          trains={selectedStatus.trains}
          status={selectedStatus.status}
        />
      )}
    </div>
  )
}

