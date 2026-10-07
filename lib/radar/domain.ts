import { z } from 'zod';
export const CATALOG = [
  {symbol:'600519.SH',name:'贵州茅台',price:1688.8,change:-1.32,heat:67},
  {symbol:'300750.SZ',name:'宁德时代',price:258.6,change:2.16,heat:86},
  {symbol:'000300.SH',name:'沪深300',price:3986.2,change:-2.35,heat:83},
  {symbol:'000001.SH',name:'上证指数',price:3228.4,change:-.86,heat:72},
  {symbol:'000001.SZ',name:'平安银行',price:11.28,change:.65,heat:44},
  {symbol:'600036.SH',name:'招商银行',price:38.62,change:-1.12,heat:56},
] as const;
export const NUMERIC_KINDS=['price','change','heat'] as const;
const numeric=z.object({kind:z.enum(NUMERIC_KINDS),op:z.enum(['lt','lte','gt','gte']),value:z.number().finite()}).strict();
const condition=z.union([numeric,z.object({kind:z.literal('event'),keyword:z.string().trim().min(1).max(30)}).strict(),z.object({kind:z.literal('calendar'),daysBefore:z.number().int().min(0).max(30)}).strict()]);
export const ruleSchema=z.object({title:z.string().trim().min(1).max(50),symbol:z.string().refine(s=>CATALOG.some(x=>x.symbol===s),'请选择演示目录中的标的'),logic:z.enum(['all','any']),conditions:z.array(condition).min(1).max(5),intervalMin:z.number().int().min(5).max(1440),cooldownMin:z.number().int().min(0).max(10080)}).strict().superRefine((r,ctx)=>{for(const c of r.conditions){if(c.kind==='price'&&c.value<=0)ctx.addIssue({code:'custom',message:'价格必须大于 0'});if(c.kind==='heat'&&(c.value<0||c.value>100))ctx.addIssue({code:'custom',message:'热度范围为 0–100'});if(c.kind==='change'&&(c.value < -100 || c.value>100))ctx.addIssue({code:'custom',message:'涨跌幅范围为 -100% 至 100%'});}});
export type Rule=z.infer<typeof ruleSchema>;
export type Condition=Rule['conditions'][number];
export type Scenario='normal'|'match'|'miss'|'stale'|'conflict'|'failure';
export const SCENARIOS:Record<Scenario,string>={normal:'正常样本',match:'条件命中',miss:'条件未命中',stale:'数据过期',conflict:'数据冲突',failure:'接口失败'};
export const STATUS:Record<string,{label:string;tone:string}>={ready:{label:'等待检查',tone:'neutral'},matched:{label:'已提醒',tone:'success'},not_matched:{label:'条件未满足',tone:'neutral'},unknown:{label:'无法判断',tone:'warning'},cooldown:{label:'冷却中',tone:'info'},duplicate:{label:'已去重',tone:'info'},paused:{label:'已暂停',tone:'neutral'},expired:{label:'已到期',tone:'neutral'}};
export const FIELD_NAMES={price:'价格',change:'日内涨跌幅',heat:'热度',event:'公告关键词',calendar:'财报日历'};
export const OP_NAMES={lt:'低于',lte:'不高于',gt:'高于',gte:'不低于'};
export function label(c:Condition):string{if(c.kind==='event')return `出现包含「${c.keyword}」的公告`;if(c.kind==='calendar')return `距财报日不超过 ${c.daysBefore} 天`;return `${FIELD_NAMES[c.kind]}${OP_NAMES[c.op]} ${c.value}${c.kind==='price'?' 元':c.kind==='change'?'%':' / 100'}`;}
export function ruleLabel(r:Rule){return r.conditions.map(label).join(r.logic==='all'?' 且 ':' 或 ');}
export const DEFAULT_RULE:Rule={title:'贵州茅台 · 价格观察',symbol:'600519.SH',logic:'all',conditions:[{kind:'price',op:'lt',value:1600}],intervalMin:5,cooldownMin:30};
export const SEED_RULES:Rule[]=[DEFAULT_RULE,{title:'宁德时代 · 公告雷达',symbol:'300750.SZ',logic:'all',conditions:[{kind:'event',keyword:'回购'}],intervalMin:5,cooldownMin:30},{title:'沪深300 · 波动与热度',symbol:'000300.SH',logic:'all',conditions:[{kind:'change',op:'lt',value:-2},{kind:'heat',op:'gt',value:80}],intervalMin:5,cooldownMin:30}];
export const EXAMPLES=[{label:'价格变化',text:'贵州茅台低于1600元时提醒我，每5分钟检查，30分钟内不重复提醒。'},{label:'公告事件',text:'关注宁德时代，出现回购公告时提醒我，每5分钟检查，冷却30分钟。'},{label:'财报日历',text:'招商银行财报发布前3天提醒我，每60分钟检查，冷却1440分钟。'},{label:'组合条件',text:'沪深300日内跌幅超过2%，并且热度高于80时提醒我，每5分钟检查，冷却30分钟。'}];
export type Snapshot={id:string;symbol:string;source:string;sourceUrl:string;observedAt:number;fetchedAt:number;quality:'ok'|'conflict'|'failure';price:number;change:number;heat:number;events:{id:string;title:string;publishedAt:number}[];calendar:{id:string;title:string;at:number};conflict?:{source:string;price:number};error?:string};
export type Evidence={condition:string;actual:string;passed:boolean|null;reason:string};
export type Decision={status:string;reason:string;evidence:Evidence[];fingerprint:string|null;recovered:boolean;data:Snapshot};
export type Task={id:string;owner:string;rule:Rule;version:number;enabled:boolean;createdAt:number;updatedAt:number;expiresAt:number;nextRun:number;lastRun:number|null;lastAlert:number|null;status:string;reason:string;failures:number;scenario:Scenario;lastData?:Snapshot};
