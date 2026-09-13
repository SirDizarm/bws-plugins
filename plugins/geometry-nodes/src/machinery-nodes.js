import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {VEHICLE_THEME_FIELDS} from './vehicle-theme.js';
import {VEHICLE_DAMAGE_FIELDS} from './vehicle-damage.js';

const fields={
 ...VEHICLE_DAMAGE_FIELDS,
 ...VEHICLE_THEME_FIELDS,vehicleThemeOverride:['Override connected theme',false],
 vehiclePaint:['Paint','#74888a'],vehicleMetal:['Chassis','#34393c'],vehicleRubber:['Rubber','#252728'],
 machineTrackLength:['Track length',4,2,8,.1],machineTrackWidth:['Track shoe width',.55,.25,1.4,.05],
 machineTrackGauge:['Track centre spacing',2,1.2,4,.1],machineTrackRadius:['Track end radius',.55,.3,.9,.05],
 machineTrackShoes:['Shoes per track',44,24,80,1],machineTrackPhase:['Tread travel',0,0,1,.01],
 machineTrackRollers:['Wheels per track',4,2,8,1],machineTrackCovers:['Track side covers',true],
 machineWheeled:['Four-wheel undercarriage',false],
 tractorWheelbase:['Tractor wheelbase',2.4,1.8,3.4,.1],tractorRearRadius:['Rear tyre radius',.8,.65,1,.05],
 tractorFrontRadius:['Front tyre radius',.46,.3,.6,.05],tractorCab:['Enclosed tractor cab',false],
 tractorLoader:['Front loader',false],tractorLoaderAngle:['Loader elevation',15,-10,65,1],
 tractorBucketAngle:['Loader bucket tilt',0,-60,70,1],tractorBucketWidth:['Loader bucket width',1.8,1.2,2.6,.1],
 machineYaw:['Base rotation',0,-180,180,1],machineBoomLength:['Main boom length',3,1,7,.1],
 machineBoomAngle:['Main boom elevation',45,-15,85,1],machineStickLength:['Outer arm length',2,.6,5,.1],
 machineStickAngle:['Outer arm bend',-75,-150,30,1],machineToolAngle:['Attachment angle',25,-120,120,1],
 machineExtension:['Telescope extension',0,0,3,.1],machineCable:['Cable drop',1.4,.3,6,.1],
 machineBucketWidth:['Bucket width',1,.4,2,.05],machineBucketTeeth:['Bucket teeth',5,3,9,1],
 machineOutriggerSpan:['Stabilizer span',4,2,7,.1],machineOutriggerDrop:['Stabilizer drop',.8,.1,2,.05],
 machineTrailerLength:['Trailer length',7,4,12,.1],machineTrailerWidth:['Trailer width',2.5,1.8,3.2,.1],
 machineTrailerAxles:['Trailer axles',3,1,4,1],machineTrailerSides:['Sideboard height',.65,0,1.3,.05],
 machineTipLength:['Tipping bed length',3.5,2,6,.1],machineTipWidth:['Tipping bed width',2.3,1.8,3,.1],
 machineTipHeight:['Tipping bed sides',.8,.3,1.6,.05],machineTipAngle:['Bed tip angle',0,0,55,1],
 machineTailgateAngle:['Tailgate opening',0,0,110,1],
 machineCabWidth:['Cab width',2.3,1.8,2.8,.1],machineCabHeight:['Cab height',2.7,2.3,3.2,.1],
 machineDoorAngle:['Cab door opening',0,0,100,1],
 machineCylinderLength:['Cylinder length',1.6,.5,4,.1],machineCylinderStroke:['Piston extension',.5,0,2,.05],
 machineAxleWidth:['Axle width',2.2,1.4,3.2,.1],machineWheelRadius:['Wheel radius',.5,.3,.8,.05]
};
const trackKeys=['machineTrackLength','machineTrackWidth','machineTrackGauge','machineTrackRadius','machineTrackShoes','machineTrackPhase','machineTrackRollers','machineTrackCovers'];
const armKeys=['machineYaw','machineBoomLength','machineBoomAngle','machineStickLength','machineStickAngle','machineToolAngle','machineBucketWidth','machineBucketTeeth'];
const craneKeys=['machineYaw','machineBoomLength','machineBoomAngle','machineExtension','machineCable','machineOutriggerSpan','machineOutriggerDrop'];
const common=['themeShape','themeCondition','themeWear','vehicleThemeOverride','vehiclePaint','vehicleMetal','vehicleRubber',...Object.keys(VEHICLE_DAMAGE_FIELDS)];
const definitions=[
 ['vehicleTractor','Classic Tractor',['tractorWheelbase','tractorRearRadius','tractorFrontRadius','tractorCab','tractorLoader','tractorLoaderAngle','tractorBucketAngle','tractorBucketWidth','machineDoorAngle']],
 ['vehicleTracks','Caterpillar Tracks',trackKeys],
 ['vehicleTrackedCarrier','Tracked Utility Carrier',[...trackKeys,'machineYaw','machineDoorAngle']],
 ['vehicleExcavator','Excavator',[...trackKeys,...armKeys,'machineDoorAngle','machineWheeled','machineWheelRadius']],
 ['vehicleCrane','Crane Assembly',craneKeys],
 ['vehicleBoom','Articulated Boom',armKeys],
 ['vehicleTelescopicBoom','Telescopic Boom',craneKeys.slice(0,5)],
 ['vehicleBucket','Excavator Bucket',['machineBucketWidth','machineBucketTeeth','machineToolAngle']],
 ['vehicleHook','Crane Hook',['machineCable']],
 ['vehicleHydraulic','Hydraulic Cylinder',['machineCylinderLength','machineCylinderStroke']],
 ['vehicleStabilizers','Stabilizer Legs',['machineOutriggerSpan','machineOutriggerDrop']],
 ['vehicleTurntable','Rotating Base',['machineYaw']],
 ['vehicleMachineCab','Machinery Cab',['machineDoorAngle']],
 ['vehicleTrailer','Cargo Trailer',['machineTrailerLength','machineTrailerWidth','machineTrailerAxles','machineTrailerSides']],
 ['vehicleCoupling','Trailer Coupling',[]],
 ['vehicleTipper','Tipping Cargo Body',['machineTipLength','machineTipWidth','machineTipHeight','machineTipAngle','machineTailgateAngle']],
 ['vehicleCabOver','Industrial Cab-over',['machineCabWidth','machineCabHeight','machineDoorAngle']],
 ['vehicleWheelAxle','Axle and Wheels',['machineAxleWidth','machineWheelRadius']]
];
const poseFields=['machineYaw','machineBoomAngle','machineStickAngle','machineToolAngle','machineDoorAngle','machineTipAngle','machineTailgateAngle','tractorLoaderAngle','tractorBucketAngle'];
for(const key of poseFields){const f=fields[key];fields[key+'Min']=[f[0]+' minimum',f[2],f[2],f[3],1];fields[key+'Max']=[f[0]+' maximum',f[3],f[2],f[3],1];}
export const MACHINERY_NODES=Object.fromEntries(definitions.map(([id,title,keys])=>[id,{title,category:'Machinery',inputSockets:['Seed','Texture','Theme'],fields:Object.fromEntries([...common,...keys,...keys.filter(k=>poseFields.includes(k)).flatMap(k=>[k+'Min',k+'Max'])].map(key=>[key,fields[key]]))}]));

// Geometry poses and joint descriptions, not a physics or hydraulic simulation.
export function buildMachineryNode(type,values,{seed=1,emit}){
 const p={...Object.fromEntries(Object.entries(fields).map(([key,f])=>[key,f[1]])),...values};
 for(const key of poseFields){
  const f=fields[key],lo=Math.max(f[2],Number(p[key+'Min'])),hi=Math.min(f[3],Number(p[key+'Max']));
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi)throw Error(f[0]+': minimum must not exceed maximum.');
  p[key+'Min']=lo;p[key+'Max']=hi;p[key]=THREE.MathUtils.clamp(Number.isFinite(Number(p[key]))?Number(p[key]):f[1],lo,hi);
 }
 const paint=p.vehiclePaint,metal=p.vehicleMetal,rubber=p.vehicleRubber;
 let matrix=new THREE.Matrix4(),chain=[],serial=0,count=0;
 const rad=THREE.MathUtils.degToRad;
 function add(g,name,color=paint,role='body'){
  let c=new THREE.Color(color),roughness=.8;
  if(p.themeCondition!=='clean'){
   let h=(seed^Math.imul(++serial,2654435761))>>>0;h=((h^(h>>>16))>>>0)/4294967295;
   const wear=p.themeWear;
   if((p.themeCondition==='rusty'||p.themeCondition==='broken')&&color===paint)c.lerp(new THREE.Color('#855138'),wear*(.2+h*.5));
   else if(color!==rubber)c.multiplyScalar(1-wear*(.08+h*.15));
   roughness=.95;
   if(p.themeCondition==='broken'&&/body panel|counterweight/.test(name)){
    const a=g.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,a.getZ(i)+Math.sin(a.getX(i)*7+a.getY(i)*3)*wear*.035);g.computeVertexNormals();
   }
  }
  g.applyMatrix4(matrix);
  emit(g,name,[0,0,0],'#'+c.getHexString(),roughness,{version:1,role,joints:chain.map(j=>({...j})),poseOnly:true});count++;
 }
 function box(name,pos,size,color=paint,role='body',round=.035){
  const r=p.themeShape==='square'||p.themeShape==='futuristic'?0:Math.min(round,...size.map(v=>v*.25));
  const g=r?new RoundedBoxGeometry(...size,2,r):new THREE.BoxGeometry(...size);g.translate(...pos);add(g,name,color,role);
 }
 function cyl(name,pos,r,length,color=metal,axis='z',role='mechanism'){
  const g=new THREE.CylinderGeometry(r,r,length,20);if(axis==='z')g.rotateX(Math.PI/2);if(axis==='x')g.rotateZ(Math.PI/2);g.translate(...pos);add(g,name,color,role);
 }
 function plate(name,points,depth,z=0,color=paint,role='body'){
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});g.translate(0,0,z-depth/2);add(g,name,color,role);
 }
 function beam(name,a,b,width,depth=width,color=paint,role='boom'){
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);if(d.length()<.001)return;
  const g=new THREE.BoxGeometry(width,d.length(),depth);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...va.add(vb).multiplyScalar(.5).toArray());add(g,name,color,role);
 }
 function pipe(name,a,b,r,color=metal,role='mechanism'){
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);if(d.length()<.001)return;
  const g=new THREE.CylinderGeometry(r,r,d.length(),16);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...va.add(vb).multiplyScalar(.5).toArray());add(g,name,color,role);
 }
 function at(pos,fn){const before=matrix;matrix=matrix.clone().multiply(new THREE.Matrix4().makeTranslation(...pos));try{fn();}finally{matrix=before;}}
 function joint(id,pos,axis,angle,min,max,fn){
  const before=matrix,old=chain;const vector=new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);
  const parameter=({'slew':'machineYaw','boom':'machineBoomAngle','crane-boom':'machineBoomAngle','stick':'machineStickAngle','bucket':'machineToolAngle','cab-door':'machineDoorAngle','tipping-bed':'machineTipAngle','tailgate':'machineTailgateAngle','tractor-loader':'tractorLoaderAngle','tractor-loader-bucket':'tractorBucketAngle'})[id]||(id.startsWith('truck-door-')?'machineDoorAngle':null);
  const pose=parameter?{parameter,label:fields[parameter][0],value:p[parameter],minimum:p[parameter+'Min'],maximum:p[parameter+'Max'],hardMin:fields[parameter][2],hardMax:fields[parameter][3]}:null;
  chain=[...chain,{id,parent:chain.at(-1)?.id||null,pivot:new THREE.Vector3(...pos).applyMatrix4(matrix).toArray(),axis:vector.clone().transformDirection(matrix).toArray(),angle,min,max,pose}];
  matrix=matrix.clone().multiply(new THREE.Matrix4().makeTranslation(...pos)).multiply(new THREE.Matrix4().makeRotationAxis(vector,rad(angle)));
  try{fn();}finally{matrix=before;chain=old;}
 }
 function hydraulic(a,b,name){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),middle=start.clone().lerp(end,.57);
  pipe(name+' barrel',a,middle.toArray(),.085,metal);pipe(name+' piston',middle.toArray(),b,.043,'#b0b8ae');
  cyl(name+' base pin',a,.105,.24);cyl(name+' rod pin',b,.085,.24);
 }
 function wheel(x,y,z,r,width,label){
  cyl(label+' tyre',[x,y,z],r,width,rubber,'z','wheels');cyl(label+' rim',[x,y,z],r*.61,width+.012,paint,'z','wheels');
  cyl(label+' hub',[x,y,z],r*.23,width+.06,metal,'z','wheels');
  for(const side of [-1,1])for(let i=0;i<6;i++){const a=i*Math.PI/3;cyl(label+' bolt '+side+' '+i,[x+Math.cos(a)*r*.4,y+Math.sin(a)*r*.4,z+side*(width/2+.025)],.025,.03,'#a0a193','z','wheels');}
 }
 function tracks(){
  const r=p.machineTrackRadius,a=Math.max(.2,(p.machineTrackLength-2*r)/2),width=p.machineTrackWidth,gauge=p.machineTrackGauge;
  const straight=2*a,perimeter=4*a+2*Math.PI*r,n=p.machineTrackShoes,pitch=perimeter/n;
  function path(distance){
   let s=((distance%perimeter)+perimeter)%perimeter;
   if(s<straight)return [-a+s,2*r,0];s-=straight;
   if(s<Math.PI*r){const angle=Math.PI/2-s/r;return [a+r*Math.cos(angle),r+r*Math.sin(angle),angle-Math.PI/2];}s-=Math.PI*r;
   if(s<straight)return [a-s,0,Math.PI];s-=straight;
   const angle=-Math.PI/2-s/r;return [-a+r*Math.cos(angle),r+r*Math.sin(angle),angle-Math.PI/2];
  }
  box('track chassis bridge',[0,r+.18,0],[a*1.7,.35,gauge],metal,'chassis');
  for(const side of [-1,1]){
   const z=side*gauge/2;
   box('track inner frame '+side,[0,r,z],[2*a,.25,width*.7],metal,'tracks');
   const rollers=Math.max(2,Math.round(p.machineTrackRollers));
   for(let i=0;i<rollers;i++){
    const rollerRadius=Math.min(r*(i===0||i===rollers-1?.86:.7),a/(rollers-1)*.92);
    wheel(-a+2*a*i/(rollers-1),rollerRadius+.0475,z,rollerRadius,width*.7,'track roller '+side+' '+i);
   }
   if(p.machineTrackCovers){
    const cover=[[-a-r*.45,r*.65],[-a-r*.55,r*1.35],[-a,r*1.78],[a,r*1.78],[a+r*.55,r*1.35],[a+r*.45,r*.65]];
    plate('track protective side plate '+side,cover,.075,z+side*(width*.38),metal,'tracks');
    box('track cover upper rail '+side,[0,r*1.8,z+side*width*.38],[2*a,.075,.12],paint,'tracks');
    for(let i=0;i<4;i++)cyl('track cover fastener '+side+' '+i,[-a+(i+.5)*2*a/4,r*1.3,z+side*(width*.38+.05)],.025,.025,'#a0a193','z','tracks');
   }
   for(let i=0;i<n;i++){
    const [x,y,angle]=path((i+p.machineTrackPhase)*pitch);
    const g=new THREE.BoxGeometry(pitch*.87,.095,width);g.rotateZ(angle);g.translate(x,y,z);add(g,'track shoe '+side+' '+i,metal,'tracks');
    const grip=new THREE.BoxGeometry(pitch*.15,.045,width*1.04);grip.translate(0,.065,0);grip.rotateZ(angle);grip.translate(x,y,z);add(grip,'track grouser '+side+' '+i,rubber,'tracks');
   }
  }
 }
 function turntable(){cyl('slew bearing',[0,.13,0],.66,.26,metal,'y','chassis');cyl('rotating platform',[0,.32,0],.78,.14,paint,'y','chassis');}
 function machineCab(){
  const outline=[[-.72,.18],[-.78,.65],[-.56,1.72],[-.4,1.87],[.56,1.87],[.65,.18]];
  box('operator floor',[0,.1,0],[1.45,.2,1.12],metal,'cab');box('rounded cab roof',[.04,1.89,0],[1.36,.14,1.22],paint,'cab',.09);
  box('operator seat',[.25,.68,0],[.5,.16,.55],rubber,'cab');box('seat back',[.46,.96,0],[.12,.5,.55],rubber,'cab');
  for(const side of [-1,1]){
   const z=side*.54;
   if(side===-1){
    plate('cab lower side panel',[[.65,.18],[-.72,.18],[-.76,.55],[.63,.55]],.06,z,paint,'cab');
    plate('cab fixed side glazing',[[-.72,.65],[-.51,1.69],[-.37,1.79],[.5,1.79],[.56,.65]],.025,z,'#294248','cab');
   }
   for(let i=0;i<outline.length;i++)beam('cab perimeter frame '+side+' '+i,[...outline[i],z],[...outline[(i+1)%outline.length],z],.065,.065,metal,'cab');
  }
  beam('sloped front windshield',[-.75,.67,0],[-.55,1.7,0],.025,1.01,'#294248','cab');
  beam('front lower glass',[-.7,.24,0],[-.75,.58,0],.025,1.01,'#294248','cab');
  for(const y of [.62,1.73])box('front glass cross rail',[-.78+(y-.62)*.2,y,0],[.065,.065,1.12],metal,'cab');
  box('cab rear body panel',[.61,.4,0],[.06,.5,1.1],paint,'cab');beam('rear windshield',[.6,.68,0],[.55,1.75,0],.025,1.01,'#294248','cab');
  joint('cab-door',[.61,.18,.565],'y',p.machineDoorAngle,0,100,()=>{
   const door=[[-1.3,.04],[-1.35,.46],[-1.13,1.5],[-.99,1.64],[-.08,1.64],[-.02,.04]];
   plate('cab door glazing',door,.025,0,'#294248','cab');
   plate('cab door lower panel',[[-1.3,.04],[-1.34,.35],[-.03,.35],[-.02,.04]],.055,0,paint,'cab');
   for(let i=0;i<door.length;i++)beam('door frame '+i,[...door[i],0],[...door[(i+1)%door.length],0],.045,.06,metal,'cab');
   beam('door window divider',[-1.31,.52,0],[-.04,.52,0],.04,.055,metal,'cab');
   box('cab door handle',[-1.12,.64,.06],[.04,.18,.045],metal,'cab');
  });
  beam('windshield wiper',[-.79,.68,-.28],[-.65,1.32,.15],.018,.022,metal,'cab');
  for(const side of [-1,1]){
   box('joystick console '+side,[.04,.62,side*.36],[.35,.3,.14],metal,'cab');
   beam('control lever '+side,[-.07,.77,side*.36],[-.16,.94,side*.36],.025,.025,metal,'cab');
   box('cab work light '+side,[-.54,1.84,side*.4],[.13,.1,.16],'#d3c79f','cab');
  }
  box('cab entry step',[-.25,-.08,.69],[.72,.1,.26],metal,'cab');
  beam('entry grab rail',[-.7,.6,.65],[-.55,1.35,.65],.035,.035,metal,'cab');
 }
 function bucket(){
  const w=p.machineBucketWidth,outline=[[.1,.25],[.08,-.34],[-.25,-.63],[-.85,-.58],[-1.03,-.32],[-.53,.18]];
  for(const side of [-1,1]){
   const shape=new THREE.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
   const g=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false});g.translate(0,0,side*w/2-.0275);add(g,'bucket side cheek '+side,paint,'bucket');
   beam('bucket side cutting edge '+side,[-.53,.18,side*w/2],[-1.03,-.32,side*w/2],.075,.085,metal,'bucket');
   for(let i=0;i<3;i++)cyl('bucket side wear bolt '+side+' '+i,[-.35-i*.2,-.4,side*(w/2+.035)],.028,.025,metal,'z','bucket');
   plate('bucket mounting ear '+side,[[.12,.05],[.16,.34],[-.24,.34],[-.37,.12]],.065,side*w*.23,metal,'bucket');
  }
  const curve=[[.04,.23],[.02,-.3],[-.27,-.56],[-.84,-.51],[-1,-.31]];
  for(let i=0;i<curve.length-1;i++)beam('bucket scoop panel '+i,[...curve[i],0],[...curve[i+1],0],.07,w,paint,'bucket');
  box('bucket cutting lip',[-1,-.32,0],[.15,.1,w+.08],metal,'bucket',0);
  for(let i=0;i<p.machineBucketTeeth;i++)box('bucket tooth '+i,[-1.08,-.36,(i+.5)*w/p.machineBucketTeeth-w/2],[.3,.09,w/p.machineBucketTeeth*.5],metal,'bucket',0);
  cyl('bucket mounting pin',[0,.12,0],.1,w*.75,metal,'z','bucket');
 }
 function hook(drop=p.machineCable){
  pipe('lifting cable',[0,0,0],[0,-drop,0],.016,metal,'hook');
  box('hook pulley block',[0,-drop-.16,0],[.28,.3,.18],paint,'hook');
  const points=[];for(let i=0;i<=24;i++){const a=Math.PI*.25+i/24*Math.PI*1.6;points.push(new THREE.Vector3(.14*Math.cos(a),-drop-.43+.14*Math.sin(a),0));}
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.04,8,false),'load hook',metal,'hook');
 }
 function diggingBucket(){
  // Excavator teeth face back toward the machine; loader buckets face forward.
  const before=matrix;matrix=matrix.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  try{bucket();}finally{matrix=before;}
 }
 function articulated(withBucket=true){
  const L=p.machineBoomLength,S=p.machineStickLength,A=-p.machineBoomAngle,B=-p.machineStickAngle;
  const end=new THREE.Vector3(-L*.48,-.07,0).applyAxisAngle(new THREE.Vector3(0,0,1),rad(A));
  for(const side of [-1,1])hydraulic([.18,-.12,side*.23],[end.x,end.y,side*.23],'boom lift '+side);
  joint('boom',[0,0,0],'z',A,-85,15,()=>{
   plate('shaped main boom',[[.14,-.15],[-L*.22,-.19],[-L*.52,L*.075],[-L*.91,.17],[-L-.1,.1],[-L-.1,-.1],[-L*.92,-.17],[-L*.52,L*.075-.4],[-L*.22,-.48],[-.1,-.28]],.36,0,paint,'boom');
   cyl('boom heel pin',[0,0,0],.18,.56);
   for(const side of [-1,1]){
    pipe('boom hydraulic line '+side,[-.2,-.05,side*.21],[-L*.5,L*.075+.015,side*.21],.018,metal,'boom');
    pipe('boom hydraulic line end '+side,[-L*.5,L*.075+.015,side*.21],[-L*.93,.2,side*.21],.018,metal,'boom');
   }
   const stickAnchor=new THREE.Vector3(-S*.45,0,0).applyAxisAngle(new THREE.Vector3(0,0,1),rad(B)).add(new THREE.Vector3(-L,0,0));
   hydraulic([-L*.6,.25,0],stickAnchor.toArray(),'stick ram');
   joint('stick',[-L,0,0],'z',B,-30,150,()=>{
    plate('tapered outer arm',[[.22,.18],[-S*.3,.17],[-S,.1],[-S-.07,-.09],[-S*.3,-.24],[.14,-.2]],.28,0,paint,'boom');cyl('elbow pin',[0,0,0],.15,.48);
    const toolAnchor=new THREE.Vector3(.22,.28,0).applyAxisAngle(new THREE.Vector3(0,0,1),rad(p.machineToolAngle)).add(new THREE.Vector3(-S,0,0));
    if(withBucket){
     // Two equal-length links form the external bucket bell crank. Solve their
     // intersection so neither bar stretches as the bucket rotates.
     const fixed=new THREE.Vector3(-S+.32,.14,0),delta=toolAnchor.clone().sub(fixed),distance=delta.length();
     const linkLength=.48,mid=fixed.clone().add(toolAnchor).multiplyScalar(.5);
     const normal=new THREE.Vector3(-delta.y,delta.x,0).normalize();
     if(normal.y<0)normal.negate();
     const crank=mid.addScaledVector(normal,Math.sqrt(Math.max(0,linkLength*linkLength-distance*distance/4)));
     const cylinderBase=[.08,.43,0];
     for(const side of [-1,1]){
      plate('bucket cylinder mounting bracket '+side,[[-.08,.1],[.2,.1],[.17,.47],[-.02,.47]],.065,side*.14,paint,'boom');
      beam('bucket rocker link '+side,[fixed.x,fixed.y,side*.22],[crank.x,crank.y,side*.22],.095,.065,paint,'boom');
      beam('bucket connecting link '+side,[crank.x,crank.y,side*.22],[toolAnchor.x,toolAnchor.y,side*.22],.095,.065,paint,'boom');
     }
     hydraulic(cylinderBase,crank.toArray(),'external bucket curl');
     cyl('bucket rocker fixed pin',fixed.toArray(),.085,.58,metal);
     cyl('bucket rocker rod pin',crank.toArray(),.085,.58,metal);
     cyl('bucket linkage attachment pin',toolAnchor.toArray(),.08,.58,metal);
     pipe('bucket cylinder supply line',[.13,.2,-.2],[.13,.43,-.2],.02,metal,'boom');
    }
    if(withBucket)joint('bucket',[-S,0,0],'z',p.machineToolAngle,-120,120,diggingBucket);
   });
  });
 }
 function telescopic(withHook=true){
  const L=p.machineBoomLength,A=-p.machineBoomAngle,extension=p.machineExtension;
  const anchor=new THREE.Vector3(-L*.55,0,0).applyAxisAngle(new THREE.Vector3(0,0,1),rad(A));hydraulic([.25,-.45,0],anchor.toArray(),'crane lift');
  joint('crane-boom',[0,0,0],'z',A,-85,15,()=>{
   box('main telescope sleeve',[-L/2,0,0],[L,.4,.42],paint,'boom');
   box('sliding telescope section',[-L-extension/2+.25,0,0],[extension+.5,.28,.3],metal,'boom');
   cyl('boom hinge',[0,0,0],.19,.65);
   if(withHook)at([-L-extension,0,0],()=>{
    // Counter-rotate so the cable stays vertical as the boom elevates.
    joint('hanging-hook',[0,0,0],'z',-A,-15,85,()=>hook());
   });
  });
 }
 function stabilizers(){
  const span=p.machineOutriggerSpan,drop=p.machineOutriggerDrop;
  for(const x of [-.65,.65]){
   box('outrigger cross beam',[x,.7,0],[.18,.2,span],metal,'stabilizers');
   for(const side of [-1,1]){
    cyl('outrigger jack',[x,.7-drop/2,side*span/2],.085,drop,'#959f98','y','stabilizers');
    box('stabilizer foot',[x,.7-drop,side*span/2],[.42,.08,.42],metal,'stabilizers');
   }
  }
 }
 function tipper(){
  const L=p.machineTipLength,w=p.machineTipWidth,h=p.machineTipHeight;
  for(const z of [-.5,.5])box('tipper subframe',[0,.8,z],[L,.16,.13],metal,'chassis');
  const liftPoint=new THREE.Vector3(-L*.72,-.2,0).applyAxisAngle(new THREE.Vector3(0,0,1),-rad(p.machineTipAngle)).add(new THREE.Vector3(L/2,1,0));
  hydraulic([-L*.25,.65,0],liftPoint.toArray(),'tipper ram');
  joint('tipping-bed',[L/2,1,0],'z',-p.machineTipAngle,-55,0,()=>{
   box('tipper lift reinforcement',[-L*.72,-.1,0],[.5,.06,1.15],metal,'mechanism');
   for(const side of [-1,1])plate('tipper lift clevis '+side,[[-L*.72-.16,-.12],[-L*.72+.16,-.12],[-L*.72+.12,-.3],[-L*.72-.12,-.3]],.055,side*.11,metal,'mechanism');
   box('tipping deck',[-L/2,0,0],[L,.14,w],paint,'cargo');box('tipper headboard',[-L,h/2,0],[.1,h,w],paint,'cargo');
   for(const side of [-1,1]){
    box('tipper side wall '+side,[-L/2,h/2,side*w/2],[L,h,.1],paint,'cargo');
    for(let i=0;i<6;i++)box('tipper side rib '+side+' '+i,[-L+(i+.5)*L/6,h/2,side*(w/2+.07)],[.09,h,.06],metal,'cargo');
   }
   joint('tailgate',[0,h,0],'z',p.machineTailgateAngle,0,110,()=>box('tipper tailgate',[0,-h/2,0],[.1,h,w],paint,'cargo'));
  });
 }
 function coupling(){
  cyl('fifth wheel bearing',[0,.1,0],.45,.14,metal,'y','coupling');
  for(const side of [-1,1])box('coupling plate '+side,[0,.22,side*.2],[.9,.12,.32],metal,'coupling');
  cyl('kingpin',[0,-.08,0],.075,.24,'#979e99','y','coupling');
 }
 function trailer(){
  const L=p.machineTrailerLength,w=p.machineTrailerWidth,h=p.machineTrailerSides;
  box('trailer cargo deck',[0,1.3,0],[L,.16,w],paint,'cargo');
  for(const side of [-1,1]){
   box('trailer frame rail '+side,[0,1.08,side*.6],[L,.26,.15],metal,'chassis');
   if(h>0){box('trailer sideboard '+side,[0,1.4+h/2,side*w/2],[L,h,.07],paint,'cargo');for(let i=0;i<7;i++)box('sideboard brace '+side+' '+i,[-L/2+(i+.5)*L/7,1.4+h/2,side*(w/2+.04)],[.065,h,.06],metal,'cargo');}
   for(let i=0;i<p.machineTrailerAxles;i++){
    const x=L/2-.7-i*1.05;wheel(x,.49,side*(w/2-.18),.49,.32,'trailer '+side+' '+i);
    if(side===1)cyl('trailer axle '+i,[x,.49,0],.07,w-.2,metal);
    box('trailer axle saddle '+side+' '+i,[x,.57,side*.6],[.25,.16,.23],metal,'chassis');
    box('trailer suspension spring '+side+' '+i,[x,.68,side*.6],[.8,.08,.16],metal,'chassis');
    for(const offset of [-.32,.32])box('trailer suspension hanger '+side+' '+i+' '+offset,[x+offset,.82,side*.6],[.1,.28,.2],metal,'chassis');
   }
   box('landing leg '+side,[-L*.3,.64,side*.65],[.14,1.1,.14],metal,'landing');box('landing foot '+side,[-L*.3,.08,side*.65],[.4,.08,.35],metal,'landing');
  }
  at([-L*.4,1,0],coupling);
 }
 function cabOver(){
  const w=p.machineCabWidth,h=p.machineCabHeight;
  box('cab floor',[0,.85,0],[1.6,.18,w],metal,'cab');box('cab roof',[0,h,0],[1.7,.17,w],paint,'cab',.1);
  box('cab front body panel',[-.75,1.3,0],[.18,.8,w],paint,'cab');box('cab rear body panel',[.75,(h+.9)/2,0],[.12,h-.9,w],paint,'cab');
  box('wide windshield',[-.79,(h+1.7)/2,0],[.035,h-1.85,w-.22],'#294248','cab');
  for(const side of [-1,1]){
   beam('front pillar '+side,[-.78,1.65,side*(w/2-.04)],[-.7,h,side*(w/2-.04)],.09,.09,paint,'cab');
   joint('truck-door-'+side,[-.65,.95,side*w/2],'y',-side*p.machineDoorAngle,-100,100,()=>{
    box('truck door body panel',[.64,.35,0],[1.28,.7,.085],paint,'cab');box('truck door window',[.64,(h-.95+.75)/2,0],[1.1,h-1.85,.035],'#294248','cab');
    box('truck door window beltline',[.64,.74,0],[1.28,.12,.085],paint,'cab');
    for(const x of [.075,1.205])box('truck door window upright',[x,(h-.95+.7)/2,0],[.065,h-1.65,.07],paint,'cab');
    box('truck door window top rail',[.64,h-1.025,0],[1.2,.065,.07],paint,'cab');
    box('truck door handle',[1.05,.75,side*.06],[.15,.05,.04],metal,'cab');
   });
   box('cab entry step '+side,[.2,.55,side*(w/2-.05)],[.8,.12,.4],metal,'cab');
   box('cab headlamp '+side,[-.86,1.12,side*w*.34],[.04,.2,.32],'#d3c79f','cab');
  }
  box('cab bumper',[-.88,.79,0],[.2,.22,w+.1],metal,'cab');
  for(let i=0;i<5;i++)box('cab grille slat '+i,[-.86,1.28+i*.07,0],[.04,.025,w*.5],metal,'cab');
 }
 function tractor(){
  const rear=p.tractorRearRadius,front=p.tractorFrontRadius,wb=p.tractorWheelbase,rearX=wb*.38,frontX=rearX-wb;
  const deck=rear+.25,hoodTop=deck+.65;
  box('tractor chassis',[rearX-wb*.48,deck-.18,0],[wb+.5,.28,.65],metal,'chassis');
  for(const [x,r,width,gauge,label] of [[rearX,rear,.42,1.55,'rear'],[frontX,front,.25,1.4,'front']]){
   cyl('tractor '+label+' axle',[x,r,0],.1,gauge,metal);
   for(const side of [-1,1]){
    const z=side*gauge/2;wheel(x,r,z,r,width,'tractor '+label+' '+side);
    for(let i=0;i<20;i++)for(const half of [-1,1]){
     const a=i*Math.PI/10;
     const g=new THREE.BoxGeometry(.075,.07,width*.65);g.rotateY(half*.55);g.translate(0,r+.01,half*width*.2);g.rotateZ(a);g.translate(x,r,z);
     add(g,'tractor chevron tread '+label+' '+side+' '+i+' '+half,rubber,'wheels');
    }
   }
  }
  box('tractor engine block',[frontX+.65,deck-.03,0],[1,.5,.64],metal,'body');
  box('tractor bonnet body panel',[frontX+.58,hoodTop-.22,0],[1.5,.47,.78],paint,'body',.1);
  box('tractor radiator surround',[frontX-.2,hoodTop-.27,0],[.12,.68,.8],paint,'body',.06);
  box('tractor radiator grille',[frontX-.27,hoodTop-.27,0],[.025,.53,.64],metal,'body');
  for(let i=0;i<10;i++)box('tractor grille bar '+i,[frontX-.29,hoodTop-.5+i*.05,0],[.025,.018,.61],'#969b91','body');
  for(const side of [-1,1]){
   cyl('tractor headlight '+side,[frontX-.3,hoodTop-.16,side*.28],.095,.06,'#d3c79f','x','body');
   box('bonnet side trim '+side,[frontX+.55,hoodTop-.19,side*.398],[1.18,.07,.025],'#b7b3a0','body');
   for(let i=0;i<4;i++)cyl('engine casing bolt '+side+' '+i,[frontX+.28+i*.19,deck-.03,side*.34],.035,.035,'#92988e','z','body');
   box('rear wheel wing '+side,[rearX,2*rear+.17,side*.77],[rear*1.9,.09,.53],paint,'body',.045);
   plate('rear fender inner plate '+side,[[rearX-rear*.9,deck],[rearX-rear*.9,2*rear+.16],[rearX+rear*.9,2*rear+.16],[rearX+rear*.9,deck]],.055,side*.51,paint,'body');
   box('tractor step '+side,[rearX-.55,deck-.35,side*.6],[.5,.09,.35],metal,'cab');
   box('tractor rear lamp '+side,[rearX+rear*.91,2*rear+.12,side*.77],[.05,.08,.13],'#8c3026','body');
  }
  cyl('tractor exhaust pipe',[frontX+.55,hoodTop+.45,-.26],.045,1,metal,'y','body');
  cyl('tractor exhaust silencer',[frontX+.55,hoodTop+.2,-.26],.075,.48,metal,'y','body');
  cyl('tractor air intake',[frontX+.25,hoodTop+.17,.25],.065,.42,metal,'y','body');
  cyl('tractor intake cap',[frontX+.25,hoodTop+.4,.25],.1,.055,metal,'y','body');
  if(p.tractorCab)at([rearX-.12,deck,0],()=>{
   // Fit the cab between the rear fenders; preserve its longitudinal layout.
   const before=matrix;matrix=matrix.clone().multiply(new THREE.Matrix4().makeScale(1,1,.8));
   try{machineCab();}finally{matrix=before;}
  });
  else {
   box('tractor operator platform',[rearX-.12,deck,0],[1.35,.1,.92],metal,'cab');
   box('tractor seat',[rearX+.12,deck+.32,0],[.5,.13,.52],rubber,'cab');
   box('tractor seat back',[rearX+.35,deck+.55,0],[.11,.42,.52],rubber,'cab',.07);
   beam('tractor gear lever',[rearX-.22,deck,.24],[rearX-.32,deck+.43,.24],.025,.025,metal,'cab');
  }
  const steering=[rearX-.53,deck+.66,0];
  beam('tractor steering column',[rearX-.65,deck+.12,0],steering,.04,.04,metal,'cab');
  const ring=new THREE.TorusGeometry(.19,.022,8,24);ring.rotateY(Math.PI/2);ring.rotateZ(-.25);ring.translate(...steering);add(ring,'tractor steering wheel',rubber,'cab');
  for(const side of [-1,1])beam('rear hitch arm '+side,[rearX+.2,deck-.28,side*.24],[rearX+.85,deck-.42,side*.3],.07,.07,metal,'coupling');
  cyl('tractor hitch pin',[rearX+.85,deck-.42,0],.045,.72,metal,'z','coupling');
  if(p.tractorLoader){
   // Keep the towers ahead of the rear tyre envelope, including tread and pins.
   const origin=[rearX-rear-.35,deck+.24,0],L=wb+.6-rear,A=-p.tractorLoaderAngle,w=p.tractorBucketWidth;
   at(origin,()=>{
    for(const side of [-1,1]){
     box('loader mounting tower '+side,[0,-.1,side*.62],[.22,.85,.18],metal,'boom');
     const rod=new THREE.Vector3(-L*.53,-.08,side*.62).applyAxisAngle(new THREE.Vector3(0,0,1),rad(A));
     hydraulic([.05,-.43,side*.62],rod.toArray(),'tractor loader lift '+side);
    }
    joint('tractor-loader',[0,0,0],'z',A,-65,10,()=>{
     for(const side of [-1,1])plate('loader lifting arm '+side,[[.12,.12],[-L*.55,.16],[-L,.07],[-L,-.12],[-L*.55,-.1],[.12,-.14]],.14,side*.62,paint,'boom');
     box('loader cross brace',[-L*.7,0,0],[.16,.16,1.38],metal,'boom');
     const tilt=p.tractorBucketAngle-A;
     const tip=new THREE.Vector3(-.1,.27,0).applyAxisAngle(new THREE.Vector3(0,0,1),rad(tilt)).add(new THREE.Vector3(-L,0,0));
     box('loader curl cylinder crossmember',[-L*.6,.02,0],[.2,.16,1.38],metal,'boom');
     for(const side of [-1,1])plate('loader curl base clevis '+side,[[-L*.6-.14,.08],[-L*.6+.14,.08],[-L*.6+.12,.31],[-L*.6-.12,.31]],.055,side*.11,metal,'boom');
     hydraulic([-L*.6,.22,0],tip.toArray(),'loader bucket curl');
     joint('tractor-loader-bucket',[-L,0,0],'z',tilt,-70,135,()=>{
      for(const side of [-1,1])plate('loader bucket curl clevis '+side,[[.08,.08],[.08,.32],[-.16,.36],[-.2,.18]],.055,side*.11,metal,'bucket');
      const profile=[[.12,.28],[.12,-.38],[-.83,-.38],[-1,-.22],[-.28,.28]];
      for(const side of [-1,1])plate('loader bucket side '+side,profile,.065,side*w/2,paint,'bucket');
      box('loader bucket back',[.08,-.05,0],[.08,.66,w],paint,'bucket');
      box('loader bucket floor',[-.36,-.37,0],[.95,.075,w],paint,'bucket');
      beam('loader bucket sloped lip',[-.83,-.37,0],[-1,-.22,0],.07,w,paint,'bucket');
      box('loader bucket cutting edge',[-1,-.22,0],[.15,.075,w+.08],metal,'bucket',0);
      cyl('loader bucket pivot',[0,.12,0],.08,1.4,metal,'z','bucket');
     });
    });
   });
  }
 }
 if(type==='vehicleTractor')tractor();
 else if(type==='vehicleTracks')tracks();
 else if(type==='vehicleExcavator'||type==='vehicleTrackedCarrier'){
  const wheeled=type==='vehicleExcavator'&&p.machineWheeled;
  if(wheeled){
   const r=p.machineWheelRadius,gauge=p.machineTrackGauge,spacing=Math.max(1.4,p.machineTrackLength*.62);
   box('wheeled undercarriage',[0,r+.22,0],[spacing+.4,.35,gauge*.68],metal,'chassis');
   for(const x of [-spacing/2,spacing/2]){
    cyl('excavator axle',[x,r,0],.1,gauge,metal);
    for(const side of [-1,1]){
     const z=side*gauge/2;wheel(x,r,z,r,.38,'excavator wheel '+x+' '+side);
     for(let i=0;i<18;i++){const a=i*Math.PI/9;const g=new THREE.BoxGeometry(.12,.08,.4);g.rotateZ(a);g.translate(x-Math.sin(a)*r,r+Math.cos(a)*r,z);add(g,'excavator tyre tread '+i,rubber,'wheels');}
     box('wheel mudguard',[x,2*r+.15,z],[r*2.15,.09,.5],paint,'body');
    }
   }
  }else tracks();
  const base=2*(wheeled?p.machineWheelRadius:p.machineTrackRadius)+.12;at([0,base,0],()=>{
   turntable();joint('slew',[0,.4,0],'y',p.machineYaw,-180,180,()=>{
    box('upper body platform',[0,.05,0],[2.5,.25,1.7],metal,'chassis');
    box('rear counterweight',[.8,.5,0],[1.1,.8,1.7],paint,'body',.14);
    for(let i=0;i<7;i++)box('engine ventilation slat '+i,[.48+i*.11,.6,-.86],[.045,.32,.035],metal,'body');
    cyl('engine exhaust',[1.05,1.02,-.5],.055,.55,metal,'y','body');
    if(type==='vehicleExcavator'){at([-.45,.16,.48],machineCab);at([-.85,.45,-.45],articulated);}
    else {at([-.45,.15,0],machineCab);box('utility cargo body panel',[.8,1,0],[.9,.2,1.5],paint,'cargo');}
   });
  });
 }else if(type==='vehicleCrane'){stabilizers();at([0,.8,0],()=>{turntable();joint('slew',[0,.4,0],'y',p.machineYaw,-180,180,()=>{box('crane pedestal',[0,.45,0],[.65,.9,.65],paint);at([0,.95,0],telescopic);});});}
 else if(type==='vehicleBoom')joint('slew',[0,0,0],'y',p.machineYaw,-180,180,()=>articulated(false));
 else if(type==='vehicleTelescopicBoom')joint('slew',[0,0,0],'y',p.machineYaw,-180,180,()=>telescopic(false));
 else if(type==='vehicleBucket')joint('bucket',[0,0,0],'z',p.machineToolAngle,-120,120,diggingBucket);
 else if(type==='vehicleHook')hook();
 else if(type==='vehicleStabilizers')stabilizers();
 else if(type==='vehicleTipper')tipper();
 else if(type==='vehicleTrailer')trailer();
 else if(type==='vehicleCoupling')coupling();
 else if(type==='vehicleCabOver')cabOver();
 else if(type==='vehicleMachineCab')machineCab();
 else if(type==='vehicleTurntable')joint('slew',[0,0,0],'y',p.machineYaw,-180,180,turntable);
 else if(type==='vehicleHydraulic'){
  pipe('hydraulic barrel',[0,0,0],[0,p.machineCylinderLength,0],.1);pipe('hydraulic piston',[0,p.machineCylinderLength,0],[0,p.machineCylinderLength+p.machineCylinderStroke,0],.055,'#b0b8ae');
  cyl('base eye',[0,0,0],.14,.2);cyl('rod eye',[0,p.machineCylinderLength+p.machineCylinderStroke,0],.11,.18);
 }else if(type==='vehicleWheelAxle'){
  cyl('axle',[0,p.machineWheelRadius,0],.085,p.machineAxleWidth,metal);for(const side of [-1,1])wheel(0,p.machineWheelRadius,side*p.machineAxleWidth/2,p.machineWheelRadius,.3,'axle wheel '+side);
 }
 return count;
}
