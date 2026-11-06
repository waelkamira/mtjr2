import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { moderateAdCampaign } from "@/server/advertising/campaigns";
export const runtime="nodejs";
type Context={params:Promise<{campaignId:string}>};
export async function PATCH(request:Request,context:Context):Promise<Response>{
 const rejected=validateIdentityMutationRequest(request);if(rejected)return rejected;
 let body:unknown;try{body=await request.json();}catch{return Response.json({error:"Invalid JSON body."},{status:400});}
 const parsed=z.object({decision:z.enum(["APPROVE","REJECT"]),reason:z.string().trim().max(500).optional()}).strict().safeParse(body);
 if(!parsed.success)return Response.json({error:"Invalid moderation decision."},{status:400});
 try{const {campaignId}=await context.params;return Response.json({item:await moderateAdCampaign(campaignId,parsed.data.decision,parsed.data.reason)});}
 catch(error){if(error instanceof AuthenticationRequiredError)return Response.json({error:"Authentication required."},{status:401});if(error instanceof PermissionDeniedError)return Response.json({error:"Permission denied."},{status:403});const message=error instanceof Error?error.message:"Unable to moderate campaign.";return Response.json({error:message},{status:/not found/i.test(message)?404:409});}
}
