import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,normalizeBoard,applyChange,applyNotebook,applyInteraction} from '../board.mjs';
test('learner pointing and ink preserve teaching content during pause',()=>{
  let state=applyNotebook(applyChange(emptyBoard(),{elements:[{id:'formula',type:'equation',text:'E=mc^2'}]}),{action:'pause'});
  const original=state.elements;
  const interact=change=>state=applyInteraction(state,{pageId:state.activePage,expectedRevision:state.revision,...change});
  interact({action:'point',x:100,y:100,targetId:'formula'});
  assert.equal(state.learner.focus.targetId,'formula');
  interact({action:'ink',item:{id:'my-ink',type:'stroke',points:[[10,10],[20,20]]}});
  assert.equal(state.learner.marks.length,1);assert.deepEqual(state.elements,original);assert.equal(state.paused,true);
  assert.deepEqual(normalizeBoard(JSON.parse(JSON.stringify(state))),state);
  assert.throws(()=>applyChange(state,{replace:true}),/copying/);
  assert.throws(()=>interact({action:'point',x:0,y:0,targetId:'missing'}),/not found/);
  assert.throws(()=>interact({action:'ink',item:{id:'bad',type:'text'}}),/stroke/);
  assert.throws(()=>interact({action:'point',x:0,y:0,expectedRevision:0}),/changed/);
  assert.throws(()=>interact({action:'point',x:0,y:0,pageId:'other'}),/changed/);
  interact({action:'clearPoint'});assert.equal(state.learner.focus,null);
  interact({action:'clearInk'});assert.equal(state.learner.marks.length,0);
});
test('page changes clear focus while preserving page-specific learner ink',()=>{
  let state=normalizeBoard(emptyBoard());
  state=applyInteraction(state,{action:'ink',pageId:state.activePage,expectedRevision:state.revision,item:{id:'ink',type:'stroke',points:[[1,1],[2,2]]}});
  state=applyInteraction(state,{action:'point',pageId:state.activePage,expectedRevision:state.revision,x:1,y:1});
  state=applyNotebook(state,{action:'new',pageId:'new-page'});
  assert.equal(state.learner.focus,null);assert.equal(state.learner.marks[0].pageId,'page-1');
  state=applyNotebook(state,{action:'delete',pageId:'page-1'});assert.equal(state.learner.marks.length,0);
});
