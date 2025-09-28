import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

export function GlassButton({
  label,
  tooltip,
  onClick,
}: {
  label: string
  tooltip?: string
  onClick?: () => void
}) {
  return (
    <div className="relative group inline-block">
      <button
        onClick={onClick}
        className={cn(
          "cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full",
          "border border-border/50 bg-gradient-to-b from-background to-muted/30 backdrop-blur-sm",
          "text-xs font-medium text-foreground/80",
          "transition-all duration-200 hover:border-border/80 hover:bg-muted/20"
        )}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary/70" />
        <span className="tracking-tight">{label}</span>
      </button>

      {tooltip && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-full mb-2", // 改成出现在按钮上方
            "px-3 py-2 rounded-md text-xs min-w-[200px] text-center", // 宽度更大一些
            "bg-muted/80 text-foreground/90 shadow-md backdrop-blur-sm border border-border/40",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          )}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}
