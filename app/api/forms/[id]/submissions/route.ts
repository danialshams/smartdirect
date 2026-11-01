import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { verifyPublicFormToken } from "@/lib/forms/public-form-token";
import { hashRequestIp } from "@/lib/auth/sms-otp";
import { sameOrigin,clientIp,privateHeaders } from "@/lib/auth/request";

/**
 * GET /api/forms/[id]/submissions
 *
 * فقط صاحب فرم می‌تواند Submission ها را ببیند.
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!form) {
      return NextResponse.json({ error: "فرم پیدا نشد" }, { status: 404 });
    }

    const submissions = await prisma.formSubmission.findMany({
      where: {
        formId: id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(submissions);
  } catch (error) {
    console.error("GET /api/forms/[id]/submissions error:", error);

    return NextResponse.json(
      { error: "خطا در دریافت پاسخ‌های فرم" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/forms/[id]/submissions
 *
 * ثبت پاسخ فرم
 *
 * این endpoint بعداً توسط Flow Engine نیز استفاده می‌شود.
 */
export async function POST(
  request: NextRequest,
  {params}:{params:Promise<{id:string}>}
) {
  // Public intake is permitted only with an unexpired signed form token bound
  // to the exact form, account and Instagram participant.
  if(!sameOrigin(request))return NextResponse.json({error:"درخواست نامعتبر است."},{status:403,headers:privateHeaders});
  if(Number(request.headers.get("content-length")||0)>16*1024)
    return NextResponse.json({error:"حجم فرم بیش از حد مجاز است."},{status:413,headers:privateHeaders});
  const reader=request.body?.getReader();
  if(!reader)return NextResponse.json({error:"درخواست نامعتبر است."},{status:400,headers:privateHeaders});
  const chunks:Uint8Array[]=[];let total=0;
  while(true){
    const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;
    if(total>16*1024){
      await reader.cancel().catch(()=>undefined);
      return NextResponse.json({error:"حجم فرم بیش از حد مجاز است."},{status:413,headers:privateHeaders});
    }
    chunks.push(value);
  }
  let body:Record<string,unknown>;
  try{
    const parsed=JSON.parse(Buffer.concat(chunks.map(chunk=>Buffer.from(chunk))).toString("utf8"));
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error();
    body=parsed;
  }catch{return NextResponse.json({error:"اطلاعات نامعتبر است."},{status:400,headers:privateHeaders});}
  const {id}=await params;
  const bearer=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim();
  const token=typeof body.token==="string"?body.token:bearer;
  if(!token||token.length>4096)return NextResponse.json({error:"مجوز فرم معتبر نیست."},{status:401,headers:privateHeaders});
  let verified:Awaited<ReturnType<typeof verifyPublicFormToken>>;
  try{verified=await verifyPublicFormToken(token);}
  catch{return NextResponse.json({error:"مجوز فرم معتبر نیست یا منقضی شده است."},{status:401,headers:privateHeaders});}
  if(verified.formId!==id)return NextResponse.json({error:"مجوز این فرم معتبر نیست."},{status:403,headers:privateHeaders});
  const form=await prisma.form.findFirst({
    where:{id,isActive:true,instagramAccountId:verified.instagramAccountId},
    include:{fields:{orderBy:{order:"asc"}}}
  });
  if(!form)return NextResponse.json({error:"فرم در دسترس نیست."},{status:404,headers:privateHeaders});
  const answers=body.answers;
  if(!answers||typeof answers!=="object"||Array.isArray(answers))
    return NextResponse.json({error:"پاسخ‌ها معتبر نیستند."},{status:400,headers:privateHeaders});
  const cleanAnswers:Record<string,unknown>={};
  for(const field of form.fields){
    const value=(answers as Record<string,unknown>)[field.name];
    if(field.required&&(value===undefined||value===null||value===""||(Array.isArray(value)&&value.length===0)))
      return NextResponse.json({error:"فیلدهای ضروری تکمیل نشده‌اند."},{status:400,headers:privateHeaders});
    if(value===undefined)continue;
    if(typeof value==="string"&&value.length<=1000)cleanAnswers[field.name]=value;
    else if(Array.isArray(value)&&value.length<=20&&value.every(v=>typeof v==="string"&&v.length<=250))
      cleanAnswers[field.name]=value;
    else return NextResponse.json({error:"یکی از پاسخ‌ها معتبر نیست."},{status:400,headers:privateHeaders});
  }
  const ipHash=hashRequestIp(clientIp(request));
  const since=new Date(Date.now()-60*60*1000);
  const attempts=await prisma.publicFormSubmissionAttempt.count({
    where:{ipHash,createdAt:{gt:since}}
  });
  if(attempts>=30)return NextResponse.json({error:"درخواست‌های زیادی ثبت شده است."},{status:429,headers:privateHeaders});
  // Count attempts before insert so unsuccessful database writes still burn budget.
  await prisma.publicFormSubmissionAttempt.create({data:{ipHash,formId:id}});
  const submission=await prisma.formSubmission.create({
    data:{formId:id,igUserId:verified.instagramUserId,username:null,
      answers:cleanAnswers as Prisma.InputJsonValue}
  });
  return NextResponse.json({success:true,id:submission.id},{status:201,headers:privateHeaders});
}
