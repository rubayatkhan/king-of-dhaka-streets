export const FEEDBACK_ENDPOINT='https://api.web3forms.com/submit';
export type FeedbackKind='idea'|'bug'|'love';
export interface FeedbackInput{name:string;kind:FeedbackKind;message:string;botcheck:string}
export interface FeedbackContext{vehicle:string;mission:string;progress:string;device:string;purchases:string}
export type FeedbackResult={ok:true}|{ok:false;reason:string};
export const FEEDBACK_KINDS:Record<FeedbackKind,string>={idea:'New idea',bug:'Something broken',love:'Something I love'};
const MAX_MESSAGE=2000,MAX_NAME=40;

export function validateFeedback(input:FeedbackInput):string|undefined{
 const message=input.message.trim();
 if(message.length<3)return 'Tell us a little more first.';
 if(message.length>MAX_MESSAGE)return `Please keep it a bit shorter (${MAX_MESSAGE} letters max).`;
}

export function buildFeedbackPayload(key:string,input:FeedbackInput,context:FeedbackContext):Record<string,string>{
 const name=input.name.trim().slice(0,MAX_NAME);
 return {access_key:key,subject:`King of Dhaka Streets · ${FEEDBACK_KINDS[input.kind]} from ${name||'a beta tester'}`,from_name:name||'Beta tester',kind:FEEDBACK_KINDS[input.kind],message:input.message.trim(),...context};
}

export async function sendFeedback(key:string|undefined,input:FeedbackInput,context:FeedbackContext,fetcher:typeof fetch=fetch):Promise<FeedbackResult>{
 const invalid=validateFeedback(input);
 if(invalid)return {ok:false,reason:invalid};
 // Automated form fillers complete the hidden field; they get a success screen and nothing is sent.
 if(input.botcheck)return {ok:true};
 if(!key)return {ok:false,reason:'The feedback inbox is not connected yet. Tell a grown-up your idea for now!'};
 try{
  const response=await fetcher(FEEDBACK_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(buildFeedbackPayload(key,input,context))});
  const body=await response.json().catch(()=>({})) as {success?:boolean};
  return response.ok&&body.success?{ok:true}:{ok:false,reason:'That did not go through. Please try again in a moment.'};
 }catch{return {ok:false,reason:'Could not reach the internet. Check your connection and try again.'};}
}
