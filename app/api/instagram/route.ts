import { NextResponse } from "next/server";
// Deprecated OAuth entry point generated unsigned state. Use /api/instagram/connect,
// which issues nonce-bound signed one-time OAuth state for the active session.
export async function GET(){
 return NextResponse.json({message:"از مسیر اتصال حساب در داشبورد استفاده کنید."},{status:410,headers:{"Cache-Control":"no-store"}});
}
