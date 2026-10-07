// External scheduler. Page requests never drive the monitoring loop.
const origin=process.env.RADAR_SITE_URL;
const secret=process.env.RADAR_CRON_SECRET;
const bypass=process.env.RADAR_SITE_BYPASS;
if(!origin||!secret)throw new Error('Missing scheduler configuration');
const url=new URL('/api/cron',origin);
const headers={Authorization:`Bearer ${secret}`,'Content-Type':'application/json',...(bypass?{'OAI-Sites-Authorization':`Bearer ${bypass}`}:{})};
let lastError;
for(let i=0;i<3;i++){
 try{const response=await fetch(url,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error(`Scheduler HTTP ${response.status}`);const report=await response.json();if(!Number.isFinite(report.lastTick))throw new Error('Invalid scheduler response');console.log(JSON.stringify({lastTick:report.lastTick,checked:report.checked,failed:report.failed}));if(report.failed)throw new Error('Some tasks failed to execute');lastError=null;break;}
 catch(error){lastError=error;console.error(`Attempt ${i+1} failed: ${error.message}`);if(i<2)await new Promise(r=>setTimeout(r,3000*(i+1)));}
}
if(lastError)process.exitCode=1;
