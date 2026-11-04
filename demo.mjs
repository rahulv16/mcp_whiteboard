import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fileURLToPath} from 'node:url';
const client=new Client({name:'whiteboard-demo',version:'1.0.0'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./mcp.mjs',import.meta.url))]}));
try{
  const result=await client.callTool({name:'whiteboard_update',arguments:{title:'A conversation, made visible',replace:true,elements:[
    {id:'heading',type:'text',text:'Let’s make an idea visible.',x:80,y:65,size:48,weight:'bold'},
    {id:'subtitle',type:'text',text:'One board. Words, equations, and a little room to think.',x:80,y:135,size:23,color:'#728379'},
    {id:'idea',type:'rect',x:80,y:240,width:270,height:110,fill:'#edf4e9',color:'#91b09b'},
    {id:'idea-label',type:'text',text:'Ask a question',x:110,y:280,size:29},
    {id:'arrow',type:'arrow',points:[[370,295],[490,295]],color:'#69947d'},
    {id:'explore',type:'rect',x:520,y:240,width:570,height:110,fill:'#f5f6ed',color:'#aeb59b'},
    {id:'explore-label',type:'text',text:'Explore it together',x:575,y:280,size:35},
    {id:'equation',type:'equation',text:'\\frac{d}{dx}x^2 = 2x',x:90,y:450,width:470,height:160,size:50},
    {id:'axis-x',type:'arrow',points:[[660,650],[1080,650]],color:'#95a69d'},
    {id:'axis-y',type:'arrow',points:[[710,680],[710,430]],color:'#95a69d'},
    {id:'curve',type:'stroke',points:Array.from({length:41},(_,index)=>[730+index*8,640-(index/40)**2*190]),color:'#2d7d61'},
    {id:'curve-label',type:'text',text:'y = x²',x:950,y:440,size:25,color:'#2d7d61'},
    {id:'note',type:'text',text:'Connected through MCP · editable objects · live updates',x:80,y:730,size:19,color:'#728379'}
  ]}});
  if(result.isError)throw Error(JSON.stringify(result));
  console.log(result.content[0].text);
}finally{await client.close();}
