import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {base} from './connection.mjs';
const client=new Client({name:'classroom-demo',version:'1'});
await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:process.env.WHITEBOARD_TOKEN?{Authorization:'Bearer '+process.env.WHITEBOARD_TOKEN}:{}}}));
try{
  const snapshot=JSON.parse((await client.callTool({name:'whiteboard_read',arguments:{}})).content[0].text);
  if(snapshot.board.paused)throw Error('Press Continue teaching before running the demo.');
  const page=await client.callTool({name:'whiteboard_notebook',arguments:{command:JSON.stringify({action:'new',title:'Area of a triangle'})}});if(page.isError)throw Error(JSON.stringify(page));
  const scene={title:'Area of a triangle',replace:true,elements:[
    {id:'heading',type:'text',text:'Why is there a half?',x:75,y:65,size:52,weight:'bold'},
    {id:'intro',type:'text',text:'A diagonal splits this rectangle into two equal triangles.',x:75,y:150,size:30,color:'#60796c'},
    {id:'rectangle',type:'rect',x:120,y:300,width:420,height:240,fill:'#f8f9f3',color:'#9eada0'},
    {id:'triangle',type:'stroke',points:[[120,300],[120,540],[540,540],[120,300]],fill:'#eaf3e4',color:'#377b5b',texture:'hatch',thickness:3},
    {id:'base',type:'text',text:'base = b',x:260,y:570,size:29,color:'#377b5b'},
    {id:'height',type:'text',text:'h',x:75,y:410,size:32,color:'#377b5b'},
    {id:'step',type:'text',text:'Rectangle: base × height\nTriangle: half as much',x:650,y:295,size:31},
    {id:'formula',type:'equation',text:'A = \\frac{1}{2}bh',x:650,y:415,width:480,height:140,size:62},
    {id:'question',type:'text',text:'Try it: b = 6 cm and h = 4 cm. What is the area?',x:75,y:675,size:30},
    {id:'pause-note',type:'text',text:'Use “Time to copy” to hold this step while you take notes.',x:75,y:738,size:21,color:'#60796c'}
  ]};
  const result=await client.callTool({name:'whiteboard_scene',arguments:{scene:JSON.stringify(scene)}});if(result.isError)throw Error(JSON.stringify(result));console.log(result.content[0].text);
}finally{await client.close();}
