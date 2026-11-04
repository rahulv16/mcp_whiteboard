const byId=id=>document.getElementById(id);
const namespace='http://www.w3.org/2000/svg';
let board={revision:0,elements:[]},connected=false,pen=false,points=[],editType='text';
let selectedId=null,drag=null,editId=null,editRevision=0;
let pointing=false,inkRevision=0,inkPage=null;
const learnerBar=document.createElement('div');learnerBar.className='learner-bar';learnerBar.innerHTML='<button id="point" aria-pressed="false">◎ Point</button><button id="write" aria-pressed="false">✎ Write</button><button id="selectMode" aria-pressed="true">Select / move</button><button id="clearPoint">Clear pointer</button><button id="clearInk">Clear my ink</button><span id="learnerHint" role="status">Point or write, then ask your assistant about it.</span>';
byId('paper').before(learnerBar);
const learnerInk=svg('g',{id:'learnerInk','pointer-events':'none'}),learnerPointer=svg('g',{id:'learnerPointer','pointer-events':'none'});
byId('canvas').append(learnerInk,learnerPointer);
function mode(value){pen=value==='write';pointing=value==='point';for(const [id,active]of [['point',pointing],['write',pen],['pen',pen],['selectMode',!pen&&!pointing]])byId(id).setAttribute('aria-pressed',active);byId('canvas').classList.toggle('pen',pen||pointing);}
byId('point').onclick=()=>mode('point');byId('write').onclick=()=>mode('write');byId('selectMode').onclick=()=>mode('select');
function interact(change){return send('/api/interaction',{pageId:board.activePage,expectedRevision:board.revision,...change}).catch(error=>{byId('learnerHint').textContent=error.message;});}
byId('clearPoint').onclick=()=>interact({action:'clearPoint'});byId('clearInk').onclick=()=>interact({action:'clearInk'});
const cached=new Map();
function selectObject(id){selectedId=id;for(const [key,entry]of cached)entry.node.classList.toggle('selected',key===id);for(const control of ['deleteObject','front','editSelected','applyStyle'])byId(control).disabled=!id;byId('objectList').value=id||'';}
byId('objectList').onchange=()=>selectObject(byId('objectList').value||null);
byId('editSelected').onclick=()=>{const item=board.elements.find(value=>value.id===selectedId);if(item)openEditor(item.type,item);};
byId('applyStyle').onclick=()=>{const item=board.elements.find(value=>value.id===selectedId);if(item)send('/api/change',{expectedRevision:board.revision,elements:[{...item,color:byId('color').value,texture:byId('texture').value,thickness:Number(byId('thickness').value),animate:false}]}).catch(report);};
byId('renamePage').onclick=()=>{openEditor('page');byId('input').disabled=false;byId('input').required=true;byId('input').value=board.title;byId('editTitle').textContent='Rename page';};
byId('deletePage').onclick=()=>notebook({action:'delete',pageId:board.activePage});
function notebook(command){return send('/api/notebook',{...command,expectedRevision:board.revision}).catch(report);}
byId('pages').onchange=()=>notebook({action:'switch',pageId:byId('pages').value});
byId('newPage').onclick=()=>notebook({action:'new',title:'Page '+((board.pages?.length||1)+1)});
byId('pause').onclick=()=>notebook({action:board.paused?'resume':'pause'});
byId('present').onclick=()=>{document.body.classList.toggle('presenting');byId('present').textContent=document.body.classList.contains('presenting')?'Exit presentation':'Present';};
byId('deleteObject').onclick=()=>{if(selectedId)send('/api/change',{remove:[selectedId],expectedRevision:board.revision}).catch(report);};
byId('front').onclick=()=>{const item=board.elements.find(value=>value.id===selectedId);if(item)send('/api/change',{remove:[item.id],elements:[item],expectedRevision:board.revision}).catch(report);};
byId('addShape').onclick=()=>{const type=byId('shape').value;send('/api/change',{elements:[{id:'shape-'+crypto.randomUUID(),type,x:350,y:250,width:250,height:170,fill:type==='arrow'?'none':'#edf4e9',color:byId('color').value,texture:byId('texture').value,thickness:Number(byId('thickness').value),...(type==='arrow'?{points:[[350,330],[620,330]]}:{})}]}).catch(report);};
byId('addImage').onclick=()=>byId('imageFile').click();
byId('imageFile').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>500000)throw Error('Choose a PNG, JPEG or WebP under 500 KB.');const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});await send('/api/change',{elements:[{id:'image-'+crypto.randomUUID(),type:'image',image,x:300,y:200,width:600,height:400}]});}catch(error){report(error);}event.target.value='';};
function download(value,type,name){const url=URL.createObjectURL(new Blob([value],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
byId('saveLesson').onclick=()=>download(JSON.stringify(board,null,2),'application/json','whiteboard-lesson.json');
byId('loadLesson').onclick=()=>byId('lessonFile').click();
byId('lessonFile').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>19000000)throw Error('Lesson file too large');await send('/api/notebook',{action:'import',notebook:JSON.parse(await file.text()),expectedRevision:board.revision});}catch(error){report(error);}event.target.value='';};
byId('sourceButton').onclick=()=>{const source=board.source||{};byId('sourceTitle').value=source.title||'';byId('sourceUrl').value=source.url||'';byId('sourceText').value=source.transcript||'';byId('sourceNotes').value=source.notes||'';byId('sourceDialog').showModal();};
byId('closeSource').onclick=()=>byId('sourceDialog').close();
byId('sourceForm').onsubmit=async event=>{event.preventDefault();try{await send('/api/notebook',{action:'source',source:{title:byId('sourceTitle').value,url:byId('sourceUrl').value,transcript:byId('sourceText').value,notes:byId('sourceNotes').value},expectedRevision:board.revision});byId('sourceDialog').close();}catch(error){report(error);}};
function svg(name,attributes={}){const node=document.createElementNS(namespace,name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);return node;}
async function send(route,value){const response=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await response.json();if(!response.ok)throw Error(result.error);return result;}
function report(error){byId('status').textContent=error.message;}
function renderItem(item){
  const group=svg('g',{'data-id':item.id,opacity:item.opacity ?? 1});
  const title=svg('title');title.textContent=item.text || item.type;group.append(title);
  let node;
  if(item.type==='text'){
    node=svg('text',{x:item.x,y:item.y,fill:item.color,'font-size':item.size,'font-weight':item.weight,'dominant-baseline':'hanging','font-family':'Arial, sans-serif'});
    item.text.split('\n').forEach((line,index)=>{const span=svg('tspan',{x:item.x,dy:index ? '1.35em':0});span.textContent=line;node.append(span);});
  }else if(item.type==='equation'){
    node=svg('foreignObject',{x:item.x,y:item.y,width:item.width,height:item.height});
    const formula=document.createElementNS('http://www.w3.org/1999/xhtml','div');formula.className='equation';formula.style.fontSize=item.size+'px';formula.style.color=item.color;
    katex.render(item.text,formula,{throwOnError:false,trust:false,strict:'warn',maxExpand:200,maxSize:20,output:'htmlAndMathml'});node.append(formula);
  }else if(item.type==='image')node=svg('image',{x:item.x,y:item.y,width:item.width,height:item.height,href:item.image,preserveAspectRatio:'xMidYMid meet'});
  else if(item.type==='triangle')node=svg('polygon',{points:`${item.x+item.width/2},${item.y} ${item.x+item.width},${item.y+item.height} ${item.x},${item.y+item.height}`});
  else if(item.type==='diamond')node=svg('polygon',{points:`${item.x+item.width/2},${item.y} ${item.x+item.width},${item.y+item.height/2} ${item.x+item.width/2},${item.y+item.height} ${item.x},${item.y+item.height/2}`});
  else if(item.type==='rect')node=svg('rect',{x:item.x,y:item.y,width:item.width,height:item.height,rx:12});
  else if(item.type==='ellipse')node=svg('ellipse',{cx:item.x+item.width/2,cy:item.y+item.height/2,rx:item.width/2,ry:item.height/2});
  else{
    node=svg('path',{d:item.points.map(([x,y],index)=>`${index ? 'L':'M'} ${x} ${y}`).join(' '),'stroke-linecap':'round','stroke-linejoin':'round'});
    if(item.type==='arrow')node.setAttribute('marker-end','url(#arrowhead)');
  }
  if(!['text','equation','image'].includes(item.type)){
    node.setAttribute('stroke',item.color);node.setAttribute('stroke-width',item.thickness ?? 3);node.setAttribute('fill',item.fill);
    if(item.texture && item.texture!=='solid'){
      const pattern=svg('pattern',{id:'texture-'+item.id,width:12,height:12,patternUnits:'userSpaceOnUse'});
      pattern.append(svg('rect',{width:12,height:12,fill:item.fill}));
      pattern.append(item.texture==='dots'?svg('circle',{cx:4,cy:4,r:1.3,fill:item.color}):svg('path',{d:'M-3,3 L3,-3 M0,12 L12,0 M9,15 L15,9',stroke:item.color,'stroke-width':1}));
      const definitions=svg('defs');definitions.append(pattern);group.append(definitions);node.setAttribute('fill',`url(#texture-${item.id})`);
    }
    if(item.animate){node.setAttribute('pathLength','1');node.setAttribute('stroke-dasharray','1');node.classList.add('draw');}
  }else if(item.animate)node.classList.add('appear');
  group.append(node);return group;
}
function render(next){
  if(drag){cached.get(drag.item.id)?.node.removeAttribute('transform');drag=null;}
  board=next;byId('title').textContent=board.title;byId('revision').textContent='REV '+board.revision;byId('count').textContent=board.elements.length;byId('empty').hidden=board.elements.length>0;
  const marks=(board.learner?.marks||[]).filter(mark=>mark.pageId===board.activePage);
  learnerInk.replaceChildren(...marks.map(mark=>renderItem(mark.item)));learnerPointer.replaceChildren();
  if(marks.length)byId('empty').hidden=true;
  const focus=board.learner?.focus;
  if(focus?.pageId===board.activePage){learnerPointer.append(svg('circle',{cx:focus.x,cy:focus.y,r:18,fill:'#e7aa3433',stroke:'#bf7200','stroke-width':3}),svg('circle',{cx:focus.x,cy:focus.y,r:4,fill:'#bf7200'}));}
  byId('learnerHint').textContent=focus?.pageId===board.activePage?'Pointer shared. Ask your assistant about this spot.':'Point or write, then ask your assistant to read the board.';
  const emptyOption=document.createElement('option');emptyOption.value='';emptyOption.textContent='Select an object to edit';
  byId('objectList').replaceChildren(emptyOption,...board.elements.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.type+': '+(item.text||item.id).slice(0,45);return option;}));
  byId('pages').replaceChildren(...(board.pages||[]).map(page=>{const option=document.createElement('option');option.value=page.id;option.textContent=page.title;option.selected=page.id===board.activePage;return option;}));
  byId('pause').textContent=board.paused?'Continue teaching':'Time to copy';byId('pause').setAttribute('aria-pressed',!!board.paused);document.body.classList.toggle('copying',!!board.paused);
  const ids=new Set(board.elements.map(item=>item.id));
  for(const [id,entry]of cached)if(!ids.has(id)){entry.node.remove();cached.delete(id);}
  for(const [index,item] of board.elements.entries()){
    const signature=JSON.stringify(item);const prior=cached.get(item.id);
    if(prior?.signature!==signature){const node=renderItem(item);if(prior)prior.node.replaceWith(node);cached.set(item.id,{node,signature});}
    const node=cached.get(item.id).node;
    const atIndex=byId('objects').children[index];
    if(atIndex!==node)byId('objects').insertBefore(node,atIndex || null);
  }
  byId('status').textContent='Board updated · changes saved locally';
  selectObject(board.elements.some(item=>item.id===selectedId)?selectedId:null);
  if(board.paused)byId('status').textContent='Teaching content is paused. You can still point and write.';
  send('/api/seen',{revision:board.revision}).catch(()=>{});
}
const events=new EventSource('/events');
events.onopen=()=>{connected=true;byId('light').classList.add('live');byId('connection').textContent='Live · local';};
events.onerror=()=>{connected=false;byId('light').classList.remove('live');byId('connection').textContent='Reconnecting';byId('status').textContent='Connection lost. Waiting for the local server.';};
events.onmessage=event=>{try{render(JSON.parse(event.data));}catch(error){report(error);}};
byId('help').onclick=()=>byId('guide').showModal();byId('closeGuide').onclick=()=>byId('guide').close();
byId('undo').onclick=()=>send('/api/undo',{}).catch(report);
byId('clear').onclick=()=>send('/api/change',{replace:true,elements:[],expectedRevision:board.revision}).catch(report);
byId('pen').onclick=()=>mode(pen?'select':'write');
function position(event){const point=byId('canvas').createSVGPoint();point.x=event.clientX;point.y=event.clientY;const location=point.matrixTransform(byId('canvas').getScreenCTM().inverse());return [Math.round(Math.max(0,Math.min(1200,location.x))),Math.round(Math.max(0,Math.min(800,location.y)))];}
byId('canvas').onpointerdown=event=>{
  if(!connected||(!pen&&!pointing&&board.paused)||!event.isPrimary)return;
  if(pointing){const [x,y]=position(event);const targetId=event.target.closest('#objects [data-id]')?.getAttribute('data-id');interact({action:'point',x,y,...(targetId?{targetId}:{})});return;}
  inkRevision=board.revision;inkPage=board.activePage;
  byId('canvas').setPointerCapture(event.pointerId);
  if(pen){points=[position(event)];byId('draft').setAttribute('stroke',byId('color').value);byId('draft').setAttribute('stroke-width',byId('thickness').value);return;}
  const id=event.target.closest('[data-id]')?.getAttribute('data-id');selectObject(id || null);
  const item=board.elements.find(value=>value.id===id);if(item)drag={item,start:position(event),revision:board.revision,dx:0,dy:0};
};
byId('canvas').onpointermove=event=>{
  if(drag){const location=position(event);const xs=drag.item.points?.map(point=>point[0])||[drag.item.x,drag.item.x+drag.item.width];const ys=drag.item.points?.map(point=>point[1])||[drag.item.y,drag.item.y+drag.item.height];drag.dx=Math.max(-Math.min(...xs),Math.min(1200-Math.max(...xs),location[0]-drag.start[0]));drag.dy=Math.max(-Math.min(...ys),Math.min(800-Math.max(...ys),location[1]-drag.start[1]));cached.get(drag.item.id).node.setAttribute('transform',`translate(${drag.dx} ${drag.dy})`);return;}
  if(!points.length||points.length>=3000)return;points.push(position(event));byId('draft').setAttribute('d',points.map(([x,y],index)=>`${index?'L':'M'}${x},${y}`).join(' '));
};
byId('canvas').onpointerup=()=>{
  if(drag){const {item,dx,dy,revision}=drag;drag=null;cached.get(item.id).node.removeAttribute('transform');if(dx||dy)send('/api/change',{expectedRevision:revision,elements:[{...item,x:Math.max(0,Math.min(1200,item.x+dx)),y:Math.max(0,Math.min(800,item.y+dy)),...(item.points?{points:item.points.map(([x,y])=>[x+dx,y+dy])}:{}),animate:false}]}).catch(report);}
  if(points.length===1)points.push([...points[0]]);
  if(points.length>1)interact({action:'ink',pageId:inkPage,expectedRevision:inkRevision,item:{id:'learner-'+crypto.randomUUID(),type:'stroke',points,color:byId('color').value,thickness:Number(byId('thickness').value),animate:false}});points=[];byId('draft').setAttribute('d','');
};
byId('canvas').onpointercancel=()=>{if(drag)cached.get(drag.item.id)?.node.removeAttribute('transform');drag=null;points=[];byId('draft').setAttribute('d','');};
function openEditor(type,item=null){editType=type;editId=item?.id||null;editRevision=board.revision;byId('editTitle').textContent=item?'Edit '+type:type==='equation'?'Add an equation':'Add text';byId('inputLabel').textContent=type==='equation'?'LaTeX equation':'Text';byId('input').value=item?.text||'';byId('input').required=['text','equation'].includes(type);byId('input').disabled=!['text','equation'].includes(type);byId('input').placeholder=type==='equation'?'y = \\frac{x^2}{2}':'What are we exploring?';for(const [id,value]of Object.entries({inputX:item?.x??80,inputY:item?.y??80,inputSize:item?.size??40,inputWidth:item?.width??1000,inputHeight:item?.height??250}))byId(id).value=value;byId('editor').showModal();byId('input').focus();}
byId('addText').onclick=()=>openEditor('text');byId('addMath').onclick=()=>openEditor('equation');byId('closeEditor').onclick=()=>byId('editor').close();
byId('canvas').ondblclick=event=>{const id=event.target.closest('[data-id]')?.getAttribute('data-id');const item=board.elements.find(value=>value.id===id);if(item&&!pen&&!pointing&&!board.paused)openEditor(item.type,item);};
byId('editForm').onsubmit=async event=>{event.preventDefault();try{if(editType==='page'){await send('/api/change',{title:byId('input').value,expectedRevision:editRevision});byId('editor').close();return;}const prior=editId?board.elements.find(item=>item.id===editId):null;if(editId&&!prior)throw Error('This object no longer exists.');const item={...prior,id:editId||'manual-'+crypto.randomUUID(),type:editType,text:byId('input').value,x:Number(byId('inputX').value),y:Number(byId('inputY').value),size:Number(byId('inputSize').value),width:Number(byId('inputWidth').value),height:Number(byId('inputHeight').value)};if(prior?.points)item.points=prior.points.map(([x,y])=>[x+item.x-prior.x,y+item.y-prior.y]);await send('/api/change',{expectedRevision:editRevision,elements:[item]});byId('editor').close();}catch(error){report(error);}};
byId('export').onclick=async()=>{
  try{
    const clone=byId('canvas').cloneNode(true);clone.setAttribute('xmlns',namespace);clone.setAttribute('width','1200');clone.setAttribute('height','800');clone.style.background='white';
    clone.querySelector('#draft')?.remove();clone.querySelectorAll('.draw,.appear').forEach(node=>{node.removeAttribute('class');node.removeAttribute('stroke-dasharray');});
    clone.querySelector('#learnerPointer')?.remove();
    let css=await (await fetch('/vendor/katex.min.css')).text();
    const fonts=[...new Set([...css.matchAll(/url\((fonts\/[^)]+)\)/g)].map(match=>match[1]))];
    for(const font of fonts){const blob=await (await fetch('/vendor/'+font)).blob();const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});css=css.split(font).join(data);}
    const style=svg('style');style.textContent=css+' .equation .katex{font-size:1em}';clone.prepend(style);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));const link=document.createElement('a');link.href=url;link.download='whiteboard.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){report(error);}
};
