import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeTextStyles,renderStyledText} from '../audit/text-format.mjs';
const source=fs.readFileSync(new URL('../standalone-audit/app.js',import.meta.url),'utf8');
const scope={normalizeTextStyles,renderStyledText};vm.createContext(scope);
vm.runInContext(source.slice(source.indexOf('function readStyledEditor'),source.indexOf('function bindTextEditors')),scope);
const text=value=>({nodeType:3,nodeValue:value});
const el=(tag,...children)=>({nodeType:1,tagName:tag,style:{fontWeight:'',fontStyle:'',textDecoration:''},childNodes:children});
test('bullet serialization preserves lines, Unicode formatting and following paragraphs',()=>{
 const editor=el('DIV',el('UL',el('LI',el('B',text('Check 🚜'))),el('LI',text('Check oil'))),el('DIV',text('Follow up')));
 const saved=scope.readStyledEditor(editor);
 assert.equal(saved.text,'• Check 🚜\n• Check oil\nFollow up');
 assert.equal(renderStyledText(saved.text,saved.styles),'• <b>Check 🚜</b><br>• Check oil<br>Follow up');
 assert.equal(scope.renderEditorText(saved.text,saved.styles),'<ul><li><b>Check 🚜</b></li><li>Check oil</li></ul>Follow up');
});
test('reopening unformatted paragraphs is safe and preserves blank lines',()=>{
 assert.equal(scope.renderEditorText('First\n\n<script>',[]),'First<br><br>&lt;script&gt;');
});
