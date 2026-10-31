"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const ROOT="/landing/robot";
const IDLE="idle-front";
const MOTIONS=["turn-left","turn-right","tilt-head","blink-glow","micro-scan"] as const;

/**
 * Two buffered <video> elements alternate so transitions don't flash black.
 * Every physically-rendered motion starts AND finishes at the same head pose.
 * Unlike a single video loop, the browser picks the next animation at random.
 * No Three.js, Canvas, WebGL or runtime model lighting.
 */
export function RobotMotionPlayer() {
  const videoA=useRef<HTMLVideoElement>(null);
  const videoB=useRef<HTMLVideoElement>(null);
  const activeRef=useRef(0);
  const lastMotion=useRef<string>("");
  const started=useRef(false);
  const [active,setActive]=useState(0);
  const [sources,setSources]=useState<[string,string]>([IDLE,"turn-left"]);
  const [startedPlaying,setStartedPlaying]=useState(false);
  const [reduced,setReduced]=useState(false);
  const [unavailable,setUnavailable]=useState(false);

  const selectNext=useCallback((current:string)=>{
    if(current!==IDLE) return IDLE;
    const eligible=MOTIONS.filter(clip=>clip!==lastMotion.current);
    const clip=eligible[Math.floor(Math.random()*eligible.length)];
    lastMotion.current=clip;
    return clip;
  },[]);

  useEffect(()=>{
    const mq=window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onReduced=()=>setReduced(mq.matches);
    const onVisibility=()=>{
      const elements=[videoA.current,videoB.current];
      if(document.visibilityState==="hidden") elements.forEach(el=>el?.pause());
      else if(!mq.matches && !unavailable) elements[activeRef.current]?.play().catch(()=>{});
    };
    mq.addEventListener("change",onReduced);
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{
      document.removeEventListener("visibilitychange",onVisibility);
      mq.removeEventListener("change",onReduced);
      [videoA.current,videoB.current].forEach(el=>el?.pause());
    };
  },[unavailable]);

  // Prebuffer the next randomly chosen motion using the hidden video element.
  useEffect(()=>{
    if(!started.current) {
      started.current=true;
      setSources([IDLE,selectNext(IDLE)]);
      return;
    }
    const current=sources[active];
    const next=selectNext(current);
    setSources(previous=>{
      const updated:[string,string]=[...previous];
      updated[1-active]=next;
      return updated;
    });
    // Active source updates only on switch; never reload the playing video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[active,selectNext]);

  useEffect(()=>{
    if(reduced || unavailable){
      videoA.current?.pause();
      videoB.current?.pause();
    } else if(document.visibilityState==="visible") {
      (active===0?videoA.current:videoB.current)?.play().catch(()=>{});
    }
  },[active,reduced,unavailable]);

  const switchToNext=(index:number)=>{
    if(activeRef.current!==index || reduced || unavailable) return;
    const nextIndex=1-index;
    const next=(nextIndex===0?videoA:videoB).current;
    if(!next)return;
    const start=()=>{
      if(activeRef.current!==index)return;
      next.currentTime=0;
      // The first and last rendered poses are identical; crossfading is safe.
      next.play().then(()=>{
        activeRef.current=nextIndex;
        setActive(nextIndex);
      }).catch(()=>setUnavailable(true));
    };
    if(next.readyState>=2) start();
    else next.addEventListener("canplay",start,{once:true});
  };

  return (
    <div className="sh-robot-motion" role="img"
      aria-label="ربات سه‌بعدی دایرا با حرکات تصادفی سر، نگاه مستقیم، چرخش چپ و راست و چشم‌های نورانی">
      <Image src={ROOT+"/front.webp"} alt="" fill priority
        sizes="(max-width: 600px) 100vw, (max-width: 860px) 540px, 680px"
        className="sh-robot-motion__poster"/>
      {!reduced && !unavailable && [0,1].map(index=>(
        <video
          key={index}
          ref={index===0?videoA:videoB}
          className={"sh-robot-motion__clip"+(index===active && startedPlaying?" sh-robot-motion__clip--active":"")}
          src={ROOT+"/"+sources[index]+".mp4"}
          autoPlay={index===0}
          muted playsInline preload="auto"
          tabIndex={-1}
          aria-hidden="true"
          onPlaying={()=>{
            if(index===activeRef.current)setStartedPlaying(true);
          }}
          onEnded={()=>switchToNext(index)}
          onError={()=>{
            // If a clip cannot be decoded, retain the last usable image.
            if(index===activeRef.current)setUnavailable(true);
          }}
        />
      ))}
    </div>
  );
}
