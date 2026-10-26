import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminUsers } from "@/lib/admin-users";
export async function GET(){
  const guard=await requireAdmin();if(guard.response)return guard.response;
  const now=new Date();
  const [userRows,pages,openTickets,activeAutomations,unreadTickets]=await Promise.all([
    getAdminUsers(),
    prisma.instagramAccount.count({where:{isConnected:true}}),
    prisma.ticket.count({where:{status:{in:["OPEN","IN_PROGRESS","WAITING_USER"]}}}),
    prisma.automation.count({where:{isActive:true}}),
    prisma.ticketMessage.count({where:{sender:{role:"USER"},readAt:null}})
  ]);
  return NextResponse.json({users:userRows.length,pages,activeSubscriptions:userRows.filter(u=>u.effectiveStatus==="ACTIVE").length,expiredSubscriptions:userRows.filter(u=>u.effectiveStatus==="EXPIRED").length,openTickets,activeAutomations,blockedUsers:userRows.filter(u=>u.isBlocked).length,unreadTickets});
}
