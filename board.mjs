import {z} from 'zod';
export const itemSchema=z.object({
  id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  type:z.enum(['text','equation','rect','ellipse','triangle','diamond','line','arrow','stroke','image']),
  x:z.number().min(0).max(1200).default(80),y:z.number().min(0).max(800).default(80),
  width:z.number().min(1).max(1200).default(300),height:z.number().min(1).max(800).default(100),
  text:z.string().max(4000).default(''),
  color:z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#203c3b'),
  fill:z.string().regex(/^(none|#[0-9a-fA-F]{6})$/).default('none'),
  size:z.number().min(12).max(160).default(36),
  weight:z.enum(['normal','bold']).default('normal'),
  thickness:z.number().min(1).max(30).default(3),
  opacity:z.number().min(0.1).max(1).default(1),
  texture:z.enum(['solid','hatch','dots']).default('solid'),
  image:z.string().max(700000).regex(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/).optional(),
  points:z.array(z.tuple([z.number().min(0).max(1200),z.number().min(0).max(800)])).max(3000).optional(),
  animate:z.boolean().default(true)
}).strict().superRefine((item,context)=>{
  if(['line','arrow','stroke'].includes(item.type) && (!item.points || item.points.length<2)) context.addIssue({code:'custom',message:'Lines, arrows and strokes require at least two points.'});
  if(item.type==='image' && !item.image)context.addIssue({code:'custom',message:'Image objects require a PNG, JPEG or WebP data URL.'});
});
export const sourceSchema=z.object({title:z.string().max(200).default(''),url:z.string().max(2000).default('').refine(value=>{if(!value)return true;try{return ['https:','http:'].includes(new URL(value).protocol);}catch{return false;}},'Source must be an HTTP(S) URL'),transcript:z.string().max(150000).default(''),notes:z.string().max(20000).default('')}).strict();
export const pageSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),title:z.string().max(100),elements:z.array(itemSchema).max(500)}).strict();
const focusSchema=z.object({pageId:z.string(),x:z.number().min(0).max(1200),y:z.number().min(0).max(800),targetId:z.string().nullable(),at:z.string()}).strict();
const learnerSchema=z.object({focus:focusSchema.nullable().default(null),marks:z.array(z.object({pageId:z.string(),item:itemSchema}).strict()).max(100).default([])}).strict().default({focus:null,marks:[]});
export const notebookSchema=z.object({title:z.string().max(100),revision:z.number().int().nonnegative(),elements:z.array(itemSchema).max(500),activePage:z.string(),pages:z.array(pageSchema).min(1).max(50),source:sourceSchema,paused:z.boolean().default(false),learner:learnerSchema}).strict();
export function applyInteraction(state,input){
  const change=z.object({action:z.enum(['point','ink','clearPoint','clearInk']),pageId:z.string(),expectedRevision:z.number().int(),x:z.number().min(0).max(1200).optional(),y:z.number().min(0).max(800).optional(),targetId:z.string().optional(),item:itemSchema.optional()}).strict().parse(input);
  if(change.pageId!==state.activePage||change.expectedRevision!==state.revision)throw Error('Board changed. Please point or write again.');
  const next=normalizeBoard(state);
  if(change.action==='point'){
    if(change.x===undefined||change.y===undefined)throw Error('Point coordinates required');
    if(change.targetId&&!state.elements.some(item=>item.id===change.targetId))throw Error('Pointed object not found');
    next.learner.focus={pageId:state.activePage,x:change.x,y:change.y,targetId:change.targetId||null,at:new Date().toISOString()};
  }
  if(change.action==='ink'){
    if(!change.item||change.item.type!=='stroke')throw Error('Learner ink must be a stroke');
    if(next.learner.marks.length>=100)throw Error('Clear your ink before adding more (100 strokes maximum).');
    next.learner.marks.push({pageId:state.activePage,item:{...change.item,animate:false}});
  }
  if(change.action==='clearPoint')next.learner.focus=null;
  if(change.action==='clearInk')next.learner.marks=next.learner.marks.filter(mark=>mark.pageId!==state.activePage);
  return {...next,revision:state.revision+1};
}
export function normalizeBoard(state){
  const normalized={...state,activePage:state.activePage || 'page-1',pages:state.pages || [{id:'page-1',title:state.title,elements:state.elements}],source:state.source || sourceSchema.parse({})};
  const valid=notebookSchema.parse(normalized);
  if(new Set(valid.pages.map(page=>page.id)).size!==valid.pages.length || !valid.pages.some(page=>page.id===valid.activePage))throw Error('Invalid page identities');
  for(const page of valid.pages)if(new Set(page.elements.map(item=>item.id)).size!==page.elements.length)throw Error('Duplicate object ids');
  return valid;
}
export function applyNotebook(state,input){
  const change=z.object({action:z.enum(['new','switch','delete','source','import','pause','resume']),pageId:z.string().max(80).optional(),title:z.string().max(100).optional(),source:sourceSchema.optional(),notebook:notebookSchema.optional(),expectedRevision:z.number().int().optional()}).strict().parse(input);
  if(state.paused && !['pause','resume','source'].includes(change.action))throw Error('The learner is copying. Press Continue before changing pages.');
  if(change.expectedRevision!==undefined&&change.expectedRevision!==state.revision)throw Error('Board changed. Refresh before editing the lesson.');
  let next=normalizeBoard(state);
  if(change.action==='pause')next.paused=true;
  if(change.action==='resume')next.paused=false;
  next.pages=next.pages.map(page=>page.id===next.activePage?{id:page.id,title:next.title,elements:next.elements}:page);
  if(change.action==='source'){if(!change.source)throw Error('Source required');next.source=change.source;}
  if(change.action==='import'){if(!change.notebook)throw Error('Notebook required');next=normalizeBoard(change.notebook);}
  if(change.action==='new'){
    if(next.pages.length>=50)throw Error('Maximum 50 pages');
    const page=pageSchema.parse({id:change.pageId || 'page-'+crypto.randomUUID(),title:change.title || 'New page',elements:[]});
    if(next.pages.some(existing=>existing.id===page.id))throw Error('Page id already exists');
    next.pages.push(page);next.activePage=page.id;
  }
  if(change.action==='switch'){if(!next.pages.some(page=>page.id===change.pageId))throw Error('Page not found');next.activePage=change.pageId;}
  if(change.action==='delete'){
    if(next.pages.length===1)throw Error('Keep at least one page');
    if(!next.pages.some(page=>page.id===change.pageId))throw Error('Page not found');
    next.pages=next.pages.filter(page=>page.id!==change.pageId);
    if(next.activePage===change.pageId)next.activePage=next.pages[0].id;
  }
  const page=next.pages.find(page=>page.id===next.activePage);
  next.learner.marks=next.learner.marks.filter(mark=>next.pages.some(page=>page.id===mark.pageId));
  if(next.learner.focus?.pageId!==next.activePage)next.learner.focus=null;
  return {...next,title:page.title,elements:page.elements,revision:state.revision+1};
}
export const changeSchema=z.object({
  title:z.string().max(100).optional(),
  replace:z.boolean().default(false),
  elements:z.array(itemSchema).max(200).default([]),
  remove:z.array(z.string().max(80)).max(200).default([]),
  expectedRevision:z.number().int().nonnegative().optional()
}).strict();
export function emptyBoard(){return {title:'Untitled board',revision:0,elements:[]};}
export function applyChange(state,input){
  if(state.paused)throw Error('The learner is copying. Keep the board unchanged until they press Continue.');
  const change=changeSchema.parse(input);
  if(change.expectedRevision!==undefined && change.expectedRevision!==state.revision) throw Error('Board changed. Read the board and retry with its current revision.');
  const elements=new Map((change.replace ? []:state.elements).map(item=>[item.id,item]));
  for(const id of change.remove) elements.delete(id);
  for(const item of change.elements) elements.set(item.id,item);
  if(elements.size>500) throw Error('Board limit is 500 objects. Clear or remove some first.');
  const next={...state,title:change.title ?? state.title,revision:state.revision+1,elements:[...elements.values()]};
  if(next.pages)next.pages=next.pages.map(page=>page.id===next.activePage?{id:page.id,title:next.title,elements:next.elements}:page);
  return next;
}
