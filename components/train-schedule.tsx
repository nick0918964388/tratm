import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertCircle } from 'lucide-react'
import { StationStatus } from "@/types/train";

interface TrainScheduleDetailProps {
  schedule: {
    trainNumber: string;
    stations: Array<{
      name: string;
      scheduledArrival: string;
      scheduledDeparture: string;
      actualArrival?: string;
      actualDeparture?: string;
      status: StationStatus;
      delay?: number;
    }> | [];
  };
}

export function TrainScheduleDetail({ schedule }: TrainScheduleProps) {
  if (!schedule) return null;
  
  const getDelayBadge = (delay?: number) => {
    if (typeof delay === 'undefined') return null;
    
    if (delay === 0) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
          準點
        </Badge>
      );
    }
    
    return (
      <Badge
        variant="outline"
        className={
          delay > 0
            ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200"
            : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
        }
      >
        {delay > 0
          ? `誤點 ${delay} 分`
          : `提前 ${Math.abs(delay)} 分`}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "當前站":
        return (
          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/20">
            <Clock className="mr-1 h-3 w-3" />
            當前站
          </Badge>
        );
      case "已過站":
        return (
          <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800">
            已過站
          </Badge>
        );
      case "未到站":
        return (
          <Badge variant="outline">
            未到站
          </Badge>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h4 className="font-semibold">
            {schedule.trainNumber} 次列車 
            <span className="text-sm text-muted-foreground ml-2">
              {schedule.stations[0].name} → {schedule.stations[schedule.stations.length - 1].name}
            </span>
          </h4>
        </div>
        {schedule.stations.some(s => (s.delay || 0) > 5) && (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">列車誤點中</span>
          </div>
        )}
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
                {getStatusBadge(station.status)}
              </TableCell>
              <TableCell>
                {getDelayBadge(station.delay)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

