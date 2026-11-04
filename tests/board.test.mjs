import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,applyChange} from '../board.mjs';
test('upsert, removal and replacement preserve predictable ids and revisions',()=>{
  const first=applyChange(emptyBoard(),{elements:[{id:'word',type:'text',text:'cat'}]});
  const second=applyChange(first,{elements:[{id:'word',type:'text',text:'sat'},{id:'box',type:'rect'}]});
  assert.equal(second.elements.length,2);assert.equal(second.elements[0].text,'sat');assert.equal(second.revision,2);
  assert.equal(applyChange(second,{remove:['word']}).elements.length,1);
  assert.equal(applyChange(second,{replace:true}).elements.length,0);
  assert.equal(first.elements[0].text,'cat');
});
test('stale updates and invalid coordinates fail without changing state',()=>{
  const state=emptyBoard();
  assert.throws(()=>applyChange(state,{expectedRevision:1}),/Board changed/);
  assert.throws(()=>applyChange(state,{elements:[{id:'bad',type:'text',x:-1}]}));
  assert.throws(()=>applyChange(state,{elements:[{id:'bad',type:'stroke',points:[[1,2]]}]}));
  assert.throws(()=>applyChange(state,{elements:[{id:'bad',type:'text',color:'url(https://example.com)'}]}));
  assert.deepEqual(state,emptyBoard());
});
