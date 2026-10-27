"use client";
import { useEffect, useRef } from "react";
import type { OrbitMode, MountedOrbit } from "./glOrbits";
export function LandingWebGL({mode}:{mode:OrbitMode}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;
    if(!canvas||!canvas.parentElement)return;
    const stage=canvas.parentElement;
    const activeCanvas: HTMLCanvasElement = canvas;
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)");
    const net=navigator as Navigator&{connection?:{saveData?:boolean}};
    const constrained=navigator as Navigator&{deviceMemory?:number};
    if(reduce.matches||net.connection?.saveData||(constrained.deviceMemory!==undefined&&constrained.deviceMemory<=2))return;
    let instance:MountedOrbit|null=null,alive=true,loading=false,visible=false,scrollFrame=0;
    let observer:IntersectionObserver|undefined,resizeObserver:ResizeObserver|undefined;
    let pointer=0;
    function update(){
      scrollFrame=0;
      if(!instance)return;
      const rect=stage.getBoundingClientRect();
      instance.update((window.innerHeight*.5-rect.top)/Math.max(rect.height,1),pointer);
    }
    function onScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(update);}
    function onPointer(e:PointerEvent){
      if(e.pointerType==="touch")return;
      const rect=stage.getBoundingClientRect();
      pointer=Math.max(-.45,Math.min(.45,((e.clientX-rect.left)/Math.max(rect.width,1)-.5)*.75));
      onScroll();
    }
    async function start(){
      if(!alive||!visible||loading||instance||reduce.matches||document.hidden)return;
      loading=true;
      try{
        const {mountOrbit}=await import("./glOrbits");
        if(!alive||!visible||!activeCanvas.isConnected)return;
        instance=mountOrbit(activeCanvas,mode);
        if(instance){
          const mounted=instance;
          void mounted.logoReady.then(ready=>{
            if(ready&&alive&&visible&&instance===mounted)stage.classList.add("dl-logo-ready");
          });
          stage.classList.add("dl-webgl-active");
          window.addEventListener("scroll",onScroll,{passive:true});
          stage.addEventListener("pointermove",onPointer,{passive:true});
          update();
        }
      }catch{/* Unavailable WebGL must never hide the server-rendered page. */}
      finally{loading=false;}
    }
    function stop(){
      if(scrollFrame){cancelAnimationFrame(scrollFrame);scrollFrame=0;}
      instance?.dispose();instance=null;
      stage.classList.remove("dl-webgl-active","dl-logo-ready");
      window.removeEventListener("scroll",onScroll);
      stage.removeEventListener("pointermove",onPointer);
    }
    const lost=(event:Event)=>{event.preventDefault();stop();};
    const restored=()=>{if(alive)void start();};
    const visibility=()=>{
      if(document.hidden)stop();
      else if(visible)void start();
    };
    const onMotionChange=()=>{if(reduce.matches)stop();else if(visible)void start();};
    reduce.addEventListener("change",onMotionChange);
    canvas.addEventListener("webglcontextlost",lost);
    canvas.addEventListener("webglcontextrestored",restored);
    document.addEventListener("visibilitychange",visibility);
    if("ResizeObserver" in window){
      resizeObserver=new ResizeObserver(()=>instance?.resize());
      resizeObserver.observe(stage);
    }
    if("IntersectionObserver" in window){
      observer=new IntersectionObserver(([entry])=>{
        visible=entry.isIntersecting;
        if(visible)void start(); else stop();
      },{rootMargin:"100px 0px 100px 0px"});
      observer.observe(stage);
    }else {visible=true;void start();}
    return ()=>{
      alive=false;observer?.disconnect();resizeObserver?.disconnect();
      reduce.removeEventListener("change",onMotionChange);
      document.removeEventListener("visibilitychange",visibility);
      canvas.removeEventListener("webglcontextlost",lost);
      canvas.removeEventListener("webglcontextrestored",restored);
      if(scrollFrame)cancelAnimationFrame(scrollFrame);
      stop();
    };
  },[mode]);
  return <canvas ref={ref} className="dl-webgl" aria-hidden="true" tabIndex={-1}/>;
}