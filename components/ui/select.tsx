"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type SelectProps = Omit<React.ComponentProps<typeof SelectPrimitive.Root>, "value" | "defaultValue"> & { value?: string | number; defaultValue?: string | number; onChange?: (event: { target: { value: string } }) => void; children?: React.ReactNode; className?: string }
function Select({ onChange, children, className, value, defaultValue, ...props }: SelectProps) {
  const options = React.Children.toArray(children).filter(React.isValidElement).filter((child) => { const value = String((child.props as { value?: string }).value ?? ""); return child.type === "option" || value !== ""; }) as React.ReactElement<{ value?: string; children?: React.ReactNode }>[]
  const placeholder = options.find((child) => String(child.props.value ?? "") === "")?.props.children
  const items = options.filter((child) => String(child.props.value ?? "") !== "").map((child) => ({ value: String(child.props.value), label: child.props.children }))
  const handleChange = (value: string) => onChange?.({ target: { value } })
  return <SelectPrimitive.Root onValueChange={handleChange} value={value === undefined ? undefined : String(value)} defaultValue={defaultValue === undefined ? undefined : String(defaultValue)} {...props}><SelectPrimitive.Trigger className={cn("flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"><SelectPrimitive.Value placeholder={placeholder ?? items[0]?.label ?? ""} /><SelectPrimitive.Icon><ChevronDown className="size-4 opacity-50" /></SelectPrimitive.Icon></SelectPrimitive.Trigger><SelectPrimitive.Portal><SelectPrimitive.Content className="z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"><SelectPrimitive.Viewport>{items.map((item) => <SelectPrimitive.Item key={item.value} value={item.value} className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"><SelectPrimitive.ItemIndicator className="absolute left-2 flex size-3.5 items-center justify-center"><Check className="size-4" /></SelectPrimitive.ItemIndicator><SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText></SelectPrimitive.Item>)}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal></SelectPrimitive.Root>
}
export { Select }
