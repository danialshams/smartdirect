"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { DayButton, getDefaultClassNames } from "react-day-picker"
import { DayPicker } from "react-day-picker/persian"

import { cn } from "../../src/lib/utils"
import { Button, buttonVariants } from "./button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-white p-3 [--cell-size:--spacing(8)] text-slate-950",
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("fa-IR-u-ca-persian", { month: "long" }),
        formatYearDropdown: (date) =>
          new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            year: "numeric",
          }).format(date),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn(
          "flex w-full flex-col gap-4",
          defaultClassNames.month
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative aspect-square h-auto w-full flex-1 select-none p-0 text-center",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-s-md bg-slate-900 text-white",
          defaultClassNames.range_start
        ),
        range_middle: cn(
          "rounded-none bg-slate-100 text-slate-950",
          defaultClassNames.range_middle
        ),
        range_end: cn(
          "rounded-e-md bg-slate-900 text-white",
          defaultClassNames.range_end
        ),
        today: cn(
          "rounded-md bg-slate-100 text-slate-950",
          defaultClassNames.today
        ),
        outside: cn(
          "text-slate-300 aria-selected:text-slate-300",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-slate-300 opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => (
          <div
            data-slot="calendar"
            ref={rootRef}
            className={cn(className)}
            {...props}
          />
        ),
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant={buttonVariants({ variant: "ghost" })}
      data-day={day.date.toLocaleDateString("fa-IR-u-ca-persian")}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal",
        "data-[selected-single=true]:bg-slate-900 data-[selected-single=true]:text-white",
        "data-[range-middle=true]:bg-slate-100 data-[range-middle=true]:text-slate-950",
        "data-[range-start=true]:bg-slate-900 data-[range-start=true]:text-white",
        "data-[range-end=true]:bg-slate-900 data-[range-end=true]:text-white",
        "data-[range-end=true]:rounded-md data-[range-start=true]:rounded-md",
        "group-data-[focused=true]/day:border-slate-300 group-data-[focused=true]/day:ring-slate-200/60",
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px]",
        defaultClassNames.day_button,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
