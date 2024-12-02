import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Train } from "@/types/train"

interface StatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  trains: Train[]
  status: string
}

export function StatusDialog({ open, onOpenChange, title, trains, status }: StatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {title} - 共 {trains.length} 輛
          </DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">車號</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>目前車次</TableHead>
              <TableHead>下一車次</TableHead>
              <TableHead>目前車站</TableHead>
              <TableHead>下一站</TableHead>
              <TableHead>司機員</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trains.map((train) => (
              <TableRow key={train.id}>
                <TableCell className="font-medium">{train.id}</TableCell>
                <TableCell>
                  <Badge className={`${getStatusColor(train.status)} text-white`}>
                    {train.status}
                  </Badge>
                </TableCell>
                <TableCell>{train.current_train || '-'}</TableCell>
                <TableCell>{train.prepare_train || '-'}</TableCell>
                <TableCell>{train.current_station || '-'}</TableCell>
                <TableCell>{train.next_station || '-'}</TableCell>
                <TableCell>{train.driver || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
} 