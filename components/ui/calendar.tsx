"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker/persian"
import { getDefaultClassNames } from "react-day-picker"

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={[defaults.root, "w-full", className ?? ""].join(" ")}
      classNames={{
        ...classNames,
        root: [defaults.root, "w-full select-none", classNames?.root ?? ""].join(" "),
        months: [defaults.months, "w-full", classNames?.months ?? ""].join(" "),
        month: [defaults.month, "w-full", classNames?.month ?? ""].join(" "),
        month_caption: [
          defaults.month_caption,
          "flex h-10 items-center justify-center",
          classNames?.month_caption ?? "",
        ].join(" "),
        caption_label: [
          defaults.caption_label,
          "text-sm font-medium",
          classNames?.caption_label ?? "",
        ].join(" "),
        dropdowns: [
          defaults.dropdowns,
          "flex items-center justify-center gap-2",
          classNames?.dropdowns ?? "",
        ].join(" "),
        dropdown_root: [
          defaults.dropdown_root,
          "relative overflow-hidden rounded-md border border-white/10 bg-white/[0.06]",
          classNames?.dropdown_root ?? "",
        ].join(" "),
        dropdown: [
          defaults.dropdown,
          "absolute inset-0 cursor-pointer opacity-0",
          classNames?.dropdown ?? "",
        ].join(" "),
        month_grid: [defaults.month_grid, "w-full", classNames?.month_grid ?? ""].join(" "),
        weekdays: [defaults.weekdays, "grid grid-cols-7", classNames?.weekdays ?? ""].join(" "),
        weekday: [
          defaults.weekday,
          "text-center text-xs font-medium text-white/45",
          classNames?.weekday ?? "",
        ].join(" "),
        week: [defaults.week, "mt-1 grid grid-cols-7", classNames?.week ?? ""].join(" "),
        day: [
          defaults.day,
          "relative p-0 text-center",
          classNames?.day ?? "",
        ].join(" "),
        day_button: [
          defaults.day_button,
          "flex aspect-square w-full items-center justify-center rounded-md text-sm font-normal text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          classNames?.day_button ?? "",
        ].join(" "),
        today: [
          defaults.today,
          "font-semibold text-blue-300",
          classNames?.today ?? "",
        ].join(" "),
        outside: [
          defaults.outside,
          "text-white/20",
          classNames?.outside ?? "",
        ].join(" "),
        disabled: [
          defaults.disabled,
          "cursor-not-allowed text-white/20 opacity-30",
          classNames?.disabled ?? "",
        ].join(" "),
        hidden: [defaults.hidden, "invisible", classNames?.hidden ?? ""].join(" "),
      }}
      {...props}
    />
  )
}
