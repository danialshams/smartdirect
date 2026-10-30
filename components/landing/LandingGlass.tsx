"use client";
import type { ReactNode } from "react";
import { LiquidGlass } from "simple-liquid-glass";

/** One refractive lens with an explicit, inexpensive sibling backdrop for iOS. */
export function LandingGlass({ children, className }: { children: ReactNode; className: string }) {
  return (
    <LiquidGlass
      className={className}
      backdropSelector="#sh-optics-backdrop"
      refraction="lens"
      lensProfile="material"
      lensOptions={{ strength: 0.17, depth: 0.18, curvature: 0.5, sheen: 1.45, specular: 1.5 }}
      quality="high"
      radius={25}
      scale={160}
      blur={1.6}
      saturation={125}
      aberrationIntensity={0.24}
      glassColor="rgba(255,255,255,0.09)"
      reveal="immediate"
    >
      {children}
    </LiquidGlass>
  );
}
