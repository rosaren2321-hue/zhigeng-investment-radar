import fs from 'node:fs';
import {compile} from '../lib/radar/compiler.ts';
process.loadEnvFile('.env.local');
if(!process.env.DEEPSEEK_API_KEY)throw new Error('DeepSeek key is not configured');
const cases=[
 {name:'明确价格',text:'贵州茅台低于1600元时提醒我，每5分钟检查，30分钟内不重复提醒。',verify:r=>r.rule?.conditions.some(c=>c.kind==='price'&&c.op==='lt'&&c.value===1600)},
 {name:'跌幅与热度组合',text:'沪深300日内跌幅超过2%，并且热度高于80时提醒我，每5分钟检查，冷却30分钟。',verify:r=>r.rule?.logic==='all'&&r.rule.conditions.some(c=>c.kind==='change'&&c.op==='lt'&&c.value===-2)&&r.rule.conditions.some(c=>c.kind==='heat'&&c.value===80)},
 {name:'公告关键词',text:'宁德时代出现回购公告时提醒我。',verify:r=>r.rule?.conditions.some(c=>c.kind==='event'&&c.keyword==='回购')},
 {name:'财报提前天数',text:'招商银行财报发布前3天提醒我，每60分钟检查。',verify:r=>r.rule?.conditions.some(c=>c.kind==='calendar'&&c.daysBefore===3)},
 {name:'模糊阈值澄清',text:'贵州茅台大跌时提醒我。',verify:r=>!r.rule&&r.questions.length>0},
 {name:'不支持时段澄清',text:'贵州茅台低于1600元时提醒我，仅在A股交易时段每5分钟检查。',verify:r=>!r.rule&&r.questions.length>0},
];
const results=[];
for(const c of cases){const started=Date.now();const response=await compile(c.text,{key:process.env.DEEPSEEK_API_KEY,model:process.env.DEEPSEEK_MODEL});const passed=response.mode==='deepseek'&&!!c.verify(response);results.push({name:c.name,input:c.text,passed,durationMs:Date.now()-started,response});console.log(JSON.stringify({name:c.name,passed,mode:response.mode,durationMs:Date.now()-started}));}
const report={testedAt:new Date().toISOString(),model:process.env.DEEPSEEK_MODEL||'deepseek-flash',promptVersion:'rule-compiler-v1.0',trialsPerCase:1,note:'有限验收样本；不是稳定准确率估计；未测试在线金融数据。',passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync('docs/live-ai-results.json',JSON.stringify(report,null,2));if(report.passed!==report.total)process.exitCode=1;
