import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {applyChange,emptyBoard,normalizeBoard,applyNotebook,applyInteraction} from './board.mjs';
import {createAuth} from './auth.mjs';
import {createMcpServer} from './tools.mjs';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.WHITEBOARD_PORT || 4180);
const host=process.env.WHITEBOARD_HOST || '127.0.0.1';
const auth=createAuth({port,host,token:process.env.WHITEBOARD_TOKEN,publicUrl:process.env.WHITEBOARD_PUBLIC_URL});
const dataDirectory=process.env.WHITEBOARD_DATA || path.join(root,'data');
mkdirSync(dataDirectory,{recursive:true});
const filename=path.join(dataDirectory,'board.json');
let state=normalizeBoard(emptyBoard());
if(existsSync(filename)){
  const saved=JSON.parse(readFileSync(filename,'utf8'));
  if(!Number.isSafeInteger(saved.revision)||saved.revision<0||typeof saved.title!=='string'||saved.title.length>100||!Array.isArray(saved.elements)||saved.elements.length>500)throw Error('Invalid saved board; preserve data/board.json and repair it before restarting.');
  state=normalizeBoard(saved);
}
const history=[];
const clients=new Set();
let displayedRevision=null;
function commit(next){
  if(Buffer.byteLength(JSON.stringify(next))>20000000)throw Error('Lesson is over the 20 MB limit. Export it and remove large images before adding more.');
  writeFileSync(filename+'.tmp',JSON.stringify(next));renameSync(filename+'.tmp',filename);
  history.push(state);if(history.length>30)history.shift();
  while(history.length>1&&Buffer.byteLength(JSON.stringify(history))>60000000)history.shift();
  state=next;
  for(const client of clients)client.write(`data: ${JSON.stringify(state)}\n\n`);
  return state;
}
function json(response,status,value){response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));}
const server=http.createServer(async(request,response)=>{
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'");
  if(!auth.validOrigin(request)){json(response,403,{error:'Host or origin is not allowed'});return;}
  const route=new URL(request.url,`http://127.0.0.1:${port}`).pathname;
  try{
    if(route==='/healthz' && request.method==='GET'){json(response,200,{ok:true});return;}
    if(route==='/api/login' && request.method==='POST'){
      if(!auth.bearer(request)){json(response,401,{error:'Invalid access token'});return;}
      response.setHeader('Set-Cookie',auth.cookie);json(response,200,{ok:true});return;
    }
    if(!['/login','/login.js','/style.css'].includes(route) && !auth.allowed(request)){
      if(route==='/' && request.method==='GET'){response.writeHead(302,{Location:'/login'});response.end();return;}
      json(response,401,{error:'Authentication required'});return;
    }
    if(route==='/mcp'){
      if(auth.enabled&&!auth.bearer(request)){json(response,401,{error:'MCP requires a bearer token'});return;}
      if(request.method!=='POST'){json(response,405,{error:'Use MCP POST requests'});return;}
      const mcp=createMcpServer();const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
      response.on('close',()=>{transport.close();mcp.close();});await mcp.connect(transport);await transport.handleRequest(request,response);return;
    }
    if(request.method==='GET' && route==='/health'){json(response,200,{app:'whiteboard',version:1,viewers:clients.size,displayedRevision});return;}
    if(request.method==='GET' && route==='/api/board'){json(response,200,state);return;}
    if(request.method==='GET' && route==='/events'){
      response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
      response.write(`data: ${JSON.stringify(state)}\n\n`);clients.add(response);
      const timer=setInterval(()=>response.write(': heartbeat\n\n'),15000);
      request.on('close',()=>{clearInterval(timer);clients.delete(response);if(!clients.size)displayedRevision=null;});return;
    }
    if(request.method==='POST' && ['/api/change','/api/notebook','/api/interaction','/api/undo','/api/seen'].includes(route)){
      if(!request.headers['content-type']?.startsWith('application/json')){json(response,415,{error:'Use application/json'});return;}
      let body='';for await(const chunk of request){body+=chunk;if(body.length>20000000)throw Error('Request too large');}
      const input=JSON.parse(body||'{}');
      if(route==='/api/interaction'){json(response,200,commit(applyInteraction(state,input)));return;}
      if(route==='/api/seen'){if(Number.isSafeInteger(input.revision)&&input.revision===state.revision)displayedRevision=input.revision;json(response,200,{ok:true});return;}
      if(route==='/api/notebook'){json(response,200,commit(applyNotebook(state,input)));return;}
      if(route==='/api/undo'){
        if(state.paused)throw Error('The learner is copying. Press Continue before changing the board.');
        if(!history.length){json(response,200,state);return;}
        const prior=history.at(-1);const next={...prior,revision:state.revision+1};
        writeFileSync(filename+'.tmp',JSON.stringify(next));renameSync(filename+'.tmp',filename);history.pop();state=next;
        for(const client of clients)client.write(`data: ${JSON.stringify(state)}\n\n`);
        json(response,200,state);return;
      }
      json(response,200,commit(applyChange(state,input)));return;
    }
    if(request.method!=='GET'){json(response,405,{error:'Method not allowed'});return;}
    const assets={'/':'public/index.html','/login':'public/login.html','/login.js':'public/login.js','/app.js':'public/app.js','/style.css':'public/style.css','/vendor/katex.min.js':'node_modules/katex/dist/katex.min.js','/vendor/katex.min.css':'node_modules/katex/dist/katex.min.css'};
    let asset=assets[route];
    if(/^\/vendor\/fonts\/[a-zA-Z0-9_-]+\.(woff2|woff|ttf)$/.test(route))asset='node_modules/katex/dist/fonts/'+route.split('/').at(-1);
    if(!asset){json(response,404,{error:'Not found'});return;}
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
    response.writeHead(200,{'Content-Type':types[path.extname(asset)],'Cache-Control':'no-cache'});response.end(readFileSync(path.join(root,asset)));
  }catch(error){json(response,400,{error:error.message});}
});
server.listen(port,host,()=>console.error(`WhiteBoard ready: http://127.0.0.1:${port}`));
process.on('SIGTERM',()=>{for(const client of clients)client.end();server.close(()=>process.exit(0));});
