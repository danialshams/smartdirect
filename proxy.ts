import type { NextRequest,NextFetchEvent } from "next/server";
import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import type { JWT } from "next-auth/jwt";

type NextAuthRequest=NextRequest&{nextauth:{token:(JWT&{role?:"ADMIN"|"USER";id?:string})|null}};
const pagesGuard=withAuth(async function middleware(req:NextAuthRequest) {
 const token=req.nextauth.token;
 if(req.nextUrl.pathname.startsWith("/rickandmorty")&&token?.role!=="ADMIN")
   return NextResponse.redirect(new URL("/dashboard",req.url));
 return NextResponse.next();
});

// Uniform cross-origin write protection for every browser-facing API. Webhooks,
// OAuth callbacks and cron requests remain server-to-server and do not depend
// on a browser Origin header. This is defense in depth alongside SameSite cookies.
export default function proxy(req:NextRequest,event:NextFetchEvent) {
 const path=req.nextUrl.pathname;
 if(path.startsWith("/api/")) {
  if(!["GET","HEAD","OPTIONS"].includes(req.method)) {
   const origin=req.headers.get("origin");
   const site=req.headers.get("sec-fetch-site");
   if(origin) {
    try{
     const source=new URL(origin);
     if(source.host!==req.nextUrl.host||source.protocol!==req.nextUrl.protocol)
       return NextResponse.json({message:"درخواست از مبدأ غیرمجاز است."},{status:403});
    }catch{return NextResponse.json({message:"مبدأ نامعتبر است."},{status:403});}
   }else if(site==="cross-site"||site==="same-site")
     return NextResponse.json({message:"درخواست از مبدأ غیرمجاز است."},{status:403});
  }
  return NextResponse.next();
 }
 return pagesGuard(req as NextAuthRequest,event);
}
export const config={
 matcher:["/dashboard/:path*","/rickandmorty/:path*","/api/:path*"],
};
