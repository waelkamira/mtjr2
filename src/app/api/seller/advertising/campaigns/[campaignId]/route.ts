import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { changeSellerAdCampaignStatus, submitSellerAdCampaign } from "@/server/advertising/campaigns";

export const runtime="nodejs";
type Context={params:Promise<{campaignId:string}>};
export async function PATCH(request:Request,context:Context):Promise<Response>{
 const rejected=validateIdentityMutationRequest(request);if(rejected)return rejected;
 let body:unknown;try{body=await request.json();}catch{return Response.json({error:"Invalid JSON body."},{status:400});}
 const parsed=z.object({action:z.enum(["SUBMIT","ACTIVATE","PAUSE","ARCHIVE"])}).strict().safeParse(body);
 if(!parsed.success)return Response.json({error:"Invalid campaign action."},{status:400});
 try{const {campaignId}=await context.params;const item=parsed.data.action==="SUBMIT"?await submitSellerAdCampaign(campaignId):await changeSellerAdCampaignStatus(campaignId,parsed.data.action);return Response.json({item});}
 catch(error){if(error instanceof AuthenticationRequiredError)return Response.json({error:"Authentication required."},{status:401});return Response.json({error:error instanceof Error?error.message:"Unable to update campaign."},{status:409});}
}
