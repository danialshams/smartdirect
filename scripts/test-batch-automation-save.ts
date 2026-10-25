import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { prepareAutomationMessages } from "../src/lib/automation/batch-messages";

async function main() {
  const seed = randomUUID().replaceAll("-", "");
  const ids: string[] = [];
  try {
    const owner = await prisma.user.create({data:{
      name:"Batch response CI", email:"batch-"+seed+"@example.invalid", password:"ci-only",
    }});
    ids.push(owner.id);
    const outsider = await prisma.user.create({data:{
      name:"Other tenant CI", email:"batch-other-"+seed+"@example.invalid", password:"ci-only",
    }});
    ids.push(outsider.id);
    const account = await prisma.instagramAccount.create({data:{
      userId:owner.id,igUserId:"batch-"+seed,igUsername:"batch",accessToken:"ci-only",
    }});
    const foreignAccount = await prisma.instagramAccount.create({data:{
      userId:outsider.id,igUserId:"batch-other-"+seed,igUsername:"other",accessToken:"ci-only",
    }});
    const form = await prisma.form.create({data:{
      userId:owner.id,instagramAccountId:account.id,title:"Owner form",
    }});
    const foreignForm = await prisma.form.create({data:{
      userId:outsider.id,instagramAccountId:foreignAccount.id,title:"Foreign form",
    }});
    const showcase = await prisma.showcase.create({data:{
      userId:owner.id,instagramAccountId:account.id,title:"Owner showcase",
    }});
    const raw = [
      {messageType:"TEXT",text:"سلام",quickReplies:[
        {title:"قیمت",payload:"price-"+seed,destinationType:"TEXT",destinationText:"قیمت محصول"},
        {title:"فرم",payload:"form-"+seed,destinationType:"FORM",
          destinationQuestion:"چه رنگی؟",destinationQuickReplies:[
            {title:"آبی",payload:"blue-"+seed,destinationType:"TEXT",destinationText:"ثبت شد"},
          ],
        },
      ]},
      {messageType:"FORM",text:"سؤال فرم",formId:form.id,quickReplies:[]},
      {messageType:"SHOWCASE",showcaseId:showcase.id,quickReplies:[]},
    ];
    const prepared = await prepareAutomationMessages(raw, account.id, owner.id);
    assert.equal(prepared.length,3);
    const result = await prisma.automation.create({
      data:{instagramAccountId:account.id,triggerType:"STORY_REPLY_KEYWORD",
        keyword:"آزمایش",isActive:false,messages:{create:prepared}},
      include:{messages:{include:{quickReplies:true}}},
    });
    assert.equal(result.messages.length,3);
    assert.equal(result.messages[0].quickReplies.length,2);
    const destination = JSON.parse(result.messages[0].quickReplies[1].replyText || "{}");
    assert.equal(destination.type,"FORM");
    assert.equal(destination.quickReplies[0].destinationText,"ثبت شد");
    assert.equal(result.messages[1].formId,form.id);
    assert.equal(result.messages[2].showcaseId,showcase.id);
    await assert.rejects(() => prepareAutomationMessages([
      {messageType:"FORM",text:"ناامن",formId:foreignForm.id},
    ],account.id,owner.id));
    await assert.rejects(() => prepareAutomationMessages([
      {messageType:"FORM",text:"سؤال",quickReplies:[
        {title:"انتخاب",payload:"nested-"+seed,destinationType:"FORM",
          destinationQuestion:"سؤال بعدی",destinationFormId:foreignForm.id,
          destinationQuickReplies:[{title:"ادامه",payload:"child-"+seed,
            destinationType:"TEXT",destinationText:"بسیار خوب"}]},
      ]},
    ],account.id,owner.id),"Nested form destinations cannot reference another account.");
    await assert.rejects(() => prepareAutomationMessages([
      {messageType:"TEXT",text:"x",quickReplies:[
        {title:"۱",payload:"reused",destinationType:"TEXT",destinationText:"a"},
        {title:"۲",payload:"reused",destinationType:"TEXT",destinationText:"b"},
      ]},
    ],account.id,owner.id));
    const before = await prisma.automation.count({where:{instagramAccountId:account.id}});
    await assert.rejects(() => prisma.automation.create({
      data:{instagramAccountId:account.id,triggerType:"DM",messages:{
        create:[{messageType:"TEXT",text:"x",order:0,form:{connect:{id:"missing-form-"+seed}}}],
      }},
    }));
    assert.equal(await prisma.automation.count({where:{instagramAccountId:account.id}}),before,
      "Nested persistence must roll back fully if a child cannot be created.");
    console.log("ATOMIC_AUTOMATION_RESPONSE_CREATION_AND_ACCOUNT_ISOLATION_OK");
  } finally {
    for (const id of ids) await prisma.user.delete({where:{id}}).catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main().catch(error => {console.error(error);process.exitCode=1;});
