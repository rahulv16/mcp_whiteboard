import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,normalizeBoard,applyChange,applyNotebook} from '../board.mjs';
import {createAuth} from '../auth.mjs';
test('old boards migrate and each page keeps its objects',()=>{
  let state=normalizeBoard(applyChange(emptyBoard(),{elements:[{id:'first',type:'text',text:'Keep me'}]}));
  state=applyNotebook(state,{action:'new',pageId:'second',title:'Second'});
  state=applyChange(state,{elements:[{id:'second-item',type:'diamond',texture:'dots'}]});
  state=applyNotebook(state,{action:'switch',pageId:'page-1'});
  assert.equal(state.elements[0].text,'Keep me');
  state=applyNotebook(state,{action:'delete',pageId:'second'});assert.equal(state.pages.length,1);
  assert.throws(()=>applyNotebook(state,{action:'delete',pageId:'page-1'}),/at least one/);
});
test('copy pause blocks edits and page changes; resume restores editing',()=>{
  const held=applyNotebook(emptyBoard(),{action:'pause'});
  assert.throws(()=>applyChange(held,{title:'Changed'}),/copying/);
  assert.throws(()=>applyNotebook(held,{action:'new'}),/copying/);
  assert.equal(applyChange(applyNotebook(held,{action:'resume'}),{title:'Now ready'}).title,'Now ready');
});
test('source is preserved and unsafe image/source inputs rejected',()=>{
  const source={title:'Lecture',url:'https://www.youtube.com/watch?v=example',transcript:'00:01 Introduction',notes:'For a beginner'};
  const state=applyNotebook(emptyBoard(),{action:'source',source});assert.deepEqual(state.source,source);
  assert.throws(()=>applyNotebook(state,{action:'source',source:{url:'javascript:alert(1)'}}));
  assert.throws(()=>applyChange(state,{elements:[{id:'bad',type:'image',image:'https://example.com/image.png'}]}));
  assert.throws(()=>applyNotebook(state,{action:'new',pageId:'page-1'}),/already exists/);
});
test('public deployments require strong credentials and HTTPS',()=>{
  assert.throws(()=>createAuth({host:'0.0.0.0'}));
  assert.throws(()=>createAuth({host:'0.0.0.0',token:'short',publicUrl:'https://board.example.com'}));
  const token='a-very-long-test-token-with-32-characters';
  const auth=createAuth({host:'0.0.0.0',token,publicUrl:'https://board.example.com'});
  assert.equal(auth.allowed({headers:{}}),false);
  assert.equal(auth.allowed({headers:{authorization:'Bearer '+token}}),true);
  assert.equal(auth.allowed({headers:{cookie:auth.cookie.split(';')[0]}}),true);
  assert.equal(auth.validOrigin({headers:{host:'board.example.com',origin:'https://evil.example.com'}}),false);
  assert.match(auth.cookie,/HttpOnly/);assert.match(auth.cookie,/Secure/);
});
