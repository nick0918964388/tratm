import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TrainSchedule } from "../types/train"
import { Badge } from "@/components/ui/badge"
import { Clock } from 'lucide-react'

interface TrainScheduleProps {
  schedule: {
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
  };
}

export function TrainScheduleDetail({ schedule }: TrainScheduleProps) {
  if (!schedule) return null;
  
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4" />
        <h4 className="font-semibold">
          {schedule.trainNumber} 次列車 
          <span className="text-sm text-muted-foreground ml-2">
            {schedule.stations[0].name} → {schedule.stations[schedule.stations.length - 1].name}
          </span>
        </h4>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>站名</TableHead>
            <TableHead>預計到達</TableHead>
            <TableHead>預計發車</TableHead>
            <TableHead>實際到達</TableHead>
            <TableHead>實際發車</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead>誤點</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.stations.map((station) => (
            <TableRow
              key={station.name}
              className={
                station.status === "當前站"
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : ""
              }
            >
              <TableCell>{station.name}</TableCell>
              <TableCell>{station.scheduledArrival}</TableCell>
              <TableCell>{station.scheduledDeparture}</TableCell>
              <TableCell>
                {station.actualArrival || station.status === "未到站"
                  ? station.actualArrival || "-"
                  : "待定"}
              </TableCell>
              <TableCell>
                {station.actualDeparture || station.status === "未到站"
                  ? station.actualDeparture || "-"
                  : "待定"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    station.status === "當前站"
                      ? "bg-blue-100 dark:bg-blue-900"
                      : station.status === "已過站"
                      ? "bg-gray-100 dark:bg-gray-800"
                      : ""
                  }
                >
                  {station.status}
                </Badge>
              </TableCell>
              <TableCell>
                {station.delay ? (
                  <Badge
                    variant="outline"
                    className={
                      station.delay > 0
                        ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200"
                        : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                    }
                  >
                    {station.delay > 0
                      ? `延誤 ${station.delay} 分`
                      : station.delay < 0
                      ? `提前 ${Math.abs(station.delay)} 分`
                      : "準點"}
                  </Badge>
                ) : (
                  "-"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

