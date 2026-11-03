import "server-only";

import { AuditActorType, SellerStaffStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasScopedPermission } from "@/server/identity/permission-repository";

const id = z.string().trim().min(1).max(128);
const messageSchema = z.object({ body: z.string().trim().min(2).max(8000) }).strict();
const startSchema = z.object({ storeId: id, subject: z.string().trim().min(5).max(180), body: z.string().trim().min(2).max(8000), orderId: id.optional() }).strict();

async function canAccessStore(userId: string, storeId: string, ownerId: string, now: Date) {
  if (ownerId === userId) return true;
  const membership = await prisma.sellerStaff.findFirst({ where: { storeId, userId, status: SellerStaffStatus.ACTIVE }, select: { id: true } });
  if (!membership) return false;
  return userHasScopedPermission(userId, { permissionKey: "messages:manage", scope: { type: "STORE", id: storeId }, now });
}

function serializeMessage(message: { id:string; body:string; createdAt:Date; senderId:string; sender:{displayName:string|null} }) {
  return { id:message.id, body:message.body, createdAt:message.createdAt.toISOString(), senderId:message.senderId, author:message.sender.displayName || "Marketplace member" };
}

export async function startStoreConversation(input: unknown, now = new Date()) {
  const data = startSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async tx => {
    const store = await tx.store.findFirst({ where:{id:data.storeId,status:"ACTIVE",seller:{status:"ACTIVE"}}, select:{id:true,name:true,seller:{select:{ownerId:true}}} });
    if (!store) throw new Error("Store is not available.");
    if (data.orderId) {
      const order = await tx.order.findFirst({where:{id:data.orderId,userId:actor.userId,vendorOrders:{some:{storeId:store.id}},status:{not:"CANCELLED"}},select:{id:true}});
      if (!order) throw new Error("Order does not belong to this customer and store.");
    }
    const conversation = await tx.storeConversation.create({data:{
      customerId:actor.userId,storeId:store.id,orderId:data.orderId ?? null,subject:data.subject,lastMessageAt:now,customerReadAt:now,
      messages:{create:{senderId:actor.userId,body:data.body}}
    },select:{id:true,subject:true,storeId:true,createdAt:true,lastMessageAt:true}});
    await tx.notification.create({data:{
      userId:store.seller.ownerId,type:"STORE_MESSAGE",title:"New customer message",
      message:"A customer has started a conversation with your store.",resourceType:"store_conversation",
      resourceId:conversation.id,deduplicationKey:"store-message:"+conversation.id
    }});
    await tx.auditLog.create({data:{actorType:AuditActorType.USER,actorId:actor.userId,action:"store.conversation.created",resource:"store_conversation",resourceId:conversation.id,scopeType:"STORE",scopeId:store.id,occurredAt:now}});
    return {...conversation,createdAt:conversation.createdAt.toISOString(),lastMessageAt:conversation.lastMessageAt.toISOString(),storeName:store.name};
  });
}

export async function listCustomerConversations(now = new Date()) {
  const actor=await requireCurrentSession(now);
  const rows=await prisma.storeConversation.findMany({where:{customerId:actor.userId},orderBy:[{lastMessageAt:"desc"},{id:"desc"}],take:100,
    select:{id:true,subject:true,lastMessageAt:true,customerReadAt:true,store:{select:{id:true,name:true}},_count:{select:{messages:true}}}});
  return rows.map(x=>({...x,lastMessageAt:x.lastMessageAt.toISOString(),customerReadAt:x.customerReadAt?.toISOString()??null,messageCount:x._count.messages,unread:!!x.lastMessageAt&&(!x.customerReadAt||x.lastMessageAt>x.customerReadAt)}));
}

export async function getCustomerConversation(conversationId:string,now=new Date()) {
 const conversationKey=id.parse(conversationId),actor=await requireCurrentSession(now);
 const c=await prisma.storeConversation.findFirst({where:{id:conversationKey,customerId:actor.userId},select:{id:true,subject:true,storeId:true,store:{select:{name:true}},messages:{orderBy:{createdAt:"asc"},take:300,select:{id:true,body:true,createdAt:true,senderId:true,sender:{select:{displayName:true}}}}}});
 if(!c)throw new Error("Conversation not found.");
 await prisma.storeConversation.updateMany({where:{id:c.id,customerId:actor.userId},data:{customerReadAt:now}});
 return {id:c.id,subject:c.subject,storeId:c.storeId,storeName:c.store.name,messages:c.messages.map(serializeMessage)};
}

export async function replyCustomerConversation(conversationId:string,input:unknown,now=new Date()) {
 const conversationKey=id.parse(conversationId),data=messageSchema.parse(input),actor=await requireCurrentSession(now);
 return prisma.$transaction(async tx=>{
  const c=await tx.storeConversation.findFirst({where:{id:conversationKey,customerId:actor.userId},select:{id:true,storeId:true,store:{select:{seller:{select:{ownerId:true}}}}}});
  if(!c)throw new Error("Conversation not found.");
  const message=await tx.storeMessage.create({data:{conversationId:c.id,senderId:actor.userId,body:data.body},select:{id:true,body:true,createdAt:true}});
  await tx.storeConversation.update({where:{id:c.id},data:{lastMessageAt:now,customerReadAt:now}});
  await tx.notification.create({data:{userId:c.store.seller.ownerId,type:"STORE_MESSAGE",title:"New customer message",message:"A customer replied to your store conversation.",resourceType:"store_conversation",resourceId:c.id,deduplicationKey:"store-message:"+message.id}});
  return {...message,createdAt:message.createdAt.toISOString()};
 });
}

export async function listStoreConversations(storeIdInput:string,now=new Date()) {
 const storeId=id.parse(storeIdInput),actor=await requireCurrentSession(now);
 const store=await prisma.store.findFirst({where:{id:storeId,status:"ACTIVE",seller:{status:"ACTIVE"}},select:{id:true,name:true,seller:{select:{ownerId:true}}}});
 if(!store||!(await canAccessStore(actor.userId,store.id,store.seller.ownerId,now)))throw new Error("You cannot access this store inbox.");
 const rows=await prisma.storeConversation.findMany({where:{storeId},orderBy:[{lastMessageAt:"desc"},{id:"desc"}],take:100,
 select:{id:true,subject:true,lastMessageAt:true,storeReadAt:true,customer:{select:{displayName:true,email:true}},_count:{select:{messages:true}}}});
 return rows.map(x=>({...x,lastMessageAt:x.lastMessageAt.toISOString(),storeReadAt:x.storeReadAt?.toISOString()??null,customerName:x.customer.displayName||x.customer.email,messageCount:x._count.messages,unread:!x.storeReadAt||x.lastMessageAt>x.storeReadAt}));
}

export async function getStoreConversation(storeIdInput:string,conversationId:string,now=new Date()) {
 const storeId=id.parse(storeIdInput),conversationKey=id.parse(conversationId),actor=await requireCurrentSession(now);
 const c=await prisma.storeConversation.findFirst({where:{id:conversationKey,storeId},select:{id:true,subject:true,customer:{select:{id:true,displayName:true,email:true}},store:{select:{seller:{select:{ownerId:true}}}},messages:{orderBy:{createdAt:"asc"},take:300,select:{id:true,body:true,createdAt:true,senderId:true,sender:{select:{displayName:true}}}}}});
 if(!c||!(await canAccessStore(actor.userId,storeId,c.store.seller.ownerId,now)))throw new Error("Conversation not found.");
 await prisma.storeConversation.updateMany({where:{id:c.id,storeId},data:{storeReadAt:now}});
 return {id:c.id,subject:c.subject,customer:c.customer,messages:c.messages.map(serializeMessage)};
}

export async function replyStoreConversation(storeIdInput:string,conversationId:string,input:unknown,now=new Date()) {
 const storeId=id.parse(storeIdInput),conversationKey=id.parse(conversationId),data=messageSchema.parse(input),actor=await requireCurrentSession(now);
 return prisma.$transaction(async tx=>{
  const c=await tx.storeConversation.findFirst({where:{id:conversationKey,storeId},select:{id:true,customerId:true,store:{select:{seller:{select:{ownerId:true}}}}}});
  if(!c||!(await canAccessStore(actor.userId,storeId,c.store.seller.ownerId,now)))throw new Error("Conversation not found.");
  const message=await tx.storeMessage.create({data:{conversationId:c.id,senderId:actor.userId,body:data.body},select:{id:true,body:true,createdAt:true}});
  await tx.storeConversation.update({where:{id:c.id},data:{lastMessageAt:now,storeReadAt:now}});
  await tx.notification.create({data:{userId:c.customerId,type:"STORE_MESSAGE",title:"Your store replied",message:"There is a new reply to your store conversation.",resourceType:"store_conversation",resourceId:c.id,deduplicationKey:"store-message:"+message.id}});
  await tx.auditLog.create({data:{actorType:AuditActorType.USER,actorId:actor.userId,action:"store.conversation.replied",resource:"store_conversation",resourceId:c.id,scopeType:"STORE",scopeId:storeId,occurredAt:now}});
  return {...message,createdAt:message.createdAt.toISOString()};
 });
}
