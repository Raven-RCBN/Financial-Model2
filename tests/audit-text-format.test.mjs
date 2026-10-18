import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTextStyles,renderStyledText} from '../audit/text-format.mjs';
import {normalizeAuditEntry} from '../audit/audit-store.mjs';
import {applyAuditWrite} from '../audit/audit-permissions.mjs';
test('formats overlap and Unicode using character ranges without interpreting HTML',()=>{
 assert.equal(renderStyledText('A😀B',[{start:1,end:2,bold:true,italic:true,underline:true}]),'A<b><i><u>😀</u></i></b>B');
 assert.equal(renderStyledText('<img src=x onerror=alert(1)>\n&'), '&lt;img src=x onerror=alert(1)&gt;<br>&amp;');
 assert.deepEqual(normalizeTextStyles('abc',[{start:-1,end:1,bold:true},{start:0,end:99,bold:true,color:'red'},{start:0,end:1,italic:'yes'},null]),[{start:0,end:3,bold:true,italic:false,underline:false}]);
});
test('plain text and formatting survive draft storage, recommendation finalization and assignee replies',()=>{
 const style=[{start:0,end:4,bold:true}],actor={userId:'creator',create:true,recommend:true},options={drafts:true,now:new Date('2026-10-18T00:00:00Z')};
 let entry=normalizeAuditEntry(applyAuditWrite(actor,{id:'demo',status:'Draft',finding:'Test finding',findingStyles:style,impact:'Test impact',impactStyles:style,observationImages:[{url:'/audit/uploads/p.png',description:'Test image',descriptionStyles:style}],actions:[{id:'a',description:'Test recommendation',descriptionStyles:style,owner:'owner',email:'owner@example.test',dueDate:'2099-01-01'}]},null,options),'p');
 assert.equal(entry.finding,'Test finding');assert.equal(entry.findingStyles[0].bold,true);assert.equal(entry.observationImages[0].descriptionStyles[0].bold,true);
 entry=normalizeAuditEntry(applyAuditWrite(actor,{operation:'save-draft',baseUpdatedAt:entry.updatedAt,status:'Open'},entry,options),'p');assert.equal(entry.actions[0].descriptionStyles[0].bold,true);
 entry=normalizeAuditEntry(applyAuditWrite({userId:'owner',email:'owner@example.test',respond:true},{operation:'reply',actionId:'a',text:'Test completed',textStyles:style,status:'Closed'},entry,options),'p');assert.equal(entry.actions[0].responses[0].textStyles[0].bold,true);
 const draft={...entry,status:'Draft'};const plainEdit=applyAuditWrite(actor,{operation:'save-draft',baseUpdatedAt:draft.updatedAt,finding:'Plain replacement'},draft,options);assert.deepEqual(plainEdit.findingStyles,[]);
});
