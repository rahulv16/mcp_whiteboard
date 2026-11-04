import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const base=`http://127.0.0.1:${process.env.WHITEBOARD_PORT || 4180}`;
export async function request(route,body){
  const headers={...(process.env.WHITEBOARD_TOKEN?{Authorization:'Bearer '+process.env.WHITEBOARD_TOKEN}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})};
  const response=await fetch(base+route,{headers,...(body===undefined ? {}:{method:'POST',body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok)throw Error(result.error || 'WhiteBoard request failed');return result;
}
export async function ensureServer(){
  try{const health=await request('/health');if(health.app!=='whiteboard')throw Error('Port belongs to another application');return;}catch(error){if(error.message==='Port belongs to another application')throw error;}
  const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{detached:true,stdio:'ignore',env:process.env});child.unref();
  for(let attempt=0;attempt<40;attempt++){
    await new Promise(resolve=>setTimeout(resolve,100));
    try{const health=await request('/health');if(health.app==='whiteboard')return;}catch{}
  }
  throw Error('WhiteBoard could not start. Run npm start in its folder to inspect the error.');
}
