import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.RADAR_TEST_URL||'https://watchlane-investment-radar.rosaren2321.chatgpt.site';
const cookies=new Map();
async function api(path,method='GET',body){const r=await fetch(base+'/api/'+path,{method,headers:{Cookie:[...cookies.values()].join('; '),...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify(body)})});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0];cookies.set(pair.split('=')[0],pair)}const data=await r.json();assert.ok(r.ok,'API returned '+r.status);return data;}
const results=[];let task;
async function check(name,fn){const t=Date.now();try{const details=await fn();results.push({name,passed:true,durationMs:Date.now()-t,details});console.log('PASS',name)}catch(e){results.push({name,passed:false,durationMs:Date.now()-t,error:e.message});console.log('FAIL',name,e.message)}}
await check('线上服务端模型配置生效',async()=>{const x=await api('state');assert.equal(x.model.configured,true);assert.equal(x.model.promptVersion,'rule-compiler-v1.2');return {model:x.model}});
for(const c of [
 {name:'价格草案经确认后形成监控',text:'贵州茅台低于1700元时提醒我，每5分钟检查，冷却30分钟。',verify:r=>r?.symbol==='600519.SH'&&r.conditions.length===1&&r.conditions[0].kind==='price'&&r.conditions[0].op==='lt'&&r.conditions[0].value===1700&&r.intervalMin===5&&r.cooldownMin===30},
 {name:'线上公告关键词解析',text:'宁德时代出现回购公告时提醒我。',verify:r=>r?.symbol==='300750.SZ'&&r.conditions.length===1&&r.conditions[0].kind==='event'&&r.conditions[0].keyword==='回购'},
 {name:'线上财报日历解析',text:'招商银行财报发布前3天提醒我，每60分钟检查。',verify:r=>r?.symbol==='600036.SH'&&r.conditions.length===1&&r.conditions[0].kind==='calendar'&&r.conditions[0].daysBefore===3&&r.intervalMin===60},
])await check(c.name,async()=>{const x=await api('compile','POST',{text:c.text});assert.equal(x.mode,'deepseek');assert.ok(c.verify(x.rule),'规则语义与输入不符');if(c.name.startsWith('价格')){task=await api('tasks','POST',{rule:{...x.rule,title:'线上 DeepSeek 验收'}});assert.equal(task.status,'matched');}return {input:c.text,response:x}});
await check('含糊阈值需澄清且不会自动创建任务',async()=>{const before=(await api('state')).tasks.length;const x=await api('compile','POST',{text:'贵州茅台大跌时提醒我。'});assert.equal(x.mode,'deepseek');assert.equal(x.rule,null);assert.ok(x.questions.length);assert.equal((await api('state')).tasks.length,before);return x});
await check('真实模型调用与检查证据持久保存',async()=>{const s=await api('state');assert.ok(s.aiRecords.some(r=>r.result.mode==='deepseek'&&r.result.promptVersion==='rule-compiler-v1.2'));assert.ok(task);const d=await api('tasks/'+task.id);assert.ok(d.runs.length>=1);assert.equal(d.runs[0].version,1);const exported=await api('export');assert.equal(JSON.stringify(exported).includes('"owner"'),false);return {modelRecordCount:s.aiRecords.length,taskId:task.id,runCount:d.runs.length}});
if(task)await api('tasks/'+task.id,'PATCH',{enabled:false,version:task.version});
const report={testedAt:new Date().toISOString(),target:base,model:'deepseek-flash',promptVersion:'rule-compiler-v1.2',passed:results.filter(x=>x.passed).length,total:results.length,note:'生产环境验收；4 次真实模型调用，单次样本，不作为稳定准确率估计。',results};
fs.writeFileSync('docs/production-ai-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
