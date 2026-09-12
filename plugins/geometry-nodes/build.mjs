import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
// Optional build-only dependency location; published source also builds with npm install here.
const require=createRequire(resolve(process.env.BWS_PLUGIN_DEPENDENCIES||root,'package.json'));
const {build}=require('esbuild');
const result=await build({entryPoints:[resolve(root,'src/main.js')],bundle:true,format:'iife',minify:true,target:'es2020',write:false,nodePaths:[resolve(process.env.BWS_PLUGIN_DEPENDENCIES||root,'node_modules')]});
const script=result.outputFiles[0].text.replaceAll('</script','<\/script');
const html=(await readFile(resolve(root,'src/main.html'),'utf8')).replace('<!--BWS_SCRIPT-->',()=>'<script>'+script+'</script>');
const license=await readFile(resolve(dirname(require.resolve('three')),'../LICENSE'),'utf8');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
const text=JSON.stringify({kind:'boltworks-plugin-package',packageVersion:1,manifest,files:{'main.html':{mediaType:'text/html',data:html},'THREE-LICENSE.txt':{mediaType:'text/plain',data:license}}});
if(Buffer.byteLength(text)>4000000)throw Error('Plugin package exceeds 4 MB');
await writeFile(resolve(root,'plugin.bwsplugin'),text);
console.log('Built Geometry Nodes '+manifest.version+' ('+Buffer.byteLength(text)+' bytes)');
