import * as React from "react"
import { cn } from "cn"
function Separator({ className, orientation="horizontal", decorative=true, ...props }: React.ComponentProps<"div"> & {orientation?:"horizontal"|"vertical"; decorative?:boolean}) { return <div data-slot="separator" data-orientation={orientation} role={decorative?"none":"separator"} className={cn("bg-border shrink-0", orientation==="horizontal"?"h-px w-full":"h-full w-px",className)} {...props}/> }
export { Separator }
