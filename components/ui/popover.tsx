"use client"
import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) { return <PopoverPrimitive.Root {...props} /> }
function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) { return <PopoverPrimitive.Trigger {...props} /> }
function PopoverContent({ className, sideOffset=4, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) { return <PopoverPrimitive.Portal><PopoverPrimitive.Content sideOffset={sideOffset} align="start" className={cn("z-50 w-auto rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none", className)} {...props} /></PopoverPrimitive.Portal> }
export { Popover, PopoverTrigger, PopoverContent }
