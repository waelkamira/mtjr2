import "server-only";
import { AdCampaignStatus, AuditActorType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";
import { userHasScopedPermission } from "@/server/identity/permission-repository";

const createSchema=z.object({
 storeId:z.string().trim().min(1),productId:z.string().trim().min(1),marketId:z.string().trim().min(1),currencyCode:z.string().trim().length(3).toUpperCase(),
 budgetMinor:z.string().regex(/^[1-9]\d{0,14}$/),dailyBudgetMinor:z.string().regex(/^[1-9]\d{0,14}$/),cpcBidMinor:z.string().regex(/^[1-9]\d{0,14}$/),
 targetCategoryId:z.string().trim().min(1).optional(),targetBrandId:z.string().trim().min(1).optional(),targetKeywords:z.array(z.string().trim().min(2).max(40)).max(8).default([]),
 title:z.string().trim().min(5).max(140),message:z.string().trim().max(300).optional(),startsAt:z.coerce.date(),endsAt:z.coerce.date()
}).strict().refine(x=>x.startsAt<x.endsAt,{path:["endsAt"],message:"Campaign end must be later than its start."})
.refine(x=>x.endsAt>new Date(),{path:["endsAt"],message:"Campaign end must be in the future."})
.refine(x=>BigInt(x.dailyBudgetMinor)<=BigInt(x.budgetMinor),{path:["dailyBudgetMinor"],message:"Daily budget cannot exceed total budget."})
.refine(x=>BigInt(x.cpcBidMinor)<=BigInt(x.dailyBudgetMinor),{path:["cpcBidMinor"],message:"Cost per click cannot exceed the daily budget."});
export type CreateAdCampaignInput=z.input<typeof createSchema>;
const select={id:true,storeId:true,productId:true,marketId:true,currencyCode:true,budgetMinor:true,dailyBudgetMinor:true,cpcBidMinor:true,spentMinor:true,impressionCount:true,clickCount:true,targetCategoryId:true,targetBrandId:true,targetKeywords:true,currency:{select:{minorUnit:true}},title:true,message:true,status:true,moderationNote:true,startsAt:true,endsAt:true,submittedAt:true,reviewedAt:true,createdAt:true,updatedAt:true,product:{select:{id:true,name:true,slug:true}},store:{select:{id:true,name:true,slug:true}}} satisfies Prisma.AdCampaignSelect;
function serializeCampaign<T extends {budgetMinor:bigint;dailyBudgetMinor:bigint;cpcBidMinor:bigint;spentMinor:bigint;impressionCount:bigint;clickCount:bigint}>(item:T){
 return {...item,budgetMinor:item.budgetMinor.toString(),dailyBudgetMinor:item.dailyBudgetMinor.toString(),cpcBidMinor:item.cpcBidMinor.toString(),spentMinor:item.spentMinor.toString(),impressionCount:item.impressionCount.toString(),clickCount:item.clickCount.toString()};
}

async function assertStoreAccess(storeId:string,userId:string,now:Date){
 const store=await prisma.store.findUnique({where:{id:storeId},select:{id:true,status:true,seller:{select:{ownerId:true,status:true}}}});
 if(!store||store.status!=="ACTIVE"||store.seller.status!=="ACTIVE")throw new Error("An active seller store is required for advertising.");
 if(store.seller.ownerId!==userId&&!await userHasScopedPermission(userId,{permissionKey:"ads:manage",scope:{type:"STORE",id:storeId},now}))throw new Error("You do not have advertising access to this store.");
 return store;
}
export async function listSellerAdCampaigns(storeId:string,now=new Date()){
 const actor=await requireCurrentSession(now); await assertStoreAccess(storeId,actor.userId,now);
 return (await prisma.adCampaign.findMany({where:{storeId},orderBy:[{createdAt:"desc"},{id:"desc"}],take:100,select})).map(serializeCampaign);
}
export async function createSellerAdCampaign(input:CreateAdCampaignInput,now=new Date()){
 const data=createSchema.parse(input),actor=await requireCurrentSession(now); await assertStoreAccess(data.storeId,actor.userId,now);
 const [product,market,storeMarket]=await Promise.all([
  prisma.product.findFirst({where:{id:data.productId,storeId:data.storeId,status:"ACTIVE",approvalStatus:"APPROVED"},select:{id:true,brandId:true,categories:{select:{categoryId:true}}}}),
  prisma.market.findFirst({where:{id:data.marketId,status:"ACTIVE",country:{isActive:true},currencies:{some:{currencyCode:data.currencyCode,isEnabled:true,currency:{isActive:true}}}},select:{id:true,defaultCurrencyCode:true}}),
  prisma.storeMarket.findUnique({where:{storeId_marketId:{storeId:data.storeId,marketId:data.marketId}},select:{isEnabled:true}})
]);
if(!market||!storeMarket?.isEnabled)throw new Error("Choose an active market enabled for this store and currency.");
if(!product)throw new Error("Choose an approved, published product belonging to this store.");
if(data.targetBrandId&&product.brandId!==data.targetBrandId)throw new Error("The selected brand does not match the advertised product.");
if(data.targetCategoryId&&!product.categories.some(category=>category.categoryId===data.targetCategoryId))throw new Error("The selected category does not match the advertised product.");
 if(!product)throw new Error("Choose an approved, published product belonging to this store.");
 return prisma.$transaction(async tx=>{
  const item=await tx.adCampaign.create({data:{...data,budgetMinor:BigInt(data.budgetMinor),dailyBudgetMinor:BigInt(data.dailyBudgetMinor),cpcBidMinor:BigInt(data.cpcBidMinor),targetKeywords:data.targetKeywords.map(value=>value.toLocaleLowerCase()),createdById:actor.userId,message:data.message||null,status:AdCampaignStatus.DRAFT},select});
  await tx.auditLog.create({data:{actorType:AuditActorType.USER,actorId:actor.userId,action:"advertising.campaign.created",resource:"ad_campaign",resourceId:item.id,scopeType:"STORE",scopeId:data.storeId,occurredAt:now,metadata:{productId:data.productId,status:item.status}}});
  return item;
 });
}
export async function submitSellerAdCampaign(id:string,now=new Date()){
 const actor=await requireCurrentSession(now),item=await prisma.adCampaign.findUnique({where:{id},select:{id:true,storeId:true,status:true}});
 if(!item)throw new Error("Campaign not found."); await assertStoreAccess(item.storeId,actor.userId,now);
 if(item.status!==AdCampaignStatus.DRAFT&&item.status!==AdCampaignStatus.REJECTED)throw new Error("Only draft or rejected campaigns can be submitted.");
 return prisma.$transaction(async tx=>{
  const changed=await tx.adCampaign.updateMany({where:{id,status:item.status},data:{status:AdCampaignStatus.SUBMITTED,submittedAt:now,moderationNote:null}});
  if(changed.count!==1)throw new Error("Campaign changed; reload and try again.");
  await tx.auditLog.create({data:{actorType:AuditActorType.USER,actorId:actor.userId,action:"advertising.campaign.submitted",resource:"ad_campaign",resourceId:id,scopeType:"STORE",scopeId:item.storeId,occurredAt:now}});
  return serializeCampaign(await tx.adCampaign.findUniqueOrThrow({where:{id},select}));
 });
}
export async function changeSellerAdCampaignStatus(id:string,action:"ACTIVATE"|"PAUSE"|"ARCHIVE",now=new Date()){
 const actor=await requireCurrentSession(now),item=await prisma.adCampaign.findUnique({where:{id},select:{id:true,storeId:true,status:true,startsAt:true,endsAt:true}});
 if(!item)throw new Error("Campaign not found."); await assertStoreAccess(item.storeId,actor.userId,now);
 let next:AdCampaignStatus;
 if(action==="ACTIVATE"){
  if(item.status!==AdCampaignStatus.APPROVED)throw new Error("Only approved campaigns can be activated.");
  if(item.startsAt>now||item.endsAt<=now)throw new Error("Campaign is outside its approved schedule.");
  const funded=await prisma.adCampaign.findUnique({where:{id},select:{budgetMinor:true,dailyBudgetMinor:true,cpcBidMinor:true,marketId:true,currencyCode:true}});
  if(!funded||funded.budgetMinor<=0n||funded.dailyBudgetMinor<=0n||funded.cpcBidMinor<=0n||!funded.marketId||!funded.currencyCode)throw new Error("Campaign requires a valid market, currency and positive budget before activation.");
  next=AdCampaignStatus.ACTIVE;
}
 else if(action==="PAUSE"){if(item.status!==AdCampaignStatus.ACTIVE)throw new Error("Only active campaigns can be paused.");next=AdCampaignStatus.PAUSED;}
 else {if(!([AdCampaignStatus.DRAFT,AdCampaignStatus.APPROVED,AdCampaignStatus.PAUSED] as AdCampaignStatus[]).includes(item.status))throw new Error("This campaign cannot be archived in its current state.");next=AdCampaignStatus.ARCHIVED;}
 return prisma.$transaction(async tx=>{
  const changed=await tx.adCampaign.updateMany({where:{id,status:item.status},data:{status:next}});
  if(changed.count!==1)throw new Error("Campaign changed; reload and try again.");
  await tx.auditLog.create({data:{actorType:AuditActorType.USER,actorId:actor.userId,action:"advertising.campaign."+action.toLowerCase(),resource:"ad_campaign",resourceId:id,scopeType:"STORE",scopeId:item.storeId,occurredAt:now,metadata:{previousStatus:item.status,status:next}}});
  return serializeCampaign(await tx.adCampaign.findUniqueOrThrow({where:{id},select}));
 });
}
export async function listAdCampaignsForModeration(now=new Date()){
 await requirePermission({permissionKey:"ads:moderate",now});
 return (await prisma.adCampaign.findMany({where:{status:AdCampaignStatus.SUBMITTED},orderBy:[{submittedAt:"asc"},{id:"asc"}],take:100,select:{...select,store:{select:{id:true,name:true,slug:true,seller:{select:{displayName:true,legalName:true}}}}}})).map(serializeCampaign);
}
export async function moderateAdCampaign(id:string,decision:"APPROVE"|"REJECT",reason:string|undefined,now=new Date()){
 const actor=await requirePermission({permissionKey:"ads:moderate",now});
 if(decision==="REJECT"&&!reason?.trim())throw new Error("A rejection reason is required.");
 return prisma.$transaction(async tx=>{
  const item=await tx.adCampaign.findUnique({where:{id},select:{id:true,storeId:true,status:true}});
  if(!item)throw new Error("Campaign not found."); if(item.status!==AdCampaignStatus.SUBMITTED)throw new Error("Only submitted campaigns can be moderated.");
  const status=decision==="APPROVE"?AdCampaignStatus.APPROVED:AdCampaignStatus.REJECTED;
  const changed=await tx.adCampaign.updateMany({where:{id,status:AdCampaignStatus.SUBMITTED},data:{status,reviewedById:actor.userId,reviewedAt:now,moderationNote:decision==="REJECT"?reason!.trim():null}});
  if(changed.count!==1)throw new Error("Campaign was already reviewed.");
  await tx.auditLog.create({data:{actorType:AuditActorType.USER,actorId:actor.userId,action:"advertising.campaign."+decision.toLowerCase(),resource:"ad_campaign",resourceId:id,scopeType:"STORE",scopeId:item.storeId,occurredAt:now,metadata:{decision,reason:reason??null}}});
  return serializeCampaign(await tx.adCampaign.findUniqueOrThrow({where:{id},select}));
 });
}
