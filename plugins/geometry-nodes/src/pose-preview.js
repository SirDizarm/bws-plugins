import * as THREE from 'three';

// Preview-only pose edits rebuild geometry. Stored legacy stops are ignored.
export function mountPosePreview({host,canvas,camera,graph,meshes,commit,status}){
 const doc=host.ownerDocument,win=doc.defaultView,events=new win.AbortController();
 const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:events.signal});
 const panel=doc.createElement('div');panel.className='gn-pose-controls';
 const style=doc.createElement('style');style.textContent='.gn-pose-controls{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:7px 0}.gn-pose-controls[hidden]{display:none}.gn-pose-controls label{display:flex;align-items:center;gap:4px;margin:0}.gn-pose-controls input,.gn-pose-controls select{width:auto;padding:4px}.gn-pose-controls select{max-width:300px}.gn-pose-controls input[type=range]{width:150px}.gn-pose-controls input[type=checkbox]{width:16px}.gn-pose-controls button{min-height:28px;padding:3px 8px}';host.append(style);
 panel.innerHTML='<label><input type="checkbox" data-show> Pose joints</label><select aria-label="Preview joint"></select><label>Angle <input aria-label="Joint angle" type="number" step="any" style="width:85px"></label><input aria-label="Bend selected joint" type="range" step=".1"><button type="button">Play motion</button><span data-note style="font-size:11px"></span>';host.after(panel);
 const show=panel.querySelector('[data-show]'),select=panel.querySelector('select'),angle=panel.querySelector('[type=number]'),slider=panel.querySelector('[type=range]'),play=panel.querySelector('button'),note=panel.querySelector('[data-note]');
 const selectionLabel=doc.createElement('strong');selectionLabel.style.cssText='color:#e7ca7d;font-size:12px';panel.prepend(selectionLabel);
 const button=(text,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;on(b,'click',fn);panel.insertBefore(b,note);return b;};
 const apply=button('Apply angle',()=>setAngle(angle.value)),minus=button('-5 degrees',()=>setAngle(Number(angle.value)-5)),plus=button('+5 degrees',()=>setAngle(Number(angle.value)+5)),reset=button('Reset joint',()=>setAngle(0)),keep=button('Keep pose',()=>stop(false,true));
 const layer=doc.createElement('div');layer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';host.append(layer);
 const dial=doc.createElementNS('http://www.w3.org/2000/svg','svg');dial.setAttribute('viewBox','-75 -75 150 180');dial.setAttribute('role','slider');dial.setAttribute('aria-label','Selected joint angle dial');dial.setAttribute('tabindex','0');
 dial.style.cssText='position:absolute;width:150px;height:180px;pointer-events:auto;touch-action:none;z-index:2';dial.innerHTML="<path data-ring fill=\"#102321\" fill-opacity=\".75\" stroke=\"#9aae9d\"/><line data-zero x1=\"0\" y1=\"0\" stroke=\"#aabbac\" stroke-dasharray=\"3 3\"/><line data-needle x1=\"0\" y1=\"0\" stroke=\"#efcb6d\" stroke-width=\"3\"/><circle r=\"4\" fill=\"#efcb6d\"/><rect x=\"-74\" y=\"69\" width=\"148\" height=\"35\" rx=\"4\" fill=\"#102321\"/><text data-value x=\"0\" y=\"83\" fill=\"#efcb6d\" font-size=\"12\" text-anchor=\"middle\"/><text data-hint x=\"0\" y=\"99\" fill=\"#dce8df\" font-size=\"10\" text-anchor=\"middle\"/>";host.append(dial);
 const friendly={slew:'Rotate vehicle body',boom:'Raise main arm',stick:'Bend outer arm',bucket:'Curl excavator bucket','crane-boom':'Raise crane boom','cab-door':'Open cab door','tractor-loader':'Raise loader arms','tractor-loader-bucket':'Tilt loader bucket','tipping-bed':'Tip cargo bed',tailgate:'Open tailgate'};
 const label=j=>friendly[j.id]||j.pose.label;
 let joints=[],markers=[],signature='',selected='',pending=null,liveFrame=null,drag=null,sliderEditing=false,sliderWindow=null,animation=null,timer=null,autoGraph='',lastGraph='',down=null,detached=false,disposed=false;
 const active=()=>joints.find(j=>j.key===selected),valueOf=j=>pending?.nodeId===j.nodeId&&pending.parameter===j.pose.parameter?pending.value:j.pose.value;

 // This frame lives in the joint's actual world plane. Never infer its
 // handedness from a fixed screen atan2 or from a camera-side sign alone.
 function dialFrame(j){
  if(!j||!Array.isArray(j.axis)||!Array.isArray(j.referenceDirection))return null;
  const normal=new THREE.Vector3(...j.axis),u=new THREE.Vector3(...j.referenceDirection);
  if(![...normal.toArray(),...u.toArray()].every(Number.isFinite)||normal.lengthSq()<1e-12)return null;
  normal.normalize();u.addScaledVector(normal,-u.dot(normal));if(u.lengthSq()<1e-12)return null;u.normalize();
  const sign=j.pose.rotationSign===-1?-1:1,v=new THREE.Vector3().crossVectors(normal,u).multiplyScalar(sign);
  camera.updateMatrixWorld();
  const origin=j.position.clone(),clip=origin.clone().project(camera),rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height||clip.z< -1||clip.z>1)return null;
  const depth=-origin.clone().applyMatrix4(camera.matrixWorldInverse).z;if(depth<=0)return null;
  const units=camera.isOrthographicCamera?(camera.top-camera.bottom)/(camera.zoom*rect.height):2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/(camera.zoom*rect.height);
  const radius=50*units,center=new THREE.Vector2((clip.x+1)*rect.width/2,(1-clip.y)*rect.height/2);
  const view=camera.isOrthographicCamera?camera.getWorldDirection(new THREE.Vector3()):origin.clone().sub(camera.getWorldPosition(new THREE.Vector3())).normalize();
  const project=direction=>{const p=origin.clone().addScaledVector(direction,radius).project(camera);return new THREE.Vector2((p.x+1)*rect.width/2-center.x,(1-p.y)*rect.height/2-center.y);};
  return {origin,normal,u,v,sign,radius,rect,center,project,edgeOn:Math.abs(view.dot(normal))<.15};
 }
 function dialPointer(event,frame){
  if(!frame)return null;
  camera.updateMatrixWorld();const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
  if(Math.abs(ray.ray.direction.dot(frame.normal))<.15)return null;
  const hit=ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(frame.normal,frame.origin),new THREE.Vector3());
  if(!hit)return null;hit.sub(frame.origin);if(hit.length()<frame.radius*.08)return null;
  return THREE.MathUtils.radToDeg(Math.atan2(hit.dot(frame.v),hit.dot(frame.u)));
 }
 function drawProjectedDial(svg,j,value){
  const f=dialFrame(j);if(!f){svg.style.display='none';return null;}svg.style.display='block';
  const base=svg.parentElement.getBoundingClientRect();
  svg.style.left=(f.rect.left-base.left+f.center.x-75)+'px';svg.style.top=(f.rect.top-base.top+f.center.y-75)+'px';
  const points=[];for(let i=0;i<=64;i++){const a=i*Math.PI/32,p=f.project(f.u.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.v,Math.sin(a)));points.push((i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2));}
  svg.querySelector('[data-ring]').setAttribute('d',points.join(' ')+' Z');
  const ray=f.u.clone().applyAxisAngle(f.normal,THREE.MathUtils.degToRad(f.sign*(value-j.pose.value))),tip=f.project(ray.multiplyScalar(.88));
  const needle=svg.querySelector('[data-needle]');needle.setAttribute('x2',String(tip.x));needle.setAttribute('y2',String(tip.y));
  const zero=f.project(f.u.clone().applyAxisAngle(f.normal,THREE.MathUtils.degToRad(-f.sign*j.pose.value)).multiplyScalar(.9));
  const baseline=svg.querySelector('[data-zero]');baseline.setAttribute('x2',String(zero.x));baseline.setAttribute('y2',String(zero.y));
  svg.querySelector('[data-value]').textContent=value+' degrees';
  svg.querySelector('[data-hint]').textContent=f.edgeOn?'Edge-on: use side view':'Joint rotation plane';
  svg.setAttribute('aria-valuenow',String(value));svg.setAttribute('aria-valuetext',value+' degrees, free rotation');svg.setAttribute('aria-disabled',String(f.edgeOn));
  svg.style.cursor=f.edgeOn?'not-allowed':'crosshair';return f;
 }

 function sync(){
  const j=active();for(const el of [select,angle,slider,apply,minus,plus,reset])el.disabled=!j||!!animation;play.disabled=!j;keep.disabled=!animation;if(!j)return;
  const value=valueOf(j);if(!sliderWindow||sliderWindow.key!==j.key||!sliderEditing)sliderWindow={key:j.key,lo:value-180,hi:value+180};
  slider.min=sliderWindow.lo;slider.max=sliderWindow.hi;slider.value=value;
  if(doc.activeElement!==angle)angle.value=value;select.value=j.key;selectionLabel.textContent=label(j)+' / '+value+' degrees';
 }
 function cancelLive(){
  if(liveFrame!==null)win.cancelAnimationFrame(liveFrame);liveFrame=null;pending=null;sliderEditing=false;
  const old=drag;drag=null;if(old&&dial.hasPointerCapture(old.pointer))dial.releasePointerCapture(old.pointer);
 }
 function write(id,values,options){
  try{commit(id,values,options);return true;}catch(error){cancelLive();animation=null;win.clearTimeout(timer);play.textContent='Play motion';status(error.message);sync();return false;}
 }
 function stop(restore=true,save=false){
  cancelLive();const old=animation;animation=null;win.clearTimeout(timer);play.textContent='Play motion';
  if(old&&graph()?.id===old.graphId&&(restore||save))write(old.nodeId,{[old.parameter]:restore?old.value:(active()?.pose.value??old.value)});sync();
 }
 function choose(key){stop();selected=key;sliderWindow=null;sync();}
 function setAngle(value){
  const j=active(),n=Number(value);if(!j||String(value).trim()===''||!Number.isFinite(n))return;
  stop(false);write(j.nodeId,{[j.pose.parameter]:n});sync();
 }
 function liveAngle(value){
  const j=active(),n=Number(value);if(!j||animation||!Number.isFinite(n))return;
  pending={nodeId:j.nodeId,parameter:j.pose.parameter,value:Math.round(n*10)/10};sync();update();
  if(liveFrame===null)liveFrame=win.requestAnimationFrame(()=>{liveFrame=null;const p=pending;if(p)write(p.nodeId,{[p.parameter]:p.value},{transient:true});});
 }
 on(select,'change',()=>choose(select.value));
 on(slider,'pointerdown',()=>{sliderEditing=true;});
 on(slider,'keydown',()=>{sliderEditing=true;});
 on(slider,'input',()=>liveAngle(slider.value));
 on(slider,'change',()=>{const value=slider.value;sliderEditing=false;setAngle(value);});
 on(slider,'blur',()=>{sliderEditing=false;sync();});
 on(angle,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();setAngle(angle.value);}});
 on(play,'click',()=>{
  if(animation){stop();return;}const j=active();if(!j)return;cancelLive();
  animation={graphId:graph().id,nodeId:j.nodeId,parameter:j.pose.parameter,value:j.pose.value,frame:0};play.textContent='Stop / restore';sync();
  function tick(){
   const a=animation;if(!a)return;if(doc.hidden||graph()?.id!==a.graphId){stop();return;}
   const start=win.performance.now(),t=(1-Math.cos(++a.frame*Math.PI/6))*.5;
   if(!write(a.nodeId,{[a.parameter]:a.value+360*t},{transient:true}))return;
   if(a.frame>=12){stop();return;}timer=win.setTimeout(tick,Math.max(500,(win.performance.now()-start)*2));
  }timer=win.setTimeout(tick,500);
 });
 on(doc,'keydown',e=>{if(e.key==='Escape'&&(animation||drag||pending)){e.preventDefault();stop();}});
 on(doc,'visibilitychange',()=>{if(doc.hidden)stop();});on(show,'change',()=>{if(!show.checked)stop();});
 on(dial,'pointerdown',e=>{
  e.preventDefault();e.stopPropagation();const j=active();if(!j||animation||e.button!==0)return;
  const frame=dialFrame(j),a=frame&&!frame.edgeOn?dialPointer(e,frame):null;
  if(a===null){status('Dial is edge-on or lacks axis metadata. Orbit to a side view or rebuild the preview.');return;}
  drag={pointer:e.pointerId,nodeId:j.nodeId,id:j.id,frame,last:a,value:valueOf(j)};dial.setPointerCapture(e.pointerId);
 });
 on(dial,'pointermove',e=>{
  if(!drag)return;e.preventDefault();e.stopPropagation();const a=dialPointer(e,drag.frame);if(a===null)return;
  const delta=((a-drag.last+540)%360)-180;drag.last=a;drag.value+=delta;liveAngle(drag.value);
 });
 const finishDial=e=>{
  e.preventDefault();e.stopPropagation();if(!drag)return;const value=drag.value,pointer=drag.pointer;drag=null;
  if(dial.hasPointerCapture(pointer))dial.releasePointerCapture(pointer);setAngle(Math.round(value*10)/10);
 };
 on(dial,'pointerup',finishDial);on(dial,'pointercancel',()=>stop(false));on(dial,'lostpointercapture',()=>{if(drag)stop(false);});
 on(dial,'wheel',e=>{e.preventDefault();e.stopPropagation();},{passive:false});
 on(dial,'keydown',e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();const j=active();if(j)setAngle(valueOf(j)+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1));}});
 for(const type of ['pointerdown','pointermove','pointerup','wheel'])on(panel,type,e=>e.stopPropagation());
 on(canvas,'pointerdown',e=>{down=[e.clientX,e.clientY];});
 on(canvas,'pointerup',e=>{
  if(!show.checked||!down||e.button!==0||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;
  const b=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);
  const m=ray.intersectObjects(meshes(),false)[0]?.object.userData.gameAsset?.machinery,j=m?.joints?.findLast(j=>j.pose),found=joints.find(v=>v.nodeId===m?.nodeId&&v.id===j?.id);if(found)choose(found.key);
 });
 function refresh(){
  if(disposed)return;const g=graph(),current=meshes(),next=[],seen=new Set();
  if(lastGraph!==g?.id){stop(false);lastGraph=g?.id;sliderWindow=null;}
  for(const mesh of current){const m=mesh.userData.gameAsset?.machinery;if(!m)continue;for(const j of m.joints||[]){
   if(!j.pose)continue;const key=m.nodeId+':'+j.id+':'+j.pivot.map(v=>Math.round(v*1000)).join(',');if(seen.has(key))continue;seen.add(key);
   next.push({...j,key,nodeId:m.nodeId,position:new THREE.Vector3(...j.pivot).add(new THREE.Vector3(...(m.offset||[0,0,0])))});
  }}
  const old=active();joints=next;
  if(!joints.some(j=>j.key===selected)){cancelLive();selected=(joints.find(j=>j.nodeId===old?.nodeId&&j.id===old?.id)||joints[0])?.key||'';sliderWindow=null;}
  const sig=joints.map(j=>j.key).join('|');if(sig!==signature){signature=sig;select.replaceChildren();layer.replaceChildren();markers=[];
   for(const j of joints){const option=doc.createElement('option');option.value=j.key;option.textContent=label(j)+' ('+j.nodeId+')';select.append(option);
    const marker=doc.createElement('button');marker.type='button';marker.textContent='+';marker.title=option.textContent;marker.setAttribute('aria-label','Pose '+option.textContent);marker.style.cssText='position:absolute;width:24px;height:24px;min-height:24px;padding:0;border-radius:50%;border:2px solid #dec66e;background:#173f37;color:white;pointer-events:auto;transform:translate(-50%,-50%)';
    on(marker,'click',()=>choose(j.key));layer.append(marker);markers.push(marker);
   }
  }
  if(autoGraph!==g?.id){autoGraph=g?.id;show.checked=current.some(m=>m.userData.gameAsset?.previewPose?.showJoints);}
  panel.hidden=!joints.length;sync();
 }
 function update(){
  if(disposed)return;layer.hidden=detached||!show.checked||!joints.length;dial.style.display=layer.hidden?'none':'block';
  const rect=canvas.getBoundingClientRect(),base=host.getBoundingClientRect();
  joints.forEach((j,i)=>{const marker=markers[i];if(!marker)return;const p=j.position.clone().project(camera);marker.hidden=p.z< -1||p.z>1;marker.style.left=(rect.left-base.left+(p.x+1)*rect.width/2)+'px';marker.style.top=(rect.top-base.top+(1-p.y)*rect.height/2)+'px';marker.style.background=j.key===selected?'#977127':'#173f37';});
  const j=active();if(j&&!layer.hidden){const f=drawProjectedDial(dial,j,valueOf(j));note.textContent=!f?'Rebuild preview for joint-plane metadata.':f.edgeOn?'Dial edge-on: orbit to a side view. Numeric angle and Bend still work.':'Free rotation. Bend spans one turn and recenters after release. No collision checking.';}
 }
 return {refresh,update,
  clear(){stop(false);down=null;joints=[];markers=[];signature='';selected='';sliderWindow=null;select.replaceChildren();layer.replaceChildren();layer.hidden=true;dial.style.display='none';selectionLabel.textContent='';panel.hidden=true;sync();},
  setDetached(value){detached=!!value;panel.style.display=detached?'none':'';update();},
  command(data){
   if(!detached||typeof data.nodeId!=='string'||typeof data.jointId!=='string')return;const j=joints.find(j=>j.nodeId===data.nodeId&&j.id===data.jointId);if(!j)return;if(selected!==j.key)choose(j.key);
   if(data.action==='live-angle'&&Number.isFinite(data.value))liveAngle(data.value);
   else if(data.action==='angle'&&Number.isFinite(data.value))setAngle(data.value);
   else if(data.action==='play'){if(!animation)play.click();}
   else if(data.action==='stop')stop();
   else if(data.action==='keep')stop(false,true);
  },
  dispose(){stop(false);disposed=true;events.abort();panel.remove();style.remove();layer.remove();dial.remove();}
 };
}
