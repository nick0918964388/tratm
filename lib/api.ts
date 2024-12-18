import { supabase } from '@/lib/supabase'
import { Train, TrainGroup, Station } from '@/types/train'


export interface TrainStop {
  seq: number;
  stationId: string;
  stationName: string;
  arrivalTime: string;
  departureTime: string;
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

export function parseLiveData(trainNo: string, data: TrainLiveData): {
  currentStationId: string;
  nextStationId: string;
  delayMap: { [stationId: string]: number };
} {
  // 找出目前車站
  const currentStationEntry = Object.entries(data.stationLiveMap)
    .find(([key, value]) => {
      const [trainNumber, _] = key.split('_')
      return trainNumber === trainNo
    })
  
  const currentStationId = currentStationEntry 
    ? currentStationEntry[0].split('_')[1] 
    : ''

  // 找出下一站 (stationLiveMap 非 0 的站點)
  const nextStationEntry = Object.entries(data.stationLiveMap)
    .find(([key, value]) => {
      const [trainNumber, _] = key.split('_')
      return trainNumber === trainNo
    })
  
  const nextStationId = nextStationEntry
    ? nextStationEntry[0].split('_')[1]
    : ''
  console.log('下一站:', nextStationId)  // 記錄下一站
  // 建立誤點對照表 - 修改這部分的邏輯
  const delayMap = Object.entries(data.trainLiveMap)
    .reduce((acc, [key, value]) => {
      // 只處理屬於這個車次的資料
      if (key.startsWith(`${trainNo}_`)) {
        const stationId = key.split('_')[1]
        // 值為 0 表示準點，1 表示誤點 1 分鐘，2 表示誤點 2 分鐘，以此類推
        acc[stationId] = value
      }
      return acc
    }, {} as { [key: string]: number })

  console.log('解析後的誤點資訊:', {
    trainNo,
    delayMap,
    currentStationId,
    nextStationId
  })

  return {
    currentStationId,
    nextStationId,
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
      status: '等待出車',
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

// 添加一個輔助函數來找下一站
function findNextStation(stopTimes: TrainStop[], currentStationId: string): string | null {
  const currentIndex = stopTimes.findIndex(stop => stop.stationId === currentStationId);
  if (currentIndex === -1 || currentIndex === stopTimes.length - 1) return null;
  return stopTimes[currentIndex + 1].stationId;
}

async function determineTrainStatus(
  trainSchedules: string[],
  currentTime: Date,
  trainId: string
): Promise<TrainStatus> {
  let lastCompletedTrain = null;
  let nextUpcomingTrain = null;

  console.log(trainId,'開始判斷列車狀態:', { trainSchedules, currentTime });

  // 先過濾出數字車次
  const validSchedules = trainSchedules.filter(trainNo => /^\d+$/.test(trainNo));
  console.log(trainId,'有效的車次清單:', validSchedules);

  // 如果沒有有效車次，維持原狀態
  if (validSchedules.length === 0) {
    console.log(trainId,'沒有有效車次，返回預設狀態');
    return {
      status: '等待出車',
      currentTrain: null,
      currentStation: null,
      nextStation: null
    };
  }

  // 按順序檢查每個車次
  for (const trainNo of validSchedules) {
    console.log(trainId,`檢查車次 ${trainNo}...`);
    try {
      // 獲取車次時刻表和即時資訊
      console.log(trainId,`正在獲取車次 ${trainNo} 的時刻表和即時資訊...`);
      const [scheduleData, liveData] = await Promise.all([
        getTrainSchedule(trainNo),
        getTrainLive(trainNo)
      ]);
      console.log(trainId,`車次 ${trainNo} 的時刻表:`, scheduleData);
      console.log(trainId,`車次 ${trainNo} 的即時資訊:`, liveData);

      // 檢查是否有即時位置資訊
      const { currentStationId } = parseLiveData(trainNo, liveData);
      console.log(trainId,`車次 ${trainNo} 的當前站點:`, currentStationId);

      if (currentStationId) {
        console.log(trainId,`車次 ${trainNo} 正在運行中，位於站點 ${currentStationId}`);
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
      
      console.log(trainId,`車次 ${trainNo} 的時間資訊:`, {
        currentTime: currentTime.toLocaleString(),
        startTime: startTime.toLocaleString(),
        endTime: endTime.toLocaleString()
      });

      if (currentTime > endTime) {
        console.log(trainId,`車次 ${trainNo} 已結束運行`);
        lastCompletedTrain = {
          trainNo,
          endTime,
          lastStation: scheduleData.stopTimes[scheduleData.stopTimes.length - 1].stationId
        };
      } else if (currentTime < startTime && (!nextUpcomingTrain || startTime < new Date(currentTime.toDateString() + ' ' + nextUpcomingTrain.startTime))) {
        console.log(trainId,`車次 ${trainNo} 尚未開始運行`);
        nextUpcomingTrain = {
          trainNo,
          startTime: scheduleData.startingTime,
          firstStation: scheduleData.stopTimes[0].stationId
        };
      }
    } catch (error) {
      console.error(trainId,`檢查車次 ${trainNo} 時發生錯誤:`, error);
    }
  }

  console.log(trainId,'檢查完所有車次，結果:', {
    lastCompletedTrain,
    nextUpcomingTrain
  });

  // 根據時間判斷狀態
  if (!lastCompletedTrain && !nextUpcomingTrain) {
    console.log(trainId,'沒有已完成或即將開始的車次');
    return {
      status: '等待出車',
      currentTrain: null,
      currentStation: null,
      nextStation: null
    };
  }

  if (lastCompletedTrain && !nextUpcomingTrain) {
    console.log(trainId,`車次 ${lastCompletedTrain.trainNo} 已結束運行`);
    return {
      status: '已出車完畢',
      currentTrain: lastCompletedTrain.trainNo,
      currentStation: lastCompletedTrain.lastStation,
      nextStation: null
    };
  }

  if (!lastCompletedTrain && nextUpcomingTrain) {
    console.log(trainId,`車次 ${nextUpcomingTrain.trainNo} 尚未開始運行`);
    return {
      status: '等待出車',
      currentTrain: nextUpcomingTrain.trainNo,
      currentStation: nextUpcomingTrain.firstStation,
      nextStation: null
    };
  }

  // 兩個車次之間
  if (lastCompletedTrain) {
    const timeSinceLastTrain = currentTime.getTime() - lastCompletedTrain.endTime.getTime();
    const timeToNextTrain = new Date(currentTime.toDateString() + ' ' + nextUpcomingTrain!.startTime).getTime() - currentTime.getTime();
    
    // 如果距離下一班車還有很長時間，就是等待出車狀態
    if (timeToNextTrain > 30 * 60 * 1000) { // 30分鐘
      return {
        status: '等待出車',
        currentTrain: nextUpcomingTrain!.trainNo,
        currentStation: nextUpcomingTrain!.firstStation,
        nextStation: null
      };
    }
    
    // 否則是準備中狀態
    return {
      status: '準備中',
      currentTrain: lastCompletedTrain.trainNo,
      currentStation: lastCompletedTrain.lastStation,
      nextStation: null
    };
  }

  // 預設返回
  return {
    status: '等待出車',
    currentTrain: null,
    currentStation: null,
    nextStation: null
  };
}

// 添加一個新的輔助函數來找出下一個車次
function findNextTrainNumber(currentTrainNo: string, dailySchedules: string[]): string | null {
  // 先過濾出數字車次並排序
  const validSchedules = dailySchedules
    .filter(trainNo => /^\d+$/.test(trainNo))
    .sort((a, b) => Number(a) - Number(b));

  const currentIndex = validSchedules.indexOf(currentTrainNo);
  
  // 如果找到當前車次，且不是最後一個車次，則返回下一個車次
  if (currentIndex !== -1 && currentIndex < validSchedules.length - 1) {
    return validSchedules[currentIndex + 1];
  }
  
  return null;
}

export async function updateTrainStatus(
  trainId: string,
  currentTrainNo: string,
  dailySchedules: string[]
): Promise<void> {
  const now = new Date();
  const status = await determineTrainStatus(dailySchedules, now,trainId);
  
  // 取得預計到達和發車時間
  let estimatedArrival = null;
  let scheduledDeparture = null;
  
  if (status.currentTrain && status.currentStation) {
    try {
      // 獲取當前車次的時刻表
      const scheduleData = await getTrainSchedule(status.currentTrain);
      
      // 找出當前站的時刻
      const currentStationSchedule = scheduleData.stopTimes.find(
        stop => stop.stationId === status.currentStation
      );

      if (currentStationSchedule) {
        // 使用時刻表的到達和發車時間
        estimatedArrival = currentStationSchedule.arrivalTime;
        scheduledDeparture = currentStationSchedule.departureTime;
        
        // 獲取即時資訊以檢查誤點狀況
        const liveData = await getTrainLive(status.currentTrain);
        const { delayMap } = parseLiveData(status.currentTrain, liveData);
        
        // 如果有誤點，在時間後面加上說明
        const delay = delayMap[status.currentStation] || 0;
        if (delay > 0) {
          estimatedArrival += ` (誤點${delay}分)`;
          scheduledDeparture += ` (誤點${delay}分)`;
        }
      }
    } catch (error) {
      console.error('獲取時刻資訊失敗:', error);
    }
  }

  // 獲取車站名��對照表
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
      prepare_train: findNextTrainNumber(status.currentTrain || currentTrainNo, dailySchedules),
      current_station: status.currentStation ? stationMap[status.currentStation] : null,
      next_station: status.nextStation ? stationMap[status.nextStation] : null,
      estimated_arrival: estimatedArrival,
      scheduled_departure: scheduledDeparture
    })
    .eq('id', trainId);

  if (error) {
    throw error;
  }
}

export async function getTrainData() {
  console.log('getTrainData: 開始查詢...')
  
  const { data: groups, error } = await supabase
    .from('train_groups')
    .select(`
      *,
      trains:trains (
        *,
        schedules:train_schedules (*),
        next_day_schedules:train_next_day_schedules (
          id,
          train_id,
          train_number,
          sequence
        )
      )
    `)

  if (error) {
    console.error('getTrainData 查詢錯誤:', error)
    throw error
  }

  

  const { data: stationSchedules } = await supabase
    .from('station_schedules')
    .select('*')

  return {
    groups: (groups || []) as TrainGroup[],
    stationSchedules: (stationSchedules || []) as Station[]
  }
}

export async function getOtherDepotTrains(): Promise<Train[]> {
  try {
    const { data, error } = await supabase
      .from('other_depot_trains')
      .select('*');

    if (error) {
      throw error;
    }

    console.log('獲取到其他段預備車資料:', data);

    // 轉換成符合 Train 型別的資料
    return data.map(train => ({
      id: train.id,
      group_id: 'other',  // 標記為其他段
      status: '預備' as const,  // 固定為預備狀態
      current_station: train.location,
      next_station: '',
      scheduled_departure: '',
      estimated_arrival: '',
      driver: '',
      current_train: '',
      prepare_train: '',
      schedules: [],
      station_schedules: [],
      next_day_schedules: []
    })) || [];
  } catch (error) {
    console.error('獲取其他段預備車失敗:', error);
    return [];
  }
}

// 添加日期格式化函數
function formatDate(date: string | null): string {
  if (!date) return '-';
  try {
    const dateObj = new Date(date);
    // 檢查是否為有效日期
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    return dateObj.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    console.error('日期格式化失敗:', error);
    return '-';
  }
}

export async function getMaintenanceTrainDetails(trainId: string) {
  try {
    const { data, error } = await supabase
      .from('maintenance_trains')
      .select('*')
      .eq('id', trainId)
      .single();

    if (error) {
      throw error;
    }

    if (!data) return null;

    return {
      location: data.location || '-',
      entry_time: formatDate(data.entry_time),
      start_time: formatDate(data.start_time),
      end_time: formatDate(data.end_time),
      duration_days: data.duration_days || 0
    };
  } catch (error) {
    console.error('獲取維修車輛詳情失敗:', error);
    return null;
  }
} 