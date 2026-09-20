const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const schedules = [];
let launches = 0, finish;
const env = {};
const stubs = {
  'node:child_process': {execFile: (_exe,args,_opts,cb) => {
    assert.ok(args[0].endsWith(path.join('scripts','auto_ciencia.mjs')));
    launches++; finish=cb;
  }},
  'node:path':path,
  'node-cron':{schedule:(expression,callback,options)=>schedules.push({expression,callback,options})},
  '../database/db.js':{db:{prepare:()=>({all:()=>[]})}},
  '../services/sefazService.js':{sefazService:{}},
  '../services/googleDriveService.js':{googleDriveService:{}},
  '../services/predictiveAlertsService.js':{predictiveAlertsService:{}}
};
const exportsObject={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/jobs/scheduler.js'),'utf8'),{
  exports:exportsObject,require:n=>{assert.ok(n in stubs,n);return stubs[n]},
  process:{env,execPath:process.execPath},__dirname:path.resolve(__dirname,'../dist/jobs'),console,setTimeout
});
(async()=>{
  exportsObject.initScheduler();
  assert.equal(schedules.length,4);
  for(const item of schedules)assert.equal(item.options.timezone,'America/Sao_Paulo');
  const nightly=schedules.find(s=>s.expression==='30 2 * * *');
  nightly.callback();await Promise.resolve();assert.equal(launches,0);
  env.VIANFE_AUTO_CIENCIA_ENABLED='true';nightly.callback();assert.equal(launches,1);
  nightly.callback();assert.equal(launches,1,'Overlapping fiscal cycles must be skipped');
  finish(null,'','');await new Promise(resolve=>setImmediate(resolve));
  nightly.callback();assert.equal(launches,2);finish(null,'','');
  console.log('PASS: explicit timezone, disabled by default, versioned path, overlap guard. No fiscal calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
