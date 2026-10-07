import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.RADAR_TEST_URL||'http://127.0.0.1:5173';
function client(){const cookies=new Map();return async(path,method='GET',body)=>{const r=await fetch(base+'/api/'+path,{method,headers:{...(cookies.size?{Cookie:Array.from(cookies.values()).join('; ')}:{}),...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0];cookies.set(pair.split('=')[0],pair);}return {status:r.status,data:await r.json()};};}
const a=client(),b=client(),results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL',name,e.message);}}
const initial=(await a('state')).data;const other=(await b('state')).data;const task=initial.tasks[0];
await check('首次访问建立 3 个持久任务',()=>assert.equal(initial.tasks.length,3));
await check('不同匿名浏览器空间隔离',()=>assert.notEqual(task.id,other.tasks[0].id));
await check('读取他人任务返回 404',async()=>assert.equal((await b('tasks/'+task.id)).status,404));
await check('重复读取保留任务编号',async()=>assert.equal((await a('state')).data.tasks[0].id,task.id));
await check('非法规则不能落库',async()=>assert.equal((await a('tasks','POST',{rule:{title:'bad'}})).status,400));
await check('不受信任来源不能写入',async()=>{const r=await fetch(base+'/api/tasks',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403)});
await check('未授权定时调用返回 401',async()=>{const r=await fetch(base+'/api/cron',{method:'POST'});assert.equal(r.status,401)});
const rule={title:'集成验证 · 价格',symbol:'600519.SH',logic:'all',conditions:[{kind:'price',op:'lt',value:1700}],intervalMin:5,cooldownMin:30};let made;
await check('创建即完成首次检查并形成提醒',async()=>{const r=await a('tasks','POST',{rule});assert.equal(r.status,201);made=r.data;assert.equal(made.status,'matched');assert.equal(made.version,1)});
if(made){
 await check('同快照重复检查被去重',async()=>assert.equal((await a('tasks/'+made.id+'/run','POST')).data.decision.status,'duplicate'));
 await check('新证据在冷却期内被抑制',async()=>{await a('tasks/'+made.id,'PATCH',{scenario:'match',version:1});assert.equal((await a('tasks/'+made.id+'/run','POST')).data.decision.status,'cooldown')});
 for(const scenario of ['stale','conflict','failure'])await check(scenario+' 不产生误报',async()=>{await a('tasks/'+made.id,'PATCH',{scenario,version:1});assert.equal((await a('tasks/'+made.id+'/run','POST')).data.decision.status,'unknown')});
 await check('恢复后重新评估并保留恢复标记',async()=>{await a('tasks/'+made.id,'PATCH',{scenario:'normal',version:1});assert.equal((await a('tasks/'+made.id+'/run','POST')).data.decision.recovered,true)});
 await check('编辑创建新版本，旧版记录可追溯',async()=>{const next=await a('tasks/'+made.id,'PATCH',{rule:{...rule,conditions:[{kind:'price',op:'lt',value:100}]},version:1});assert.equal(next.data.version,2);const detail=(await a('tasks/'+made.id)).data;assert.equal(detail.versions.length,2);assert.ok(detail.runs.every(x=>x.version===1))});
 await check('陈旧版本修改被拒绝',async()=>assert.equal((await a('tasks/'+made.id,'PATCH',{rule,version:1})).status,409));
 await check('新版本使用新阈值判断',async()=>{const run=(await a('tasks/'+made.id+'/run','POST')).data;assert.equal(run.version,2);assert.equal(run.decision.status,'not_matched')});
 await check('暂停任务不能手动触发',async()=>{await a('tasks/'+made.id,'PATCH',{enabled:false,version:2});assert.equal((await a('tasks/'+made.id+'/run','POST')).status,409)});
 await check('恢复后可再次检查',async()=>{await a('tasks/'+made.id,'PATCH',{enabled:true,version:2});assert.equal((await a('tasks/'+made.id+'/run','POST')).status,200)});
 await check('并发检查不会产生重复提醒',async()=>{await a('tasks/'+made.id,'PATCH',{rule,version:2});const r=await Promise.all([a('tasks/'+made.id+'/run','POST'),a('tasks/'+made.id+'/run','POST')]);assert.ok(r.some(x=>x.status===200));const state=(await a('state')).data;assert.equal(state.alerts.filter(x=>x.task_id===made.id&&x.version===3).length,1)});
 await check('提醒支持标记已读',async()=>{const alert=(await a('state')).data.alerts.find(x=>x.task_id===made.id);await a('alerts/'+alert.id+'/read','POST');assert.ok((await a('state')).data.alerts.find(x=>x.id===alert.id).read_at)});
 await check('证据导出包含每条规则版本和检查',async()=>{const x=(await a('export')).data;const detail=x.details.find(d=>d.task.id===made.id);assert.equal(detail.versions.length,3);assert.ok(detail.runs.length>=8);assert.equal(x.dataMode,'demo')});
 await a('tasks/'+made.id,'PATCH',{enabled:false,version:3});
}
await check('交易执行被拒绝且无任务创建',async()=>{const before=(await a('state')).data.tasks.length;const r=await a('compile','POST',{text:'自动买入贵州茅台'});assert.equal(r.data.refused,true);assert.equal((await a('state')).data.tasks.length,before)});
const report={testedAt:new Date().toISOString(),target:base,passed:results.filter(x=>x.passed).length,total:results.length,results};fs.writeFileSync(base.includes('127.0.0.1')?'docs/local-integration-test-results.json':'docs/production-integration-test-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
