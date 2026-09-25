"use client"

import * as React from "react"
import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Sheet = Dialog.Root
const SheetTrigger = Dialog.Trigger
const SheetClose = Dialog.Close

const SheetPortal = ({ children, ...props }: React.ComponentProps<typeof Dialog.Portal>) => (
  <Dialog.Portal {...props}>{children}</Dialog.Portal>
)

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof Dialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof Dialog.Overlay>
>(({ className, ...props }, ref) => (
  <Dialog.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/15 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:duration-300 data-[state=open]:duration-300",
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = Dialog.Overlay.displayName

const SheetContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  React.ComponentPropsWithoutRef<typeof Dialog.Content> & { side?: "top" | "right" | "bottom" | "left" }
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <Dialog.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col gap-5 bg-background p-5 shadow-xl outline-none transition-transform duration-300 ease-in-out data-[state=closed]:animate-out data-[state=open]:animate-in",
        side === "left" && "inset-y-0 left-0 w-[280px] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:w-[320px]",
        side === "right" && "inset-y-0 right-0 w-[280px] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-[320px]",
        side === "top" && "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        side === "bottom" && "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        className,
      )}
      {...props}
    >
      {children}
      <Dialog.Close
        className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:outline-none focus:ring-0"
        aria-label="بستن"
      >
        <X className="size-4" />
        <span className="sr-only">بستن</span>
      </Dialog.Close>
    </Dialog.Content>
  </SheetPortal>
))
SheetContent.displayName = Dialog.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 text-right", className)} {...props} />
)

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof Dialog.Title>,
  React.ComponentPropsWithoutRef<typeof Dialog.Title>
>(({ className, ...props }, ref) => (
  <Dialog.Title ref={ref} className={cn("text-base font-semibold tracking-tight", className)} {...props} />
))
SheetTitle.displayName = Dialog.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof Dialog.Description>,
  React.ComponentPropsWithoutRef<typeof Dialog.Description>
>(({ className, ...props }, ref) => (
  <Dialog.Description ref={ref} className={cn("text-xs leading-5 text-muted-foreground", className)} {...props} />
))
SheetDescription.displayName = Dialog.Description.displayName

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription }
