import * as THREE from 'three';

const groups=['all','cargo','cab','engine','wheels','chassis','forks','tracks','boom','bucket','hook','stabilizers','coupling','landing'];
const selection={assemblyGroup:['Part group','all',groups]};
const transform={};
for(const axis of ['X','Y','Z']){
 transform['place'+axis]=['Position '+axis,0,-1000,1000,.05];
 transform['rotate'+axis]=['Rotation '+axis,0,-180,180,1];
 transform['scale'+axis]=['Scale '+axis,1,.01,20,.05];
}
export const ASSEMBLY_NODES={
 buildingFireDamage:{title:'Building Fire Damage',category:'Damage & Effects',attachment:true,inputSockets:['Geometry'],fields:{fireDamage:['Structural damage',.4,0,.9,.05],fireScorch:['Scorch amount',.85,0,1,.05],fireSeed:['Damage pattern',1,1,999999,1]}},
 previewPose:{title:'Preview Pose',category:'Assembly',attachment:true,inputSockets:['Geometry'],fields:{poseShowJoints:['Show joint controls',true]}},
 vehicleControlHook:{title:'Vehicle Control Hook',category:'Assembly',attachment:true,inputSockets:['Geometry'],fields:{controlEnabled:['Enable control binding',true],controlChannel:['Control channel','vehicle',['vehicle','arm','attachment']]}},
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
  const machinery=part.gameAsset?.machinery;
  if(machinery){
   const world=m.clone().multiply(matrix(part));
   machinery.joints=(machinery.joints||[]).map(j=>({...j,pivot:new THREE.Vector3(...j.pivot).applyMatrix4(world).toArray(),axis:new THREE.Vector3(...j.axis).transformDirection(world).toArray()}));
   machinery.offset=[0,0,0];
  }
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
   if(part.gameAsset?.machinery?.role)group=part.gameAsset.machinery.role;
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
  else if(type==='buildingFireDamage'){
   const original=input(0),damage=Math.max(0,Math.min(.9,p.fireDamage)),burn=Math.max(0,Math.min(1,p.fireScorch));
   function noise(text){let n=(p.fireSeed||1)>>>0;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619)>>>0;return n/4294967295;}
   const building=bounds(original),size=building.getSize(new THREE.Vector3()),center=building.getCenter(new THREE.Vector3());
   const fireX=center.x+size.x*(noise('fire-x')-.5)*.45,fireZ=center.z+size.z*(noise('fire-z')-.5)*.45;
   const baseRadius=Math.max(.25,Math.min(size.x,size.z)*(.16+damage*.42)),radiusX=baseRadius*(.8+noise('breach-width')*.3),radiusZ=baseRadius*(.85+noise('breach-depth')*.3),radius=Math.max(radiusX,radiusZ)*1.35,phase=noise('breach-edge')*Math.PI*2;
   // Irregular, axis-oriented bays keep the damage aligned with the building.
   const bayX=Math.max(.12,size.x/(5+Math.floor(noise('breach-bays-x')*4))),bayZ=Math.max(.12,size.z/(6+Math.floor(noise('breach-bays-z')*5)));
   const breachDistance=point=>{const x=(point.x-fireX)/radiusX,z=(point.z-fireZ)/radiusZ,angle=Math.atan2(z,x),shape=Math.max(Math.abs(x),Math.abs(z))*.7+Math.hypot(x,z)*.3,edge=.9+.13*Math.sin(angle*3+phase)+.09*Math.sin(angle*5-phase),bay=.035*Math.sin((point.x-fireX)/bayX*2.1+(point.z-fireZ)/bayZ*1.7+phase);return Math.max(shape-edge-bay,(building.min.y+size.y*.42-point.y)/baseRadius);};
   const roofComponents=new WeakMap(),roofParts=new Set();
   function breach(part){
    const g=fromData(part.geometry),flat=g.index?g.toNonIndexed():g,position=flat.getAttribute('position'),world=matrix(part),kept=[];
    const limit=Math.max(.045,Math.min(size.x,size.z)/70);
    function triangle(a,b,c,depth){
     const lowX=Math.min(a.x,b.x,c.x),highX=Math.max(a.x,b.x,c.x),lowZ=Math.min(a.z,b.z,c.z),highZ=Math.max(a.z,b.z,c.z);
     if(highX<fireX-radius||lowX>fireX+radius||highZ<fireZ-radius||lowZ>fireZ+radius||Math.max(a.y,b.y,c.y)<=building.min.y+size.y*.42){kept.push(...a.toArray(),...b.toArray(),...c.toArray());return;}
     const ab=a.distanceToSquared(b),bc=b.distanceToSquared(c),ca=c.distanceToSquared(a);
     if(depth<10&&Math.max(ab,bc,ca)>limit*limit){
      if(ab>=bc&&ab>=ca){const m=a.clone().lerp(b,.5);triangle(a,m,c,depth+1);triangle(m,b,c,depth+1);}
      else if(bc>=ca){const m=b.clone().lerp(c,.5);triangle(a,b,m,depth+1);triangle(a,m,c,depth+1);}
      else{const m=c.clone().lerp(a,.5);triangle(a,b,m,depth+1);triangle(m,b,c,depth+1);}
     }else{
      // Clip boundary triangles at the continuous damage contour instead of
      // deleting complete triangles by their centroid (the old sawtooth edge).
      const vertices=[a,b,c],values=vertices.map(breachDistance),polygon=[];
      for(let i=0;i<3;i++){const j=(i+1)%3,outside=values[i]>=0,nextOutside=values[j]>=0;if(outside)polygon.push(vertices[i]);if(outside!==nextOutside){let lo=0,hi=1;for(let step=0;step<14;step++){const mid=(lo+hi)/2,positive=breachDistance(vertices[i].clone().lerp(vertices[j],mid))>=0;if(positive===outside)lo=mid;else hi=mid;}polygon.push(vertices[i].clone().lerp(vertices[j],(lo+hi)/2));}}
      for(let i=1;i+1<polygon.length;i++)kept.push(...polygon[0].toArray(),...polygon[i].toArray(),...polygon[i+1].toArray());
     }
    }
    for(let i=0;i<position.count;i+=3)triangle(new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(world),new THREE.Vector3().fromBufferAttribute(position,i+1).applyMatrix4(world),new THREE.Vector3().fromBufferAttribute(position,i+2).applyMatrix4(world),0);
    if(flat!==g)flat.dispose();g.dispose();
    if(!kept.length)return false;
    // Keep connected surfaces separate for the whole-roof support pass below.
    const count=kept.length/9,parent=Array.from({length:count},(_,i)=>i),welded=new Map(),areas=new Map(),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    for(let i=0;i<count;i++)for(let j=0;j<3;j++){const k=i*9+j*3,key=[kept[k],kept[k+1],kept[k+2]].map(v=>Math.round(v*10000)).join(':');if(welded.has(key)){const a=root(i),b=root(welded.get(key));if(a!==b)parent[a]=b;}else welded.set(key,i);}
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<count;i++){a.fromArray(kept,i*9);b.fromArray(kept,i*9+3).sub(a);c.fromArray(kept,i*9+6).sub(a);const id=root(i);areas.set(id,(areas.get(id)||0)+b.cross(c).length()*.5);}
    const clean=[],components=new Map();for(let i=0;i<count;i++){const id=root(i);if(areas.get(id)<=1e-8)continue;if(!components.has(id))components.set(id,[]);for(let j=0;j<9;j++){clean.push(kept[i*9+j]);components.get(id).push(kept[i*9+j]);}}if(!clean.length)return false;roofComponents.set(part,[...components.values()]);
    const cut=new THREE.BufferGeometry();cut.setAttribute('position',new THREE.Float32BufferAttribute(clean,3));cut.computeVertexNormals();part.geometry=toData(cut);cut.dispose();part.position=[0,0,0];part.rotation=[0,0,0];part.scale=[1,1,1];part.doubleSided=true;return true;
   }
   parts=[];
   for(const part of original){
    const fullName=String(part.gameAsset?.partLabel||part.name||''),name=fullName.split(graph.name).join('').toLowerCase(),r=noise(name),stone=/stone|brick|foundation|chimney|masonry/.test(name),roof=/roof|tile|shingle|slate|ridge/.test(name),glass=/glass|glazing|pane/.test(name),wood=/timber|beam|brace|rafter|post|diagonal|wood|shutter|door|canopy|floor/.test(name),wall=/plaster|infill|wall panel/.test(name);
    // Apply to the detailed house stream, preserving its dimensions and layout.
    // Breach the backing locally, rather than randomly dropping an entire
    // bearing sheet and consequently orphaning the surviving slope's tiles.
    const chance=stone||/roof backing/.test(name)?0:glass?damage*.95:wood?damage*.12:roof?damage*.4:wall?damage*.15:0;
    if(r<chance)continue;
    if(damage>0&&!stone&&!wood&&(roof||wall||glass)&&!breach(part))continue;
    const color=new THREE.Color(part.color||'#a99880'),char=new THREE.Color(stone?'#514a43':wood?'#171311':'#46372d');
    color.lerp(char,Math.min(1,burn*(wood?.9+r*.1:stone?.45+r*.3:.65+r*.3)));part.color='#'+color.getHexString();part.roughness=.98;
    part.gameAsset={...part.gameAsset,fireDamage:{version:1,amount:damage,scorch:burn,seed:p.fireSeed}};
    parts.push(part);if(roof&&!stone)roofParts.add(part);
   }
   if(damage>0&&roofParts.size){
    // Test actual surface contact across roof parts. A large isolated tile is
    // discarded too; a small fragment survives only through a support path.
    const tolerance=.035,candidates=[],anchors=[];
    function surface(part,positions){let g=null,flat=null;const triangles=[],box=new THREE.Box3();if(!positions){g=fromData(part.geometry);flat=g.index?g.toNonIndexed():g;const attr=flat.getAttribute('position'),world=matrix(part);positions=[];for(let i=0;i<attr.count;i++){const v=new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(world);positions.push(v.x,v.y,v.z);}}
     for(let i=0;i<positions.length;i+=9){const a=new THREE.Vector3().fromArray(positions,i),b=new THREE.Vector3().fromArray(positions,i+3),c=new THREE.Vector3().fromArray(positions,i+6);box.expandByPoint(a);box.expandByPoint(b);box.expandByPoint(c);triangles.push(new THREE.Triangle(a,b,c));}if(flat&&flat!==g)flat.dispose();g?.dispose();return {part,positions,triangles,triangleBounds:triangles.map(t=>new THREE.Box3().setFromPoints([t.a,t.b,t.c])),box,supported:false};}
    for(const part of parts){if(roofParts.has(part)){const components=roofComponents.get(part);if(components)for(const positions of components)candidates.push(surface(part,positions));else candidates.push(surface(part));}else{const label=String(part.gameAsset?.partLabel||part.name||'').split(graph.name).join('').toLowerCase();if(/frame|plaster|infill|gable|stone|brick|foundation|masonry|chimney/.test(label)&&!/flashing|cap|surround/.test(label))anchors.push(surface(part));}}
    const nearest=new THREE.Vector3(),hit=new THREE.Vector3(),direction=new THREE.Vector3(),ray=new THREE.Ray(),d1=new THREE.Vector3(),d2=new THREE.Vector3(),delta=new THREE.Vector3(),toleranceSq=tolerance*tolerance,cellSize=Math.max(.2,Math.max(size.x,size.y,size.z)/16);
    // Sparse grids bound candidate work to local cells. Cache triangle bounds
    // and pair results instead of resampling every roof/anchor pair.
    function cells(box,visit){const x0=Math.floor(box.min.x/cellSize),x1=Math.floor(box.max.x/cellSize),y0=Math.floor(box.min.y/cellSize),y1=Math.floor(box.max.y/cellSize),z0=Math.floor(box.min.z/cellSize),z1=Math.floor(box.max.z/cellSize);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)visit(x+':'+y+':'+z);}
    function insert(grid,box,value){cells(box,key=>{if(!grid.has(key))grid.set(key,[]);grid.get(key).push(value);});}
    function query(grid,box){const result=new Set();cells(box,key=>{for(const value of grid.get(key)||[])result.add(value);});return result;}
    const surfaceGrid=new Map(),testedPairs=new Map();let surfaceId=0;for(const item of anchors){item.anchor=true;item.index=surfaceId++;insert(surfaceGrid,item.box,item);}for(const item of candidates){item.index=surfaceId++;insert(surfaceGrid,item.box,item);}
    function edgeDistanceSq(p1,q1,p2,q2){d1.subVectors(q1,p1);d2.subVectors(q2,p2);delta.subVectors(p1,p2);const a=d1.lengthSq(),e=d2.lengthSq(),f=d2.dot(delta);let s=0,t=0;if(a<=1e-16&&e<=1e-16)return delta.lengthSq();if(a<=1e-16)t=THREE.MathUtils.clamp(f/e,0,1);else{const c=d1.dot(delta);if(e<=1e-16)s=THREE.MathUtils.clamp(-c/a,0,1);else{const b=d1.dot(d2),denom=a*e-b*b;s=denom>1e-16?THREE.MathUtils.clamp((b*f-c*e)/denom,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=THREE.MathUtils.clamp(-c/a,0,1);}else if(t>1){t=1;s=THREE.MathUtils.clamp((b-c)/a,0,1);}}}return delta.addScaledVector(d1,s).addScaledVector(d2,-t).lengthSq();}
    function edgePierces(start,end,triangle){direction.subVectors(end,start);const length=direction.length();if(length<1e-12)return false;ray.set(start,direction.multiplyScalar(1/length));return !!ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit)&&hit.distanceToSquared(start)<=length*length+1e-10;}
    function trianglesTouch(a,b){const av=[a.a,a.b,a.c],bv=[b.a,b.b,b.c];for(const v of av)if(b.closestPointToPoint(v,nearest).distanceToSquared(v)<=toleranceSq)return true;for(const v of bv)if(a.closestPointToPoint(v,nearest).distanceToSquared(v)<=toleranceSq)return true;
     // Surface intersections and crossing coplanar edges can have no nearby
     // vertices. Include both before declaring a bearing contact absent.
     for(let i=0;i<3;i++){if(edgePierces(av[i],av[(i+1)%3],b)||edgePierces(bv[i],bv[(i+1)%3],a))return true;for(let j=0;j<3;j++)if(edgeDistanceSq(av[i],av[(i+1)%3],bv[j],bv[(j+1)%3])<=toleranceSq)return true;}return false;}
    function contact(a,b){const key=Math.min(a.index,b.index)+':'+Math.max(a.index,b.index);if(testedPairs.has(key))return testedPairs.get(key);let found=false;if(a.box.clone().expandByScalar(tolerance).intersectsBox(b.box)){if(a.triangles.length>b.triangles.length)[a,b]=[b,a];if(!b.triangleGrid){b.triangleGrid=new Map();b.triangleBounds.forEach((bounds,index)=>insert(b.triangleGrid,bounds,index));}
     for(let i=0;i<a.triangles.length&&!found;i++){const bounds=a.triangleBounds[i].clone().expandByScalar(tolerance);for(const j of query(b.triangleGrid,bounds))if(bounds.intersectsBox(b.triangleBounds[j])&&trianglesTouch(a.triangles[i],b.triangles[j])){found=true;break;}}}testedPairs.set(key,found);return found;}
    const queue=[];for(const item of candidates)for(const other of query(surfaceGrid,item.box.clone().expandByScalar(tolerance)))if(other.anchor&&contact(item,other)){item.supported=true;queue.push(item);break;}
    for(let i=0;i<queue.length;i++)for(const item of query(surfaceGrid,queue[i].box.clone().expandByScalar(tolerance)))if(!item.anchor&&!item.supported&&contact(item,queue[i])){item.supported=true;queue.push(item);}
    const supported=new Map();for(const item of candidates)if(item.supported){if(!supported.has(item.part))supported.set(item.part,[]);const positions=supported.get(item.part);for(const value of item.positions)positions.push(value);}
    parts=parts.filter(part=>{if(!roofParts.has(part))return true;const positions=supported.get(part);if(!positions?.length)return false;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();part.geometry=toData(g);g.dispose();part.position=[0,0,0];part.rotation=[0,0,0];part.scale=[1,1,1];return true;});
   }
  }
  else if(type==='previewPose'||type==='vehicleControlHook'){
   parts=input(0);
   for(const part of parts){
    if(type==='previewPose')part.gameAsset={...part.gameAsset,previewPose:{nodeId:id,showJoints:p.poseShowJoints}};
    else part.gameAsset={...part.gameAsset,controlHook:{version:1,nodeId:id,enabled:p.controlEnabled,channel:p.controlChannel,sourceNode:meta(part)?.sourceNode,engineSupportRequired:true}};
   }
  }
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
