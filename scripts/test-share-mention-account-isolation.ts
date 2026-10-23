import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { findMatchingInteractionAutomation } from "../src/lib/automation/find-interaction-automation";

const key = "interaction-" + Date.now() + "-" + Math.random().toString(36).slice(2,9);
async function main(){
 const user=await prisma.user.create({data:{email:key+"@example.test",name:"Interaction test",password:"test-only"}});
 try {
  const other=await prisma.user.create({data:{email:"other-"+key+"@example.test",name:"Other",password:"test-only"}});
  try{
   const account=await prisma.instagramAccount.create({data:{userId:user.id,igUserId:"IG"+Date.now()+"1",igUsername:key,accessToken:"test-only",isConnected:true}});
   const unrelated=await prisma.instagramAccount.create({data:{userId:other.id,igUserId:"IG"+Date.now()+"2",igUsername:"other-"+key,accessToken:"test-only",isConnected:true}});
   const share=await prisma.automation.create({data:{instagramAccountId:account.id,triggerType:"DM_MEDIA_SHARE",mediaIds:"17900000000000001,17900000000000002",sendDm:true}});
   const mention=await prisma.automation.create({data:{instagramAccountId:account.id,triggerType:"STORY_MENTION",sendDm:true}});
   assert.equal((await findMatchingInteractionAutomation(account.id,{kind:"DM_MEDIA_SHARE",mediaId:"17900000000000001",shortcode:null}))?.id,share.id);
   assert.equal(await findMatchingInteractionAutomation(account.id,{kind:"DM_MEDIA_SHARE",mediaId:"17900000000000003",shortcode:null}),null);
   assert.equal(await findMatchingInteractionAutomation(unrelated.id,{kind:"DM_MEDIA_SHARE",mediaId:"17900000000000001",shortcode:null}),null);
   assert.equal((await findMatchingInteractionAutomation(account.id,{kind:"STORY_MENTION",storyUrl:null}))?.id,mention.id);
   await prisma.automation.update({where:{id:mention.id},data:{isActive:false}});
   assert.equal(await findMatchingInteractionAutomation(account.id,{kind:"STORY_MENTION",storyUrl:null}),null);
   await prisma.automation.update({where:{id:share.id},data:{isActive:false}});
   assert.equal(await findMatchingInteractionAutomation(account.id,{kind:"DM_MEDIA_SHARE",mediaId:"17900000000000001",shortcode:null}),null);
   console.log("SHARE_MENTION_ACCOUNT_ISOLATION_OK");
  }finally{await prisma.user.delete({where:{id:other.id}});}
 }finally{await prisma.user.delete({where:{id:user.id}});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
