import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createSellerAdCampaign, listSellerAdCampaigns } from "@/server/advertising/campaigns";

export const runtime = "nodejs";
const bodySchema=z.object({
 storeId:z.string().trim().min(1),productId:z.string().trim().min(1),marketId:z.string().trim().min(1),currencyCode:z.string().trim().length(3),
 budgetMinor:z.string().regex(/^[1-9]\d{0,14}$/),dailyBudgetMinor:z.string().regex(/^[1-9]\d{0,14}$/),cpcBidMinor:z.string().regex(/^[1-9]\d{0,14}$/),
 targetCategoryId:z.string().trim().min(1).optional(),targetBrandId:z.string().trim().min(1).optional(),targetKeywords:z.array(z.string().trim().min(2).max(40)).max(8).default([]),
 title:z.string().trim().min(5).max(140),message:z.string().trim().max(300).optional(),startsAt:z.string().datetime(),endsAt:z.string().datetime()
}).strict();

export async function GET(request:Request):Promise<Response>{
 const params=new URL(request.url).searchParams;
 const storeId=params.get("storeId"),cursor=params.get("cursor")??undefined;
 if(!storeId)return Response.json({error:"storeId is required."},{status:400});
 try{return Response.json(await listSellerAdCampaigns(storeId,new Date(),{cursor}),{headers:{"Cache-Control":"private, no-store"}});}
 catch(error){if(error instanceof AuthenticationRequiredError)return Response.json({error:"Authentication required."},{status:401});return Response.json({error:error instanceof Error?error.message:"Unable to load campaigns."},{status:403});}
}
export async function POST(request:Request):Promise<Response>{
 const rejected=validateIdentityMutationRequest(request);if(rejected)return rejected;
 let body:unknown;try{body=await request.json();}catch{return Response.json({error:"Invalid JSON body."},{status:400});}
 const parsed=bodySchema.safeParse(body);if(!parsed.success)return Response.json({error:"Invalid campaign details.",issues:parsed.error.issues},{status:400});
 try{return Response.json({item:await createSellerAdCampaign(parsed.data)},{status:201});}
 catch(error){if(error instanceof AuthenticationRequiredError)return Response.json({error:"Authentication required."},{status:401});return Response.json({error:error instanceof Error?error.message:"Unable to create campaign."},{status:400});}
}
