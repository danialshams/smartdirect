import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
export async function GET(){
  const guard=await requireAdmin();if(guard.response)return guard.response;
  const now=new Date();
  const [users,pages,activeSubscriptions,expiredSubscriptions,openTickets,activeAutomations,blockedUsers,unreadTickets]=await Promise.all([
    prisma.user.count({where:{role:"USER"}}),
    prisma.instagramAccount.count({where:{isConnected:true}}),
    prisma.user.count({where:{role:"USER",subscriptions:{some:{status:"ACTIVE",expiresAt:{gt:now}}}}}),
    prisma.user.count({where:{role:"USER",subscriptions:{some:{OR:[{status:"EXPIRED"},{status:"ACTIVE",expiresAt:{lte:now}}]}}}}),
    prisma.ticket.count({where:{status:{in:["OPEN","IN_PROGRESS","WAITING_USER"]}}}),
    prisma.automation.count({where:{isActive:true}}),
    prisma.user.count({where:{role:"USER",isBlocked:true}}),
    prisma.ticketMessage.count({where:{sender:{role:"USER"},readAt:null}})
  ]);
  return NextResponse.json({users,pages,activeSubscriptions,expiredSubscriptions,openTickets,activeAutomations,blockedUsers,unreadTickets});
}
