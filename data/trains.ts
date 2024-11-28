import { TrainGroup, Station } from "../types/train"

// 生成站點時刻表
const generateStations = (isDelayed: boolean = false): Station[] => {
  const stations: Station[] = [
    {
      name: "七堵",
      scheduledArrival: "14:00",
      scheduledDeparture: "14:05",
      actualArrival: "14:00",
      actualDeparture: "14:05",
      status: "已過站",
      delay: 0,
    },
    {
      name: "南港",
      scheduledArrival: "14:20",
      scheduledDeparture: "14:22",
      actualArrival: "14:20",
      actualDeparture: "14:22",
      status: "已過站",
      delay: 0,
    },
    {
      name: "台北",
      scheduledArrival: "14:30",
      scheduledDeparture: "14:35",
      actualArrival: "14:33",
      actualDeparture: "14:38",
      status: "當前站",
      delay: isDelayed ? 3 : 0,
    },
    {
      name: "板橋",
      scheduledArrival: "14:45",
      scheduledDeparture: "14:47",
      status: "未到站",
    },
    {
      name: "桃園",
      scheduledArrival: "15:10",
      scheduledDeparture: "15:12",
      status: "未到站",
    },
  ]
  return stations
}

export const trainGroups: TrainGroup[] = [
  {
    id: "EMU900",
    name: "EMU900型列車",
    trains: [
      {
        id: "EMU901",
        groupId: "EMU900",
        status: "運行中",
        currentStation: "台北",
        nextStation: "板橋",
        scheduledDeparture: "14:35",
        estimatedArrival: "5分鐘",
        driver: "張志明",
        schedule: ["501", "502", "507", "508"],
        currentTrain: "502",
        scheduleDetails: [
          {
            trainNumber: "501",
            stations: generateStations(true),
          },
          {
            trainNumber: "502",
            stations: generateStations(false),
          },
        ],
      },
      {
        id: "EMU902",
        groupId: "EMU900",
        status: "準備中",
        currentStation: "七堵",
        nextStation: "南港",
        scheduledDeparture: "15:00",
        estimatedArrival: "待發車",
        driver: "李大維",
        schedule: ["512", "513", "516", "517"],
        currentTrain: "準備發車",
        scheduleDetails: [
          {
            trainNumber: "512",
            stations: generateStations(false),
          },
        ],
      },
    ],
  },
  {
    id: "E1000",
    name: "E1000型列車",
    trains: [
      {
        id: "E1001",
        groupId: "E1000",
        status: "運行中",
        currentStation: "板橋",
        nextStation: "桃園",
        scheduledDeparture: "14:50",
        estimatedArrival: "12分鐘",
        driver: "王小明",
        schedule: ["122", "123", "126", "127"],
        currentTrain: "122",
        scheduleDetails: [
          {
            trainNumber: "122",
            stations: generateStations(true),
          },
        ],
      },
      {
        id: "E1002",
        groupId: "E1000",
        status: "維修中",
        currentStation: "機廠",
        nextStation: "-",
        scheduledDeparture: "-",
        estimatedArrival: "-",
        driver: "-",
        schedule: ["暫無排程"],
        currentTrain: "維修中",
        scheduleDetails: [],
      },
    ],
  },
]

