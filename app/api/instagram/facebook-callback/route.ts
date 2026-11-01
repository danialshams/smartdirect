import { NextResponse } from "next/server";
// The deprecated implicit OAuth flow used to transfer tokens via a URL query.
// Keep this endpoint disabled rather than reintroducing token leaks.
export async function GET() {
 return NextResponse.json({message:"از مسیر اتصال امن اینستاگرام در داشبورد استفاده کنید."},{status:410,headers:{"Cache-Control":"no-store"}});
}
