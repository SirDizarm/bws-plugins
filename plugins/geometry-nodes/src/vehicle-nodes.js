import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {VEHICLE_THEME_FIELDS} from './vehicle-theme.js';
import {MACHINERY_NODES,buildMachineryNode} from './machinery-nodes.js';
import {VEHICLE_DAMAGE_FIELDS} from './vehicle-damage.js';

const fields={
 ...VEHICLE_THEME_FIELDS,
 ...VEHICLE_DAMAGE_FIELDS,
 vehicleThemeOverride:['Override connected theme',false],
 vehicleBody:['Cargo body','wood',['wood','flatbed','box','logs']],
 vehicleRearAxles:['Rear axle count',1,1,3,1],vehicleCargoHeight:['Cargo height',2,.8,3,.1],
 vehicleLogRows:['Log layers',4,1,6,1],vehicleStacks:['Exhaust stacks',false],
 vehicleForkLift:['Fork height',.12,.12,2.2,.05],vehicleForkSpread:['Fork spacing',.65,.35,1.1,.05],
 vehicleForkLength:['Fork length',1.3,.8,2,.1],
 vehicleWheelbase:['Wheelbase',3.4,2.6,4.8,.1],vehicleWidth:['Body width',2.3,1.8,2.8,.05],
 vehicleCabHeight:['Cab height',2.55,2.2,3.1,.05],vehicleBedLength:['Bed length',3.1,2.2,4.5,.1],
 vehicleBedSides:['Bed side height',.65,.2,1.2,.05],vehicleWheelRadius:['Tyre radius',.5,.38,.62,.02],
 vehicleSeats:['Seats','two',["none","driver","two","bench"]],
 vehicleDrivingSide:['Steering side','left',["left","right","none"]],
 vehicleSeatColor:['Seat upholstery','#51483e'],vehicleShowHood:['Show hood panels',true],vehicleShowRoof:['Show cab roof',true],vehicleShowGlass:['Show window glass',true],
 vehicleTyreWidth:['Tyre width',.3,.22,.42,.02],vehiclePaint:['Paint','#74888a'],
 vehicleWood:['Bed wood','#796049'],vehicleMetal:['Chassis','#34393c'],vehicleRubber:['Rubber','#252728']
};
export const VEHICLE_NODES=Object.freeze({...MACHINERY_NODES,...Object.fromEntries([
 ['vehicleCargoTruck','Cargo Truck'],['vehicleCab','Truck Cab'],['vehicleChassis','Truck Chassis'],
 ['vehicleWheels','Truck Wheel Set'],['vehicleCargoBed','Cargo Bed'],['vehicleInterior','Cab Interior'],['vehicleEngine','Engine'],
 ['vehicleBoxBody','Box Cargo Body'],['vehicleLogRack','Logging Body'],['vehicleExhaust','Exhaust Stacks'],['vehicleForklift','Forklift']
].map(([id,title])=>[id,{title,category:'Vehicles',inputSockets:['Seed','Texture','Theme'],fields:Object.fromEntries(
 Object.entries(fields).filter(([key])=>id==='vehicleForklift'||!key.startsWith('vehicleFork'))
)}]))});

// Metres, Y up, forward -X. All component nodes use the same assembly origin.
export function buildVehicleNode(type,p,{seed=1,emit}){
 if(MACHINERY_NODES[type])return buildMachineryNode(type,p,{seed,emit});
 const forklift=type==='vehicleForklift';
 const wb=forklift?1.65:p.vehicleWheelbase,w=forklift?1.45:p.vehicleWidth,r=forklift?.36:p.vehicleWheelRadius,tw=p.vehicleTyreWidth;
 const recessedBed=['wood','flatbed'].includes(p.vehicleBody)&&!['vehicleBoxBody','vehicleLogRack'].includes(type);
 const front=-wb/2,rear=wb/2,track=w/2-.08,deck=recessedBed?r+.40:2*r+.38,cabBack=front+1.48;
 const roof=p.vehicleCabHeight,bedL=p.vehicleBedLength,bedX=cabBack+.08+bedL/2;
 const paint=p.vehiclePaint,metal=p.vehicleMetal,wood=p.vehicleWood,rubber=p.vehicleRubber;
 const axleCount=forklift?1:Math.round(p.vehicleRearAxles),spacing=2*r+.22;
 const rearCenter=forklift?rear:Math.min(rear,cabBack+.08+bedL-.25-r-(axleCount-1)*spacing/2);
 const axles=[['front',front],...Array.from({length:axleCount},(_,i)=>['rear '+(i+1),rearCenter+(i-(axleCount-1)/2)*spacing])];
 const wooden=p.vehicleBody==='wood'&&!['vehicleBoxBody','vehicleLogRack'].includes(type);
 let count=0,state=(seed>>>0)||1;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const tint=(c,a=.08)=>'#'+new THREE.Color(c).multiplyScalar(1+(random()-.5)*a).getHexString();
 function add(g,name,pos,color,roughness=.8){
  const condition=p.themeCondition||'clean',wear=p.themeWear??.45;
  const panel=/panel|hood|cargo wall|counterweight|bed side plank|tailgate|headboard/.test(name);
  if(condition==='broken'&&/glass|bed side plank|tailgate/.test(name)&&random()<wear*.45){g.dispose();return;}
  if(condition==='broken'&&panel){
   const a=g.attributes.position;
   for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);a.setZ(i,z+Math.sin(x*7+y*5)*.025*wear);}
   a.needsUpdate=true;g.computeVertexNormals();
  }
  if(condition!=='clean'&&!/glass|lens|tyre|rubber|seat|steering wheel/.test(name)){
   const c=new THREE.Color(color);
   if((condition==='rusty'||condition==='broken')&&panel)c.lerp(new THREE.Color('#855138'),wear*(.2+random()*.65));
   else c.multiplyScalar(1-wear*(.08+random()*.16));
   color='#'+c.getHexString();roughness=Math.max(roughness,.9);
  }
  emit(g,name,pos,color,roughness);count++;
 }
 function box(name,pos,size,color,round=0){
  const rounding=p.themeShape==='square'||p.themeShape==='futuristic'?0:p.themeShape==='round'?Math.max(round,Math.min(...size)*.22):round;
  const radius=Math.min(rounding,...size.map(n=>n/2-.001));
  add(radius>0?new RoundedBoxGeometry(...size,3,radius):new THREE.BoxGeometry(...size),name,pos,color);
 }
 function cylinder(name,pos,radius,length,color){const g=new THREE.CylinderGeometry(radius,radius,length,24);g.rotateX(Math.PI/2);add(g,name,pos,color,.65);}
 function beam(name,a,b,width,color){const delta=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const g=new THREE.CylinderGeometry(width,width,delta.length(),10);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));
  add(g,name,a.map((v,i)=>(v+b[i])/2),color);
 }
 function fender(x,z,label){
  const inner=r+.12,outer=inner+.105,shape=new THREE.Shape();
  if(axleCount>1&&label.startsWith('rear ')){
   // Trim only the ends of adjacent arches; keep the tyre clearance circular.
   const limit=spacing/2-.04;
   let points=[];
   for(let i=0;i<=48;i++){const a=i*Math.PI/48;points.push([Math.cos(a)*outer,Math.sin(a)*outer]);}
   for(let i=48;i>=0;i--){const a=i*Math.PI/48;points.push([Math.cos(a)*inner,Math.sin(a)*inner]);}
   for(const sign of [-1,1]){
    const clipped=[];
    for(let i=0;i<points.length;i++){
     const a=points[i],b=points[(i+1)%points.length],insideA=sign*a[0]<=limit,insideB=sign*b[0]<=limit;
     if(insideA)clipped.push(a);
     if(insideA!==insideB){const t=(sign*limit-a[0])/(b[0]-a[0]);clipped.push([sign*limit,a[1]+t*(b[1]-a[1])]);}
    }
    points=clipped;
   }
   shape.moveTo(...points[0]);for(const point of points.slice(1))shape.lineTo(...point);shape.closePath();
  }else{
   shape.absarc(0,0,outer,0,Math.PI,false);shape.lineTo(-inner,0);shape.absarc(0,0,inner,Math.PI,0,true);shape.closePath();
  }
  const depth=tw+.18,g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:24,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2});
  g.translate(0,0,-depth/2);add(g,label,[x,r,z],paint);
 }
 function cab(){
  const cabFront=front+.17,cabLen=cabBack-cabFront,center=(cabFront+cabBack)/2,base=r+.25,waist=roof*.61;
  // Cut the side panels around the outside of the fender, including its bevel.
  function archPanel(name,left,right,bottom,top,z,depth,color){
   const clearance=r+.225+.018+.025;
   if(top<=r)return;
   const start=Math.max(left,front+Math.sqrt(Math.max(0,clearance*clearance-(top-r)*(top-r))));
   if(start>=right)return;
   const lower=x=>Math.max(bottom,r+Math.sqrt(Math.max(0,clearance*clearance-(x-front)*(x-front))));
   const shape=new THREE.Shape();
   shape.moveTo(start,top);shape.lineTo(right,top);
   for(let i=48;i>=0;i--){const x=start+(right-start)*i/48;shape.lineTo(x,Math.min(top,lower(x)));}
   shape.closePath();
   const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false});
   geometry.translate(0,0,-depth/2);add(geometry,name,[0,0,z],color);
  }
  box('cab floor',[center,base,0],[cabLen,.13,w*.89],metal,.035);
  box('cab front cowl panel',[cabFront-.015,(base+waist)/2,0],[.12,waist-base,w*.91],paint,.025);
  box('cab rear panel',[cabBack-.055,(roof+base)/2,0],[.12,roof-base,w*.9],paint,.055);
  if(p.vehicleShowRoof)box('rounded cab roof',[center,roof-.08,0],[cabLen+.07,.22,w*.96],paint,.10);
  box('dashboard',[cabFront+.2,waist,0],[.32,.18,w*.81],metal,.035);
  for(const side of [-1,1]){
   const z=side*w*.45;
   archPanel('door lower panel '+side,cabFront+.05,cabBack-.05,base,waist,z,.085,paint);
   archPanel('door sill '+side,cabFront,cabBack,base-.01,base+.08,z,.13,metal);
   for(const x of [cabFront+.06,cabBack-.15])box('window pillar '+side+' '+x,[x,(waist+roof-.16)/2,z],[.095,roof-.16-waist,.11],paint,.025);
   if(p.vehicleShowGlass)box('side window glass '+side,[center-.04,(waist+roof-.20)/2,z-side*.026],[cabLen-.30,roof-.20-waist,.025],'#263b43',.01);
   box('window sill '+side,[center,waist,z],[cabLen-.12,.065,.11],metal,.015);
   box('door handle '+side,[cabBack-.3,waist-.15,z+side*.07],[.17,.045,.045],'#b2b0a6',.015);
   archPanel('running board '+side,cabFront-.11,cabBack+.11,base-.225,base-.135,z,.35,metal);
   beam('mirror arm '+side,[cabFront+.1,waist+.24,z],[cabFront-.03,waist+.32,z+side*.28],.022,metal);
   box('mirror housing '+side,[cabFront-.03,waist+.38,z+side*.30],[.08,.22,.14],metal,.035);
   box('mirror face '+side,[cabFront+.016,waist+.38,z+side*.30],[.012,.17,.10],'#a2b8bc',.015);
  }
  if(p.vehicleShowGlass)for(const side of [-1,1])box('windshield '+side,[cabFront-.025,(waist+roof-.2)/2,side*w*.215],[.035,roof-.20-waist,w*.40],'#263b43',.014);
  box('windshield divider',[cabFront-.05,(waist+roof-.13)/2,0],[.085,roof-.13-waist,.055],paint,.02);
  box('windshield lower frame',[cabFront-.055,waist,0],[.09,.09,w*.91],paint,.025);
  const nose=front-.87,hoodLength=cabFront-nose;
  if(p.vehicleShowHood){
   const angular=p.themeShape==='square'||p.themeShape==='futuristic';
   const hood=angular?new THREE.BoxGeometry(hoodLength,.48,w*.65):new RoundedBoxGeometry(hoodLength,.48,w*.65,5,.18),hp=hood.attributes.position;
   for(let i=0;i<hp.count;i++){
    const t=(hp.getX(i)+hoodLength/2)/hoodLength;
    hp.setZ(i,hp.getZ(i)*(p.themeShape==='futuristic'?.70+.30*t:.90+.10*t));hp.setY(i,hp.getY(i)-(p.themeShape==='futuristic'?.18:.07)*(1-t));
   }
   hood.computeVertexNormals();add(hood,'tapered rounded hood',[(nose+cabFront)/2,r+.94,0],paint);
   const seam=new THREE.BoxGeometry(hoodLength-(angular?.18:.40),.012,.018),sp=seam.attributes.position;
   for(let i=0;i<sp.count;i++){
    const t=(sp.getX(i)+hoodLength/2)/hoodLength;
    sp.setY(i,sp.getY(i)-(p.themeShape==='futuristic'?.18:.07)*(1-t));
   }
   seam.computeVertexNormals();add(seam,'hood center seam',[(nose+cabFront)/2,r+1.184,0],metal);
   for(const side of [-1,1]){
    box('hood lower side panel '+side,[(nose+cabFront)/2,r+.46,side*(w*.325-.032)],
     [hoodLength-.035,.55,.065],paint,.022);
    for(let vent=0;vent<6;vent++)box('hood side vent '+side+' '+vent,
     [nose+.19+vent*(hoodLength-.34)/6,r+.56,side*(w*.325+.004)],
     [.018,.16,.008],metal,.003);
   }
  }
  box('engine bay firewall',[cabFront+.035,r+.55,0],[.08,.90,w*.65],metal,.025);
  box('radiator surround',[nose+.06,r+.61,0],[.18,.81,w*.65],paint,.075);
  box('radiator recess',[nose-.04,r+.59,0],[.026,.62,w*.52],'#171b1c',.025);
  for(let i=0;i<9;i++)box('grille slat '+i,[nose-.063,r+.32+i*.065,0],[.035,.022,w*.5],'#93958d',.006);
  for(const side of [-1,1])beam('bumper frame bracket '+side,[front-.60,r*.92,side*.48],[nose-.16,r*.62,side*.48],.055,metal);
  box('front bumper',[nose-.20,r*.62,0],[.16,.17,w*.98],metal,.065);
  for(const side of [-1,1]){
   fender(front,side*track,'front fender '+side);
   const g=new THREE.CylinderGeometry(.115,.115,.10,24);g.rotateZ(Math.PI/2);
   add(g,'headlamp housing '+side,[nose+.04,r+.86,side*w*.37],metal,.5);
   const lens=new THREE.CylinderGeometry(.091,.091,.015,24);lens.rotateZ(Math.PI/2);
   add(lens,'headlamp lens '+side,[nose-.018,r+.86,side*w*.37],'#ded5ac',.3);
  }
 }
 function interior(){
  const floor=r+.315,seatX=cabBack-.48,seatY=floor+.24;
  const upholstery=p.vehicleSeatColor,driverSide=p.vehicleDrivingSide==='right'?-1:1;
  const halfSeat=Math.min(.46,w*.22),seatWidth=Math.min(.65,w*.30);
  function seat(z,width,label){
   box(label+' pedestal',[seatX,floor+.10,z],[.43,.20,width*.70],metal,.025);
   box(label+' cushion',[seatX,seatY,z],[.57,.16,width],upholstery,.07);
   box(label+' backrest',[seatX+.25,seatY+.37,z],[.15,.65,width],upholstery,.07);
   box(label+' headrest',[seatX+.25,seatY+.78,z],[.14,.22,width*.65],upholstery,.06);
   for(const side of [-1,1])box(label+' seat rail '+side,[seatX,floor+.015,z+side*width*.32],[.65,.028,.035],metal,.008);
  }
  if(p.vehicleSeats==='bench')seat(0,w*.76,'bench seat');
  else if(p.vehicleSeats!=='none'){
   seat(driverSide*halfSeat,seatWidth,'driver seat');
   if(p.vehicleSeats==='two')seat(-driverSide*halfSeat,seatWidth,'passenger seat');
  }
  if(p.vehicleDrivingSide!=='none'){
   const z=driverSide*halfSeat,waist=roof*.61;
   const center=new THREE.Vector3(front+.65,waist-.07,z);
   const normal=new THREE.Vector3(-.92,.39,0).normalize();
   const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
   beam('steering column',[front+.37,waist-.24,z],center.toArray(),.033,metal);
   const rim=new THREE.TorusGeometry(.185,.024,10,32);rim.applyQuaternion(rotation);
   add(rim,'steering wheel rim',center.toArray(),rubber,.9);
   const hub=new THREE.CylinderGeometry(.055,.055,.05,16);
   hub.rotateX(Math.PI/2);hub.applyQuaternion(rotation);add(hub,'steering wheel hub',center.toArray(),metal);
   for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,tip=new THREE.Vector3(Math.cos(a)*.168,Math.sin(a)*.168,0).applyQuaternion(rotation).add(center);
    beam('steering wheel spoke '+i,center.toArray(),tip.toArray(),.014,metal);
   }
   for(const [name,dz,width]of [['brake',-.075,.07],['accelerator',.075,.045]])
    box(name+' pedal',[front+.40,floor+.085,z+dz],[.12,.045,width],rubber,.01);
   box('instrument panel',[front+.37,waist+.035,z],[.035,.17,.35],metal,.025);
   for(const offset of [-.09,.09]){
    const gauge=new THREE.CylinderGeometry(.051,.051,.008,20);gauge.rotateZ(Math.PI/2);
    add(gauge,'dashboard gauge '+offset,[front+.392,waist+.035,z+offset],'#c3c1ad',.6);
   }
   beam('gear lever',[seatX-.25,floor,0],[seatX-.32,floor+.35,0],.018,metal);
   add(new THREE.SphereGeometry(.043,12,8),'gear knob',[seatX-.32,floor+.35,0],rubber);
  }
 }
 function engine(){
  const nose=front-.87,cabFront=front+.17,length=(cabFront-nose)*.70;
  const x=(nose+cabFront)/2,y=r+.36;
  box('engine block',[x,y,0],[length,.38,.40],'#465958',.045);
  box('engine sump',[x,y-.25,0],[length*.88,.16,.34],metal,.035);
  box('cylinder head',[x,y+.23,0],[length*.98,.12,.43],'#93968d',.022);
  box('valve cover',[x,y+.33,0],[length*.86,.10,.28],metal,.04);
  for(const side of [-1,1]){
   box('engine mount '+side,[x,y-.05,side*.40],[.24,.10,.43],metal,.015);
   box('rubber engine mounting pad '+side,[x,r*.92+.13,side*.48],[.18,.07,.15],rubber,.012);
  }
  for(let i=0;i<4;i++){
   const px=x-length*.35+length*.70*i/3;
   beam('exhaust branch '+i,[px,y+.15,.20],[px,y+.04,.33],.028,'#786953');
   beam('intake branch '+i,[px,y+.15,-.20],[px,y+.23,-.32],.025,'#8e9188');
  }
  beam('exhaust collector',[x-length*.4,y+.04,.33],[x+length*.5,y+.04,.33],.045,'#786953');
  beam('exhaust downpipe',[x+length*.5,y+.04,.33],[cabFront+.12,r*.62,.35],.038,'#786953');
  beam('intake plenum',[x-length*.35,y+.23,-.32],[x+length*.35,y+.23,-.32],.05,'#8e9188');
  box('air filter box',[x+length*.18,y+.32,-.37],[.25,.17,.20],metal,.025);
  const pulley=new THREE.CylinderGeometry(.105,.105,.055,24);pulley.rotateZ(Math.PI/2);
  add(pulley,'crank pulley',[x-length/2-.035,y-.04,0],metal);
  const fan=new THREE.CylinderGeometry(.045,.045,.10,16);fan.rotateZ(Math.PI/2);
  add(fan,'cooling fan hub',[nose+.21,y+.06,0],metal);
  for(let i=0;i<4;i++){
   const blade=new THREE.BoxGeometry(.025,.26,.06);blade.translate(0,.13,0);blade.rotateX(i*Math.PI/2);
   add(blade,'cooling fan blade '+i,[nose+.21,y+.06,0],'#898d80');
  }
  box('radiator core',[nose+.15,r+.60,0],[.08,.62,w*.49],'#303b3d',.015);
  beam('radiator hose',[nose+.20,r+.84,-.16],[x-length*.2,y+.22,-.18],.03,rubber);
 }
 function chassis(){
  const start=front-.73,end=cabBack+bedL;
  for(const side of [-1,1])box('chassis rail '+side,[(start+end)/2,r*.92,side*.48],[end-start,.20,.12],metal,.025);
  for(let i=0;i<6;i++)box('crossmember '+i,[start+(end-start)*(i+.5)/6,r*.92,0],[.10,.14,1.04],metal,.015);
  for(const [axle,x]of axles){
   cylinder(axle+' axle',[x,r,0],.085,track*2,metal);
   box(axle+' differential',[x,r,0],[.28,.25,.30],metal,.10);
   for(const side of [-1,1])for(let layer=0;layer<3;layer++)box(axle+' leaf spring '+side+' '+layer,[x,r+.13+layer*.027,side*.48],[.74-layer*.13,.024,.075],metal,.008);
  }
  beam('drive shaft',[front+.5,r,0],[rear,r,0],.06,metal);
  box('fuel tank',[cabBack+.28,r+.05,-.8],[.6,.38,.36],metal,.09);
 }
 function bed(){
  // Low decks are segmented around the wheel housings, never through the tyres.
  const housingRadius=r+.12+.105+.02,housingDepth=tw+.18+.04;
  function clearSpans(y,z,halfWidth){
   let spans=[[bedX-bedL/2,bedX+bedL/2]];
   if(!recessedBed||Math.abs(Math.abs(z)-track)>housingDepth/2+halfWidth)return spans;
   const rise=Math.max(0,y-r);
   if(rise>=housingRadius)return spans;
   const reach=Math.sqrt(housingRadius*housingRadius-rise*rise)+.015;
   for(const [,x]of axles.slice(1))spans=spans.flatMap(([a,b])=>{
    const lo=x-reach,hi=x+reach;
    if(hi<=a||lo>=b)return [[a,b]];
    return [[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([start,end])=>end-start>.015);
   });
   return spans;
  }
  function bedBoard(name,y,z,height,width,color){
   for(const [a,b]of clearSpans(y-height/2,z,width/2))box(name+' '+a,[(a+b)/2,y,z],[b-a,height,width],color,.008);
  }
  const railTop=r*.92+.10,bedBottom=deck-.0425;
  const supportTop=bedBottom-.10;
  for(const x of [bedX-bedL*.40,bedX,bedX+bedL*.40]){
   box('bed cross bearer '+x,[x,bedBottom-.05,0],[.12,.10,recessedBed?Math.min(w*.94,2*(track-housingDepth/2-.03)):w*.94],metal,.014);
   for(const side of [-1,1])box('bed chassis mount '+x+' '+side,
    [x,(railTop+supportTop)/2,side*.48],[.12,Math.max(.02,supportTop-railTop),.14],metal,.012);
  }
  const boards=10;
  for(let i=0;i<boards;i++){
   const z=-w/2+w*(i+.5)/boards;
   bedBoard('deck plank '+i,deck,z,.085,w/boards-.012,tint(wood,.22));
   for(let line=0;line<2;line++){
    const grainZ=z+(random()-.5)*w/boards*.7;
    for(const [a,b]of clearSpans(deck-.0425,z,w/boards/2))box('deck grain '+i+' '+line+' '+a,[(a+b)/2,deck+.044,grainZ],[(b-a)*.92,.002,.005],tint('#493b2c',.3));
   }
  }
  const sideHeight=p.vehicleBedSides,rows=Math.max(2,Math.round(sideHeight/.17));
  for(const side of [-1,1]){
   if(wooden)for(let row=0;row<rows;row++)bedBoard('bed side plank '+side+' '+row,deck+.09+(row+.5)*sideHeight/rows,side*w/2,sideHeight/rows-.014,.065,tint(wood,.18));
   if(wooden)for(let i=0;i<4;i++){
    const x=bedX-bedL/2+bedL*(i+.1)/3.2;
    if(recessedBed&&axles.slice(1).some(([,axleX])=>Math.abs(x-axleX)<housingRadius+.05))continue;
    box('bed stake '+side+' '+i,[x,deck+.1+sideHeight/2,side*(w/2+.035)],[.07,sideHeight+.16,.06],metal,.01);
    for(const y of [deck+.17,deck+sideHeight-.04])cylinder('stake bolt '+side+' '+i+' '+y,[x,y,side*(w/2+.075)],.018,.012,'#a29d8b');
   }
   for(const [name,x]of axles.slice(1)){
    fender(x,side*track,name+' fender '+side);
    if(recessedBed){
     // Close the inboard face of the curved housing, outside the tyre envelope.
     const radius=r+.225,base=deck-.043-r,angle=Math.asin(Math.min(.99,Math.max(0,base/radius)));
     const shape=new THREE.Shape();
     const endAngle=axleCount>1?Math.max(angle,Math.acos(Math.min(1,(spacing/2-.04)/radius))):angle;
     shape.absarc(0,0,radius,endAngle,Math.PI-endAngle,false);
     if(endAngle>angle){
      const endX=radius*Math.cos(endAngle);
      shape.lineTo(-endX,base);shape.lineTo(endX,base);
     }
     shape.closePath();
     const cap=new THREE.ExtrudeGeometry(shape,{depth:.025,steps:1,curveSegments:24,bevelEnabled:false});
     cap.translate(0,0,-.0125);
     add(cap,name+' inner wheel tub '+side,[x,r,side*(track-(tw+.18)/2)],paint);
    }
   }
  }
  if(wooden)for(const end of [-1,1])for(let row=0;row<rows;row++)box((end<0?'headboard ':'tailgate ')+row,[bedX+end*(bedL/2-.025),deck+.09+(row+.5)*sideHeight/rows,0],[.065,sideHeight/rows-.014,w],tint(wood,.18),.01);
  const tailX=bedX+bedL/2;
  box('rear lamp mounting bar',[tailX-.03,deck-.14,0],[.14,.20,w*.94],metal,.015);
  for(const side of [-1,1]){
   box('rear bar bed bracket '+side,[tailX-.03,deck-.067,side*.48],[.14,.08,.14],metal,.01);
   box('tail lamp housing '+side,[tailX+.065,deck-.14,side*w*.4],[.05,.14,.23],metal,.015);
   box('tail lamp lens '+side,[tailX+.096,deck-.14,side*w*.4],[.014,.10,.18],'#a73526',.005);
  }
 }
 function cargoBox(){
  const h=p.vehicleCargoHeight;
  for(const side of [-1,1]){
   box('cargo wall '+side,[bedX,deck+h/2,side*(w/2-.035)],[bedL,h,.07],paint,.025);
   for(let i=0;i<=6;i++)box('cargo rib '+side+' '+i,[bedX-bedL/2+.04+(bedL-.08)*i/6,deck+h/2,side*(w/2+.012)],[.045,h,.035],metal,.009);
   for(const y of [deck+.04,deck+h-.04])box('cargo edge rail '+side+' '+y,[bedX,y,side*w/2],[bedL,.07,.08],metal,.015);
   const x=bedX+bedL/2;
   box('rear cargo door '+side,[x,deck+h/2,side*w*.25],[.065,h-.06,w*.5-.025],paint,.018);
   beam('door locking rod '+side,[x+.045,deck+.15,side*w*.24],[x+.045,deck+h-.15,side*w*.24],.018,metal);
   for(const y of [deck+.25,deck+h-.25])box('door hinge '+side+' '+y,[x+.045,y,side*w*.46],[.06,.08,.13],metal,.008);
  }
  box('cargo roof',[bedX,deck+h,0],[bedL,.08,w],paint,.03);
  box('cargo front wall',[bedX-bedL/2+.035,deck+h/2,0],[.07,h,w],paint);
 }
 function logRack(){
  const h=p.vehicleCargoHeight,rr=Math.min(.19,w/10),rows=Math.min(Math.round(p.vehicleLogRows),Math.floor((h-.20)/(rr*2)));
  for(let i=0;i<4;i++){
   const x=bedX-bedL*.44+i*bedL*.88/3;
   box('logging bolster '+i,[x,deck+.10,0],[.14,.14,w],metal,.015);
   for(const side of [-1,1])box('logging stake '+i+' '+side,[x,deck+h/2,side*(w/2-.03)],[.10,h,.10],metal,.015);
  }
  const columns=Math.max(2,Math.floor((w-.20)/(rr*2.02)));
  for(let row=0;row<rows;row++)for(let col=0;col<columns-(row%2);col++){
   const z=(col-(columns-1-(row%2))/2)*rr*2.02,y=deck+.18+rr+row*rr*1.76;
   const length=bedL*(.91+random()*.07),g=new THREE.CylinderGeometry(rr*.90,rr,length,12);
   g.rotateZ(Math.PI/2);add(g,'log '+row+' '+col,[bedX,y,z],tint('#594638',.35));
   for(const end of [-1,1]){
    const cap=new THREE.CylinderGeometry(rr*.89,rr*.89,.008,16);cap.rotateZ(Math.PI/2);
    add(cap,'log cut end '+row+' '+col+' '+end,[bedX+end*(length/2+.003),y,z],'#b89965');
   }
  }
 }
 function exhaust(){
  for(const side of [-1,1]){
   const x=cabBack+.035,z=side*(w/2+.12),top=roof+.55;
   beam('lower exhaust '+side,[x,r*.8,side*.4],[x,r+.3,z],.055,metal);
   beam('exhaust stack '+side,[x,r+.3,z],[x,top-.18,z],.065,'#8a8b80');
   beam('exhaust tip '+side,[x,top-.18,z],[x+.14,top,z],.065,'#8a8b80');
   for(const y of [r+.45,roof-.15])beam('stack bracket '+side+' '+y,[cabBack,y,side*w*.45],[x,y,z],.018,metal);
  }
 }
 function forkliftBody(){
  box('forklift chassis',[0,.48,0],[2.5,.30,w*.85],metal,.10);
  box('rear counterweight',[rear+.02,.90,0],[.75,.85,w*.94],paint,.18);
  box('operator floor',[-.12,.70,0],[1.22,.12,w*.82],metal,.04);
  box('seat pedestal',[.18,.88,0],[.50,.26,.48],metal,.04);
  box('seat cushion',[.18,1.06,0],[.55,.15,.60],p.vehicleSeatColor,.07);
  box('seat back',[.42,1.38,0],[.14,.62,.60],p.vehicleSeatColor,.07);
  for(const side of [-1,1]){
   beam('front guard post '+side,[-.72,.73,side*.61],[-.55,2.24,side*.61],.04,metal);
   beam('rear guard post '+side,[.60,.80,side*.61],[.60,2.24,side*.61],.04,metal);
   box('entry step '+side,[-.13,.48,side*.68],[.60,.08,.25],metal,.025);
   for(const [name,x]of axles)fender(x,side*track,'forklift '+name+' fender '+side);
  }
  box('overhead guard',[.02,2.26,0],[1.35,.10,1.40],metal,.05);
  beam('steering column',[-.55,.76,0],[-.48,1.39,0],.035,metal);
  const steering=new THREE.TorusGeometry(.18,.022,10,28);steering.rotateX(Math.PI/2-.25);
  add(steering,'steering wheel',[-.48,1.39,0],rubber);
  for(const side of [-1,1])beam('steering spoke '+side,[-.48,1.39,0],[-.48,1.39,side*.17],.012,metal);
  const x=front-.50,lift=p.vehicleForkLift;
  for(const side of [-1,1]){
   box('mast rail '+side,[x,1.80,side*.46],[.14,3.20,.12],metal,.012);
   box('carriage upright '+side,[x-.15,lift+.48,side*.43],[.10,.96,.09],metal,.01);
   box('fork heel '+side,[x-.24,lift+.36,side*p.vehicleForkSpread/2],[.12,.72,.12],metal,.025);
   box('fork tine '+side,[x-.24-p.vehicleForkLength/2,lift,side*p.vehicleForkSpread/2],[p.vehicleForkLength,.065,.12],metal,.025);
   beam('mast mount '+side,[front,.4,side*.46],[x,.4,side*.46],.06,metal);
   beam('lift chain '+side,[x-.02,.28,side*.24],[x-.02,3.27,side*.24],.013,'#757970');
  }
  for(const y of [.24,3.36])box('mast cross rail '+y,[x,y,0],[.15,.12,1.04],metal);
  for(const y of [lift+.15,lift+.80])box('carriage cross rail '+y,[x-.16,y,0],[.10,.10,1.02],metal);
  beam('hydraulic barrel',[x+.10,.30,0],[x+.10,1.15,0],.07,metal);
  beam('hydraulic piston',[x+.10,1.15,0],[x+.10,1.35+lift*.55,0],.035,'#bbc3c4');
 }
 function wheels(){
  for(const [axle,x]of axles)for(const side of [-1,1]){
   const label=axle+' '+(side>0?'right':'left'),z=side*track;
   const profile=[[r*.60,-tw*.5],[r*.82,-tw*.57],[r*.96,-tw*.42],[r,0],[r*.96,tw*.42],[r*.82,tw*.57],[r*.60,tw*.5],[r*.60,-tw*.5]].map(([a,b])=>new THREE.Vector2(a,b));
   const tyre=new THREE.LatheGeometry(profile,36);tyre.rotateX(Math.PI/2);
   const parts=[tyre];
   for(let i=0;i<36;i++)for(const lane of [-1,1]){
    const a=i*Math.PI*2/36+lane*.025,g=new THREE.BoxGeometry(r*.11,.018,tw*.42);
    g.rotateZ(a-Math.PI/2);g.translate(Math.cos(a)*(r+.005),Math.sin(a)*(r+.005),lane*tw*.24);parts.push(g);
   }
   const merged=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
   add(merged,label+' tyre',[x,r,z],rubber,.96);
   cylinder(label+' rim',[x,r,z],r*.60,tw*1.02,tint(paint),.62);
   cylinder(label+' hub',[x,r,z+side*tw*.57],r*.24,.085,metal);
   for(let bolt=0;bolt<6;bolt++){
    const a=bolt*Math.PI/3;cylinder(label+' wheel bolt '+bolt,[x+Math.cos(a)*r*.36,r+Math.sin(a)*r*.36,z+side*tw*.54],.022,.027,'#a5a195');
   }
  }
 }
 if(type==='vehicleCargoTruck'||type==='vehicleChassis')chassis();
 if(type==='vehicleCargoTruck'||type==='vehicleCab')cab();
 if(type==='vehicleCargoTruck'||type==='vehicleInterior')interior();
 if(type==='vehicleCargoTruck'||type==='vehicleEngine')engine();
 if(['vehicleCargoTruck','vehicleCargoBed','vehicleBoxBody','vehicleLogRack'].includes(type))bed();
 if(type==='vehicleBoxBody'||(type==='vehicleCargoTruck'&&p.vehicleBody==='box'))cargoBox();
 if(type==='vehicleLogRack'||(type==='vehicleCargoTruck'&&p.vehicleBody==='logs'))logRack();
 if(type==='vehicleExhaust'||(type==='vehicleCargoTruck'&&p.vehicleStacks))exhaust();
 if(forklift){forkliftBody();wheels();}
 if(type==='vehicleCargoTruck'||type==='vehicleWheels')wheels();
 return count;
}
