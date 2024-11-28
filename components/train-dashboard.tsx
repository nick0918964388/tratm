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
  ChevronRight
} from 'lucide-react'
import { trainGroups } from "@/data/trains"
import { TrainScheduleDetail } from "@/components/train-schedule"
import { Train, TrainGroup, Station } from "@/types/train"
import { TitleBar } from "@/components/title-bar"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { supabase } from '@/lib/supabase'
import { getTrainSchedule, TrainDetail, getStationDetails } from "@/lib/api"

interface DashboardProps {
  initialData: {
    groups: TrainGroup[]
    stationSchedules: Station[]
  }
}

interface ProcessedTrain extends Train {
  schedule: string[];
  currentTrain: string;
  scheduleDetails: Array<{
    trainNumber: string;
    stations: Station[];
  }>;
}

interface ProcessedTrainGroup extends Omit<TrainGroup, 'trains'> {
  trains: ProcessedTrain[];
}

export function TrainDashboard({ initialData }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => 
    ['EMU900', 'E1000']  // 指定要展開的群組 ID
  )
  const [expandedSchedules, setExpandedSchedules] = useState<{
    trainId: string
    trainNumber: string
  } | null>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [selectedSchedule, setSelectedSchedule] = useState<TrainDetail | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [stationMap, setStationMap] = useState<{ [key: string]: string }>({})

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
      .channel('trains-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'trains' 
      }, payload => {
        // 更新列車資料
        setGroups(current => {
          // 處理更新邏輯
          return processGroupData(current)
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(trainsSubscription)
    }
  }, [])

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

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1000)
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
      case "維修中":
        return "bg-rose-500"
      default:
        return "bg-slate-500"
    }
  }

  const filterTrainGroups = (groups: TrainGroup[]) => {
    return groups
      .map((group) => ({
        ...group,
        trains: group.trains.filter((train) =>
          train.id.toLowerCase().includes(searchTerm.toLowerCase())
        ),
      }))
      .filter((group) => group.trains.length > 0)
  }

  const processTrainData = (trains: Train[]): ProcessedTrain[] => {
    return trains.map(train => ({
      ...train,
      schedule: train.schedules?.map(schedule => schedule.train_number) || [],
      currentTrain: train.current_train,
      currentStation: train.current_station,
      nextStation: train.next_station,
      scheduledDeparture: train.scheduled_departure,
      estimatedArrival: train.estimated_arrival,
      scheduleDetails: train.station_schedules ? [{
        trainNumber: train.current_train,
        stations: train.station_schedules.map(s => ({
          name: s.station_name,
          scheduledArrival: s.scheduled_arrival,
          scheduledDeparture: s.scheduled_departure,
          actualArrival: s.actual_arrival,
          actualDeparture: s.actual_departure,
          status: s.status,
          delay: s.delay
        }))
      }] : []
    }))
  }

  const processGroupData = (groups: TrainGroup[]): ProcessedTrainGroup[] => {
    return groups.map(group => ({
      ...group,
      trains: processTrainData(group.trains || [])
    }))
  }

  const [groups, setGroups] = useState<ProcessedTrainGroup[]>(() => 
    processGroupData(initialData.groups)
  )
  const [stationSchedules, setStationSchedules] = useState(initialData.stationSchedules)

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
      
      const scheduleData = await getTrainSchedule(trainNo)
      console.log('獲取到時刻表:', scheduleData)
      
      scheduleData.stationDetails = stationMap
      
      setSelectedSchedule(scheduleData)
      setExpandedSchedules({ trainId, trainNumber: trainNo })
    } catch (error) {
      console.error('獲取列車時刻表失敗:', error)
      // 可以添加一個錯誤提示
      alert('獲取列車時刻表失敗，請稍後再試')
    } finally {
      setLoadingSchedule(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TitleBar 
        onRefresh={handleRefresh} 
        refreshing={refreshing}
        schedules={allTrains.flatMap(train => train.schedule)}
      />
      
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              即時監控面板
            </h2>
            <p className="text-sm text-muted-foreground">
              目前監控中車輛：{allTrains.length} 輛
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
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm">
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
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">準備發車</CardTitle>
              <Clock className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTrains.filter((t) => t.status === "準備中").length}
              </div>
              <p className="text-xs text-muted-foreground">
                待發車的車輛數量
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">維修車輛</CardTitle>
              <AlertCircle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allTrains.filter((t) => t.status === "維修中").length}
              </div>
              <p className="text-xs text-muted-foreground">
                目前維修中的車輛數量
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 列表 */}
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>車輛運行狀況</CardTitle>
              <CardDescription>
                即時顯示所有車輛的運行狀態與位置資訊
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
              {filteredGroups.map((group) => (
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
                            <TableHead>車號</TableHead>
                            <TableHead>狀態</TableHead>
                            <TableHead>目前車次</TableHead>
                            <TableHead>今日車次</TableHead>
                            <TableHead>目前車站</TableHead>
                            <TableHead>下一站</TableHead>
                            <TableHead>預計到達時間</TableHead>
                            <TableHead>預計發車時間</TableHead>
                            <TableHead>司機員</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.trains.map((train) => (
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
                                <TableCell>{train.currentTrain}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {train.schedule.map((num) => (
                                      <Badge
                                        key={num}
                                        variant="outline"
                                        className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                          train.currentTrain === num
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
                                <TableCell>{train.currentStation}</TableCell>
                                <TableCell>{train.nextStation}</TableCell>
                                <TableCell>{train.estimatedArrival}</TableCell>
                                <TableCell>
                                  {train.scheduledDeparture}
                                </TableCell>
                                <TableCell>{train.driver}</TableCell>
                              </TableRow>
                              {expandedSchedules?.trainId === train.id && selectedSchedule && (
                                <TableRow>
                                  <TableCell colSpan={9} className="p-0">
                                    <TrainScheduleDetail
                                      schedule={{
                                        trainNumber: selectedSchedule.no,
                                        stations: selectedSchedule.stopTimes.map(stop => ({
                                          name: stationMap[stop.stationId] || stop.stationId,
                                          scheduledArrival: stop.arrivalTime,
                                          scheduledDeparture: stop.departureTime,
                                          status: "未到站",
                                          delay: 0
                                        }))
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

