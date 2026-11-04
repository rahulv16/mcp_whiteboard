import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
test('authenticated HTTP MCP and browser login reject unauthenticated access',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'whiteboard-auth-'));
  const port=String(35000+Math.floor(Math.random()*10000)),token=randomBytes(32).toString('hex');
  const base=`http://127.0.0.1:${port}`;
  const server=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,WHITEBOARD_PORT:port,WHITEBOARD_DATA:directory,WHITEBOARD_TOKEN:token},stdio:['ignore','ignore','pipe']});
  const client=new Client({name:'auth-check',version:'1'});
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),5000);server.stderr.once('data',chunk=>{clearTimeout(timer);String(chunk).includes('ready')?resolve():reject(Error(String(chunk)));});server.once('error',reject);});
    assert.equal((await fetch(base+'/api/board')).status,401);
    assert.equal((await fetch(base+'/mcp',{method:'POST'})).status,401);
    assert.equal((await fetch(base+'/healthz')).status,200);
    const denied=await fetch(base+'/api/login',{method:'POST',headers:{Authorization:'Bearer wrong'}});assert.equal(denied.status,401);
    const login=await fetch(base+'/api/login',{method:'POST',headers:{Authorization:'Bearer '+token}});assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base+'/api/board',{headers:{Cookie:cookie}})).status,200);
    assert.equal((await fetch(base+'/api/board',{headers:{Authorization:'Bearer '+token,Origin:'https://evil.example'}})).status,403);
    await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token}}}));
    const update=await client.callTool({name:'whiteboard_scene',arguments:{scene:'{"title":"Authenticated lesson"}'}});assert.ok(!update.isError);
    const snapshot=await fetch(base+'/api/board',{headers:{Cookie:cookie}});assert.equal((await snapshot.json()).title,'Authenticated lesson');
  }finally{await client.close();server.kill('SIGTERM');await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve));await rm(directory,{recursive:true,force:true});}
});
