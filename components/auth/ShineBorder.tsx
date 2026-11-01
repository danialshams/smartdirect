"use client";

import type { CSSProperties } from "react";

// Adapted from Magic UI's MIT-licensed Shine Border component.
// https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/shine-border.tsx
export function ShineBorder({ duration = 16, borderWidth = 1 }: {
  duration?: number;
  borderWidth?: number;
}) {
  return (
    <div
      className="da-auth-shine-border"
      aria-hidden="true"
      style={{
        "--da-shine-duration": `${duration}s`,
        "--da-shine-width": `${borderWidth}px`,
      } as CSSProperties}
    />
  );
}
