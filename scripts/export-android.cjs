const {spawnSync}=require('node:child_process');
const path=require('node:path');
const mobile=path.resolve(__dirname,'../apps/mobile');
const result=spawnSync(process.execPath,[path.join(mobile,'node_modules/expo/bin/cli'),'export','--platform','android','--output-dir','dist-android'],
  {cwd:mobile,env:process.env,stdio:'inherit'});
process.exitCode=result.status??1;
