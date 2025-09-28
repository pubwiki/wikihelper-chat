import { cn } from "@/lib/utils"

interface InfoTableProps {
  rows: {
    label: string
    value: React.ReactNode
  }[]
  className?: string
}

export function InfoTable({ rows, className }: InfoTableProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/40 bg-muted/10 backdrop-blur-sm",
        className
      )}
    >
      <div className="divide-y divide-border/30">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm text-muted-foreground font-medium">
              {row.label}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
