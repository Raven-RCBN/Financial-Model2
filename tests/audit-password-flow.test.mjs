import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordChallenges,passwordPage} from '../standalone-audit/password-flow.mjs';
test('verification requires emailed code, limits guesses and supports one-time consumption',async()=>{
 const store=passwordChallenges();let mail;
 const user={name:'test',email:'test@example.test',credential:{salt:'version'}};
 const id=await store.begin(user,'/app',async job=>{mail=job;});
 const code=mail.text.match(/\b\d{6}\b/)[0];
 assert.equal(store.verify(id,'000000'),null);
 assert.equal(store.verify(id,code).userId,'test');
 await assert.rejects(store.begin(user,'/app',async()=>{}),/recently sent/);
 store.remove(id);assert.equal(store.verify(id,code),null);
 const other=await store.begin({...user,name:'other'},'/app',async()=>{});
 for(let i=0;i<6;i++)store.verify(other,'000000');
 assert.equal(store.get(other),null);
 assert(passwordPage('<script>',true).includes('&lt;script&gt;'));
});
