import assert from "node:assert/strict";
import { randomInt, randomUUID, createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { internalEmailForPhone, normalizePhone, validatePassword } from "../src/lib/auth/phone";

async function main() {
const phone = normalizePhone("+98910" + randomInt(1_000_000,9_999_999))!;
const password = "SamplePass123";
assert.ok(phone && validatePassword(password));
let userId: string | undefined;
try {
  const created = await prisma.user.create({data:{
    name:"نیلوفر آزمون",firstName:"نیلوفر",lastName:"آزمون",
    phone,email:internalEmailForPhone(phone),password:await bcrypt.hash(password,12)
  }});
  userId=created.id;
  assert.equal(created.phone,phone);
  assert.equal(created.firstName,"نیلوفر");
  assert.equal(created.lastName,"آزمون");
  assert.equal(created.phoneVerifiedAt,null,"Registration cannot mark an unverified phone as verified");
  assert.ok(await bcrypt.compare(password,created.password));
  assert.notEqual(created.password,password);
  const igId = "daira-auth-test-"+randomUUID();
  await prisma.instagramAccount.create({data:{
    userId:created.id,igUserId:igId,igUsername:"daira_test",
    accessToken:"fixture-token-not-valid",isConnected:true
  }});
  const fetched=await prisma.user.findUnique({
    where:{id:created.id},
    include:{instagramAccounts:{select:{userId:true,igUserId:true,isConnected:true}}}
  });
  assert.equal(fetched?.instagramAccounts.length,1);
  assert.equal(fetched?.instagramAccounts[0].igUserId,igId);
  assert.equal(fetched?.instagramAccounts[0].userId,created.id);

  const challenge=await prisma.authSmsChallenge.create({data:{
    userId:created.id,phone,purpose:"verify",
    codeHash:createHmac("sha256","test-key").update("test").digest("hex"),
    expiresAt:new Date(Date.now()+120_000),ipHash:"test-ip"
  }});
  assert.equal(challenge.attempts,0);
  assert.equal(challenge.consumedAt,null);
  const attempt=await prisma.authSignupAttempt.create({data:{ipHash:"test-ip"}});
  assert.ok(attempt.id);
  await prisma.authSignupAttempt.delete({where:{id:attempt.id}});
  console.log("DAIRA AUTH PERSISTENCE PASS: name, surname, E.164 phone, bcrypt password, Instagram ownership and OTP challenge");
} finally {
  if(userId)await prisma.user.delete({where:{id:userId}}).catch(()=>{});
  await prisma.$disconnect();
}

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
