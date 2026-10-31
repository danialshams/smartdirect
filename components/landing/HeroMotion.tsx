"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Apple-inspired editorial motion: large type reveal, dark stage progression,
 * gentle parallax and one-time feature reveals. No images, no fake product demo.
 * Everything stays readable if JavaScript or animation is unavailable.
 */
export function HeroMotion() {
  useLayoutEffect(()=>{
    if(window.location.hash)return;
    const old=window.history.scrollRestoration;
    window.history.scrollRestoration="manual";
    const reset=()=>window.scrollTo(0,0);
    reset();
    window.addEventListener("pageshow",reset);
    return ()=>{
      window.removeEventListener("pageshow",reset);
      window.history.scrollRestoration=old;
    };
  },[]);

  useLayoutEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    if(media.matches)return;

    const context=gsap.context(()=>{
      gsap.timeline({defaults:{ease:"power3.out"},delay:.12})
        .from("[data-hero-entrance]",{
          y:48,autoAlpha:0,duration:1.02,stagger:.115,
          clearProps:"all",
        },0);

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach(el=>{
        gsap.from(el,{
          y:40,autoAlpha:0,duration:.95,ease:"power3.out",
          clearProps:"all",
          scrollTrigger:{
            trigger:el,start:"top 92%",once:true,
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-story-reveal]").forEach((el,i)=>{
        gsap.from(el,{
          y:50,autoAlpha:0,duration:1.08,delay:i*.08,ease:"power3.out",
          clearProps:"all",
          scrollTrigger:{
            trigger:".ap-story__copy",start:"top 75%",once:true,
          },
        });
      });

      const mm=gsap.matchMedia();
      mm.add("(min-width: 800px)",()=>{
        gsap.fromTo(".ap-story__visual",
          {scale:.82,rotate:-18},
          {scale:1.27,rotate:28,ease:"none",scrollTrigger:{
            trigger:".ap-story",start:"top bottom",end:"bottom top",scrub:1.15,
          }}
        );
        gsap.fromTo(".ap-story__glow",
          {opacity:.3,scale:.75},
          {opacity:1,scale:1.5,ease:"none",scrollTrigger:{
            trigger:".ap-story",start:"top 92%",end:"bottom 18%",scrub:1.1,
          }}
        );
        gsap.fromTo(".ap-capabilities__heading",
          {scale:.96},
          {scale:1,ease:"none",scrollTrigger:{
            trigger:".ap-capabilities",start:"top 100%",end:"top 28%",scrub:.8,
          }}
        );
      });
    });

    const onRefresh=()=>ScrollTrigger.refresh();
    if(document.fonts)document.fonts.ready.then(onRefresh).catch(()=>{});
    return ()=>context.revert();
  },[]);

  return null;
}
