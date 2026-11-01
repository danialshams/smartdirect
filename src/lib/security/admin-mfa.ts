import "server-only";
import {createCipheriv,createDecipheriv,createHmac,createHash,hkdfSync,randomBytes,timingSafeEqual} from "node:crypto";
import {cookies,headers} from "next/headers";
import {NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";
import {prisma} from "@/lib/prisma";

const COOKIE="daira_admin_mfa";
const MAX_AGE=10*60*60;
const ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function baseKey(context:string):Buffer{
 const root=process.env.NEXTAUTH_SECRET;
 if(!root||root.length<32)throw new Error("MFA_SECRET_UNAVAILABLE");
 return Buffer.from(hkdfSync("sha256",Buffer.from(root),Buffer.from("daira-mfa-v1"),Buffer.from(context),32));
}
function mac(value:string,ctx:string):string{
 return createHmac("sha256",baseKey(ctx)).update(value).digest("hex");
}
function base32(input:Buffer):string{
 let data=0,bits=0,out="";
 for(const b of input){data=(data<<8)|b;bits+=8;while(bits>=5){out+=ALPHABET[(data>>>(bits-=5))&31];}}
 if(bits)out+=ALPHABET[(data<<(5-bits))&31];
 return out;
}
function decodeBase32(input:string):Buffer{
 let data=0,bits=0;const parts:number[]=[];
 for(const ch of input.replace(/=|\s/g,"").toUpperCase()){
  const ix=ALPHABET.indexOf(ch);if(ix<0)throw Error("INVALID_BASE32");
  data=(data<<5)|ix;bits+=5;if(bits>=8){parts.push((data>>>(bits-=8))&255);}
 }
 return Buffer.from(parts);
}
export function generateTotpSecret():string{return base32(randomBytes(20));}
export function encryptMfaSecret(secret:string):string{
 const iv=randomBytes(12),key=baseKey("totp-encryption");
 const cipher=createCipheriv("aes-256-gcm",key,iv);
 const ciphertext=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);
 return "mfa1:"+[iv,cipher.getAuthTag(),ciphertext].map(x=>x.toString("base64url")).join(".");
}
export function decryptMfaSecret(stored:string):string{
 if(!stored.startsWith("mfa1:"))throw Error("INVALID_MFA_SECRET");
 const [iv,tag,content]=stored.slice(5).split(".").map(x=>Buffer.from(x,"base64url"));
 const cipher=createDecipheriv("aes-256-gcm",baseKey("totp-encryption"),iv);
 cipher.setAuthTag(tag);return Buffer.concat([cipher.update(content),cipher.final()]).toString("utf8");
}
function otp(secret:string,counter:number):string{
 const bytes=Buffer.alloc(8);bytes.writeBigUInt64BE(BigInt(counter));
 const h=createHmac("sha1",decodeBase32(secret)).update(bytes).digest();
 const index=h[h.length-1]&15;const n=(h.readUInt32BE(index)&0x7fffffff)%1000000;
 return String(n).padStart(6,"0");
}
export function validTotp(secret:string,code:string,now=Date.now()):boolean{
 if(!/^\d{6}$/.test(code))return false;
 const counter=Math.floor(now/30000);
 for(const delta of [-1,0,1]){
  const expected=otp(secret,counter+delta);
  if(timingSafeEqual(Buffer.from(code),Buffer.from(expected)))return true;
 }
 return false;
}
export function generateRecoveryCodes():string[]{
 return Array.from({length:10},()=>randomBytes(9).toString("hex").toUpperCase());
}
export function hashRecoveryCode(userId:string,code:string):string{
 return mac(userId+":"+code.replace(/[\s-]/g,"").toUpperCase(),"recovery-code");
}
function userAgentHash(agent:string){return createHash("sha256").update(agent).digest("hex").slice(0,20);}
export function issueMfaProof(userId:string,sessionVersion:number,agent:string):string{
 const time=Math.floor(Date.now()/1000),nonce=randomBytes(8).toString("hex");
 const body=[userId,String(sessionVersion),String(time),userAgentHash(agent),nonce].join(".");
 return body+"."+mac(body,"mfa-proof");
}
export function validateMfaProof(proof:string|undefined,userId:string,version:number,agent:string):boolean{
 if(!proof||proof.length>1024)return false;
 const parts=proof.split(".");
 if(parts.length!==6||parts[0]!==userId||parts[1]!==String(version))return false;
 const issued=Number(parts[2]);if(!Number.isSafeInteger(issued)||issued>Math.floor(Date.now()/1000)+60||issued<Math.floor(Date.now()/1000)-MAX_AGE)return false;
 if(parts[3]!==userAgentHash(agent))return false;
 const body=parts.slice(0,5).join("."),expected=mac(body,"mfa-proof");
 return parts[5].length===expected.length&&timingSafeEqual(Buffer.from(parts[5]),Buffer.from(expected));
}
export async function setMfaCookie(response:NextResponse,userId:string,version:number,agent:string){
 response.cookies.set(COOKIE,issueMfaProof(userId,version,agent),{
  httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",
  maxAge:MAX_AGE,path:"/"
 });
}
export async function authenticatedAdmin(){
 const session=await getServerSession(authOptions);
 if(!session?.user?.id||session.user.role!=="ADMIN")return null;
 const user=await prisma.user.findUnique({where:{id:session.user.id},select:{id:true,role:true,isBlocked:true,sessionVersion:true,password:true,email:true}});
 if(!user||user.role!=="ADMIN"||user.isBlocked)return null;
 return user;
}
export async function hasAdminMfa(userId:string,version:number):Promise<"setup"|"verify"|"ok">{
 const record=await prisma.adminMfa.findUnique({where:{userId},select:{enabledAt:true}});
 if(!record?.enabledAt)return "setup";
 const c=(await cookies()).get(COOKIE)?.value;
 const agent=(await headers()).get("user-agent")||"";
 return validateMfaProof(c,userId,version,agent)?"ok":"verify";
}
export function adminMfaDenied(state:"setup"|"verify"){
 return NextResponse.json({message:state==="setup"?"ابتدا تأیید دومرحله‌ای مدیریت را راه‌اندازی کنید.":"کد دومرحله‌ای مدیریت الزامی است.",code:state==="setup"?"MFA_SETUP_REQUIRED":"MFA_REQUIRED"}, {status:403,headers:{"Cache-Control":"no-store"}});
}
