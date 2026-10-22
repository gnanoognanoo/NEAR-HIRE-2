const fs = require('node:fs');
const path = require('node:path');
const {execFileSync,spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, encoding:'utf8'}).split('\0').filter(Boolean);
const secret = /-----BEGIN (?:RSA )?PRIVATE KEY-----|"type"\s*:\s*"service_account"|sb_secret_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}/;
let failed = false;
for (const file of files) {
  if (/(^|\/)(?:\.env(?:\..*)?|google-services[^/]*\.json|[^/]*firebase-adminsdk[^/]*\.json)$/.test(file) && !file.endsWith('.env.example')) {
    console.error('Credential/config file must not be tracked: ' + file); failed = true;
  }
  if (fs.existsSync(path.join(root,file)) && secret.test(fs.readFileSync(path.join(root,file),'utf8'))) {
    console.error('Private credential pattern in: ' + file); failed = true;
  }
}
function scan(dir) {
  if (!fs.existsSync(dir)) throw new Error('Run Android export before the bundle scan.');
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) scan(file);
    else {
      let text=fs.readFileSync(file).toString('utf8');
      if (file.endsWith('.hbc')) {
        // Hermes concatenates strings in its binary table. Scan decoded boundaries so
        // the SDK's harmless "sb_secret_" prefix is not joined to the next string.
        const platform=process.platform==='win32'?'win64-bin':process.platform==='darwin'?'osx-bin':'linux64-bin';
        const compiler=path.join(root,'apps/mobile/node_modules/hermes-compiler/hermesc',platform,process.platform==='win32'?'hermesc.exe':'hermesc');
        const decoded=spawnSync(compiler,['-dump-bytecode',file],{encoding:'utf8',maxBuffer:128*1024*1024,windowsHide:true});
        if(decoded.status!==0)throw new Error('Cannot decode Hermes bundle for secret scan.');
        text=[...decoded.stdout.matchAll(/^s\d+\[[^\]]+\]: (.*)$/gm)].map(m=>m[1]).join('\n');
        if(!text)throw new Error('Hermes string table is empty.');
      }
      const serviceRoleJwt=text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)?.some(t=>{
        try{return JSON.parse(Buffer.from(t.split('.')[1],'base64url')).role==='service_role';}catch{return false;}
      });
      if(secret.test(text)||serviceRoleJwt||/https:\/\/api\.olamaps\.io[^\s"']*[?&]api_key=/.test(text)) {
        console.error('Private credential in export: '+path.relative(root,file)); failed=true;
      }
    }
  }
}
scan(path.join(root,'apps/mobile/dist-android'));
console.log('Tracked source and Android bundle secret scan: '+(failed?'FAIL':'PASS'));
process.exitCode=failed?1:0;
