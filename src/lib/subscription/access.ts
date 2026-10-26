import { prisma } from "@/lib/prisma";
export type AccessReason = "ACCOUNT_BLOCKED" | "SUBSCRIPTION_INACTIVE" | null;
export function accessBlockFromState(user: { isBlocked: boolean; subscriptions: { status: string; expiresAt: Date }[] }): AccessReason {
 if(user.isBlocked)return "ACCOUNT_BLOCKED";
 const sub=user.subscriptions[0];
 // Accounts predating the subscription rollout remain accessible until migrated.
 if(!sub)return null;
 if(sub.status!=="ACTIVE"||sub.expiresAt.getTime()<=Date.now())return "SUBSCRIPTION_INACTIVE";
 return null;
}
export async function getUserAccessBlock(userId:string):Promise<AccessReason>{
 const user=await prisma.user.findUnique({where:{id:userId},select:{isBlocked:true,subscriptions:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:1,select:{status:true,expiresAt:true}}}});
 return !user?"ACCOUNT_BLOCKED":accessBlockFromState(user);
}
