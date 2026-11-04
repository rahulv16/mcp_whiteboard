import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const root=fileURLToPath(new URL('../',import.meta.url));
test('real stdio MCP → local server → SSE, persistence, undo and origin protection',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'whiteboard-test-'));
  const port=String(24000+Math.floor(Math.random()*10000));
  const env={...process.env,WHITEBOARD_PORT:port,WHITEBOARD_DATA:directory};
  const server=spawn(process.execPath,['server.mjs'],{cwd:root,env,stdio:['ignore','ignore','pipe']});
  const client=new Client({name:'whiteboard-test',version:'1.0.0'});
  let stream;
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),5000);server.stderr.once('data',chunk=>{clearTimeout(timer);if(String(chunk).includes('ready'))resolve();else reject(Error(String(chunk)));});server.once('error',reject);});
    await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'mcp.mjs')],env}));
    const tools=await client.listTools();assert.equal(tools.tools.length,6);
    const response=await fetch(`http://127.0.0.1:${port}/events`);stream=response.body.getReader();await stream.read();
    const result=await client.callTool({name:'whiteboard_update',arguments:{title:'Integration check',elements:[{id:'math',type:'equation',text:'x^2',x:40,y:40}]}});
    assert.ok(!result.isError);assert.equal(JSON.parse(result.content[0].text).viewers,1);
    const event=new TextDecoder().decode((await stream.read()).value);assert.match(event,/Integration check/);
    const snapshot=JSON.parse((await client.callTool({name:'whiteboard_read',arguments:{}})).content[0].text);assert.equal(snapshot.board.elements[0].text,'x^2');
    const stale=await client.callTool({name:'whiteboard_update',arguments:{expectedRevision:0,title:'Wrong'}});assert.equal(stale.isError,true);
    const bad=await fetch(`http://127.0.0.1:${port}/api/change`,{method:'POST',headers:{'Origin':'https://example.com','Content-Type':'application/json'},body:'{}'});assert.equal(bad.status,403);
    assert.equal(JSON.parse(await readFile(path.join(directory,'board.json'),'utf8')).title,'Integration check');
    await client.callTool({name:'whiteboard_clear',arguments:{}});await client.callTool({name:'whiteboard_undo',arguments:{}});
    const restored=JSON.parse((await client.callTool({name:'whiteboard_read',arguments:{}})).content[0].text);assert.equal(restored.board.elements.length,1);assert.equal(restored.board.revision,3);
    const remote=new Client({name:'http-test',version:'1'});
    try{
      await remote.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
      const added=await remote.callTool({name:'whiteboard_notebook',arguments:{command:JSON.stringify({action:'new',title:'Next idea',pageId:'next'})}});assert.ok(!added.isError);
      const scene=await remote.callTool({name:'whiteboard_scene',arguments:{scene:JSON.stringify({elements:[{id:'shape',type:'triangle',texture:'hatch'}]})}});assert.ok(!scene.isError);
      await remote.callTool({name:'whiteboard_notebook',arguments:{command:'{"action":"pause"}'}});
      const held=await remote.callTool({name:'whiteboard_scene',arguments:{scene:'{"replace":true}'}});assert.equal(held.isError,true);
      await remote.callTool({name:'whiteboard_notebook',arguments:{command:'{"action":"resume"}'}});
      await remote.callTool({name:'whiteboard_notebook',arguments:{command:'{"action":"switch","pageId":"page-1"}'}});
      const original=JSON.parse((await remote.callTool({name:'whiteboard_read',arguments:{}})).content[0].text);assert.equal(original.board.elements[0].id,'math');
    }finally{await remote.close();}
  }finally{await stream?.cancel();await client.close();server.kill('SIGTERM');await new Promise(resolve=>server.exitCode!==null ? resolve():server.once('exit',resolve));await rm(directory,{recursive:true,force:true});}
});
