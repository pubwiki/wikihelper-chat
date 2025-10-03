"use client"

import * as React from "react"
import * as Progress from "@radix-ui/react-progress"

export function Progess({
  value
}: React.ComponentProps<typeof Progress.Root>) {
  return (
    <Progress.Root
      data-slot="progress"
      value={value}
      className="
        relative overflow-hidden
        w-full h-2
        rounded-full bg-secondary
        border border-secondary
        [transform:translateZ(0)]
      "
    >
      <Progress.Indicator
        className="
          h-full w-full
          bg-primary
          transition-transform duration-[660ms]
          [transition-timing-function:cubic-bezier(0.65,0,0.35,1)]
          rounded-full
        "
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </Progress.Root>
  )
}
