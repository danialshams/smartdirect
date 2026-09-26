"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange"> & {
  value?: string | number
  defaultValue?: string | number
  onChange?: (event: { target: { value: string } }) => void
  children?: React.ReactNode
  className?: string
}

function Select({
  onChange,
  children,
  className,
  value,
  defaultValue,
  ...props
}: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        value={value === undefined ? undefined : String(value)}
        defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
        onChange={(event) => onChange?.({ target: { value: event.target.value } })}
        className={cn(
          "flex h-10 w-full appearance-none items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
    </div>
  )
}

export { Select }
