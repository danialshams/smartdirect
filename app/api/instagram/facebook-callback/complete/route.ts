import { NextResponse } from "next/server";
// Retired: never accept access tokens in GET query strings.
export async function GET() {
 return NextResponse.json({message:"مسیر قدیمی اتصال غیرفعال شده است."},{status:410,headers:{"Cache-Control":"no-store"}});
}
