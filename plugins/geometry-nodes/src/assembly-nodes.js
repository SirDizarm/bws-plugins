import * as THREE from 'three';

const groups=['all','cargo','cab','engine','wheels','chassis','forks'];
const selection={assemblyGroup:['Part group','all',groups]};
const transform={};
for(const axis of ['X','Y','Z']){
 transform['place'+axis]=['Position '+axis,0,-1000,1000,.05];
 transform['rotate'+axis]=['Rotation '+axis,0,-180,180,1];
 transform['scale'+axis]=['Scale '+axis,1,.01,20,.05];
}
export const ASSEMBLY_NODES={
 removeParts:{title:'Remove Parts',category:'Assembly',attachment:true,inputSockets:['Geometry'],fields:selection},
 placePart:{title:'Place Part',category:'Assembly',attachment:true,inputSockets:['Target','Part'],fields:{...selection,
  placeAnchor:['Placement','top',['top','center','bottom','manual','forks']],placeKeepTarget:['Keep target',true],placeMass:['Cargo weight kg (0 = unspecified)',0,0,100000,10],...transform}},
 hingePart:{title:'Hinge',category:'Assembly',attachment:true,inputSockets:['Geometry'],fields:{...selection,
  hingeAxis:['Hinge axis','y',['x','y','z']],hingeAngle:['Open angle',0,-180,180,1],hingeMin:['Minimum angle',0,-180,180,1],hingeMax:['Maximum angle',110,-180,180,1],
  hingeX:['Pivot X',0,-1000,1000,.05],hingeY:['Pivot Y',0,-1000,1000,.05],hingeZ:['Pivot Z',0,-1000,1000,.05]}},
 interactionVolume:{title:'Interaction Volume',category:'Assembly',attachment:true,inputSockets:['Geometry'],fields:{
  volumePurpose:['Purpose','storage',['storage','heavyCargo','spawn','interact','entry']],volumeDebug:['Show debug box',true],volumeOversize:['Allow oversized items',false],volumeCapacity:['Item capacity',10,1,1000,1],
  volumeItemMass:['Maximum item weight kg',1000,1,100000,10],volumeTotalMass:['Maximum total load kg',5000,1,1000000,100],
  volumeCargoType:['Allowed cargo','any',['any','vehicles','equipment']],volumeOverweight:['Allow overweight loads (debug)',false],
  volumeX:['Box X',0,-1000,1000,.05],volumeY:['Box Y',1,-1000,1000,.05],volumeZ:['Box Z',0,-1000,1000,.05],
  volumeWidth:['Box width',2,.05,100,.05],volumeHeight:['Box height',2,.05,100,.05],volumeDepth:['Box depth',2,.05,100,.05],
  volumeRotX:['Box rotation X',0,-180,180,1],volumeRotY:['Box rotation Y',0,-180,180,1],volumeRotZ:['Box rotation Z',0,-180,180,1],
  itemWidth:['Maximum item width',1,.01,100,.05],itemHeight:['Maximum item height',1,.01,100,.05],itemDepth:['Maximum item depth',1,.01,100,.05]}}
};
ASSEMBLY_NODES.heavyCargoVolume={title:'Heavy Cargo Area',category:'Assembly',attachment:true,inputSockets:['Geometry'],fields:{
 ...ASSEMBLY_NODES.interactionVolume.fields,
 volumePurpose:['Purpose','heavyCargo',['heavyCargo']],volumeCargoType:['Allowed cargo','vehicles',['any','vehicles','equipment']],
 volumeCapacity:['Item capacity',2,1,1000,1],volumeWidth:['Box width',2.5,.05,100,.05],volumeHeight:['Box height',3,.05,100,.05],volumeDepth:['Box depth',7,.05,100,.05],
 itemWidth:['Maximum item width',2.4,.01,100,.05],itemHeight:['Maximum item height',2.8,.01,100,.05],itemDepth:['Maximum item depth',5,.01,100,.05],
 volumeItemMass:['Maximum item weight kg',4000,1,100000,10],volumeTotalMass:['Maximum total load kg',10000,1,1000000,100]
}};

ASSEMBLY_NODES.forkCargoVolume={title:'Fork Cargo Area',category:'Assembly',attachment:true,inputSockets:['Forklift'],fields:{
 ...ASSEMBLY_NODES.interactionVolume.fields,
 volumePurpose:['Purpose','heavyCargo',['heavyCargo']],volumeHeight:['Cargo height',1,.05,10,.05],volumeCapacity:['Item capacity',1,1,100,1],
 volumeItemMass:['Maximum item weight kg',1500,1,100000,10],volumeTotalMass:['Maximum total load kg',1500,1,1000000,100]
}};
// Operates on geometry streams, not the editor scene. Each branch owns its copies.
export function evaluateAssembly(graph,{typeOf,params,source,fromData,toData,smooth}){
 const cache=new Map(),visiting=new Set();
 const copy=parts=>structuredClone(parts);
 const meta=part=>part.gameAsset?.assembly;
 const selected=(part,group)=>group==='all'||meta(part)?.group===group;
 const matrix=part=>new THREE.Matrix4().compose(new THREE.Vector3(...(part.position||[0,0,0])),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation||[0,0,0]).map(THREE.MathUtils.degToRad))),new THREE.Vector3(...(part.scale||[1,1,1])));
 const union=streams=>[...new Map(streams.flat().map(part=>[meta(part)?.id,part])).values()];
 function bounds(parts){
  const b=new THREE.Box3();
  for(const part of parts){const g=fromData(part.geometry);g.computeBoundingBox();b.union(g.boundingBox.clone().applyMatrix4(matrix(part)));g.dispose();}
  if(b.isEmpty())throw Error('The chosen target has no geometry. Check its group and connection.');
  return b;
 }
 function transformPart(part,m){
  const g=fromData(part.geometry);g.applyMatrix4(m.clone().multiply(matrix(part)));part.geometry=toData(g);g.dispose();
  part.position=[0,0,0];part.rotation=[0,0,0];part.scale=[1,1,1];
  const a=meta(part);
  if(a){
   for(const volume of a.volumes||[])volume.matrix=new THREE.Matrix4().multiplyMatrices(m,new THREE.Matrix4().fromArray(volume.matrix)).toArray();
   if(a.hinge){a.hinge.pivot=new THREE.Vector3(...a.hinge.pivot).applyMatrix4(m).toArray();a.hinge.axis=new THREE.Vector3(...a.hinge.axis).transformDirection(m).toArray();}
  }
 }
 function tag(parts,id,type){
  const seen=new Map();
  return parts.map(part=>{
   const name=String(part.name||'part'),serial=seen.get(name)||0;seen.set(name,serial+1);
   let group='other';
   if(type.startsWith('vehicle')){
    group=/tyre|wheel bolt|rim|hub|fender/.test(name)?'wheels':/bed|deck|cargo|tailgate|headboard|log |logging|rear lamp|tail lamp|rear bar|stake bolt/.test(name)?'cargo':/engine|sump|cylinder head|valve|exhaust|intake|radiator core|radiator hose|fan|pulley|filter/.test(name)?'engine':/chassis|crossmember|axle|differential|spring|shaft|fuel tank/.test(name)?'chassis':'cab';
   }
   if(type==='vehicleForklift'&&/fork tine /.test(name))group='forks';
   part.gameAsset={...part.gameAsset,assembly:{version:1,id:id+':'+name+':'+serial,sourceNode:id,group}};return part;
  });
 }
 function run(id){
  if(cache.has(id))return copy(cache.get(id));
  if(visiting.has(id))throw Error('Assembly graph contains a circular connection.');visiting.add(id);
  const type=typeOf(id),p=params(id),links=graph.connections.filter(c=>c.toNodeId===id);
  const input=index=>union(links.filter(c=>(c.toInputIndex||0)===index).map(c=>run(c.fromNodeId)));
  let parts;
  if(type==='output'||type==='join')parts=union(links.map(c=>run(c.fromNodeId)));
  else if(type==='transform'){
   parts=input(0);
   const m=new THREE.Matrix4().compose(new THREE.Vector3(p.transformX,p.transformY,p.transformZ),new THREE.Quaternion().setFromEuler(new THREE.Euler(...[p.transformRotX,p.transformRotY,p.transformRotZ].map(THREE.MathUtils.degToRad))),new THREE.Vector3().setScalar(p.transformScale));
   for(const part of parts){transformPart(part,m);meta(part).id=id+'/'+meta(part).id;}
  }else if(type==='smoothGeometry'){
   parts=input(0);for(const part of parts){const g=fromData(part.geometry),result=smooth(g,id);part.geometry=toData(result);result.dispose();meta(part).id=id+'/'+meta(part).id;}
  }
  else if(type==='removeParts')parts=input(0).filter(part=>!selected(part,p.assemblyGroup));
  else if(type==='placePart'){
   const target=input(0),payload=input(1);
   if(!payload.length)throw Error('Place Part needs geometry connected to its Part socket.');
   let anchor=new THREE.Vector3(),origin=new THREE.Vector3();
   if(p.placeAnchor!=='manual'){
    const b=bounds(target.filter(part=>selected(part,p.placeAnchor==='forks'?'forks':p.assemblyGroup)&&!meta(part)?.debugOnly));b.getCenter(anchor);
    if(p.placeAnchor==='top'||p.placeAnchor==='forks')anchor.y=b.max.y;else if(p.placeAnchor==='bottom')anchor.y=b.min.y;
    const pb=bounds(payload);pb.getCenter(origin);origin.y=pb.min.y;
   }
   anchor.add(new THREE.Vector3(p.placeX,p.placeY,p.placeZ));
   const m=new THREE.Matrix4().compose(anchor,new THREE.Quaternion().setFromEuler(new THREE.Euler(...['X','Y','Z'].map(a=>THREE.MathUtils.degToRad(p['rotate'+a])))),new THREE.Vector3(p.scaleX,p.scaleY,p.scaleZ)).multiply(new THREE.Matrix4().makeTranslation(-origin.x,-origin.y,-origin.z));
   for(const part of payload){transformPart(part,m);meta(part).id=id+'/'+meta(part).id;meta(part).placement={node:id,targetNode:links.find(c=>(c.toInputIndex||0)===0)?.fromNodeId||null,group:p.assemblyGroup,anchor:p.placeAnchor,loadId:id,massKg:p.placeMass||null};}
   parts=[...(p.placeKeepTarget?target:[]),...payload];
  }else if(type==='hingePart'){
   parts=input(0);const pivot=new THREE.Vector3(p.hingeX,p.hingeY,p.hingeZ),axis=new THREE.Vector3(p.hingeAxis==='x'?1:0,p.hingeAxis==='y'?1:0,p.hingeAxis==='z'?1:0);
   if(p.hingeMin>p.hingeMax)throw Error('Hinge minimum angle must not exceed its maximum.');
   const angle=Math.max(p.hingeMin,Math.min(p.hingeMax,p.hingeAngle));
   const m=new THREE.Matrix4().makeTranslation(...pivot.toArray()).multiply(new THREE.Matrix4().makeRotationAxis(axis,THREE.MathUtils.degToRad(angle))).multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
   const matches=parts.filter(part=>selected(part,p.assemblyGroup));if(!matches.length)throw Error('Hinge could not find the selected part group.');
   for(const part of matches){transformPart(part,m);meta(part).hinge={id,axis:axis.toArray(),pivot:pivot.toArray(),angle,min:p.hingeMin,max:p.hingeMax};}
  }else if(type==='interactionVolume'||type==='heavyCargoVolume'||type==='forkCargoVolume'){
   parts=input(0);if(!parts.length)throw Error('Connect an asset to Interaction Volume first.');
   const forkBounds=type==='forkCargoVolume'?bounds(parts.filter(part=>selected(part,'forks'))):null;
   const position=forkBounds?[(forkBounds.min.x+forkBounds.max.x)/2+p.volumeX,forkBounds.max.y+p.volumeHeight/2+p.volumeY-1,(forkBounds.min.z+forkBounds.max.z)/2+p.volumeZ]:[p.volumeX,p.volumeY,p.volumeZ],rotation=[p.volumeRotX,p.volumeRotY,p.volumeRotZ];
   const m=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(THREE.MathUtils.degToRad))),new THREE.Vector3(1,1,1));
   const volume={id,purpose:type==='heavyCargoVolume'?'heavyCargo':p.volumePurpose,matrix:m.toArray(),size:[p.volumeWidth,p.volumeHeight,p.volumeDepth],maxItemSize:[p.itemWidth,p.itemHeight,p.itemDepth],capacity:p.volumeCapacity,allowOversized:p.volumeOversize,maxItemMassKg:p.volumeItemMass,maxTotalMassKg:p.volumeTotalMass,allowedCargo:p.volumeCargoType,allowOverweight:p.volumeOverweight,massAccounting:'Count each placement loadId once, not once per mesh; null mass is unknown, not zero.'};
   if(forkBounds){const size=forkBounds.getSize(new THREE.Vector3());volume.size=[size.x,p.volumeHeight,size.z];volume.attachment='forks';}
   meta(parts[0]).volumes=[...(meta(parts[0]).volumes||[]),volume];
   if(p.volumeDebug){
    const sizes=volume.size;
    for(let axis=0;axis<3;axis++)for(const a of [-1,1])for(const b of [-1,1]){
     const other=[0,1,2].filter(i=>i!==axis),dim=[.015,.015,.015],pos=[0,0,0];dim[axis]=sizes[axis];pos[other[0]]=a*sizes[other[0]]/2;pos[other[1]]=b*sizes[other[1]]/2;
     const g=new THREE.BoxGeometry(...dim);g.translate(...pos);g.applyMatrix4(m);
     parts.push({shape:'custom',geometry:toData(g),name:'Interaction volume debug',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#36dbb0',roughness:1,gameAsset:{assembly:{version:1,id:id+':debug:'+axis+':'+a+':'+b,group:'debug',debugOnly:true}}});g.dispose();
    }
   }
  }else parts=tag(source(id,type),id,type);
  if(parts.length>5000)throw Error('Assembly exceeds the 5,000 part preview limit.');
  visiting.delete(id);cache.set(id,copy(parts));return parts;
 }
 return union(graph.nodeOrder.filter(id=>typeOf(id)==='output').map(run));
}
