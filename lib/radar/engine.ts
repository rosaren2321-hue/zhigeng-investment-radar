import { CATALOG, label, type Rule, type Snapshot, type Scenario, type Decision, type Evidence } from './domain.ts';
export const FRESHNESS_MS=10*60*1000;
export function demoSnapshot(rule:Rule,now:number,scenario:Scenario='normal'):Snapshot{
  const stock=CATALOG.find(x=>x.symbol===rule.symbol)!;const bucket=Math.floor(now/300000)*300000;
  const day=Math.floor(now/86400000)*86400000;
  const data:Snapshot={id:`demo:${rule.symbol}:${bucket}:${scenario}`,symbol:rule.symbol,source:'知更合成样本 v1',sourceUrl:'demo://fixtures/v1',observedAt:bucket,fetchedAt:now,quality:'ok',price:stock.price,change:stock.change,heat:stock.heat,events:[{id:`demo:${rule.symbol}:repurchase:${day}`,title:`${stock.name}：关于股份回购进展的公告（合成示例）`,publishedAt:day}],calendar:{id:`demo:${rule.symbol}:earnings:${day}`,title:'财报披露日（合成示例）',at:day+2*86400000}};
  if(scenario==='match'||scenario==='miss')for(const c of rule.conditions){const hit=scenario==='match';if(c.kind==='event')data.events=[{id:`demo:${rule.symbol}:${day}:${hit?'match':'miss'}`,title:hit?`${c.keyword}相关公告（合成场景）`:'与关注关键词无关的示例',publishedAt:day}];else if(c.kind==='calendar')data.calendar.at=now+(hit?c.daysBefore:c.daysBefore+2)*86400000;else {const d=c.kind==='price'?0.01:0.1;data[c.kind]=c.value+((c.op==='gt'||c.op==='gte')==hit?d:-d);}}
  if(scenario==='stale')data.observedAt=now-3600000;
  if(scenario==='conflict'){data.quality='conflict';data.conflict={source:'合成校验源 B',price:Number((data.price*1.08).toFixed(2))};}
  if(scenario==='failure'){data.quality='failure';data.error='演示适配器模拟上游超时（HTTP 504）';}
  return data;
}
export async function fingerprint(rule:Rule,data:Snapshot){
  const semantic=rule.conditions.map(c=>c.kind==='event'?data.events.filter(e=>e.title.includes(c.keyword)).map(e=>e.id):c.kind==='calendar'?data.calendar.id:[c.kind,data.id,data[c.kind]]);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({symbol:rule.symbol,semantic})));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function evaluate(rule:Rule,data:Snapshot,context:{now:number;lastAlert:number|null;previousStatus:string;seen?:boolean}):Promise<Decision>{
  const base={data,recovered:context.previousStatus==='unknown',fingerprint:null};
  let problem='';
  if(data.quality==='failure')problem=data.error||'上游接口失败';
  else if(data.quality==='conflict')problem=`数据来源冲突：主源价格 ${data.price}，${data.conflict?.source??'校验源'}价格 ${data.conflict?.price??'缺失'}。本轮暂停判断。`;
  else if(!Number.isFinite(data.observedAt)||data.observedAt>context.now+60000)problem='数据时间戳无效或来自未来，无法校验新鲜度。';
  else if(context.now-data.observedAt>FRESHNESS_MS)problem=`数据已过期 ${Math.floor((context.now-data.observedAt)/60000)} 分钟，超过 10 分钟有效期。`;
  else if(data.symbol!==rule.symbol)problem='数据标的与规则不一致。';
  const evidence:Evidence[]=rule.conditions.map(c=>{
    const condition=label(c);if(problem)return {condition,actual:'不可用',passed:null,reason:problem};
    if(c.kind==='event'){if(!Array.isArray(data.events))return {condition,actual:'缺失',passed:null,reason:'缺少公告数据'};const events=data.events.filter(e=>e.title.includes(c.keyword));return {condition,actual:events.length?events.map(e=>e.title).join('；'):'未发现关键词匹配',passed:events.length>0,reason:'按公告标题进行字面关键词匹配；不作语义投资判断'};}
    if(c.kind==='calendar'){if(!data.calendar||!Number.isFinite(data.calendar.at))return {condition,actual:'缺失',passed:null,reason:'缺少日历数据'};const days=Math.ceil((data.calendar.at-context.now)/86400000);return {condition,actual:`距示例财报日 ${days} 天`,passed:days>=0&&days<=c.daysBefore,reason:'按北京时间展示，提前天数按 24 小时向上取整'};}
    const val=data[c.kind];if(!Number.isFinite(val)||(c.kind==='price'&&val<=0)||(c.kind==='heat'&&(val<0||val>100))||(c.kind==='change'&&(val < -100||val>100)))return {condition,actual:'无效数值',passed:null,reason:'数据字段缺失或超出有效范围'};
    const passed=c.op==='lt'?val<c.value:c.op==='lte'?val<=c.value:c.op==='gt'?val>c.value:val>=c.value;
    return {condition,actual:`${val}${c.kind==='price'?' 元':c.kind==='change'?'%':' / 100'}`,passed,reason:passed?'当前值满足阈值':'当前值尚未满足阈值'};
  });
  if(evidence.some(e=>e.passed===null))return {...base,recovered:false,status:'unknown',reason:problem||'部分条件缺少可信数据，本轮暂停判断，不发送提醒。',evidence};
  const hit=rule.logic==='all'?evidence.every(e=>e.passed):evidence.some(e=>e.passed);
  if(!hit)return {...base,status:'not_matched',reason:`${rule.logic==='all'?'要求全部条件满足':'要求至少一个条件满足'}。${evidence.filter(e=>!e.passed).map(e=>`${e.condition}：当前 ${e.actual}`).join('；')}`,evidence};
  const fp=await fingerprint(rule,data);
  if(context.seen)return {...base,fingerprint:fp,status:'duplicate',reason:'条件满足，但同一版本已为这份证据提醒过。本次仅记录检查，不重复提醒。',evidence};
  if(context.lastAlert!==null&&context.now-context.lastAlert<rule.cooldownMin*60000)return {...base,fingerprint:fp,status:'cooldown',reason:`条件满足，但仍在 ${rule.cooldownMin} 分钟冷却期内，还剩 ${Math.ceil((context.lastAlert+rule.cooldownMin*60000-context.now)/60000)} 分钟。`,evidence};
  return {...base,fingerprint:fp,status:'matched',reason:`${evidence.filter(e=>e.passed).map(e=>`${e.condition}（当前 ${e.actual}）`).join('；')}。已生成站内提醒。`,evidence};
}
export function nextDelay(rule:Rule,status:string,failures:number){return status==='unknown'?Math.min(3600000,60000*2**Math.min(failures,6)):rule.intervalMin*60000;}
