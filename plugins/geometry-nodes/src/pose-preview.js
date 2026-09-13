import * as THREE from 'three';

// Preview-only controls. Changes rebuild the source node, including its hydraulics.
export function mountPosePreview({host,canvas,camera,graph,meshes,commit,status}){
 const panel=document.createElement('div');
 panel.className='gn-pose-controls';
 const style=document.createElement('style');style.textContent='.gn-pose-controls{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:7px 0}.gn-pose-controls[hidden]{display:none}.gn-pose-controls label{display:flex;align-items:center;gap:4px;margin:0}.gn-pose-controls input,.gn-pose-controls select{width:auto;padding:4px}.gn-pose-controls select{max-width:300px}.gn-pose-controls input[type=range]{width:150px}.gn-pose-controls input[type=checkbox]{width:16px}.gn-pose-controls button{min-height:28px;padding:3px 8px}';host.append(style);
 panel.innerHTML='<label><input type="checkbox" data-show> Pose joints</label><select aria-label="Preview joint"></select><label>Angle <input aria-label="Joint angle" type="number" step="1" style="width:65px"></label><input aria-label="Bend selected joint" type="range" step="1"><label>Min <input aria-label="Joint minimum" type="number" style="width:60px"></label><label>Max <input aria-label="Joint maximum" type="number" style="width:60px"></label><button type="button">Play motion</button><span style="font-size:11px">Select a joint marker or model part. Limits are angle stops, not collision detection.</span>';
 host.after(panel);
 const show=panel.querySelector('[data-show]'),select=panel.querySelector('select'),angle=panel.querySelector('[aria-label="Joint angle"]'),slider=panel.querySelector('[type="range"]'),minimum=panel.querySelector('[aria-label="Joint minimum"]'),maximum=panel.querySelector('[aria-label="Joint maximum"]'),play=panel.querySelector('button');
 function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);panel.insertBefore(b,panel.lastElementChild);return b;}
 const apply=button('Apply angle',()=>setAngle(angle.value));
 const minus=button('-5 degrees',()=>setAngle(Number(angle.value)-5)),plus=button('+5 degrees',()=>setAngle(Number(angle.value)+5));
 const limits=button('Apply limits',setLimits),reset=button('Reset joint',()=>{limitDraft=null;setAngle(0);});
 const keep=button('Keep pose',()=>stop(false,true));
 const layer=document.createElement('div');layer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';host.append(layer);
 const dial=document.createElementNS('http://www.w3.org/2000/svg','svg');
 dial.setAttribute('viewBox','-75 -75 150 170');dial.setAttribute('role','slider');dial.setAttribute('aria-label','Selected joint angle dial');dial.setAttribute('tabindex','0');
 dial.style.cssText='position:absolute;width:150px;height:170px;overflow:visible;pointer-events:auto;touch-action:none;cursor:crosshair;filter:drop-shadow(0 1px 3px #081518);z-index:2';host.append(dial);
 const ticks=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12,x=Math.cos(a),y=-Math.sin(a),major=i%6===0;return '<line x1="'+x*(major?44:48)+'" y1="'+y*(major?44:48)+'" x2="'+x*53+'" y2="'+y*53+'" stroke="#b0c9bf" stroke-width="'+(major?2:1)+'"/>';}).join('');
 dial.innerHTML='<circle r="54" fill="#102321" fill-opacity=".8" stroke="#4c7768"/>'+ticks+'<line x1="0" y1="0" x2="54" y2="0" stroke="#a2b7ae" stroke-dasharray="3 3"/><path data-arc fill="none" stroke="#e1b14b" stroke-width="4"/><line data-needle x1="0" y1="0" x2="43" y2="0" stroke="#f0ce72" stroke-width="3"/><circle r="4" fill="#f0ce72"/><g fill="#d8e8df" font-size="10" text-anchor="middle"><text x="65" y="4">0</text><text x="0" y="-60">90</text><text x="-65" y="4">180</text><text x="0" y="65">-90</text></g><rect x="-71" y="72" width="142" height="22" rx="4" fill="#102321"/><text data-readout x="0" y="87" fill="#f0ce72" font-size="13" text-anchor="middle"/></svg>';
 const arc=dial.querySelector('[data-arc]'),needle=dial.querySelector('[data-needle]'),readout=dial.querySelector('[data-readout]');
 const selectionLabel=document.createElement('strong');selectionLabel.style.cssText='color:#e7ca7d;font-size:12px';panel.prepend(selectionLabel);
 const friendly={slew:'Rotate vehicle body',boom:'Raise main arm',stick:'Bend outer arm',bucket:'Curl excavator bucket','crane-boom':'Raise crane boom','cab-door':'Open cab door','tractor-loader':'Raise loader arms','tractor-loader-bucket':'Tilt loader bucket','tipping-bed':'Tip cargo bed',tailgate:'Open tailgate'};
 function label(j){return friendly[j.id]||j.pose.label;}
 let pending=null,liveFrame=null,dragging=false,dragAngle=0,dragValue=0,limitDraft=null;
 let joints=[],markers=[],signature='',selected='',animation=null,timer=null,autoGraph='';
 const ray=new THREE.Raycaster();
 function active(){return joints.find(j=>j.key===selected);}
 function sync(){
  const j=active();for(const el of [select,angle,slider,minimum,maximum,apply,minus,plus,limits,reset])el.disabled=!j||!!animation;play.disabled=!j;keep.disabled=!animation;
  if(!j)return;
  const value=pending?.nodeId===j.nodeId&&pending.parameter===j.pose.parameter?pending.value:j.pose.value;
  select.value=j.key;angle.value=slider.value=value;selectionLabel.textContent=label(j)+' / '+value+'\u00b0';
  angle.min=slider.min=j.pose.minimum;angle.max=slider.max=j.pose.maximum;
  if(limitDraft&&limitDraft.key!==j.key)limitDraft=null;
  minimum.value=limitDraft?.minimum??j.pose.minimum;maximum.value=limitDraft?.maximum??j.pose.maximum;
  minimum.min=maximum.min=j.pose.hardMin;minimum.max=maximum.max=j.pose.hardMax;
 }
 function write(id,values,options){
  try{commit(id,values,options);return true;}catch(error){animation=null;clearTimeout(timer);play.textContent='Play motion';status(error.message);sync();return false;}
 }
 function stop(restore=true,save=false){
  cancelAnimationFrame(liveFrame);liveFrame=null;pending=null;dragging=false;
  const old=animation;animation=null;clearTimeout(timer);play.textContent='Play motion';
  if(old&&graph()?.id===old.graphId&&(restore||save))write(old.nodeId,{[old.parameter]:restore?old.value:(active()?.pose.value??old.value)});
  sync();
 }
 function choose(key){stop();if(selected!==key)limitDraft=null;selected=key;sync();}
 select.addEventListener('change',()=>choose(select.value));
 function setAngle(value){const j=active();if(!j||!Number.isFinite(Number(value)))return;stop(false);write(j.nodeId,{[j.pose.parameter]:THREE.MathUtils.clamp(Number(value),j.pose.minimum,j.pose.maximum)});}
 function liveAngle(value){
  const j=active();if(!j||animation||!Number.isFinite(Number(value)))return;
  pending={nodeId:j.nodeId,parameter:j.pose.parameter,value:THREE.MathUtils.clamp(Math.round(Number(value)),j.pose.minimum,j.pose.maximum)};
  sync();update();
  if(liveFrame===null)liveFrame=requestAnimationFrame(()=>{liveFrame=null;const next=pending;if(next)write(next.nodeId,{[next.parameter]:next.value},{transient:true});});
 }
 slider.addEventListener('input',()=>liveAngle(slider.value));
 angle.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setAngle(angle.value);}});slider.addEventListener('change',()=>setAngle(slider.value));
 function setLimits(){
  const j=active();if(!j)return;const loText=limitDraft?.key===j.key?limitDraft.minimum:minimum.value,hiText=limitDraft?.key===j.key?limitDraft.maximum:maximum.value,lo=Number(loText),hi=Number(hiText);
  if(!loText.trim()||!hiText.trim()||!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi||lo<j.pose.hardMin||hi>j.pose.hardMax){status('Choose finite, ordered limits inside '+j.pose.hardMin+' to '+j.pose.hardMax+' degrees.');sync();return;}
  limitDraft={key:j.key,minimum:loText,maximum:hiText,submitted:true,lo,hi};
  stop(false);write(j.nodeId,{[j.pose.parameter+'Min']:lo,[j.pose.parameter+'Max']:hi,[j.pose.parameter]:THREE.MathUtils.clamp(j.pose.value,lo,hi)});
 }
 for(const el of [minimum,maximum])el.addEventListener('input',()=>{const j=active();if(j)limitDraft={key:j.key,minimum:minimum.value,maximum:maximum.value,submitted:false};});
 play.addEventListener('click',()=>{
  if(animation){stop();return;}const j=active();if(!j)return;
  animation={graphId:graph().id,nodeId:j.nodeId,parameter:j.pose.parameter,value:j.pose.value,frame:0,lo:j.pose.minimum,hi:j.pose.maximum};play.textContent='Stop / restore';sync();
  function tick(){
   const a=animation;if(!a)return;if(document.hidden||graph()?.id!==a.graphId){stop();return;}
   const start=performance.now(),t=(1-Math.cos(++a.frame*Math.PI/6))*.5;
   if(!write(a.nodeId,{[a.parameter]:Math.round(a.lo+(a.hi-a.lo)*t)},{transient:true}))return;
   if(a.frame>=12){stop();return;}
   timer=setTimeout(tick,Math.max(500,(performance.now()-start)*2));
  }
  timer=setTimeout(tick,500);
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&animation){e.preventDefault();stop();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&animation)stop();});
 show.addEventListener('change',()=>{if(!show.checked)stop();});
 function dialValue(e){const b=dial.getBoundingClientRect(),x=e.clientX-b.left-b.width/2,y=e.clientY-b.top-b.height*75/170;return THREE.MathUtils.radToDeg(Math.atan2(-y,x));}
 dial.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const j=active();if(animation||!j||e.button!==0)return;dragging=true;dragAngle=dialValue(e);dragValue=pending?.value??j.pose.value;dial.setPointerCapture(e.pointerId);});
 dial.addEventListener('pointermove',e=>{if(!dragging)return;e.preventDefault();e.stopPropagation();const j=active();if(!j)return;const next=dialValue(e),delta=((next-dragAngle+540)%360)-180;dragAngle=next;dragValue=THREE.MathUtils.clamp(dragValue+delta,j.pose.minimum,j.pose.maximum);liveAngle(dragValue);});
 const finishDial=e=>{e.preventDefault();e.stopPropagation();if(!dragging)return;dragging=false;const value=pending?.value??active()?.pose.value;if(dial.hasPointerCapture(e.pointerId))dial.releasePointerCapture(e.pointerId);if(value!==undefined)setAngle(value);};
 dial.addEventListener('pointerup',finishDial);dial.addEventListener('pointercancel',finishDial);
 dial.addEventListener('lostpointercapture',()=>{if(dragging){dragging=false;const value=pending?.value;if(value!==undefined)setAngle(value);}});
 dial.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();},{passive:false});
 for(const type of ['pointerdown','pointermove','pointerup','wheel'])panel.addEventListener(type,e=>e.stopPropagation());
 dial.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();setAngle((active()?.pose.value||0)+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1));}});
 let down=null;
 canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{
  if(!show.checked||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||e.button!==0)return;
  const b=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);
  const hit=ray.intersectObjects(meshes(),false)[0],m=hit?.object.userData.gameAsset?.machinery;
  const joint=m?.joints?.findLast(j=>j.pose);if(!joint)return;
  const found=joints.find(j=>j.nodeId===m.nodeId&&j.id===joint.id);if(found)choose(found.key);
 });
 function refresh(){
  const g=graph(),current=meshes(),next=[];const seen=new Set();
  for(const mesh of current){
   const data=mesh.userData.gameAsset,m=data?.machinery;if(!m)continue;
   for(const joint of m.joints||[]){
    if(!joint.pose)continue;
    const key=m.nodeId+':'+joint.id+':'+joint.pivot.map(v=>Math.round(v*1000)).join(',');
    if(seen.has(key))continue;seen.add(key);
    next.push({...joint,key,nodeId:m.nodeId,position:new THREE.Vector3(...joint.pivot).add(new THREE.Vector3(...(m.offset||[0,0,0])))});
   }
  }
  if(animation&&animation.graphId!==g?.id)stop(false);
  const old=active();joints=next;
  if(limitDraft&&!joints.some(j=>j.key===limitDraft.key))limitDraft=null;
  if(limitDraft?.submitted&&joints.some(j=>j.key===limitDraft.key&&j.pose.minimum===limitDraft.lo&&j.pose.maximum===limitDraft.hi))limitDraft=null;
  if(!joints.some(j=>j.key===selected))selected=(joints.find(j=>j.nodeId===old?.nodeId&&j.id===old?.id)||joints[0])?.key||'';
  const sig=joints.map(j=>j.key).join('|');
  if(sig!==signature){
   signature=sig;select.replaceChildren();layer.replaceChildren();markers=[];
   for(const j of joints){
    const option=document.createElement('option');option.value=j.key;option.textContent=label(j)+' ('+j.nodeId+')';select.append(option);
    const marker=document.createElement('button');marker.type='button';marker.textContent='+';marker.title=option.textContent;marker.setAttribute('aria-label','Pose '+option.textContent);
    marker.style.cssText='position:absolute;width:24px;height:24px;min-height:24px;padding:0;border-radius:50%;border:2px solid #dec66e;background:#173f37;color:white;pointer-events:auto;transform:translate(-50%,-50%)';
    marker.addEventListener('click',()=>choose(j.key));layer.append(marker);markers.push(marker);
   }
  }
  if(autoGraph!==g?.id){autoGraph=g?.id;show.checked=current.some(m=>m.userData.gameAsset?.previewPose?.showJoints);}
  panel.hidden=!joints.length;sync();
 }
 function update(now=performance.now()){
  layer.hidden=!show.checked||!joints.length;
  dial.style.display=layer.hidden?'none':'block';
  const rect=canvas.getBoundingClientRect(),base=host.getBoundingClientRect();
  joints.forEach((j,i)=>{const marker=markers[i];if(!marker)return;const v=j.position.clone().project(camera);marker.hidden=v.z< -1||v.z>1;marker.style.left=(rect.left-base.left+(v.x+1)*rect.width/2)+'px';marker.style.top=(rect.top-base.top+(1-v.y)*rect.height/2)+'px';marker.style.background=j.key===selected?'#977127':'#173f37';});
  const j=active();if(j){
   const v=j.position.clone().project(camera),value=pending?.nodeId===j.nodeId&&pending.parameter===j.pose.parameter?pending.value:j.pose.value,a=THREE.MathUtils.degToRad(value);
   dial.style.left=(rect.left-base.left+(v.x+1)*rect.width/2-75)+'px';dial.style.top=(rect.top-base.top+(1-v.y)*rect.height/2-75)+'px';
   if(v.z< -1||v.z>1)dial.style.display='none';
   needle.setAttribute('x2',String(43*Math.cos(a)));needle.setAttribute('y2',String(-43*Math.sin(a)));
   arc.setAttribute('d',Math.abs(value)<.01?'':'M 38 0 A 38 38 0 '+(Math.abs(value)>180?1:0)+' '+(value<0?1:0)+' '+38*Math.cos(a)+' '+(-38*Math.sin(a)));
   readout.textContent=value+'\u00b0 local joint';dial.setAttribute('aria-valuenow',String(value));dial.setAttribute('aria-valuemin',String(j.pose.minimum));dial.setAttribute('aria-valuemax',String(j.pose.maximum));dial.setAttribute('aria-valuetext',label(j)+': '+value+' degrees');
  }
 }
 let detached=false;
 return {refresh,update,
  clear(){
   // Do not restore/commit a pose: either operation would rebuild the cleared model.
   stop(false);limitDraft=null;dragging=false;down=null;joints=[];markers=[];signature='';selected='';
   select.replaceChildren();layer.replaceChildren();layer.hidden=true;dial.style.display='none';
   selectionLabel.textContent='';panel.hidden=true;sync();
  },
  setDetached(value){detached=!!value;panel.style.display=detached?'none':'';},
  command(data){
   if(!detached||typeof data.nodeId!=='string'||typeof data.jointId!=='string')return;
   const joint=joints.find(j=>j.nodeId===data.nodeId&&j.id===data.jointId);if(!joint)return;
   if(selected!==joint.key)choose(joint.key);
   if(data.action==='live-angle'&&Number.isFinite(data.value))liveAngle(data.value);
   else if(data.action==='angle'&&Number.isFinite(data.value))setAngle(data.value);
   else if(data.action==='limits'&&Number.isFinite(data.minimum)&&Number.isFinite(data.maximum)){limitDraft={key:joint.key,minimum:String(data.minimum),maximum:String(data.maximum),submitted:false};minimum.value=data.minimum;maximum.value=data.maximum;setLimits();}
   else if(data.action==='play'){if(!animation)play.click();}
   else if(data.action==='stop')stop();
   else if(data.action==='keep')stop(false,true);
  }
 };
}
