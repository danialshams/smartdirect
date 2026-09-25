"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type SelectProps = React.ComponentProps<typeof SelectPrimitive.Root> & { onChange?: (event: { target: { value: string } }) => void; children?: React.ReactNode }
function Select({ onChange, children, ...props }: SelectProps) {
  const options = React.Children.toArray(children).filter(React.isValidElement).filter((child: any) => child.type === "option" || child.props?.value !== undefined)
  const items = options.map((child: any) => ({ value: String(child.props.value ?? ""), label: child.props.children }))
  const handleChange = (value: string) => onChange?.({ target: { value } })
  return <SelectPrimitive.Root onValueChange={handleChange} {...props}><SelectPrimitive.Trigger className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"><SelectPrimitive.Value placeholder={items[0]?.label ?? ""} /><SelectPrimitive.Icon><ChevronDown className="size-4 opacity-50" /></SelectPrimitive.Icon></SelectPrimitive.Trigger><SelectPrimitive.Portal><SelectPrimitive.Content className="z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"><SelectPrimitive.Viewport>{items.map((item) => <SelectPrimitive.Item key={item.value} value={item.value} className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"><SelectPrimitive.ItemIndicator className="absolute left-2 flex size-3.5 items-center justify-center"><Check className="size-4" /></SelectPrimitive.ItemIndicator><SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText></SelectPrimitive.Item>)}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal></SelectPrimitive.Root>
}
export { Select }
