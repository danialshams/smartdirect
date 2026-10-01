"use client";

import * as React from "react";
import {
  Box,
  Button as MuiButton,
  Checkbox as MuiCheckbox,
  FormControl,
  InputBase,
  MenuItem,
  Paper,
  Popover as MuiPopover,
  Select as MuiSelect,
  Skeleton as MuiSkeleton,
  TextField,
} from "@mui/material";
import { DayPicker, faIR } from "@daypicker/persian";
import { getDefaultClassNames, type DayPickerProps } from "react-day-picker";
import { ChevronDown } from "lucide-react";

const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  text: "#0F172A",
  secondary: "#64748B",
  border: "#E2E8F0",
  background: "#F8FAFC",
  surface: "#FFFFFF",
};

function classNameValue(value?: string) {
  return value || "";
}

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "color"> & {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  asChild?: boolean;
}) {
  const sx = {
    textTransform: "none",
    fontFamily: '"Vazirmatn", Arial, sans-serif',
    fontWeight: 600,
    minHeight:
      size === "xs" ? 24 :
      size === "sm" ? 32 :
      size === "lg" ? 40 :
      size === "icon-xs" ? 24 :
      size === "icon-sm" ? 32 :
      size === "icon-lg" ? 40 :
      size === "icon" ? 36 : 36,
    px:
      size === "xs" ? 1 :
      size === "sm" ? 1.5 :
      size === "lg" ? 3 :
      size?.startsWith("icon") ? 0 :
      2,
    minWidth: size?.startsWith("icon") ? (
      size === "icon-xs" ? 24 : size === "icon-sm" ? 32 : size === "icon-lg" ? 40 : 36
    ) : undefined,
    borderRadius: 2,
    boxShadow: "none",
    ...(variant === "default" ? {
      bgcolor: COLORS.primary,
      color: "#FFFFFF",
      "&:hover": { bgcolor: COLORS.primaryDark },
    } : {}),
    ...(variant === "destructive" ? {
      bgcolor: "#FFFFFF",
      color: "#DC2626",
      border: "1px solid #DC2626",
      "&:hover": { bgcolor: "#FFFFFF", borderColor: "#B91C1C", color: "#B91C1C" },
    } : {}),
    ...(variant === "outline" ? {
      bgcolor: COLORS.surface,
      color: COLORS.text,
      border: "1px solid " + COLORS.border,
      "&:hover": { bgcolor: COLORS.background, borderColor: "#94A3B8" },
    } : {}),
    ...(variant === "secondary" ? {
      bgcolor: "#F1F5F9",
      color: COLORS.text,
      "&:hover": { bgcolor: "#E2E8F0" },
    } : {}),
    ...(variant === "ghost" ? {
      bgcolor: "transparent",
      color: COLORS.secondary,
      "&:hover": { bgcolor: COLORS.background, color: COLORS.text },
    } : {}),
    ...(variant === "link" ? {
      bgcolor: "transparent",
      color: COLORS.primary,
      textDecoration: "underline",
      "&:hover": { bgcolor: "transparent", color: COLORS.primaryDark },
    } : {}),
  } as const;

  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<{
      className?: string;
      style?: React.CSSProperties;
      onClick?: React.MouseEventHandler;
    }>;
    return React.cloneElement(child, {
      className: [classNameValue(className), child.props.className].filter(Boolean).join(" "),
      onClick: props.onClick
        ? (event) => {
            props.onClick?.(event as React.MouseEvent<HTMLButtonElement, MouseEvent>);
            child.props.onClick?.(event);
          }
        : child.props.onClick,
      style: { ...(child.props.style || {}), ...(props.style || {}) },
    });
  }

  return (
    <MuiButton
      {...props}
      className={className}
      variant="contained"
      disableElevation
      sx={sx}
    >
      {children}
    </MuiButton>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, ...props }, ref) {
    return (
      <TextField
        inputRef={ref}
        type={props.type}
        value={props.value}
        defaultValue={props.defaultValue}
        onChange={props.onChange}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
        name={props.name}
        id={props.id}
        disabled={props.disabled}
        required={props.required}
        autoFocus={props.autoFocus}
        autoComplete={props.autoComplete}
        inputProps={{
          ...(props as Record<string, unknown>),
        }}
        className={className}
        size="small"
        fullWidth
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            bgcolor: COLORS.surface,
          },
          "& .MuiOutlinedInput-input": {
            fontFamily: '"Vazirmatn", Arial, sans-serif',
            fontSize: 13,
          },
        }}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  function Textarea({ className, ...props }, ref) {
    return (
      <TextField
        inputRef={ref}
        multiline
        minRows={3}
        value={props.value}
        defaultValue={props.defaultValue}
        onChange={props.onChange}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
        name={props.name}
        id={props.id}
        disabled={props.disabled}
        required={props.required}
        rows={props.rows}
        className={className}
        fullWidth
        size="small"
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            bgcolor: COLORS.surface,
            alignItems: "flex-start",
          },
          "& textarea": {
            fontFamily: '"Vazirmatn", Arial, sans-serif',
            fontSize: 13,
            lineHeight: 1.9,
          },
        }}
      />
    );
  },
);

export function Select({
  value,
  defaultValue,
  onChange,
  children,
  className,
  disabled,
  name,
  id,
  required,
  ...props
}: Pick<React.SelectHTMLAttributes<HTMLSelectElement>, "className" | "disabled" | "name" | "id" | "required"> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <FormControl fullWidth size="small" className={className}>
      <MuiSelect
        native
        value={value === undefined ? "" : String(value)}
        defaultValue={defaultValue === undefined ? "" : String(defaultValue)}
        disabled={disabled}
        name={name}
        id={id}
        required={required}
        onChange={(event) => onChange?.({ target: { value: String(event.target.value) } })}
        IconComponent={ChevronDown}
        sx={{
          borderRadius: 2,
          bgcolor: COLORS.surface,
          fontFamily: '"Vazirmatn", Arial, sans-serif',
          fontSize: 13,
          "& .MuiSelect-select": { py: 1.05 },
        }}
        {...props}
      >
        {children}
      </MuiSelect>
    </FormControl>
  );
}

export function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  ...props
}: {
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  required?: boolean;
  value?: string;
}) {
  return (
    <MuiCheckbox
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      className={className}
      {...props}
      sx={{
        p: 0.5,
        color: "#CBD5E1",
        "&.Mui-checked": { color: COLORS.primary },
      }}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <MuiSkeleton
      variant="rounded"
      className={className}
      animation="pulse"
      {...props}
      sx={{
        bgcolor: "#E2E8F0",
        borderRadius: 2,
      }}
    />
  );
}

type PopoverContextValue = {
  anchorEl: HTMLElement | null;
  setAnchorEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

export function Popover({ children }: { children: React.ReactNode }) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  return (
    <PopoverContext.Provider value={{ anchorEl, setAnchorEl }}>
      {children}
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  children,
  asChild = false,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const context = React.useContext(PopoverContext);
  if (!context) return null;

  const child = React.Children.only(children) as React.ReactElement<{
    onClick?: React.MouseEventHandler;
  }>;

  const onClick = (event: React.MouseEvent) => {
    context.setAnchorEl((current) => current ? null : event.currentTarget as HTMLElement);
    child.props.onClick?.(event);
  };

  if (asChild) return React.cloneElement(child, { onClick });
  return (
    <span onClick={onClick} style={{ display: "inline-flex" }}>
      {children}
    </span>
  );
}

export function PopoverContent({
  children,
  className,
  sideOffset = 4,
  align = "start",
}: {
  children: React.ReactNode;
  className?: string;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}) {
  const context = React.useContext(PopoverContext);
  if (!context) return null;

  return (
    <MuiPopover
      open={Boolean(context.anchorEl)}
      anchorEl={context.anchorEl}
      onClose={() => context.setAnchorEl(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: align === "end" ? "right" : align === "center" ? "center" : "left" }}
      transformOrigin={{ vertical: "top", horizontal: align === "end" ? "right" : align === "center" ? "center" : "left" }}
      slotProps={{
        paper: {
          className,
          sx: {
            mt: sideOffset / 8,
            p: 0,
            border: "1px solid " + COLORS.border,
            borderRadius: 2,
            boxShadow: "0 18px 50px rgba(15,23,42,0.12)",
            overflow: "hidden",
          },
        },
      }}
    >
      {children}
    </MuiPopover>
  );
}

type DashboardCalendarProps = any;

export function Calendar({ className, ...props }: DashboardCalendarProps) {
  const defaultClassNames = getDefaultClassNames();
  return (
    <Box
      dir="rtl"
      className={className}
      sx={{
        p: 1.25,
        bgcolor: COLORS.surface,
        fontFamily: '"Vazirmatn", Arial, sans-serif',
        direction: "rtl",
        "& .rdp-root": { "--cell-size": "38px" },
        "& .rdp-months": { display: "flex", gap: 2 },
        "& .rdp-month": { width: "100%" },
        "& .rdp-month_caption": {
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        "& .rdp-dropdowns": { display: "flex", justifyContent: "center", alignItems: "center", gap: 0.75, flexWrap: "nowrap", width: "fit-content", maxWidth: "100%", margin: "0 auto" },
        "& .rdp-dropdown_root": {
          width: "auto",
          minWidth: 0,
          maxWidth: "none",
          border: "1px solid " + COLORS.border,
          borderRadius: 1.5,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          position: "relative",
          background: COLORS.surface,
        },
        "& .rdp-dropdown_root:nth-child(1)": { width: 112, flex: "0 0 112px" },
        "& .rdp-dropdown_root:nth-child(1) select": { width: "112px", maxWidth: "112px" },
        "& .rdp-dropdown_root:nth-child(2)": { width: 76, flex: "0 0 76px" },
        "& .rdp-dropdown_root:nth-child(2) select": { width: "76px", maxWidth: "76px" },
        "& .rdp-dropdown_root svg, & .rdp-chevron": {
          display: "none",
        },
        "& .rdp-caption_label": { fontSize: 13, fontWeight: 700, color: COLORS.text },
        "& .rdp-weekdays": { display: "flex" },
        "& .rdp-weekday": {
          flex: 1,
          textAlign: "center",
          color: COLORS.secondary,
          fontSize: 11,
          fontWeight: 600,
          py: 0.75,
        },
        "& .rdp-week": { display: "flex", mt: 0.5 },
        "& .rdp-day": {
          flex: 1,
          display: "grid",
          placeItems: "center",
          p: 0.25,
        },
        "& .rdp-day_button": {
          width: 34,
          height: 34,
          border: 0,
          borderRadius: "50%",
          background: "transparent",
          color: COLORS.text,
          fontFamily: '"Vazirmatn", Arial, sans-serif',
          cursor: "pointer",
        },
        "& .rdp-day_button:hover": { background: "#EFF6FF", color: COLORS.primary },
        "& [data-selected=true] .rdp-day_button": {
          background: COLORS.primary,
          color: "#FFFFFF",
        },
        "& [data-today=true] .rdp-day_button": {
          border: "1px solid " + COLORS.primary,
        },
        "& [data-disabled=true] .rdp-day_button": {
          color: "#94A3B8",
          opacity: 0.45,
          cursor: "not-allowed",
        },
        "& select": {
          width: "auto",
          maxWidth: "100%",
          fontFamily: '"Vazirmatn", Arial, sans-serif',
          fontSize: 11,
          minHeight: 32,
          padding: "4px 8px",
          paddingLeft: 28,
          paddingRight: 8,
          background: COLORS.surface,
          color: COLORS.text + " !important",
          WebkitTextFillColor: COLORS.text,
          border: 0,
          outline: 0,
          appearance: "none",
          cursor: "pointer",
        },
        "& .rdp-dropdown_root select option": {
          color: COLORS.text,
          backgroundColor: COLORS.surface,
          fontFamily: '"Vazirmatn", Arial, sans-serif',
        },
        "& .rdp-button_previous, & .rdp-button_next": {
          display: "none",
        },
      }}
    >
      <DayPicker
        {...props}
        locale={faIR}
        numerals="arabext"
        dir="rtl"
        showOutsideDays={false}
        captionLayout={props.captionLayout ?? "dropdown"}
        formatters={{
          formatMonthDropdown: (date) =>
            date.toLocaleString("fa-IR-u-ca-persian", { month: "long" }),
          ...(props.formatters || {}),
        }}
        hideNavigation
        classNames={{
          ...defaultClassNames,
          month_grid: "rdp-month_grid",
          month_caption: "rdp-month_caption",
          weekdays: "rdp-weekdays",
          weekday: "rdp-weekday",
          week: "rdp-week",
          day: "rdp-day",
          day_button: "rdp-day_button",
          button_previous: "rdp-button_previous",
          button_next: "rdp-button_next",
          caption_label: "rdp-caption_label",
          dropdowns: "rdp-dropdowns",
          dropdown_root: "rdp-dropdown_root",
        }}
      />
    </Box>
  );
}
