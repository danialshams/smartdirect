import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { getAdminUsers, getAdminUsersPage, resolveAdminSelection } from "../src/lib/admin-users";
import { getUserAccessBlock } from "../src/lib/subscription/access";
async function main(){
 const uid=randomUUID(), email="admin-regression-"+uid+"@example.invalid";
 const admin=await prisma.user.create({data:{name:"Admin Audit Test",email:"other-"+email,password:"test-only",role:"ADMIN"}});
 const user=await prisma.user.create({data:{name:"Admin Regression "+uid,email,password:"test-only",role:"USER"}});
 try{
  const account=await prisma.instagramAccount.create({data:{userId:user.id,igUserId:"regression-"+uid,igUsername:"regression_"+uid.slice(0,8),accessToken:"test-only",isConnected:true}});
  await prisma.automation.create({data:{instagramAccountId:account.id,triggerType:"DM",isActive:true}});
  await prisma.subscription.create({data:{userId:user.id,planKey:"monthly",status:"ACTIVE",source:"MANUAL",startedAt:new Date(Date.now()-30*86400000),expiresAt:new Date(Date.now()+30*86400000),createdAt:new Date(Date.now()-86400000)}});
  const latest=await prisma.subscription.create({data:{userId:user.id,planKey:"yearly",status:"ACTIVE",source:"MANUAL",startedAt:new Date(),expiresAt:new Date(Date.now()+365*86400000),createdAt:new Date()}});
  const filters={q:uid,planKey:"yearly"};
  const rows=await getAdminUsers(filters);
  assert.equal(rows.find(x=>x.id===user.id)?.subscription?.planKey,"yearly","Latest subscription must win over history");
  assert.equal(rows.find(x=>x.id===user.id)?.pagesCount,1);
  assert.equal((await getAdminUsers({q:uid,planKey:"monthly"})).some(x=>x.id===user.id),false,"Old plan cannot appear as current");
  const page=await getAdminUsersPage({q:uid},1,20);
  assert.equal(page.total,1);
  assert.equal(page.data[0]?.id,user.id);
  const selected=await resolveAdminSelection({mode:"filtered",filters});
  assert.deepEqual(selected,[user.id]);
  assert.deepEqual(await resolveAdminSelection({mode:"ids",userIds:[user.id,admin.id]}),[user.id],"Admin must never be bulk-selected");
  assert.equal(await getUserAccessBlock(user.id),null);
  await prisma.subscription.update({where:{id:latest.id},data:{status:"SUSPENDED",suspendedAt:new Date()}});
  assert.equal(await getUserAccessBlock(user.id),"SUBSCRIPTION_INACTIVE","Suspended account must not execute automations");
  await prisma.user.update({where:{id:user.id},data:{isBlocked:true}});
  assert.equal(await getUserAccessBlock(user.id),"ACCOUNT_BLOCKED","Block must supersede plan status");
  await prisma.user.update({where:{id:user.id},data:{isBlocked:false}});
  await prisma.subscription.update({where:{id:latest.id},data:{status:"ACTIVE",suspendedAt:null}});
  assert.equal(await getUserAccessBlock(user.id),null,"Reactivation must restore access");
  console.log("ADMIN_DATABASE_ACCESS_AND_SUBSCRIPTIONS_OK");
 }finally{
  await prisma.user.delete({where:{id:user.id}}).catch(()=>undefined);
  await prisma.user.delete({where:{id:admin.id}}).catch(()=>undefined);
  await prisma.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
