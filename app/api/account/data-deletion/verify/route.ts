import {NextRequest,NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import bcrypt from "bcryptjs";
import {authOptions} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {sameOrigin,privateHeaders} from "@/lib/auth/request";
import {normalizePhone} from "@/lib/auth/phone";
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({message:"مبدأ درخواست معتبر نیست."},{status:403,headers:privateHeaders});
 const session=await getServerSession(authOptions);
 if(!session?.user?.id)return NextResponse.json({message:"برای تأیید حساب وارد شوید."},{status:401,headers:privateHeaders});
 if(Number(req.headers.get("content-length")||0)>1200)return NextResponse.json({message:"درخواست بزرگ است."},{status:413,headers:privateHeaders});
 let body:Record<string,unknown>|null=null;try{body=await req.json();}catch{}
 const reference=typeof body?.reference==="string"?body.reference.trim():"";
 const password=body?.password;
 if(!/^c[a-z0-9]{12,40}$/.test(reference)||typeof password!=="string"||password.length>128)
  return NextResponse.json({message:"کد پیگیری یا رمز معتبر نیست."},{status:400,headers:privateHeaders});
 const [user,request]=await Promise.all([
  prisma.user.findUnique({where:{id:session.user.id},select:{id:true,phone:true,email:true,password:true,isBlocked:true,role:true}}),
  prisma.dataDeletionRequest.findUnique({where:{id:reference}})
 ]);
 if(!user||!request||user.isBlocked||user.role==="ADMIN"||request.status==="COMPLETED"||request.status==="REJECTED")
  return NextResponse.json({message:"تأیید امکان‌پذیر نیست."},{status:400,headers:privateHeaders});
 const ownerContact=(normalizePhone(request.contact)&&normalizePhone(request.contact)===user.phone) ||
  (request.contact.toLowerCase()===user.email.toLowerCase());
 if(!ownerContact||!await bcrypt.compare(password,user.password))
  return NextResponse.json({message:"مشخصات حساب یا رمز عبور مطابقت ندارد."},{status:403,headers:privateHeaders});
 await prisma.dataDeletionRequest.update({where:{id:reference},data:{verifiedUserId:user.id,verifiedAt:new Date(),status:"VERIFYING"}});
 return NextResponse.json({success:true,message:"مالکیت حساب تأیید شد. درخواست برای بررسی حذف در صف مدیریت قرار گرفت."},{headers:privateHeaders});
}
