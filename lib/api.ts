import { supabase } from '@/lib/supabase'

export interface TrainStop {
  seq: number
  stationId: string
  arrivalTime: string
  departureTime: string
}

export interface TrainDetail {
  no: string
  trainTypeName: string
  startingStationName: string
  endingStationName: string
  startingTime: string
  endingTime: string
  stopTimes: TrainStop[]
  stationDetails?: { [key: string]: string }
}

export async function getTrainSchedule(trainNo: string): Promise<TrainDetail> {
  try {
    console.log('正在獲取列車時刻表:', trainNo)
    const response = await fetch(`/api/train/${trainNo}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('獲取到的列車資料:', data)
    return data
  } catch (error) {
    console.error('獲取列車時刻表失敗:', error)
    throw error
  }
}

export interface StationDetail {
  station_id: string
  station_name: string
}

export async function getStationDetails(): Promise<StationDetail[]> {
  try {
    console.log('正在獲取車站資訊...')
    const { data, error } = await supabase
      .from('train_station_details')
      .select('station_id, station_name')

    if (error) {
      console.error('Supabase 查詢錯誤:', error)
      throw error
    }

    console.log('獲取到車站資訊:', data)
    return data || []
  } catch (error) {
    console.error('獲取車站資訊失敗:', error)
    throw error
  }
}

export interface TrainLiveData {
  liveUpdateTime: string
  trainLiveMap: { [key: string]: number }
  stationLiveMap: { [key: string]: any }
}

export async function getTrainLive(trainNo: string): Promise<TrainLiveData> {
  try {
    const response = await fetch(`/api/train-live/${trainNo}`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('獲取列車即時資訊失敗:', error)
    throw error
  }
}

interface ParsedLiveData {
  currentStationId: string
  delayMap: { [stationId: string]: number }
}

function parseLiveData(trainNo: string, data: TrainLiveData): ParsedLiveData {
  // 找出目前車站
  const currentStationEntry = Object.entries(data.stationLiveMap)
    .find(([key, value]) => key.startsWith(`${trainNo}_`) && value === 0)
  
  const currentStationId = currentStationEntry 
    ? currentStationEntry[0].split('_')[1] 
    : ''

  // 建立誤點對照表
  const delayMap = Object.entries(data.trainLiveMap)
    .reduce((acc, [key, value]) => {
      const stationId = key.split('_')[1]
      acc[stationId] = value
      return acc
    }, {} as { [key: string]: number })

  return {
    currentStationId,
    delayMap
  }
}

function getTrainStatus(
  trainNo: string,
  currentStationId: string,
  stopTimes: TrainStop[],
  liveUpdateTime: string
): { status: string; currentStation: string; nextStation: string | null } {
  // 解析即時更新時間 (格式: "2024/11/28 15:51")
  const now = new Date(liveUpdateTime.replace(/\//g, '-'))  // 轉換日期格式
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTime = currentHour * 60 + currentMinute  // 轉換為分鐘數

  const firstStation = stopTimes[0]
  const lastStation = stopTimes[stopTimes.length - 1]
  
  // 解析時刻表時間
  const [firstHour, firstMinute] = firstStation.arrivalTime.split(':').map(Number)
  const firstTimeInMinutes = firstHour * 60 + firstMinute

  const [lastHour, lastMinute] = lastStation.departureTime.split(':').map(Number)
  const lastTimeInMinutes = lastHour * 60 + lastMinute

  // 如果當前時間早於第一站到達時間
  if (currentTime < firstTimeInMinutes) {
    return {
      status: '機務段待發車',
      currentStation: firstStation.stationId,
      nextStation: stopTimes[1]?.stationId || null
    }
  }

  // 如果當前時間晚於最後一站發車時間
  if (currentTime > lastTimeInMinutes) {
    return {
      status: '已出車完畢',
      currentStation: lastStation.stationId,
      nextStation: null
    }
  }

  // 如果找到當前站
  if (currentStationId) {
    return {
      status: '運行中',
      currentStation: currentStationId,
      nextStation: stopTimes[stopTimes.length - 1].stationId === currentStationId
        ? null
        : stopTimes[stopTimes.indexOf(stopTimes.find(s => s.stationId === currentStationId)!) + 1]?.stationId || null
    }
  }

  // 如果找不到當前站，但在運行時間內
  // 找出下一個未到達的站
  const nextStationInfo = stopTimes.find(stop => {
    const [stopHour, stopMinute] = stop.departureTime.split(':').map(Number)
    const stopTimeInMinutes = stopHour * 60 + stopMinute
    return stopTimeInMinutes > currentTime
  })

  if (nextStationInfo) {
    const currentStationIndex = stopTimes.indexOf(nextStationInfo) - 1
    return {
      status: '運行中',
      currentStation: currentStationIndex >= 0 ? stopTimes[currentStationIndex].stationId : firstStation.stationId,
      nextStation: nextStationInfo.stationId
    }
  }

  // 如果都找不到，返回第一站
  return {
    status: '運行中',
    currentStation: firstStation.stationId,
    nextStation: stopTimes[1]?.stationId || null
  }
}

interface TrainScheduleInfo {
  trainNo: string
  startTime: string
  endTime: string
}

function getCurrentTrainNumber(
  schedules: TrainScheduleInfo[],
  currentTime: number
): string | null {
  // 將所有時間轉換為分鐘數進行比較
  const currentSchedule = schedules.find(schedule => {
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number)
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number)
    const startTimeInMinutes = startHour * 60 + startMinute
    const endTimeInMinutes = endHour * 60 + endMinute
    
    return currentTime >= startTimeInMinutes && currentTime <= endTimeInMinutes
  })

  return currentSchedule?.trainNo || null
}

interface TrainStatus {
  status: string;
  currentTrain: string | null;
  currentStation: string | null;
  nextStation: string | null;
}

async function determineTrainStatus(
  trainSchedules: string[],
  currentTime: Date
): Promise<TrainStatus> {
  let foundCurrentStation = false;
  let lastCompletedTrain = null;
  let nextUpcomingTrain = null;

  // 按順序檢查每個車次
  for (const trainNo of trainSchedules) {
    try {
      // 跳過非數字車次
      if (!/^\d+$/.test(trainNo)) continue;

      // 獲取車次時刻表和即時資訊
      const [scheduleData, liveData] = await Promise.all([
        getTrainSchedule(trainNo),
        getTrainLive(trainNo)
      ]);

      // 檢查是否有即時位置資訊
      const { currentStationId } = parseLiveData(trainNo, liveData);
      if (currentStationId) {
        // 找到目前位置，確定是這個車次
        return {
          status: '運行中',
          currentTrain: trainNo,
          currentStation: currentStationId,
          nextStation: findNextStation(scheduleData.stopTimes, currentStationId)
        };
      }

      // 記錄時間資訊用於後續判斷
      const startTime = new Date(currentTime.toDateString() + ' ' + scheduleData.startingTime);
      const endTime = new Date(currentTime.toDateString() + ' ' + scheduleData.endingTime);

      if (currentTime > endTime) {
        lastCompletedTrain = {
          trainNo,
          endTime,
          lastStation: scheduleData.stopTimes[scheduleData.stopTimes.length - 1].stationId
        };
      } else if (currentTime < startTime && (!nextUpcomingTrain || startTime < new Date(currentTime.toDateString() + ' ' + nextUpcomingTrain.startTime))) {
        nextUpcomingTrain = {
          trainNo,
          startTime: scheduleData.startingTime,
          firstStation: scheduleData.stopTimes[0].stationId
        };
      }
    } catch (error) {
      console.error(`檢查車次 ${trainNo} 時發生錯誤:`, error);
    }
  }

  // 根據時間判斷狀態
  if (!lastCompletedTrain && !nextUpcomingTrain) {
    return {
      status: '機務段待發車',
      currentTrain: null,
      currentStation: null,
      nextStation: null
    };
  }

  if (lastCompletedTrain && !nextUpcomingTrain) {
    return {
      status: '已出車完畢',
      currentTrain: lastCompletedTrain.trainNo,
      currentStation: lastCompletedTrain.lastStation,
      nextStation: null
    };
  }

  if (!lastCompletedTrain && nextUpcomingTrain) {
    return {
      status: '機務段待發車',
      currentTrain: nextUpcomingTrain.trainNo,
      currentStation: nextUpcomingTrain.firstStation,
      nextStation: null
    };
  }

  // 在兩個車次之間
  return {
    status: '準備中',
    currentTrain: lastCompletedTrain.trainNo,
    currentStation: lastCompletedTrain.lastStation,
    nextStation: null
  };
}

export async function updateTrainStatus(
  trainId: string,
  currentTrainNo: string,
  dailySchedules: string[]
): Promise<void> {
  // 獲取當前時間
  const now = new Date();
  
  // 確定列車狀態
  const status = await determineTrainStatus(dailySchedules, now);
  
  // 獲取車站名稱對照表
  const { data: stationDetails } = await supabase
    .from('train_station_details')
    .select('station_id, station_name');

  const stationMap = stationDetails?.reduce((acc, station) => {
    acc[station.station_id] = station.station_name;
    return acc;
  }, {} as Record<string, string>) || {};

  // 更新資料庫
  const { error } = await supabase
    .from('trains')
    .update({
      status: status.status,
      current_train: status.currentTrain,
      current_station: status.currentStation ? stationMap[status.currentStation] : null,
      next_station: status.nextStation ? stationMap[status.nextStation] : null
    })
    .eq('id', trainId);

  if (error) {
    throw error;
  }
} 