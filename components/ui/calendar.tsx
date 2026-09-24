"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { getDefaultClassNames, type DayButton } from "react-day-picker"
import { DayPicker } from "react-day-picker/persian"

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaults = getDefaultClassNames()
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString("fa-IR-u-ca-persian")}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      className={[
        defaults.day_button,
        "flex aspect-square size-auto w-full min-w-9 items-center justify-center rounded-md text-sm font-normal",
        "text-white/75 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        "data-[selected-single=true]:bg-white data-[selected-single=true]:text-slate-950",
        className ?? "",
      ].join(" ")}
      {...props}
    />
  )
}

export function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  captionLayout = "dropdown",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={[defaults.root, "w-full select-none text-white", className ?? ""].join(" ")}
      classNames={{
        ...classNames,
        root: [defaults.root, "w-full", classNames?.root ?? ""].join(" "),
        months: [defaults.months, "w-full", classNames?.months ?? ""].join(" "),
        month: [defaults.month, "w-full", classNames?.month ?? ""].join(" "),
        month_caption: [defaults.month_caption, "mb-3 flex h-10 items-center justify-center", classNames?.month_caption ?? ""].join(" "),
        caption_label: [defaults.caption_label, "flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-white", classNames?.caption_label ?? ""].join(" "),
        dropdowns: [defaults.dropdowns, "flex items-center justify-center gap-2", classNames?.dropdowns ?? ""].join(" "),
        dropdown_root: [defaults.dropdown_root, "relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.06]", classNames?.dropdown_root ?? ""].join(" "),
        dropdown: [defaults.dropdown, "absolute inset-0 cursor-pointer opacity-0", classNames?.dropdown ?? ""].join(" "),
        month_grid: [defaults.month_grid, "w-full border-collapse", classNames?.month_grid ?? ""].join(" "),
        weekdays: [defaults.weekdays, "mb-1 grid grid-cols-7", classNames?.weekdays ?? ""].join(" "),
        weekday: [defaults.weekday, "flex h-8 items-center justify-center text-[11px] font-medium text-white/35", classNames?.weekday ?? ""].join(" "),
        week: [defaults.week, "mt-1 grid grid-cols-7", classNames?.week ?? ""].join(" "),
        day: [defaults.day, "relative flex aspect-square items-center justify-center p-0", classNames?.day ?? ""].join(" "),
        day_button: [defaults.day_button, "text-white/75", classNames?.day_button ?? ""].join(" "),
        today: [defaults.today, "font-bold text-blue-300", classNames?.today ?? ""].join(" "),
        outside: [defaults.outside, "text-white/15", classNames?.outside ?? ""].join(" "),
        disabled: [defaults.disabled, "cursor-not-allowed text-white/20 opacity-30", classNames?.disabled ?? ""].join(" "),
        hidden: [defaults.hidden, "invisible", classNames?.hidden ?? ""].join(" "),
      }}
      components={{
        DayButton: CalendarDayButton,
        Chevron: ({ orientation, className, ...props }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeftIcon
              : orientation === "right"
                ? ChevronRightIcon
                : ChevronDownIcon
          return <Icon className={["size-4", className ?? ""].join(" ")} {...props} />
        },
      }}
      {...props}
    />
  )
}
