import {env} from 'cloudflare:workers';
import {ZodError} from 'zod';
import * as service from '@/lib/radar/service';
export const dynamic='force-dynamic';
async function handle(request:Request){
 const url=new URL(request.url);const parts=url.pathname.replace(/^\/api\//,'').split('/');const cookie=request.headers.get('cookie')??'';const existing=cookie.match(/(?:^|;\s*)radar_session=([a-f0-9-]{36})(?:;|$)/)?.[1];const session=existing??crypto.randomUUID();const auth=request.headers.get('oai-authenticated-user-id');const owner=auth?`user:${auth}`:`visitor:${session}`;
 const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!existing)headers['Set-Cookie']=`radar_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${url.protocol==='https:'?'; Secure':''}`;
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data,(key,value)=>key==='owner'?undefined:value),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
 try{
  if(parts[0]==='cron'){
   if(request.method!=='POST')return respond({error:'Method not allowed'},405);
   const key=(env as unknown as Record<string,string>).CRON_SECRET;
   if(!key||request.headers.get('authorization')!==`Bearer ${key}`)return respond({error:'Unauthorized'},401);
   return respond(await service.cron());
  }
  if(request.method!=='GET'){
   const origin=request.headers.get('origin');const configured=(env as unknown as Record<string,string>).PUBLIC_SITE_URL;
   if(!origin||![url.origin,configured].filter(Boolean).includes(origin))return respond({error:'请求来源不受信任，请从产品页面操作。'},403);
   if(!request.headers.get('content-type')?.includes('application/json'))return respond({error:'请使用 JSON 请求。'},415);
  }
  if(request.method==='GET'&&parts[0]==='state'){await service.seed(owner);return respond(await service.state(owner));}
  if(request.method==='GET'&&parts[0]==='tasks'&&parts[1])return respond(await service.detail(owner,parts[1]));
  if(request.method==='GET'&&parts[0]==='export'){const state=await service.state(owner);const details=await Promise.all(state.tasks.map(t=>service.detail(owner,t.id)));return respond({product:'知更 · 投资风险雷达',exportedAt:new Date().toISOString(),...state,details});}
  const raw=await request.text();if(raw.length>16000)return respond({error:'请求内容过大。'},413);const body=raw?JSON.parse(raw):{};
  if(request.method==='POST'&&parts[0]==='compile')return respond(await service.generate(owner,body.text));
  if(request.method==='POST'&&parts[0]==='tasks'&&!parts[1])return respond(await service.create(owner,body.rule),201);
  if(request.method==='PATCH'&&parts[0]==='tasks'&&parts[1])return respond(await service.update(owner,parts[1],body));
  if(request.method==='POST'&&parts[0]==='tasks'&&parts[1]&&parts[2]==='run'){await service.owned(parts[1],owner);return respond(await service.runTask(parts[1],owner,'manual'));}
  if(request.method==='POST'&&parts[0]==='alerts'&&parts[1]&&parts[2]==='read')return respond(await service.markRead(owner,parts[1]));
  return respond({error:'接口不存在。'},404);
 }catch(error){if(error instanceof service.AppError)return respond({error:error.message},error.code);if(error instanceof ZodError)return respond({error:error.issues.map(x=>x.message).join('；')},400);if(error instanceof SyntaxError)return respond({error:'请求格式不正确。'},400);console.error('radar request failed',error instanceof Error?error.name:'unknown');return respond({error:'服务暂时不可用，内容未丢失。请稍后重试。'},503);}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;
