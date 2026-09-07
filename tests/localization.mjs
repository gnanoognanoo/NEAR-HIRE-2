import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const en=JSON.parse(readFileSync(new URL('../apps/mobile/src/live/locales/en.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const ta=JSON.parse(readFileSync(new URL('../apps/mobile/src/live/locales/ta.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
test('English and Tamil have matching nonempty translation keys',()=>{assert.deepEqual(Object.keys(en).sort(),Object.keys(ta).sort());for(const [k,v] of Object.entries(ta))assert.ok(typeof v==='string'&&v.length>0,k);});
test('literal live-screen translation references exist',()=>{const source=readFileSync(new URL('../apps/mobile/src/live/LiveApp.tsx',import.meta.url),'utf8');for(const match of source.matchAll(/\bt\(["']([^"']+)["']\)/g))assert.ok(en[match[1]],match[1]);});
