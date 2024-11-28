export type TrainStatus = '運行中' | '準備中' | '維修中'
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
  schedules?: TrainSchedule[]
  station_schedules?: Station[]
}

export interface TrainGroup {
  id: string
  name: string
  trains?: Train[]
}

