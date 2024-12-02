export type TrainStatus = 
  | '運行中' 
  | '等待出車' 
  | '已出車完畢'
  | '在段待修'
  | '臨修(C2)'
  | '進廠檢修(3B)'
  | '在段保養(2A)'
  | '預備';
export type StationStatus = '已過站' | '當前站' | '未到站'

export interface Station {
  id: number
  train_number: string
  station_name: string
  scheduled_arrival: string
  scheduled_departure: string
  actual_arrival?: string
  actual_departure?: string
  status: StationStatus
  delay?: number
}

export interface TrainSchedule {
  train_id: string
  train_number: string
  is_current: boolean
}

export interface TrainNextDaySchedule {
  id: number
  train_id: string
  train_number: string
  sequence: number
  created_at: string
  updated_at: string
}

export interface Train {
  id: string
  group_id: string
  status: TrainStatus
  current_station: string
  next_station: string
  scheduled_departure: string
  estimated_arrival: string
  driver: string
  current_train: string
  prepare_train: string
  schedules?: TrainSchedule[]
  station_schedules?: Station[]
  next_day_schedules?: TrainNextDaySchedule[]
}

export interface TrainGroup {
  id: string
  name: string
  trains?: Train[]
}

export interface ProcessedTrain extends Omit<Train, 'schedules'> {
  schedules: string[];
  next_day_schedules: TrainNextDaySchedule[];
  // ... 其他屬性
}

