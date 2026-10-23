"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep the last dialog in the DOM for its exit animation when parents use
 * conditional JSX. Do not use this on MUI Dialog (MUI handles its own exit).
 */
export default function GlassModalPresence({
  open,children,onEscape,
}:{open:boolean;children:ReactNode;onEscape?:()=>void}) {
  const [present,setPresent]=useState(open);
  const lastRef=useRef<ReactNode>(children);
  if (open && children) lastRef.current=children;
  useEffect(() => {
    if (open) {setPresent(true);return;}
    if (!present) return;
    const id=window.setTimeout(() => {setPresent(false);lastRef.current=null;},220);
    return () => window.clearTimeout(id);
  },[open,present]);
  useEffect(() => {
    if (!open || !onEscape) return;
    const handleKeyDown=(event:KeyboardEvent)=>{
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscape();
    };
    window.addEventListener("keydown",handleKeyDown);
    return () => window.removeEventListener("keydown",handleKeyDown);
  },[open,onEscape]);
  if (!present && !open) return null;
  return (
    <div className="daira-modal-presence" data-phase={open?"open":"closing"} aria-hidden={open?undefined:true}>
      {open?children:lastRef.current}
    </div>
  );
}
