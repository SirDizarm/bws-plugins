function round(value,digits=3){const scale=10**digits;return Math.round((Number(value)||0)*scale)/scale;}
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMeshFactory} from './factory.js';
import {VEHICLE_NODES,buildVehicleNode} from './vehicle-nodes.js';
const drafts=new Map(),localStorage={getItem:key=>drafts.get(key)||null,setItem:(key,value)=>drafts.set(key,String(value))};
const textureLibrary=new Map(),objects=[],groups=new Map();
const pluginManifestById=()=>({enabled:true});
const normalizeHexColor=(v,fallback='#ffffff')=>/^#[0-9a-f]{6}$/i.test(String(v))?String(v):fallback;
const recordHistory=()=>{};
const log=message=>setGeometryNodeStatus(message);
const findObject=id=>objects.find(m=>m.userData.id===id);
const groupRecord=id=>groups.get(id);
function createSceneGroupRecord(value={}){const group={...value,id:value.id||crypto.randomUUID(),name:value.name||'Node output'};groups.set(group.id,group);return group;}
function geometryFromPositions(positions) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addQuad(positions, a, b, c, d) {
  positions.push(...a, ...b, ...c, ...a, ...c, ...d);
}

function addBoxToPositions(positions, center, size) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size.map(value => value / 2);
  const v = {
    lbf: [cx - sx, cy - sy, cz + sz],
    rbf: [cx + sx, cy - sy, cz + sz],
    rtf: [cx + sx, cy + sy, cz + sz],
    ltf: [cx - sx, cy + sy, cz + sz],
    lbb: [cx - sx, cy - sy, cz - sz],
    rbb: [cx + sx, cy - sy, cz - sz],
    rtb: [cx + sx, cy + sy, cz - sz],
    ltb: [cx - sx, cy + sy, cz - sz]
  };
  addQuad(positions, v.lbf, v.rbf, v.rtf, v.ltf);
  addQuad(positions, v.rbb, v.lbb, v.ltb, v.rtb);
  addQuad(positions, v.lbb, v.lbf, v.ltf, v.ltb);
  addQuad(positions, v.rbf, v.rbb, v.rtb, v.rtf);
  addQuad(positions, v.ltf, v.rtf, v.rtb, v.ltb);
  addQuad(positions, v.lbb, v.rbb, v.rbf, v.lbf);
}

function makeCompositeBoxGeometry(boxes) {
  const positions = [];
  for (const box of boxes) addBoxToPositions(positions, box.center, box.size);
  return geometryFromPositions(positions);
}

function makeWedgeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-.5, -.5);
  shape.lineTo(.5, -.5);
  shape.lineTo(.5, .5);
  shape.lineTo(-.5, -.5);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -.5);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function orientExtrudedGeometry(geometry, depth, axis) {
  geometry.translate(0, 0, -depth / 2);
  if (axis === "y") geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeRingShape(innerRadius, outerRadius, segments) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, Math.PI * 2, 0, true);
  shape.holes.push(hole);
  return shape;
}

function makeArcBandShape(innerRadius, outerRadius, segments, start, end) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const angle = start + (end - start) * (i / segments);
    const x = Math.cos(angle) * outerRadius;
    const y = Math.sin(angle) * outerRadius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const angle = start + (end - start) * (i / segments);
    shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
  }
  shape.closePath();
  return shape;
}

function makeRingLikeGeometry({ innerRadius = .28, outerRadius = .5, depth = .1, segments = 48, start = 0, end = Math.PI * 2, axis = "z" } = {}) {
  const isFullRing = Math.abs(end - start) >= Math.PI * 2 - .001;
  const shape = isFullRing
    ? makeRingShape(innerRadius, outerRadius, segments)
    : makeArcBandShape(innerRadius, outerRadius, segments, start, end);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: segments
  });
  return orientExtrudedGeometry(geometry, depth, axis);
}

function makeCurvedPanelGeometry() {
  const geometry = makeRingLikeGeometry({ innerRadius: .58, outerRadius: .68, depth: 1, segments: 24, start: THREE.MathUtils.degToRad(55), end: THREE.MathUtils.degToRad(125), axis: "y" });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function makeHollowBoxGeometry() {
  return makeCompositeBoxGeometry([
    { center: [0, .42, 0], size: [1, .16, .22] },
    { center: [0, -.42, 0], size: [1, .16, .22] },
    { center: [-.42, 0, 0], size: [.16, .68, .22] },
    { center: [.42, 0, 0], size: [.16, .68, .22] }
  ]);
}

function makeArchGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-.5, -.5);
  shape.lineTo(-.5, 0);
  shape.absarc(0, 0, .5, Math.PI, 0, true);
  shape.lineTo(.5, -.5);
  shape.lineTo(.34, -.5);
  shape.lineTo(.34, 0);
  shape.absarc(0, 0, .34, 0, Math.PI, false);
  shape.lineTo(-.34, -.5);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .24,
    bevelEnabled: false,
    curveSegments: 28
  });
  geometry.center();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeStairGeometry() {
  const positions = [];
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    addBoxToPositions(positions, [0, -.5 + (i + 1) / steps / 2, -.5 + (i + .5) / steps], [1, (i + 1) / steps, 1 / steps]);
  }
  return geometryFromPositions(positions);
}

function makeHemisphereGeometry({ radius = .55, heightScale = 1, segments = 32, rings = 12 } = {}) {
  const positions = [];
  for (let y = 0; y < rings; y++) {
    const phi0 = y / rings * Math.PI / 2;
    const phi1 = (y + 1) / rings * Math.PI / 2;
    for (let x = 0; x < segments; x++) {
      const theta0 = x / segments * Math.PI * 2;
      const theta1 = (x + 1) / segments * Math.PI * 2;
      const point = (phi, theta) => [
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius * heightScale,
        Math.sin(phi) * Math.sin(theta) * radius
      ];
      addQuad(positions, point(phi0, theta0), point(phi0, theta1), point(phi1, theta1), point(phi1, theta0));
    }
  }
  const center = [0, 0, 0];
  for (let x = 0; x < segments; x++) {
    const theta0 = x / segments * Math.PI * 2;
    const theta1 = (x + 1) / segments * Math.PI * 2;
    const p0 = [Math.cos(theta0) * radius, 0, Math.sin(theta0) * radius];
    const p1 = [Math.cos(theta1) * radius, 0, Math.sin(theta1) * radius];
    positions.push(...center, ...p0, ...p1);
  }
  return geometryFromPositions(positions);
}

function makePrismGeometry() {
  const positions = [];
  const front = [[-.5, -.42, .5], [.5, -.42, .5], [0, .48, .5]];
  const back = [[-.5, -.42, -.5], [.5, -.42, -.5], [0, .48, -.5]];
  positions.push(...front[0], ...front[1], ...front[2]);
  positions.push(...back[0], ...back[2], ...back[1]);
  addQuad(positions, back[0], front[0], front[2], back[2]);
  addQuad(positions, front[1], back[1], back[2], front[2]);
  addQuad(positions, back[1], front[1], front[0], back[0]);
  return geometryFromPositions(positions);
}

function makeHeartGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, .24);
  shape.bezierCurveTo(-.52, .72, -1.02, .12, -.52, -.34);
  shape.bezierCurveTo(-.2, -.64, 0, -.82, 0, -.82);
  shape.bezierCurveTo(0, -.82, .2, -.64, .52, -.34);
  shape.bezierCurveTo(1.02, .12, .52, .72, 0, .24);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .2,
    bevelEnabled: true,
    bevelThickness: .025,
    bevelSize: .025,
    bevelSegments: 2
  });
  geometry.center();
  geometry.scale(.78, .78, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const meshFactory = createMeshFactory({
  builders: {
    box: () => new THREE.BoxGeometry(1, 1, 1),
    sphere: () => new THREE.SphereGeometry(0.55, 32, 18),
    cylinder: () => new THREE.CylinderGeometry(0.48, 0.48, 1, 32),
    cone: () => new THREE.ConeGeometry(0.55, 1, 32),
    torus: () => new THREE.TorusGeometry(0.42, 0.14, 16, 40),
    panel: () => new THREE.BoxGeometry(1, 1, .08),
    wedge: makeWedgeGeometry,
    hollowBox: makeHollowBoxGeometry,
    tube: () => makeRingLikeGeometry({ innerRadius: .32, outerRadius: .5, depth: 1, segments: 48, axis: "y" }),
    curvedPanel: makeCurvedPanelGeometry,
    ring: () => makeRingLikeGeometry({ innerRadius: .28, outerRadius: .5, depth: .1, segments: 48, axis: "z" }),
    arch: makeArchGeometry,
    hemisphere: makeHemisphereGeometry,
    dome: () => makeHemisphereGeometry({ radius: .55, heightScale: .55, segments: 32, rings: 10 }),
    capsule: () => new THREE.CapsuleGeometry(.32, .7, 8, 24),
    pyramid: () => {
      const geometry = new THREE.ConeGeometry(.68, 1, 4);
      geometry.rotateY(Math.PI / 4);
      return geometry;
    },
    prism: makePrismGeometry,
    tetrahedron: () => new THREE.TetrahedronGeometry(.68, 0),
    pyramidFrustum: () => {
      const geometry = new THREE.CylinderGeometry(.28, .68, 1, 4, 1, false);
      geometry.rotateY(Math.PI / 4);
      return geometry;
    },
    facetedBallLow: () => new THREE.IcosahedronGeometry(.58, 0),
    facetedBallMedium: () => new THREE.IcosahedronGeometry(.58, 1),
    facetedBallHigh: () => new THREE.IcosahedronGeometry(.58, 2),
    heart: makeHeartGeometry,
    stair: makeStairGeometry
  }
});

const {
  shapeFactories,
  shapeAliases,
  normalizeShapeName,
  proceduralCatalog,
  buildProceduralAssembly,
  listProceduralTemplates
} = meshFactory;

function geometryFromData(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  if (data.normals?.length === data.positions.length) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  if (data.colors?.length === data.positions.length) geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  if (data.uvs?.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  if (data.indices?.length) geometry.setIndex(data.indices);
  geometry.computeBoundingSphere();
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  return geometry;
}

function geometryToData(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  source.computeVertexNormals();
  const position = source.getAttribute("position");
  const normal = source.getAttribute("normal");
  const color = source.getAttribute("color");
  const uv = source.getAttribute("uv");
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  for (let i = 0; i < position.count; i++) {
    positions.push(round(position.getX(i)), round(position.getY(i)), round(position.getZ(i)));
    normals.push(round(normal.getX(i)), round(normal.getY(i)), round(normal.getZ(i)));
    if (color) colors.push(round(color.getX(i)), round(color.getY(i)), round(color.getZ(i)));
    if (uv) uvs.push(round(uv.getX(i)), round(uv.getY(i)));
  }
  source.dispose();
  return { positions, normals, colors, uvs };
}

// geometry-building-details
const BWS_BUILDING_DETAIL_NODES={
 medievalStyle:{title:"Medieval Style",category:"Architecture",attachment:true,fields:{medievalStoneInset:["Stone floor inset",.3,.15,.6,.05],medievalStoneGround:["Stone ground floor",true],medievalGableTimber:["Timbered gables",true],medievalLeadedGlass:["Diamond window leading",true],medievalSteepRoof:["Steep roof",true],medievalRoofPitch:["Minimum roof pitch",48,30,65,1],medievalGableBays:["Gable divisions",4,2,8,1],medievalStoneColor:["Ground floor stone","#908676"],medievalStoneCourses:["Stone courses",10,4,16,1]}},
 interiorPartition:{title:"Interior Partition",category:"Architecture",attachment:true,fields:{partitionLevel:["Storey",1,1,3,1],partitionAxis:["Runs along","width",["width","depth"]],partitionPosition:["Across floor (-1 to 1)",.5,-.9,.9,.05],partitionThickness:["Thickness",.12,.08,.3,.01],partitionDoor:["Doorway",true],partitionDoorPosition:["Door position",0,-.8,.8,.05],partitionDoorWidth:["Door width",1,.6,2,.1],partitionDoorHeight:["Door height",2.1,1.5,3,.1],partitionColor:["Wall color","#b1a58b"]}},
 balcony:{title:"Balcony",category:"Architecture",attachment:true,fields:{balconySide:["Wall","front",["front","back","left","right"]],balconyLevel:["Storey",2,2,3,1],balconyWidth:["Width",2.4,1.2,5,.1],balconyDepth:["Projection",1.2,.6,2.5,.1],balconyPosition:["Horizontal position",0,-.7,.7,.05],balconyDoorWidth:["Door width",1,.6,2,.1],balconyDoorHeight:["Door height",2.1,1.5,3,.1],balconyRailHeight:["Railing height",.95,.7,1.3,.05],balconyColor:["Wood","#70533e"]}},
 staircase:{title:"Staircase",category:"Architecture",attachment:true,fields:{stairsPositionX:["Across house (-1 to 1)",.85,-1,1,.05],stairsPositionZ:["Along house (-1 to 1)",.75,-1,1,.05],stairsWidth:["Flight width",.85,.55,1.4,.05],stairsTread:["Desired tread",.25,.16,.35,.01],stairsRiser:["Desired riser",.18,.12,.25,.01],stairsAttic:["Access attic",true],stairsRails:["Handrails",true],stairsColor:["Wood","#74563e"]}},
 foundation:{title:"Foundation",category:"Architecture",attachment:true,fields:{foundationCorners:["Wrap stone corners",true],foundationHeight:["Stone base height",.65,.2,1.3,.05],foundationCourses:["Stone courses",3,1,6,1],foundationColor:["Stone","#928878"],foundationVariation:["Variation",.15,0,.3,.01]}},
 facadeDetails:{title:"Facade Details",category:"Architecture",attachment:true,fields:{facadeBelts:["Storey belts",true],facadeSills:["Window sills",true],facadeCanopy:["Door canopy",true],facadeColor:["Trim color","#624c39"]}},
 chimney:{title:"Chimney",category:"Architecture",attachment:true,fields:{chimneyWidth:["Width",.65,.35,1.2,.05],chimneyHeight:["Above roof",1.5,.6,3,.1],chimneyColor:["Masonry","#937b63"]}}
};
function architectureStairPlan(W,D,H,thick,settings){if(!settings)return null;const availableX=W-thick-.5,availableZ=D-thick-.6,width=Math.min(settings.stairsWidth,(availableX-.12)/2),landing=Math.min(width,availableZ*.3),steps=Math.max(3,Math.ceil(H/(2*settings.stairsRiser))),run=Math.min(steps*settings.stairsTread,availableZ-landing),tread=run/steps;if(width<.5||tread<.14)return null;const span=2*width+.12,cx=(settings.stairsPositionX||0)*Math.max(0,(availableX-span)/2),cz=(settings.stairsPositionZ||0)*Math.max(0,(availableZ-run-landing)/2);return {width,landing,steps,run,tread,span,centerX:cx,x0:cx-span/2,x1:cx+span/2,z0:cz-(run+landing)/2,z1:cz+(run+landing)/2};}
function architectureWallDetails(attachments,{width,H,level,origin,angle,thick,holes,box,geom,graph,side,isHouse=false}){
 const medieval=attachments.find(a=>a.type==='medievalStyle');
 const foundation=medieval?.params.medievalStoneGround?{nodeId:medieval.nodeId,params:{foundationCorners:true,foundationHeight:H,foundationCourses:medieval.params.medievalStoneCourses,foundationColor:medieval.params.medievalStoneColor,foundationVariation:.10}}:attachments.find(a=>a.type==='foundation');if(foundation&&level===1){const p=foundation.params,height=medieval?.params.medievalStoneGround?H:Math.min(p.foundationHeight,H*.45),rows=p.foundationCourses,trim=isHouse&&p.foundationCorners?.36:0,cols=Math.max(2,Math.ceil(width/.55)),cw=width/cols,baseDepth=medieval?.params.medievalStoneGround?(attachments.find(a=>a.type==='floor')?.params.floorThickness||.15):0,rh=(height+baseDepth)/rows;for(let row=0;row<rows;row++)for(let col=-1;col<cols;col++){const bonded=!!(medieval?.params.medievalStoneGround&&isHouse&&p.foundationCorners),rowTrim=bonded?architectureCornerBond(row,side):trim,span=width-2*rowTrim,count=Math.max(1,Math.round(span/.55)),fitted=span/count;const x0=bonded?-width/2+rowTrim+col*fitted:Math.max(-width/2+trim,-width/2+(col+(row%2)*.5)*cw),x1=bonded?x0+fitted:Math.min(width/2-trim,-width/2+(col+1+(row%2)*.5)*cw),y0=row*rh-baseDepth,y1=y0+rh;if(bonded&&(col<0||col>=count))continue;if(x1<=x0)continue;let pieces=[[x0,y0,x1,y1]];for(const hole of holes){const next=[];for(const r of pieces){const l=Math.max(r[0],hole.x0),rt=Math.min(r[2],hole.x1),lo=Math.max(r[1],hole.y0),hi=Math.min(r[3],hole.y1);if(l>=rt||lo>=hi){next.push(r);continue;}next.push([r[0],r[1],l,r[3]],[rt,r[1],r[2],r[3]],[l,r[1],rt,lo],[l,hi,rt,r[3]]);}pieces=next.filter(r=>r[2]-r[0]>.02&&r[3]-r[1]>.02);}
 const rand=geometryNodePrng((graph.seed+row*331+col*7919+side.length*43)>>>0),color='#'+new THREE.Color(p.foundationColor).multiplyScalar(1+(rand()-.5)*p.foundationVariation).getHexString();for(const r of pieces){
  if(medieval?.params.medievalStoneGround){const w=r[2]-r[0]-.012,h=r[3]-r[1]-.012,d=.075+rand()*.025,g=architectureRubbleRock(w,h,d,rand);g.translate((r[0]+r[2])/2,(r[1]+r[3])/2,thick/2+.065);geom(g,'rough wall rock',color,origin,angle,foundation.nodeId);}
  else box('foundation stone',(r[0]+r[2])/2,(r[1]+r[3])/2,thick/2+.04,r[2]-r[0]-.008,r[3]-r[1]-.008,.065,color,origin,angle,foundation.nodeId);
 }}}
 if(medieval?.params.medievalStoneGround&&level===1){
  const floorDepth=attachments.find(a=>a.type==='floor')?.params.floorThickness||.15;
  box('stone floor-edge backing',0,-floorDepth/2,0,width,floorDepth,thick+.035,medieval.params.medievalStoneColor,origin,angle,medieval.nodeId);
  const frameWidth=.15,frameDepth=.10,front=thick/2+.15;
  for(const r of holes){const w=r.x1-r.x0,h=r.y1-r.y0,cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,color=r.settings.windowColor||r.settings.doorColor||'#604a36';
   box('stone opening left surround',r.x0-frameWidth/2,cy,front,frameWidth,h,frameDepth,color,origin,angle,r.source);
   box('stone opening right surround',r.x1+frameWidth/2,cy,front,frameWidth,h,frameDepth,color,origin,angle,r.source);
   box('stone opening lintel',cx,r.y1+frameWidth/2,front,w+2*frameWidth,frameWidth,frameDepth,color,origin,angle,r.source);
   const dep=thick+.24,lip=.045;
box('wood left reveal',r.x0+lip/2,cy,.04,lip,h,dep,color,origin,angle,r.source);
box('wood right reveal',r.x1-lip/2,cy,.04,lip,h,dep,color,origin,angle,r.source);
box('wood head reveal',cx,r.y1-lip/2,.04,w-2*lip,lip,dep,color,origin,angle,r.source);
if(r.y0>0)box('wood sill reveal',cx,r.y0+lip/2,.04,w-2*lip,lip,dep,color,origin,angle,r.source);
else box('wood door threshold',cx,-.025,.075,w+2*frameWidth+.06,.12,dep+.13,color,origin,angle,r.source);
if(r.y0>0)box('stone window bottom surround',cx,r.y0-frameWidth/2,front,w+2*frameWidth,frameWidth,frameDepth,color,origin,angle,r.source);
  }
 }
 const details=attachments.find(a=>a.type==='facadeDetails');if(!details)return;const p=details.params;
 if(p.facadeBelts){box('storey cornice',0,H-.08,thick/2+.075,width+.12,.16,.13,p.facadeColor,origin,angle,details.nodeId);for(let i=0;i<Math.max(2,Math.floor(width));i++)box('eaves bracket',-width/2+.4+i*(width-.8)/Math.max(1,Math.floor(width)-1),H-.1875,thick/2+(medieval?.params.medievalStoneGround&&level===1?.14:.07),.1,.415,(medieval?.params.medievalStoneGround&&level===1?.24:.12),p.facadeColor,origin,angle,details.nodeId);}
 for(const r of holes){const w=r.x1-r.x0,cx=(r.x0+r.x1)/2;if(r.kind==='window'&&p.facadeSills){box('window sill',cx,r.y0-.08,thick/2+.10,w+.24,.12,.27,p.facadeColor,origin,angle,details.nodeId);for(const sign of[-1,1])box('sill bracket',cx+sign*w*.34,r.y0-.23,thick/2+.06,.09,.25,.14,p.facadeColor,origin,angle,details.nodeId);}if(r.kind==='door'&&p.facadeCanopy){const g=new THREE.BoxGeometry(w+.5,.075,.72);g.rotateX(.3);g.translate(cx,r.y1+.22,thick/2+.3);geom(g,'door canopy',p.facadeColor,origin,angle,details.nodeId);for(const sign of[-1,1])box('canopy bracket',cx+sign*(w/2+.08),r.y1+.02,thick/2+.13,.08,.3,.28,p.facadeColor,origin,angle,details.nodeId);}}
}
function architectureBuildStairs(plan,settings,levels,H,attic,emitBox,emitGeom,source){
 function box(name,x,y,z,...rest){return emitBox(name,x+(plan.centerX||0),y+.018,z,...rest);}
 function geom(g,...rest){g.translate(plan.centerX||0,.018,0);return emitGeom(g,...rest);}
if(!plan)return;const flights=levels-1+(attic?1:0),{width,steps,tread,span,z0,run,landing}=plan,color=settings.stairsColor;
 function rail(a,b){const delta=b.clone().sub(a),g=new THREE.BoxGeometry(.055,delta.length(),.055);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());geom(g,'stair handrail',color,new THREE.Vector3(),0,source);}
 function guard(ax,az,bx,bz,y){rail(new THREE.Vector3(ax,y+.98,az),new THREE.Vector3(bx,y+.98,bz));const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/.16));for(let i=0;i<=n;i++)box('stairwell guard',ax+(bx-ax)*i/n,y+.48,az+(bz-az)*i/n,.045,.96,.045,color,new THREE.Vector3(),0,source);}
if(settings.stairsRails)for(let l=1;l<=flights;l++){const a=-span/2-.115,b=span/2+.115,c=z0-.06,d=z0+run+landing+.06;guard(a,c,a,d,l*H);guard(b,c,b,d,l*H);guard(a,d,b,d,l*H);if(l===flights)guard(a,c,-.06,c,l*H);}
for(let floor=0;floor<flights;floor++){const base=floor*H,rise=H/(2*steps);for(let i=0;i<steps;i++){const y1=base+(i+1)*rise,y2=base+H/2+(i+1)*rise;box('stair ascending left',-width/2-.06,y1-.05,z0+(i+.5)*tread,width,.10,tread+.006,color,new THREE.Vector3(),0,source);box('stair left riser',-width/2-.06,y1-rise/2,z0+i*tread+.025,width,rise,.05,color,new THREE.Vector3(),0,source);box('stair returning right',width/2+.06,y2-.05,z0+run-(i+.5)*tread,width,.10,tread+.006,color,new THREE.Vector3(),0,source);box('stair right riser',width/2+.06,y2-rise/2,z0+run-i*tread-.025,width,rise,.05,color,new THREE.Vector3(),0,source);}
 box('half landing',0,base+H/2-.06,z0+run+landing/2,span,.12,landing,color,new THREE.Vector3(),0,source);
 if(settings.stairsRails){
 rail(new THREE.Vector3(-.06,base+.85,z0),new THREE.Vector3(-.06,base+H/2+.85,z0+run));
 rail(new THREE.Vector3(.06,base+H+.85,z0),new THREE.Vector3(.06,base+H/2+.85,z0+run));
 for(const x of[-.06,.06])for(let i=0;i<=steps;i+=Math.max(1,Math.floor(steps/4))){const y=base+(x<0?i*rise:H-i*rise);box('inner stair baluster',x,y+.425,z0+i*tread,.045,.85,.045,color,new THREE.Vector3(),0,source);}
 rail(new THREE.Vector3(-span/2,base+H/2+.85,z0+run+landing),new THREE.Vector3(span/2,base+H/2+.85,z0+run+landing));
 for(const x of[-span/2,span/2])rail(new THREE.Vector3(x,base+H/2+.85,z0+run),new THREE.Vector3(x,base+H/2+.85,z0+run+landing));
 rail(new THREE.Vector3(-span/2,base+.85,z0),new THREE.Vector3(-span/2,base+H/2+.85,z0+run));rail(new THREE.Vector3(span/2,base+H+.85,z0),new THREE.Vector3(span/2,base+H/2+.85,z0+run));for(const x of[-span/2,span/2])for(let i=0;i<=steps;i+=Math.max(1,Math.floor(steps/3))){const y=base+(x<0?i*rise:H-i*rise),z=z0+i*tread;box('stair baluster',x,y+.425,z,.055,.85,.055,color,new THREE.Vector3(),0,source);}}
 }
}
function architectureInteriorAndCorners(attachments,{W,D,H,levels,thick,stairPlan,box,graph,stoneInset=0,geom}){
 const origin=new THREE.Vector3(),medieval=attachments.find(a=>a.type==='medievalStyle'),foundation=medieval?.params.medievalStoneGround?{nodeId:medieval.nodeId,params:{foundationCorners:true,foundationHeight:H,foundationCourses:medieval.params.medievalStoneCourses,foundationColor:medieval.params.medievalStoneColor,foundationVariation:.10}}:attachments.find(a=>a.type==='foundation');
 if(foundation?.params.foundationCorners){const p=foundation.params,height=medieval?.params.medievalStoneGround?H:Math.min(p.foundationHeight,H*.45),baseDepth=medieval?.params.medievalStoneGround?(attachments.find(a=>a.type==='floor')?.params.floorThickness||.15):0,rh=(height+baseDepth)/p.foundationCourses;
  for(const sx of[-1,1])for(const sz of[-1,1])for(let row=0;row<p.foundationCourses;row++){
   const bonded=!!medieval?.params.medievalStoneGround,xReach=bonded?architectureCornerBond(row,'front'):.36,zReach=bonded?architectureCornerBond(row,'left'):.36;const x0=W/2-stoneInset-xReach,x1=W/2-stoneInset+thick/2+.08,z0=D/2-stoneInset-zReach,z1=D/2-stoneInset+thick/2+.08,turn=D/2-stoneInset-.04;
   const rng=geometryNodePrng((graph.seed+row*331+(sx+2)*7919+(sz+2)*43)>>>0),color='#'+new THREE.Color(p.foundationColor).multiplyScalar(1+(rng()-.5)*p.foundationVariation).getHexString();
   if(medieval?.params.medievalStoneGround){
    const xt=W/2-stoneInset-.04,ex=x1+.012+rng()*.035,ez=z1+.012+rng()*.035,ch=.025+rng()*.04,points=[[xt,z0+.012],[ex-ch,z0+.012],[ex,z0+ch],[ex,ez-ch],[ex-ch,ez],[x0+ch,ez],[x0+.012,ez-ch],[x0+.012,turn],[xt,turn]],shape=new THREE.Shape();
    points.forEach((p,i)=>{const x=sx*p[0],z=-sz*p[1];if(i)shape.lineTo(x,z);else shape.moveTo(x,z);});shape.closePath();
    // One continuous L-shaped stone removes the exposed split between two corner blocks.
    const g=new THREE.ExtrudeGeometry(shape,{depth:rh-.048,bevelEnabled:true,bevelSize:.01+rng()*.008,bevelThickness:.01,bevelSegments:1,steps:1});g.rotateX(-Math.PI/2);g.translate(0,row*rh-baseDepth+.024,0);geom(g,'joined masonry corner',color,origin,0,foundation.nodeId);
   }else{
    box('stone corner front',sx*(x0+x1)/2,(row+.5)*rh,sz*(turn+z1)/2,x1-x0,rh-.008,z1-turn,color,origin,0,foundation.nodeId);
    box('stone corner return',sx*(W/2-stoneInset-.04+x1)/2,(row+.5)*rh,sz*(z0+turn)/2,x1-(W/2-stoneInset-.04),rh-.008,turn-z0,color,origin,0,foundation.nodeId);
   }
  }
 }
 const emitted=[];
 for(const node of attachments.filter(a=>a.type==='interiorPartition')){
  const p=node.params;if(p.partitionLevel>levels)continue;
  const inset=p.partitionLevel===1?stoneInset:0,alongX=p.partitionAxis==='width',length=(alongX?W:D)-thick-2*inset,cross=(alongX?D:W)-thick-2*inset,t=p.partitionThickness,base=(p.partitionLevel-1)*H;
  const pos=p.partitionPosition*(cross-t)/2,doorWidth=Math.min(p.partitionDoorWidth,length-.2),doorHeight=Math.min(p.partitionDoorHeight,H-.15),doorCenter=p.partitionDoorPosition*(length-doorWidth)/2;
  let pieces=[[-length/2,0,length/2,H]];
  function cut(a,b,c,d){const next=[];for(const r of pieces){const x0=Math.max(r[0],a),x1=Math.min(r[2],c),y0=Math.max(r[1],b),y1=Math.min(r[3],d);if(x0>=x1||y0>=y1)next.push(r);else next.push([r[0],r[1],x0,r[3]],[x1,r[1],r[2],r[3]],[x0,r[1],x1,y0],[x0,y1,x1,r[3]]);}pieces=next.filter(r=>r[2]-r[0]>.001&&r[3]-r[1]>.001);}
  if(p.partitionDoor)cut(doorCenter-doorWidth/2,0,doorCenter+doorWidth/2,doorHeight);
  const obstacles=[];
  if(stairPlan)obstacles.push([stairPlan.x0-.45,stairPlan.z0-.65,stairPlan.x1+.45,stairPlan.z1+.45]);
  const chimney=attachments.find(a=>a.type==='chimney');
  if(chimney){const size=Math.min(chimney.params.chimneyWidth,W*.22,D*.22),cx=-W*.27,cz=-D*.25;obstacles.push([cx-size/2-.2,cz-size/2-.2,cx+size/2+.2,cz+size/2+(p.partitionLevel===1?1:.2)]);}
  for(const q of obstacles){const a=alongX?q[1]:q[0],b=alongX?q[3]:q[2];if(pos+t/2>a&&pos-t/2<b)cut(alongX?q[0]:q[1],0,alongX?q[2]:q[3],H);}
  // Subtract previously emitted walls, so crossing partitions do not share faces.
  for(const q of emitted){if(q.level!==p.partitionLevel)continue;const a=alongX?q.z0:q.x0,b=alongX?q.z1:q.x1;if(pos+t/2>a&&pos-t/2<b)cut(alongX?q.x0:q.z0,q.y0,alongX?q.x1:q.z1,q.y1);}
  for(const r of pieces){const mid=(r[0]+r[2])/2,y=(r[1]+r[3])/2,x=alongX?mid:pos,z=alongX?pos:mid,w=alongX?r[2]-r[0]:t,d=alongX?t:r[2]-r[0];box('room partition storey '+p.partitionLevel,x,base+y,z,w,r[3]-r[1],d,p.partitionColor,origin,0,node.nodeId);emitted.push({level:p.partitionLevel,x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:r[1],y1:r[3]});}
 }
}
function architectureRubbleRock(width,height,depth,rng){
 const w=Math.max(.005,width),h=Math.max(.005,height),d=Math.max(.005,depth),bevel=Math.min(.024,w*.12,h*.12,d*.2),x=w/2-bevel,y=h/2-bevel;
 const c=()=>.14+rng()*.2;
 const points=[[-x,-y+h*c()*.5],[-x+w*c()*.5,-y],[x-w*c()*.5,-y],[x,-y+h*c()*.5],[x,y-h*c()*.5],[x-w*c()*.5,y],[-x+w*c()*.5,y],[-x,y-h*c()*.5]];
 const shape=new THREE.Shape();shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,d-2*bevel),bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1});g.translate(0,0,-(d-2*bevel)/2);g.computeVertexNormals();return g;
}
function architectureCornerBond(row,side){const front=side==='front'||side==='back';return ((row%2===0)===front)?.55:.25;}

// geometry-building
const BWS_BUILDING_NODES={
 ...BWS_BUILDING_DETAIL_NODES,
 houseBatch:{title:"House Batch",category:"Architecture",attachment:true,fields:{batchCount:["House count",60,1,100,1],batchColumns:["Town columns",10,1,20,1],batchSpacing:["Plot spacing",24,8,70,1],batchVariation:["Size variation",.25,0,.5,.05],batchStoreys:["Vary storeys",true],batchPalette:["Vary palette",true]}},
 houseLayout:{title:"House Layout",category:"Architecture",fields:{buildingWidth:["Width",6,2,32,.25],buildingDepth:["Depth",5,2,32,.25],buildingStoreys:["Storeys",2,1,3,1],buildingStoreyHeight:["Storey height",3,2,5,.1],buildingWallDepth:["Wall thickness",.24,.1,.6,.02],buildingBays:["Frame bays",3,1,12,1],buildingBeam:["Beam width",.16,.06,.3,.01],buildingPlaster:["Plaster","#b1a58b"],buildingTimber:["Timber","#65462e"]}},
 floor:{title:"Floor",category:"Architecture",attachment:true,fields:{floorStyle:["Surface","boards",["boards","stone"]],floorDivisions:["Divisions",8,2,16,1],floorThickness:["Thickness",.15,.05,.3,.01],floorColor:["Surface color","#846747"]}},
 window:{title:"Window",category:"Architecture",attachment:true,fields:{windowSide:["Wall","all",["front","back","left","right","all"]],windowLevel:["Storey",2,1,3,1],windowCount:["Count per wall",1,0,12,1],windowPerSide:["Use separate side counts",false],windowFrontCount:["Front windows",1,0,12,1],windowBackCount:["Back windows",1,0,12,1],windowLeftCount:["Left windows",1,0,12,1],windowRightCount:["Right windows",1,0,12,1],windowWidth:["Width",1.1,.3,3,.1],windowHeight:["Height",1.3,.3,3,.1],windowSill:["Sill height",.85,.1,2,.05],windowStyle:["Style","cross",["cross","plain","shutters"]],windowColor:["Frame color","#685039"]}},
 door:{title:"Door",category:"Architecture",attachment:true,fields:{doorSide:["Wall","front",["front","back","left","right"]],doorLevel:["Storey",1,1,3,1],doorWidth:["Width",1.2,.4,3,.1],doorHeight:["Height",2.1,1,3,.1],doorPosition:["Horizontal position",0,-.8,.8,.05],doorStyle:["Style","planks",["planks","open"]],doorColor:["Wood","#785234"]}},
 opening:{title:"Opening",category:"Architecture",attachment:true,fields:{openingSide:["Wall","front",["front","back","left","right"]],openingLevel:["Storey",1,1,3,1],openingWidth:["Width",1.2,.3,4,.1],openingHeight:["Height",2,.3,3,.1],openingSill:["Bottom height",0,0,2,.05],openingPosition:["Horizontal position",0,-.8,.8,.05]}},
 roof:{title:"Roof",category:"Architecture",attachment:true,fields:{roofRidgeTiles:["Rounded ridge caps",true],roofRidgeLength:["Ridge tile length",.65,.3,1.5,.05],roofRise:["Rise",2,.3,5,.1],roofOverhang:["Overhang",.35,.05,1,.05],roofRows:["Tile courses",10,2,16,1],roofColumns:["Tiles along ridge",14,2,20,1],roofVariation:["Seed color variation",.16,0,.35,.01],roofStyle:["Tile style","clay",["clay","slate","shingles","curved","scalloped"]],roofColor:["Tile color","#86513b"]}},
 diagonalBracing:{title:"Diagonal Bracing",category:"Architecture",attachment:true,fields:{braceStyle:["Pattern","alternating",["slash","alternating","cross"]],braceWidth:["Width",.13,.04,.25,.01]}}
};
function buildingAttachments(graph,sourceId,active){const out=[],seen=new Set([sourceId]),queue=[sourceId];while(queue.length){const id=queue.shift();for(const c of graph.connections.filter(c=>c.fromNodeId===id)){if(seen.has(c.toNodeId)||!active.has(c.toNodeId))continue;seen.add(c.toNodeId);const type=geometryNodeTypeForId(graph,c.toNodeId);if(BWS_BUILDING_NODES[type]?.attachment){out.push({type,nodeId:c.toNodeId,params:assetNodeSanitize(graph.nodeParams?.[c.toNodeId]||graph.params)});queue.push(c.toNodeId);}else if(type==="join"||type==="transform")queue.push(c.toNodeId);}}return out;}
function buildArchitecture(type,p,ctx){
 const {graph,nodeId,group,outputName,emit,attachments=[]}=ctx;
 const isHouse=type==="houseLayout",W=isHouse?p.buildingWidth:p.houseWidth,D=isHouse?p.buildingDepth:.24,H=isHouse?p.buildingStoreyHeight:p.houseHeight,levels=isHouse?p.buildingStoreys:1;
 const thick=isHouse?p.buildingWallDepth:p.houseDepth,beam=Math.min(isHouse?p.buildingBeam:p.houseBeam,W*.1,H*.1),bays=isHouse?p.buildingBays:p.houseBays;
 const plaster=isHouse?p.buildingPlaster:p.housePanel,timber=isHouse?p.buildingTimber:p.houseTimber;
 const stairNode=isHouse?attachments.find(a=>a.type==='staircase'):null;
 const planInset=isHouse&&attachments.find(a=>a.type==='medievalStyle')?.params.medievalStoneGround?Math.min(attachments.find(a=>a.type==='medievalStyle').params.medievalStoneInset,(Math.min(W,D)-2)/2):0;
 const stairPlan=architectureStairPlan(W-2*planInset,D-2*planInset,H,thick,stairNode?.params);
 const attic=!!(stairPlan&&stairNode.params.stairsAttic&&attachments.some(a=>a.type==='roof'));
 const medieval=attachments.find(a=>a.type==='medievalStyle');
 const effectiveRoofRise=rise=>{if(medieval?.params.medievalSteepRoof)rise=Math.max(rise,(W/2+(attachments.find(a=>a.type==='roof')?.params.roofOverhang||0))*Math.tan(THREE.MathUtils.degToRad(medieval.params.medievalRoofPitch)));return attic?Math.max(rise,2.25/Math.max(.25,1-(Math.max(Math.abs(stairPlan.x0),Math.abs(stairPlan.x1))+.10)/(W/2))):rise;};
 const offset=new THREE.Vector3(p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ);let serial=0;
 function geom(g,name,color,position=new THREE.Vector3(),rotation=0,source=nodeId){g.rotateY(rotation);g.translate(position.x+offset.x,position.y+offset.y,position.z+offset.z);emit(geometryNodeCustomSpec(g,{name:outputName+' '+nodeId+' '+name+' '+(++serial),position:[0,0,0],color,group,graph,targetId:source}));}
 function box(name,x,y,z,w,h,d,color,origin=new THREE.Vector3(),angle=0,source=nodeId){if(Math.min(w,h,d)<.00001)return;const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);geom(g,name,color,origin,angle,source);}
 function polygon(points,depth,name,color,origin,angle){if(points.length<3)return;let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}if(Math.abs(area)<1e-8)return;const shape=new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(v=>shape.lineTo(...v));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});g.translate(0,0,-depth/2);geom(g,name,color,origin,angle);}
 function clip(poly,a,b,inside=true){const out=[],cross=v=>(b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0]);for(let i=0;i<poly.length;i++){const v=poly[i],w=poly[(i+1)%poly.length],dv=cross(v),dw=cross(w),iv=inside?dv>=-1e-9:dv<=1e-9,iw=inside?dw>=-1e-9:dw<=1e-9;if(iv)out.push(v);if(iv!==iw){const t=dv/(dv-dw);out.push([v[0]+t*(w[0]-v[0]),v[1]+t*(w[1]-v[1])]);}}return out;}
 function partition(poly,cutter){let remaining=poly;const outside=[];for(let i=0;i<cutter.length&&remaining.length;i++){const a=cutter[i],b=cutter[(i+1)%cutter.length],piece=clip(remaining,a,b,false);if(piece.length>=3)outside.push(piece);remaining=clip(remaining,a,b,true);}return {outside,inside:remaining};}
 const stoneInset=isHouse&&medieval?.params.medievalStoneGround?Math.min(medieval.params.medievalStoneInset,(Math.min(W,D)-2)/2):0;
 const sides=isHouse?[['front',W,new THREE.Vector3(0,0,D/2),0],['back',W,new THREE.Vector3(0,0,-D/2),Math.PI],['left',D,new THREE.Vector3(-W/2,0,0),-Math.PI/2],['right',D,new THREE.Vector3(W/2,0,0),Math.PI/2]]:[['front',W,new THREE.Vector3(),0]];
 for(let level=1;level<=levels;level++)for(const[side,outerWidth,base,angle]of sides){const stoneGround=level===1&&!!medieval?.params.medievalStoneGround,inset=level===1?stoneInset:0,width=outerWidth-2*inset,origin=base.clone().add(new THREE.Vector3(-Math.sin(angle)*inset,(level-1)*H,-Math.cos(angle)*inset)),holes=[];
  function hole(cx,sill,w,h,kind,settings,source){const maxW=width-4*beam;w=Math.min(w,maxW);sill=Math.max(0,Math.min(sill,H-3*beam));h=Math.min(h,H-sill-2*beam);cx=Math.max(-width/2+beam+w/2,Math.min(width/2-beam-w/2,cx));const r={x0:cx-w/2,x1:cx+w/2,y0:sill,y1:sill+h,kind,settings,source};if(holes.some(q=>r.x0-beam<q.x1+beam&&r.x1+beam>q.x0-beam&&r.y0-beam<q.y1+beam&&r.y1+beam>q.y0-beam))return;if(kind==='window'&&level===1&&stairPlan){
 const world=new THREE.Vector3(cx,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(origin),pad=.9;
 const adjacent=(side==='left'||side==='right')?world.x>=stairPlan.x0-pad&&world.x<=stairPlan.x1+pad&&world.z+w/2>stairPlan.z0-.15&&world.z-w/2<stairPlan.z1+.15:world.z>=stairPlan.z0-pad&&world.z<=stairPlan.z1+pad&&world.x+w/2>stairPlan.x0-.15&&world.x-w/2<stairPlan.x1+.15;
 if(adjacent)return;
 }holes.push(r);}
  const balcony=attachments.find(a=>a.type==='balcony' && a.params.balconyLevel===level && a.params.balconySide===side);
  let balconyFit=null;
  if(balcony&&isHouse){const v=balcony.params,bw=Math.min(v.balconyWidth,width-2*beam),dw=Math.min(v.balconyDoorWidth,bw-.2),cx=Math.max(-width/2+beam+bw/2,Math.min(width/2-beam-bw/2,v.balconyPosition*width/2));hole(cx,0,dw,v.balconyDoorHeight,'door',{doorStyle:'planks',doorColor:v.balconyColor},balcony.nodeId);balconyFit={cx,width:bw};}
  const openingNodes=attachments.filter(a=>['window','door','opening'].includes(a.type)).sort((a,b)=>(a.type==='window'?1:0)-(b.type==='window'?1:0));
  for(const a of openingNodes){const v=a.params,k=a.type;if(v[k+'Level']!==level||!(v[k+'Side']==='all'||v[k+'Side']===side))continue;if(k==='window'){const requested=v.windowPerSide?v['window'+side[0].toUpperCase()+side.slice(1)+'Count']:v.windowCount,count=Math.min(requested,Math.max(0,Math.floor((width-2*beam)/(.3+2*beam))));if(!count)continue;const span=(width-2*beam)/count;for(let i=0;i<count;i++)hole(-width/2+beam+span*(i+.5),v.windowSill,Math.min(v.windowWidth,span-2*beam),v.windowHeight,k,v,a.nodeId);}else hole(v[k+'Position']*(width/2-beam),k==='door'?0:v.openingSill,v[k+'Width'],v[k+'Height'],k,v,a.nodeId);}
  if(!isHouse&&!openingNodes.length&&p.houseOpening!=='none')hole(0,p.houseOpening==='window'?p.houseSill:0,p.houseOpeningWidth,p.houseOpeningHeight,'opening',{},nodeId);
  const frames=[[-width/2,0,width/2,beam],[-width/2,H-beam,width/2,H]];
  for(let i=0;i<=bays;i++){const x=-width/2+beam/2+(width-beam)*i/bays;frames.push([x-beam/2,0,x+beam/2,H]);}
  for(const r of holes){frames.push([r.x0-beam,Math.max(0,r.y0-beam),r.x0,r.y1+beam],[r.x1,Math.max(0,r.y0-beam),r.x1+beam,r.y1+beam],[r.x0,r.y1,r.x1,r.y1+beam]);if(r.y0>0)frames.push([r.x0,r.y0-beam,r.x1,r.y0]);}
  const braces=[],bracing=attachments.find(a=>a.type==='diagonalBracing');
  if(bracing&&!stoneGround){const bw=bracing.params.braceWidth;for(let i=0;i<bays;i++){const x0=-width/2+beam+(width-beam)*i/bays,x1=-width/2+(width-beam)*(i+1)/bays,y0=beam,y1=H-beam;for(const flip of(bracing.params.braceStyle==='cross'?[false,true]:[bracing.params.braceStyle==='alternating'&&i%2===1])){const a=[x0,flip?y1:y0],b=[x1,flip?y0:y1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*bw/2,ny=dx/len*bw/2;let q=[[a[0]+nx,a[1]+ny],[a[0]-nx,a[1]-ny],[b[0]-nx,b[1]-ny],[b[0]+nx,b[1]+ny]];braces.push(q);}}}
  const unique=v=>[...new Set(v.map(x=>Math.max(0,Math.min(1,x))))];
  const xs=[...new Set([-width/2,width/2,...frames.flatMap(r=>[r[0],r[2]]),...holes.flatMap(r=>[r.x0,r.x1])])].sort((a,b)=>a-b),ys=[...new Set([0,H,...frames.flatMap(r=>[r[1],r[3]]),...holes.flatMap(r=>[r.y0,r.y1])])].sort((a,b)=>a-b);
  for(let yi=0;yi<ys.length-1;yi++)for(let xi=0;xi<xs.length-1;xi++){const x0=xs[xi],x1=xs[xi+1],y0=ys[yi],y1=ys[yi+1],cx=(x0+x1)/2,cy=(y0+y1)/2;if(x1-x0<1e-6||y1-y0<1e-6||holes.some(r=>cx>r.x0&&cx<r.x1&&cy>r.y0&&cy<r.y1))continue;const framed=frames.some(r=>cx>r[0]&&cx<r[2]&&cy>r[1]&&cy<r[3]);if(framed){box(side+' frame',cx,cy,0,x1-x0,y1-y0,stoneGround?thick:thick+.05,stoneGround?medieval.params.medievalStoneColor:timber,origin,angle);continue;}let pieces=[[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]];for(const brace of braces){const next=[];for(const piece of pieces){const cut=partition(piece,brace);polygon(cut.inside,thick+.05,side+' diagonal',timber,origin,angle);next.push(...cut.outside);}pieces=next;}for(const piece of pieces)polygon(piece,thick,side+' plaster',stoneGround?medieval.params.medievalStoneColor:plaster,origin,angle);}
  architectureWallDetails(attachments,{width,H,level,origin,angle,thick,holes,box,geom,graph,side,isHouse});
  if(balconyFit){const v=balcony.params,cx=balconyFit.cx,bw=balconyFit.width,depth=v.balconyDepth,rh=v.balconyRailHeight,z=thick/2,color=v.balconyColor;
    box('balcony deck',cx,-.075,z+depth/2,bw,.15,depth,color,origin,angle,balcony.nodeId);
    for(let i=0;i<=6;i++)box('balcony front baluster',cx-bw/2+i*bw/6,rh/2,z+depth-.04,.055,rh,.055,color,origin,angle,balcony.nodeId);
    box('balcony front rail',cx,rh,z+depth-.04,bw+.06,.07,.08,color,origin,angle,balcony.nodeId);
    for(const sign of[-1,1]){box('balcony side rail',cx+sign*(bw/2-.025),rh,z+depth/2,.07,.07,depth,color,origin,angle,balcony.nodeId);for(let i=1;i<4;i++)box('balcony side baluster',cx+sign*(bw/2-.025),rh/2,z+i*depth/4,.055,rh,.055,color,origin,angle,balcony.nodeId);
      const start=new THREE.Vector3(cx+sign*bw*.34,-.7,z+.02),end=new THREE.Vector3(cx+sign*bw*.34,-.15,z+depth*.75),delta=end.clone().sub(start),g=new THREE.BoxGeometry(.11,delta.length(),.11);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());geom(g,'balcony support',color,origin,angle,balcony.nodeId);
    }
  }
  for(const r of holes){const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,w=r.x1-r.x0,h=r.y1-r.y0,v=r.settings;if(r.kind==='door'&&v.doorStyle!=='open'){for(let j=0;j<6;j++)box('door plank',r.x0+(j+.5)*w/6,cy+.0275,0,w/6-.006,h-.055,.07,v.doorColor,origin,angle,r.source);box('door handle',r.x1-.12,cy,thick/2+.03,.045,.12,.04,'#393b37',origin,angle,r.source);}if(r.kind==='window'){box('window glass',cx,cy,0,w,h,.025,'#40585c',origin,angle,r.source);if(medieval?.params.medievalLeadedGlass)architectureWindowLeading(w,h,cx,cy,origin,angle,r.source,geom);if(v.windowStyle!=='plain'){box('window mullion',cx,cy,.035,.045,h,.045,v.windowColor,origin,angle,r.source);box('window transom',cx,cy,.035,w,.045,.045,v.windowColor,origin,angle,r.source);}if(v.windowStyle==='shutters')for(const sign of[-1,1])box('open shutter',cx+sign*(w/2+w/4+.06),cy,thick/2+.06,w*.43,h,.05,v.windowColor,origin,angle,r.source);}}
 }
 if(isHouse)architectureInteriorAndCorners(attachments,{W,D,H,levels,thick,stairPlan,box,graph,stoneInset,geom});
 const floor=attachments.find(a=>a.type==='floor') || (stairNode?{params:assetNodeSanitize({}),nodeId:stairNode.nodeId}:null);
 if(isHouse&&floor){const f=floor.params;
  for(let l=0;l<levels+(attic?1:0);l++){
   const inset=l===0?stoneInset:0,iw=W-thick-2*inset,id=D-thick-2*inset;
   const n=f.floorDivisions,rows=f.floorStyle==='stone'?Math.max(1,Math.round(n*id/iw)):1;
   for(let x=0;x<n;x++)for(let z=0;z<rows;z++){
    const x0=-iw/2+x*iw/n,x1=x0+iw/n,z0=-id/2+z*id/rows,z1=z0+id/rows;
    let pieces=[[x0,z0,x1,z1]];
    if(l>0&&stairPlan){const cut={x0:stairPlan.x0-.08,x1:stairPlan.x1+.08,z0:stairPlan.z0-.025,z1:stairPlan.z1+.025};
     const a=Math.max(x0,cut.x0),b=Math.min(x1,cut.x1),c=Math.max(z0,cut.z0),d=Math.min(z1,cut.z1);
     if(a<b&&c<d)pieces=[[x0,z0,a,z1],[b,z0,x1,z1],[a,z0,b,c],[a,d,b,z1]];
    }
    const chimneyNode=attachments.find(a=>a.type==='chimney');
    if(chimneyNode){const size=Math.min(chimneyNode.params.chimneyWidth,W*.22,D*.22),cx=-W*.27,cz=-D*.25,cut=[cx-size/2-.02,cz-size/2-.02,cx+size/2+.02,cz+size/2+.02],next=[];
      for(const q of pieces){const a=Math.max(q[0],cut[0]),b=Math.min(q[2],cut[2]),c=Math.max(q[1],cut[1]),d=Math.min(q[3],cut[3]);if(a>=b||c>=d)next.push(q);else next.push([q[0],q[1],a,q[3]],[b,q[1],q[2],q[3]],[a,q[1],b,c],[a,d,b,q[3]]);}pieces=next;
    }
    for(const q of pieces)if(q[2]-q[0]>.006&&q[3]-q[1]>.006)box('floor '+(l+1),(q[0]+q[2])/2,l*H+.018-f.floorThickness/2,(q[1]+q[3])/2,q[2]-q[0]-.005,f.floorThickness,q[3]-q[1]-.005,f.floorColor,new THREE.Vector3(),0,floor.nodeId);
   }
  }
 }
 if(stairNode&&stairPlan)architectureBuildStairs(stairPlan,stairNode.params,levels,H,attic,box,geom,stairNode.nodeId);
 const roof=attachments.find(a=>a.type==='roof');
 if(isHouse&&roof){const r=roof.params,half=W/2+r.roofOverhang,length=D+2*r.roofOverhang,rise=effectiveRoofRise(r.roofRise),pitch=Math.atan2(rise,half),slant=Math.hypot(half,rise),base=levels*H,cos=Math.cos(pitch),sin=Math.sin(pitch);
  const stack=attachments.find(a=>a.type==='chimney'),size=stack?Math.min(stack.params.chimneyWidth,W*.22,D*.22):0,cx=-W*.27,cz=-D*.25;
  function panel(sign,u0,u1,z0,z1,depth,shift,label,color,source){if(['curved','scalloped','shingles'].includes(r.roofStyle)&&label!=='roof backing'){const lap=Math.min(.12,slant/r.roofRows*.16);u1=Math.min(slant,u1+lap);}let pieces=[[u0,z0,u1,z1]];
    if(stack){const clearance=label==='roof backing'?-.025:.015;const a=Math.max(u0,Math.min(sign*(cx-size/2-clearance),sign*(cx+size/2+clearance))/cos),b=Math.min(u1,Math.max(sign*(cx-size/2-clearance),sign*(cx+size/2+clearance))/cos),c=Math.max(z0,cz-size/2-clearance),d=Math.min(z1,cz+size/2+clearance);if(a<b&&c<d)pieces=[[u0,z0,a,z1],[b,z0,u1,z1],[a,z0,b,c],[a,d,b,z1]];}
    const mid=(u0+u1)/2,zc=(z0+z1)/2;
const original=r.roofStyle==='curved'&&label!=='roof backing'?architectureCurvedRoofTile(u1-u0,z1-z0,sign):r.roofStyle==='scalloped'&&label!=='roof backing'?architectureScallopedTile(u1-u0,z1-z0,sign):new THREE.BoxGeometry(u1-u0,depth,z1-z0);
for(const q of pieces){if(q[2]-q[0]<.0001||q[3]-q[1]<.0001)continue;const a=sign*(q[0]-mid),b=sign*(q[2]-mid),g=pieces.length===1&&q[0]===u0&&q[1]===z0&&q[2]===u1&&q[3]===z1?original.clone():architectureClipTile(original,Math.min(a,b),Math.max(a,b),q[1]-zc,q[3]-zc);g.rotateZ(-sign*pitch);g.translate(sign*mid*cos,base+rise-mid*sin+shift,zc);geom(g,label,color,new THREE.Vector3(),0,source);}original.dispose();
  }
  for(const sign of[-1,1]){panel(sign,0,slant,-length/2,length/2,.24,-.055-.0825/cos,'roof backing',timber,nodeId);
    for(let row=0;row<r.roofRows;row++)for(let col=0;col<r.roofColumns;col++){const rng=geometryNodePrng((graph.seed+row*19349663+col*73856093+(sign+1)*83492791)>>>0),color='#'+new THREE.Color(r.roofColor).multiplyScalar(1+(rng()-.5)*r.roofVariation).getHexString();panel(sign,row*slant/r.roofRows+.002,(row+1)*slant/r.roofRows-.002,-length/2+col*length/r.roofColumns+.003,-length/2+(col+1)*length/r.roofColumns-.003,r.roofStyle==='clay'?.065:.035,.015,'roof '+r.roofStyle+' tile',color,roof.nodeId);}
  }
  // Gable peaks and eave fillers meet the actual underside of the pitched backing.
  const under=.055+.2025/cos,peak=base+rise-under,eave=base+rise*(1-W/(2*half))-under;
  for(const sign of[-1,1]){{
    const outline=[[-W/2,base],[W/2,base],[W/2,eave],[0,peak],[-W/2,eave]],origin=new THREE.Vector3(0,0,sign*D/2);
    if(medieval?.params.medievalGableTimber){
     const strips=[],b=Math.min(beam,.18),n=medieval.params.medievalGableBays;
     function band(a,c){const dx=c[0]-a[0],dy=c[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*b/2,ny=dx/len*b/2;strips.push([[a[0]+nx,a[1]+ny],[a[0]-nx,a[1]-ny],[c[0]-nx,c[1]-ny],[c[0]+nx,c[1]+ny]]);}
     for(let i=0;i<=n;i++){const x=-W/2+i*W/n;band([x,base],[x,peak+.1]);}
     for(const f of[0,.36,.7])band([-W/2,base+(peak-base)*f],[W/2,base+(peak-base)*f]);
     band([-W/2,eave],[0,peak]);band([0,peak],[W/2,eave]);
     band([-W*.40,base],[0,base+(peak-base)*.70]);band([W*.40,base],[0,base+(peak-base)*.70]);
     let remaining=[outline];
     for(const strip of strips){const next=[];for(const piece of remaining){const cut=partition(piece,strip);polygon(cut.inside,thick+.055,'gable timber',timber,origin,0);next.push(...cut.outside);}remaining=next;}
     for(const piece of remaining)polygon(piece,thick,'gable infill',plaster,origin,0);
    }else polygon(outline,thick,'fitted gable',plaster,origin,0);
   }if(eave>base)box('eave wall closure',sign*W/2,(base+eave)/2,0,thick,eave-base,D,plaster);}
  if(stack){const c=stack.params,roofAtStack=base+rise*(1-Math.abs(cx)/half),top=roofAtStack+c.chimneyHeight,wall=Math.min(.12,size*.2),courses=Math.max(3,Math.ceil(top/.25));
    for(let row=0;row<courses;row++){const y=(row+.5)*top/courses,ch=top/courses;for(const sign of[-1,1]){box('continuous chimney side',cx+sign*(size-wall)/2,y,cz,wall,ch,size,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);box('continuous chimney face',cx,y,cz+sign*(size-wall)/2,size-2*wall,ch,wall,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);}}
    for(const sign of[-1,1]){box('chimney cap',cx+sign*(size-wall)/2,top+.04,cz,wall+.05,.10,size+.08,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);box('chimney cap',cx,top+.04,cz+sign*(size-wall)/2,size-2*wall,.10,wall+.05,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);}
    for(let l=0;l<levels+(attic?1:0);l++){const o=size+.24,i=size-.02,y=l*H+.035;for(const sign of[-1,1]){box('chimney hearth side',cx+sign*(i+o)/4,y,cz,(o-i)/2,.045,o,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);box('chimney hearth return',cx,y,cz+sign*(i+o)/4,i,.045,(o-i)/2,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);}}
box('stove hearth',cx,.015,cz+size/2+.46,size*1.1+.28,.06,.96,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);
const inner=size-.015,outer=size+.18;
function flashing(x0,x1,z0,z1){const sh=new THREE.Shape();sh.moveTo(x0,-z0);sh.lineTo(x1,-z0);sh.lineTo(x1,-z1);sh.lineTo(x0,-z1);sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth:.29,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,-.265,0);const p=g.getAttribute('position'),lift=r.roofStyle==='curved'?.09+(length/r.roofColumns)*.43: .21;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+base+rise-Math.abs(p.getX(i))*Math.tan(pitch)+lift);g.computeVertexNormals();geom(g,'chimney flashing','#55544d',new THREE.Vector3(),0,stack.nodeId);}
for(const sign of[-1,1]){const a=cx+sign*inner/2,b=cx+sign*outer/2;flashing(Math.min(a,b),Math.max(a,b),cz-outer/2,cz+outer/2);const c=cz+sign*inner/2,d=cz+sign*outer/2;flashing(cx-inner/2,cx+inner/2,Math.min(c,d),Math.max(c,d));}
    const stoveZ=cz+size/2+.38,iron='#363a38';box('stove body',cx,.40,stoveZ,size*1.1,.6,.55,iron,new THREE.Vector3(),0,stack.nodeId);box('stove door',cx,.42,stoveZ+.29,size*.78,.34,.035,'#222825',new THREE.Vector3(),0,stack.nodeId);box('stove handle',cx+size*.25,.42,stoveZ+.325,.04,.15,.045,'#8b8573',new THREE.Vector3(),0,stack.nodeId);
    for(const x of[-1,1])for(const z of[-1,1])box('stove foot',cx+x*size*.37,.075,stoveZ+z*.20,.07,.15,.07,iron,new THREE.Vector3(),0,stack.nodeId);
    const pipeRadius=Math.min(.07,size*.12),vertical=new THREE.CylinderGeometry(pipeRadius,pipeRadius,.42,10);vertical.translate(cx,.9,stoveZ);geom(vertical,'stove flue upright',iron,new THREE.Vector3(),0,stack.nodeId);
    const pipeLength=stoveZ-cz,connector=new THREE.CylinderGeometry(pipeRadius,pipeRadius,pipeLength,10);connector.rotateX(Math.PI/2);connector.translate(cx,1.11,(stoveZ+cz)/2);geom(connector,'stove to chimney connection',iron,new THREE.Vector3(),0,stack.nodeId);
  }
  if(r.roofRidgeTiles){
   const count=Math.max(1,Math.ceil(length/r.roofRidgeLength)),step=length/count,overlap=Math.min(.10,step*.18);
   const radius=Math.max(.24,Math.min(.65,length/r.roofColumns*.5)),thickness=.025;
   for(let i=0;i<count;i++){
    const z0=-length/2+i*step,z1=Math.min(length/2,z0+step+(i<count-1?overlap:0)),span=z1-z0;
    // The wider socket of each cap fits over the narrower end of its neighbour.
    const g=assetNodeSector([[-span/2,radius, radius-thickness],[span/2,radius+.045,radius+.045-thickness]],0,Math.PI,16);
    g.rotateX(-Math.PI/2);g.translate(0,base+rise+.04,(z0+z1)/2);
    const rng=geometryNodePrng((graph.seed+i*7919+104729)>>>0),color='#'+new THREE.Color(r.roofColor).multiplyScalar(1+(rng()-.5)*r.roofVariation).getHexString();
    geom(g,'rounded ridge tile '+(i+1),color,new THREE.Vector3(),0,roof.nodeId);
   }
  }else box('ridge cap',0,base+rise+.055,0,.13,.1,length,r.roofColor,new THREE.Vector3(),0,roof.nodeId);
 }
 return serial;
}
function architectureCurvedRoofTile(length,width,slopeSign=1){
 const positions=[],uvs=[],segments=12,thickness=Math.min(.035,width*.045),radius=width*.29;
 function quad(a,b,c,d,reverse=false){for(const i of(reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3])){const p=[a,b,c,d][i];positions.push(...p);uvs.push((p[0]/length+.5),p[2]/width+.5);}}
 function shell(center,concave,from,to){
  function point(end,angle,inner){const t=end, taper=.90+.10*t,rad=radius*taper,theta=from+(to-from)*angle;
   const z=center+rad*Math.cos(theta);
   // The down-slope lip is lifted above the next course instead of sharing its surface.
   const lift=t*Math.min(.11,length*.12),y=concave?.04+rad*(1-Math.sin(theta)):width*.12+rad*Math.sin(theta);
   return [slopeSign*(t-.5)*length,y+lift-(inner?thickness:0),z];
  }
  for(let i=0;i<segments;i++){
   const a=i/segments,b=(i+1)/segments;
   quad(point(0,a,false),point(1,a,false),point(1,b,false),point(0,b,false),slopeSign<0);
   quad(point(0,a,true),point(0,b,true),point(1,b,true),point(1,a,true),slopeSign<0);
   quad(point(0,a,false),point(0,b,false),point(0,b,true),point(0,a,true),slopeSign<0);
   quad(point(1,a,false),point(1,a,true),point(1,b,true),point(1,b,false),slopeSign<0);
  }
  for(const a of[0,1])quad(point(0,a,false),point(0,a,true),point(1,a,true),point(1,a,false),(a===1)!==(slopeSign<0));
 }
 shell(0,false,0,Math.PI);
 // Half channels on either edge meet the matching half in the neighbouring column.
 shell(-width/2,true,0,Math.PI/2);
 shell(width/2,true,Math.PI/2,Math.PI);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}
function architectureScallopedTile(length,width,sign){
 const radius=Math.min(width*.48,length*.26),end=length/2-radius,shape=new THREE.Shape();
 shape.moveTo(-length/2,-width/2);shape.lineTo(end,-width/2);
 // Rounded lower edge, keeping the tile within its assigned roof cell.
 shape.quadraticCurveTo(length/2,-width/2,length/2,0);shape.quadraticCurveTo(length/2,width/2,end,width/2);
 shape.lineTo(-length/2,width/2);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false,curveSegments:5});
 const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),y=p.getZ(i)+.02+(x/length+.5)*.07;p.setXYZ(i,sign*x,y,z);}
 if(sign>0){const index=g.index;if(index){for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}}else{for(let i=0;i<p.count;i+=3){for(const attribute of Object.values(g.attributes)){for(let j=0;j<attribute.itemSize;j++){const a=(i+1)*attribute.itemSize+j,b=(i+2)*attribute.itemSize+j,v=attribute.array[a];attribute.array[a]=attribute.array[b];attribute.array[b]=v;}}}}}
 g.computeVertexNormals();return g;
}
function architectureWindowLeading(w,h,cx,cy,origin,angle,source,geom){
 const gap=.28;
 for(const slope of[-1,1])for(let k=-Math.ceil((w+h)/gap);k<=Math.ceil((w+h)/gap);k++){
  const offset=k*gap,points=[];
  for(const x of[-w/2,w/2]){const y=slope*x+offset;if(y>=-h/2&&y<=h/2)points.push(new THREE.Vector3(cx+x,cy+y,.053));}
  for(const y of[-h/2,h/2]){const x=(y-offset)/slope;if(x>-w/2&&x<w/2)points.push(new THREE.Vector3(cx+x,cy+y,.053));}
  if(points.length!==2)continue;const delta=points[1].clone().sub(points[0]);if(delta.length()<.001)continue;
  const g=new THREE.BoxGeometry(.014,delta.length(),.014);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));g.translate(...points[0].add(points[1]).multiplyScalar(.5).toArray());geom(g,'diamond window leading','#393a34',origin,angle,source);
 }
}
function architectureClipTile(source,x0,x1,z0,z1){
const g=source.index?source.toNonIndexed():source.clone(),p=g.getAttribute('position'),uv=g.getAttribute('uv'),n=g.getAttribute('normal'),out=[],tex=[],norm=[];
for(let i=0;i<p.count;i+=3){let poly=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j),uv?uv.getX(i+j):0,uv?uv.getY(i+j):0,n?n.getX(i+j):0,n?n.getY(i+j):1,n?n.getZ(i+j):0]);
for(const [axis,bound,sign] of [[0,x0,1],[0,x1,-1],[2,z0,1],[2,z1,-1]]){const next=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;const insideA=da>=-1e-6,insideB=db>=-1e-6;if(insideA)next.push(a);if(insideA!==insideB){const t=Math.max(0,Math.min(1,da/(da-db)));next.push(a.map((v,k)=>v+(b[k]-v)*t));}}poly=next;}
for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){out.push(...v.slice(0,3));tex.push(...v.slice(3,5));norm.push(...v.slice(5,8));}}
g.dispose();const r=new THREE.BufferGeometry();r.setAttribute('position',new THREE.Float32BufferAttribute(out,3));r.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));r.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));return r;}

// scene-environment-nodes
const BWS_SCENE_ENVIRONMENT_NODES={
 sceneTerrain:{title:"Terrain",category:"Scene",fields:{terrainWidth:["Width",40,2,1000,1],terrainDepth:["Depth",40,2,1000,1],terrainResolution:["Segments",80,8,180,1],terrainColor:["Ground","#64734b"],pondRadius:["Pond radius (0 = none)",0,0,100,.25],pondX:["Pond X",0,-500,500,.5],pondZ:["Pond Z",0,-500,500,.5],pondDepth:["Pond depth",1,.2,5,.1]}},
 sceneWater:{title:"Water",category:"Scene",fields:{waterRadius:["Radius",4,.2,100,.25],waterLevel:["Surface level",-.15,-10,10,.05],waterColor:["Water","#367c82"]}},
 scenePath:{title:"Path",category:"Scene",fields:{pathLength:["Length",10,.1,1000,.25],pathWidth:["Width",2,.1,20,.1],pathColor:["Surface","#b4a184"]}}
};
function bwsTerrainNoise(x,z,seed){
 const ix=Math.floor(x),iz=Math.floor(z),sx=x-ix,sz=z-iz,u=sx*sx*(3-2*sx),v=sz*sz*(3-2*sz);
 const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7+seed*.017)*43758.5453;return n-Math.floor(n);};
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}
function bwsTerrainRise(x,z,chaos,seed){return chaos*((bwsTerrainNoise(x*.085,z*.085,seed)-.5)*3.2+(bwsTerrainNoise(x*.27,z*.27,seed+71)-.5)*.6);}
function bwsPondEdge(angle){return 1+.1*Math.sin(angle*3+.7)+.055*Math.cos(angle*5-1.1)+.025*Math.sin(angle*9);}
function bwsEnvironmentGeometry(type,source){
 const p=assetNodeSanitize(source);
 if(type==="scenePath")return {geometry:new THREE.BoxGeometry(p.pathWidth,.025,p.pathLength),color:p.pathColor,y:.005};
 if(type==="sceneWater"){const g=new THREE.CircleGeometry(p.waterRadius,96);g.rotateX(-Math.PI/2);const positions=g.getAttribute("position");for(let i=1;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),edge=bwsPondEdge(Math.atan2(z,x));positions.setXZ?positions.setXZ(i,x*edge,z*edge):(positions.setX(i,x*edge),positions.setZ(i,z*edge));}g.computeBoundingSphere();return {geometry:g,color:p.waterColor,y:p.waterLevel,water:true};}
 if(type==="sceneTerrain"){
  const g=new THREE.PlaneGeometry(p.terrainWidth,p.terrainDepth,p.terrainResolution,p.terrainResolution);g.rotateX(-Math.PI/2);
  const positions=g.getAttribute("position");
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),dx=x-p.pondX,dz=z-p.pondZ,r=p.pondRadius>0?Math.hypot(dx,dz)/(p.pondRadius*bwsPondEdge(Math.atan2(dz,dx))):2;positions.setY(i,-.02-(r<1?p.pondDepth*(1-r*r):0));}
  g.computeVertexNormals();return {geometry:g,color:p.terrainColor,y:0};
 }
 throw Error("Unsupported environment node");
}
function bwsBuildEnvironmentNode(type,p,{graph,nodeId,group,outputName,emit}){
 const part=bwsEnvironmentGeometry(type,p);emit(geometryNodeCustomSpec(part.geometry,{name:outputName+" "+type,position:[p.assetOffsetX,part.y+p.assetOffsetY,p.assetOffsetZ],color:part.color,roughness:part.water?.18:.95,group,graph,targetId:nodeId}));return 1;
}

// geometry-nature-details
import { ConvexGeometry as BwsNaturalRockHull } from "three/addons/geometries/ConvexGeometry.js";
const BWS_DETAILED_NATURE_NODES=Object.freeze({
 detailedTree:{label:"Detailed Tree",source:true,fields:{treeSpecies:["Species","oak",["oak","birch","pine","spruce","tallPine","deadTree"]],treeHeight:["Height",5,1,18,.1],treeCrownWidth:["Crown width",3.6,.5,12,.1],treeFullness:["Foliage fullness",1,.4,1.8,.1],treeBarkColor:["Bark","#66503b"],treeLeafColor:["Leaves","#496b35"]}},
 detailedRock:{label:"Natural Stone",source:true,fields:{stoneStyle:["Stone type","boulder",["boulder","fieldstone","slate","crag"]],stoneSize:["Size",1.2,.2,8,.1],stoneWeathering:["Irregularity",.65,0,1,.05],stoneColor:["Stone","#747a70"]}}
});
function bwsBuildDetailedNature(type,p,{graph,nodeId,group,outputName,emit}){
 const random=geometryNodePrng(graph.seed+graph.nodeOrder.indexOf(nodeId)*7919),batches=new Map();
 function add(g,c){g.deleteAttribute("uv");const key=new THREE.Color(c).getHexString();if(!batches.has(key))batches.set(key,[]);batches.get(key).push(g);}
 function limb(a,b,r0,r1,c){const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r1,r0,d.length(),8,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,c);}
 function blob(pos,size,c){const g=new THREE.IcosahedronGeometry(1,1),v=g.attributes.position;for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),f=1+.12*Math.sin(x*7+y*4)*Math.cos(z*6-y*3);v.setXYZ(i,x*f*size.x,y*f*size.y,z*f*size.z);}g.computeVertexNormals();g.translate(...pos.toArray());add(g,c);}
 if(type==="detailedTree"){
  const h=p.treeHeight,w=p.treeCrownWidth,kind=p.treeSpecies,bark=new THREE.Color(kind==="birch"?"#c5c5ae":p.treeBarkColor),leaf=new THREE.Color(p.treeLeafColor);
  const shades=[-.075,-.035,0,.025,.055].map(v=>leaf.clone().offsetHSL(0,-.025,v)),bend=(random()-.5)*h*.08;
  const at=t=>new THREE.Vector3(bend*t*t,h*t,Math.sin(t*3)*h*.014),radius=h*(kind==="birch"?.019:.035);

  for(let i=0;i<9;i++){
   const t=i/9;
   limb(at(t),at((i+1)/9),radius*(1-t*.92),radius*(1-(i+1)/9*.92),bark);
  }
  if(kind==="birch"){
   // Small scars lie on individual trunk faces, never around the circumference.
   for(let i=0;i<36;i++){
    const t=.035+random()*.84,segment=Math.floor(t*9),u=t*9-segment;
    const a=at(segment/9),b=at((segment+1)/9),axis=b.clone().sub(a).normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
    const angle=(Math.floor(random()*8)+.5)*Math.PI/4;
    const normal=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)).applyQuaternion(q);
    const tangent=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle)).applyQuaternion(q);
    const r=radius*(1-t*.92),width=r*(.22+random()*.36),height=h*(.0025+random()*.005);
    const center=a.clone().lerp(b,u).addScaledVector(normal,r*Math.cos(Math.PI/8)+.0015);
    const outline=[[-.5,-.35],[-.28,-.52],[.5,-.24],[.36,.4],[-.16,.52],[-.48,.15]];
    const positions=[];
    for(let j=0;j<outline.length;j++){
     for(const xy of [[0,0],outline[j],outline[(j+1)%outline.length]]){
      const point=center.clone().addScaledVector(tangent,xy[0]*width).addScaledVector(axis,xy[1]*height);
      positions.push(...point.toArray());
     }
    }
    const mark=new THREE.BufferGeometry();mark.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    // Face toward the outward trunk normal regardless of the chosen face.
    const pa=new THREE.Vector3().fromArray(positions,0),pb=new THREE.Vector3().fromArray(positions,3),pc=new THREE.Vector3().fromArray(positions,6);
    if(pb.sub(pa).cross(pc.sub(pa)).dot(normal)<0){for(let j=0;j<positions.length;j+=9)for(let k=0;k<3;k++){const v=positions[j+3+k];positions[j+3+k]=positions[j+6+k];positions[j+6+k]=v;}mark.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));}
    mark.computeVertexNormals();add(mark,i%4===0?"#555347":"#302e29");
   }
  }
  if(kind!=="birch")for(let i=0;i<5;i++){const a=i*Math.PI*2/5;limb(new THREE.Vector3(Math.cos(a)*radius*2.7,.018,Math.sin(a)*radius*2.7),at(.1),radius*.3,radius*.66,bark);}
  if(["pine","spruce","tallPine"].includes(kind)){
   const tall=kind==="tallPine",spruce=kind==="spruce",tiers=spruce?10:tall?5:7;
   const bottom=tall?.65:spruce?.18:.22;
   for(let tier=0;tier<tiers;tier++){
    const t=bottom+tier*(.94-bottom)/tiers,r=w*.5*(1-tier/(tiers+.3))*(tall?.74:1),center=at(t);
    const phase=tier*2.399+random()*.2,segments=10;
    const points=[];
    // Jagged, broad skirts and asymmetric peaks create a readable low-poly silhouette.
    const peak=center.clone().add(new THREE.Vector3(h*.013*(random()-.5),h*(spruce?.18:.22),0));
    const ring=[];
    for(let j=0;j<segments;j++){const a=j*Math.PI*2/segments+phase,rr=r*(.86+random()*.18);ring.push(center.clone().add(new THREE.Vector3(Math.cos(a)*rr,-h*(.008+random()*.025),Math.sin(a)*rr)));}
    for(let j=0;j<segments;j++){
     const a=ring[j],b=ring[(j+1)%segments];
     points.push(...peak.toArray(),...b.toArray(),...a.toArray());
     points.push(...center.clone().add(new THREE.Vector3(0,-h*.045,0)).toArray(),...a.toArray(),...b.toArray());
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(points,3));g.computeVertexNormals();add(g,shades[tier%5]);
   }
   if(tall||spruce)for(let i=0;i<(tall?15:7);i++){
    const t=.23+random()*(tall?.39:.4),a=i*2.399,len=w*(.12+random()*.13),start=at(t);
    const end=start.clone().add(new THREE.Vector3(Math.cos(a)*len,-h*.045,Math.sin(a)*len));
    limb(start,end,radius*.18,radius*.016,bark);
    const fork=start.clone().lerp(end,.7);limb(fork,end.clone().add(new THREE.Vector3(-Math.sin(a)*len*.2,h*.045,Math.cos(a)*len*.2)),radius*.07,radius*.008,bark);
   }
  }else{
   const dead=kind==="deadTree",birch=kind==="birch",count=dead?8:birch?9:10;
   for(let i=0;i<count;i++){
    const fraction=i/count,angle=i*2.39996+(random()-.5)*.4,t=(birch?.49:.42)+fraction*.39;
    const spread=w*(birch?.33:.45)*(1-fraction*.48)*(.85+random()*.18);
    const start=at(t),elbow=start.clone().add(new THREE.Vector3(Math.cos(angle)*spread*.45,h*.085,Math.sin(angle)*spread*.45));
    const end=elbow.clone().add(new THREE.Vector3(Math.cos(angle)*spread*.55,h*(.06+random()*.07),Math.sin(angle)*spread*.55));
    limb(start,elbow,radius*.46,radius*.23,bark);limb(elbow,end,radius*.23,radius*.055,bark);
    for(let j=0;j<3;j++){
     const a=angle+(j-1)*.8,tip=end.clone().add(new THREE.Vector3(Math.cos(a)*w*.1,h*.035,Math.sin(a)*w*.1));
     limb(elbow,tip,radius*.12,radius*.008,bark);
     if(dead){const twig=tip.clone().add(new THREE.Vector3(Math.cos(a+.6)*w*.06,h*.04,Math.sin(a+.6)*w*.06));limb(end.clone().lerp(tip,.6),twig,radius*.045,radius*.003,bark);continue;}
     const n=Math.max(1,Math.round(2*p.treeFullness));
     for(let k=0;k<n;k++){
      const a2=random()*Math.PI*2,s=w*(birch?.155:.18)*(.85+random()*.3);
      const pos=tip.clone().add(new THREE.Vector3(Math.cos(a2)*w*.08,(random()-.5)*h*.055,Math.sin(a2)*w*.08));
      blob(pos,new THREE.Vector3(s,s*(birch?1.22:.83),s*.91),shades[(i+j+k)%5]);
     }
    }
   }
   if(!dead)for(let i=0;i<5;i++){const a=i*2.399,r=w*.13,s=w*.19;blob(at(.94).add(new THREE.Vector3(Math.cos(a)*r,(random()-.5)*h*.04,Math.sin(a)*r)),new THREE.Vector3(s,s*(birch?1.2:.85),s),shades[i]);}
  }

 }else{
  const s=p.stoneSize,style=p.stoneStyle,rough=p.stoneWeathering;
  const sx=s*(.85+random()*.45),sy=s*(style==="crag"?.7+random()*.3:style==="slate"?.16+random()*.1:style==="fieldstone"?.3+random()*.16:.45+random()*.24),sz=s*(.65+random()*.4);
  const points=[],lobes=Array.from({length:5},()=>({direction:new THREE.Vector3(random()-.5,random()-.5,random()-.5).normalize(),strength:(random()-.45)*.35})),phase=random()*6.28;
  const number=style==="slate"?36:style==="crag"?42:58,lean=(random()-.5)*.28;
  for(let i=0;i<number;i++){
   const y=1-2*(i+.5)/number,angle=i*2.399963+phase+(random()-.5)*.3,r=Math.sqrt(1-y*y),direction=new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
   let shape=1;for(const lobe of lobes)shape+=rough*lobe.strength*Math.pow(Math.max(0,direction.dot(lobe.direction)),2);
   shape+=rough*(random()-.5)*.13;
   const x=direction.x*shape,z=direction.z*shape,yy=Math.max(-.48,direction.y*shape);
   points.push(new THREE.Vector3((x+yy*lean)*sx,yy*sy,(z+x*.07*rough)*sz));
  }
  // A hull over irregular support points gives closed weathered faces, not
  // latitude bands, stretched pyramids or separately stacked rock layers.
  const g=new BwsNaturalRockHull(points);g.rotateY(random()*Math.PI*2);g.computeBoundingBox();g.translate(0,-g.boundingBox.min.y,0);const v=g.attributes.position;
  const c=new THREE.Color(p.stoneColor),buckets=Array.from({length:5},()=>[]);
  for(let i=0;i<v.count;i+=3){const band=Math.min(4,Math.floor(random()*5));for(let k=0;k<3;k++)buckets[band].push(v.getX(i+k),v.getY(i+k),v.getZ(i+k));}
  buckets.forEach((positions,i)=>{if(!positions.length)return;const part=new THREE.BufferGeometry();part.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));part.computeVertexNormals();add(part,c.clone().offsetHSL(0,0,(i-2)*.012));});g.dispose();
 }
 let count=0;for(const [color,geometries]of batches){const merged=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();if(!merged)continue;emit(geometryNodeCustomSpec(merged,{name:outputName+" "+(type==="detailedTree"?p.treeSpecies:p.stoneStyle)+" "+(++count),position:[p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ],color:"#"+color,roughness:.93,group,graph,targetId:nodeId}));}return count;
}
function bwsEnsureDetailedNaturePresets(role,seed){
 const recipes=role==="tree"?[["Oak","oak",3.6,"#627534"],["Birch","birch",2.8,"#789048"],["Pine","pine",3.3,"#687330"],["Spruce","spruce",3.2,"#46633b"],["Tall Pine","tallPine",2.8,"#687330"],["Dead Tree","deadTree",3.2,"#496b35"]]:[["Boulder","boulder"],["Fieldstone","fieldstone"],["Slate","slate"],["Crag","crag"]];let first=null;
 for(const [label,style,width,color]of recipes){const name="Scene "+label+" nodes";let graph=geometryNodeProjectState.graphs.find(g=>g.name===name);
  if(!graph&&geometryNodeProjectState.graphs.length<24){graph=defaultGeometryNodeGraph(name);graph.seed=seed+(role==="tree"?101:307);graph.centerOutput=true;const type=role==="tree"?"detailedTree":"detailedRock";graph.nodeOrder=["seed",type,"output"];graph.smoothNodes=[];graph.generatedIds=[];
   graph.connections=graph.nodeOrder.slice(1).map((id,i)=>({id:geometryNodeId("link"),fromNodeId:graph.nodeOrder[i],toNodeId:id,toInputIndex:0}));
   graph.nodePositions=Object.fromEntries(graph.nodeOrder.map((id,i)=>[id,{x:50+i*260,y:50}]));
   Object.assign(graph.params,{outputName:name},role==="tree"?{treeSpecies:style,treeCrownWidth:width,treeLeafColor:color}:{stoneStyle:style});graph.nodeParams={};geometryNodeProjectState.graphs.push(graph);
  }if(!first&&graph)first=graph;
 }
 if(!first)throw new Error("The graph library is full. Free a graph slot to add detailed nature presets.");
 saveGeometryNodeDraft();renderGeometryNodeEditor();return first.id;
}

// village-props
const BWS_VILLAGE_PROP_BASE=Object.freeze({
 villageProp:{label:"Village Props",source:true,fields:{propKind:["Prop","crate",["crate","barrel","fence","logPile"]],propSize:["Size",1,.2,4,.1],propFenceLength:["Fence length",3,.3,50,.1],propWood:["Wood","#796044"],propMetal:["Iron","#444943"]}}
});
const BWS_VILLAGE_PROP_NODES=Object.freeze({...BWS_VILLAGE_PROP_BASE,...Object.fromEntries([
 ["propFence","Wooden Fence","fence"],["propGate","Wooden Gate","gate"],
 ["propBarrel","Wooden Barrel","barrel"],["propCrate","Braced Crate","crate"],
 ["propLogPile","Stacked Logs","logPile"],["propLog","Fallen Log","log"],
 ["propStump","Tree Stump","stump"],["propBench","Wooden Bench","bench"],
 ["propCart","Handcart","cart"],["propSack","Grain Sack","sack"],
 ["propTrough","Water Trough","trough"],["propWell","Stone Well","well"]
].map(([id,label,kind])=>[id,{label,kind,source:true,fields:Object.fromEntries(Object.entries(BWS_VILLAGE_PROP_BASE.villageProp.fields).filter(([key])=>key!=="propKind"&&(key!=="propFenceLength"||kind==="fence")))}]))});
function bwsBuildVillageProp(type,p,{graph,nodeId,group,outputName,emit}){
 if(type!=="villageProp")p={...p,propKind:BWS_VILLAGE_PROP_NODES[type].kind};
 const size=p.propSize,wood=p.propWood,iron=p.propMetal,batches=new Map();
 function add(g,color){g.deleteAttribute("uv");if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}if(!batches.has(color))batches.set(color,[]);batches.get(color).push(g);}
 function box(w,h,d,x,y,z,color=wood,angle=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateZ(angle);g.translate(x,y,z);add(g,color);}
 function beam(a,b,width,color=wood){const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.BoxGeometry(width,v.length(),width);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);add(g,color);}
 if(p.propKind==="fence"){
  const length=p.propFenceLength,segments=Math.max(1,Math.ceil(length/2.1));
  for(let i=0;i<=segments;i++){const x=-length/2+length*i/segments;box(.15,1.15,.15,x,.575,0);box(.19,.07,.19,x,1.16,0);}
  for(let i=0;i<segments;i++){const a=-length/2+length*i/segments,b=-length/2+length*(i+1)/segments;for(const y of [.36,.78])box(b-a,.11,.09,(a+b)/2,y,0);if(i%2===0)beam([a,.31,.025],[b,.85,.025],.065);}
 }else if(p.propKind==="crate"){
  for(let i=0;i<5;i++){const a=-.4+i*.2;for(const z of [-.47,.47])box(.185,.95,.065,a,.51,z);for(const x of [-.47,.47])box(.065,.95,.185,x,.51,a);box(.185,.055,.9,a,1.015,0);}
  for(const z of [-.52,.52]){for(const y of [.13,.9])box(1.03,.13,.075,0,y,z);beam([-.41,.2,z],[.41,.83,z],.095);}
  for(const x of [-.52,.52])for(const y of [.13,.9])box(.075,.13,1.03,x,y,0);
 }else if(p.propKind==="barrel"){
  const profile=[new THREE.Vector2(.36,0),new THREE.Vector2(.4,.12),new THREE.Vector2(.46,.48),new THREE.Vector2(.43,.85),new THREE.Vector2(.36,1.05)];
  for(let i=0;i<14;i++){const g=new THREE.LatheGeometry(profile,1,i*Math.PI*2/14+.009,Math.PI*2/14-.018);add(g,i%3===0?"#8a704e":wood);}
  for(const y of [.13,.83]){const g=new THREE.CylinderGeometry(y<.5?.408:.443,y<.5?.413:.447,.075,14,1,true);g.translate(0,y,0);add(g,iron);}
  const lid=new THREE.CylinderGeometry(.36,.36,.05,14);lid.translate(0,1.05,0);add(lid,wood);
  const bottom=new THREE.CylinderGeometry(.36,.36,.04,14);bottom.translate(0,.02,0);add(bottom,wood);
  for(const x of [-.18,0,.18])box(.012,.004,Math.sqrt(.36*.36-x*x)*2,x,1.077,0,"#594a37");
 }else if(p.propKind==="gate"){
  for(const x of [-1.1,1.1])box(.19,1.45,.19,x,.725,0);
  for(const y of [.3,1.05])box(1.96,.13,.12,0,y,0);
  for(let i=0;i<6;i++)box(.12,1.05,.1,-.85+i*.34,.7,0);
  beam([-.92,.3,.08],[.92,1.08,.08],.11);box(.2,.06,.08,.75,.88,.13,iron);
 }else if(p.propKind==="bench"){
  for(const z of [-.22,0,.22])box(1.8,.1,.2,0,.58,z);
  for(const x of [-.65,.65]){for(const z of [-.2,.2])box(.12,.55,.12,x,.275,z);box(.12,1.05,.12,x,.55,-.27);}
  for(const y of [.82,1.08])box(1.8,.18,.08,0,y,-.3);
 }else if(p.propKind==="trough"){
  box(1.9,.1,.7,0,.2,0);for(const z of [-.38,.38])box(2,.45,.1,0,.43,z);
  for(const x of [-.95,.95])box(.1,.45,.8,x,.43,0);
  for(const x of [-.65,.65])box(.18,.25,.65,x,.125,0);
  box(1.8,.015,.64,0,.45,0,"#527c79");
 }else if(p.propKind==="sack"){
  const g=new THREE.IcosahedronGeometry(1,2);g.scale(.37,.52,.3);g.translate(0,.52,0);add(g,"#b3a078");
  const neck=new THREE.CylinderGeometry(.1,.16,.16,9);neck.translate(0,1.02,0);add(neck,"#a58f63");
  const tie=new THREE.TorusGeometry(.105,.025,4,10);tie.rotateX(Math.PI/2);tie.translate(0,1.055,0);add(tie,"#675336");
 }else if(p.propKind==="log"||p.propKind==="stump"){
  const stump=p.propKind==="stump",length=stump?.65:2.3,r=stump?.42:.24;
  const g=new THREE.CylinderGeometry(r*.9,r,length,10);if(!stump)g.rotateX(Math.PI/2);g.translate(0,stump?length/2:r,0);add(g,wood);
  const end=new THREE.CircleGeometry(r*.88,10);if(stump){end.rotateX(-Math.PI/2);end.translate(0,length+.002,0);}else end.translate(0,r,length/2+.002);add(end,"#bda274");
  if(!stump){const cap=new THREE.CircleGeometry(r*.98,10);cap.rotateY(Math.PI);cap.translate(0,r,-length/2-.002);add(cap,"#bda274");}
  if(stump)for(let i=0;i<5;i++){const a=i*Math.PI*2/5;beam([Math.cos(a)*.65,.05,Math.sin(a)*.65],[0,.32,0],.18);}
 }else if(p.propKind==="cart"){
  for(let i=0;i<6;i++)box(.17,.09,1.45,-.45+i*.18,.65,0);
  for(const x of [-.58,.58]){for(const y of [.87,1.1])box(.075,.18,1.5,x,y,0);for(const z of [-.65,.65])box(.09,.65,.09,x,.95,z);}
  for(const y of [.87,1.1])box(1.2,.18,.08,0,y,-.72);
  for(const x of [-.42,.42])beam([x,.61,.5],[x,.8,2],.085);
  beam([-.85,.48,0],[.85,.48,0],.12,iron);
  for(const x of [-.78,.78]){const rim=new THREE.TorusGeometry(.43,.06,5,12);rim.rotateY(Math.PI/2);rim.translate(x,.48,0);add(rim,wood);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;beam([x,.48,0],[x,.48+Math.sin(a)*.4,Math.cos(a)*.4],.045);}
  }
 }else if(p.propKind==="well"){
  for(let row=0;row<3;row++)for(let i=0;i<12;i++){const a=(i+(row%2)*.5)*Math.PI/6,g=new THREE.BoxGeometry(.4,.27,.25);g.rotateY(-a);g.translate(Math.cos(a)*.82,.15+row*.28,Math.sin(a)*.82);add(g,i%3?"#8b897e":"#9d998b");}
  for(const x of [-1,1])box(.14,2.3,.14,x,1.15,0);box(2.2,.14,.18,0,2.3,0);
  beam([-1,1.65,0],[1,1.65,0],.09,iron);beam([0,1.65,0],[0,.5,0],.022,"#a99165");
  const water=new THREE.CircleGeometry(.66,24);water.rotateX(-Math.PI/2);water.translate(0,.15,0);add(water,"#405f62");
 }else{
  for(let row=0;row<3;row++)for(let i=0;i<3-row;i++){
   const x=(i-(2-row)/2)*.36,y=.18+row*.3,length=1.8+(i%2)*.15;
   const g=new THREE.CylinderGeometry(.17,.2,length,9);g.rotateX(Math.PI/2);g.translate(x,y,0);add(g,wood);
   for(const z of [-length/2-.002,length/2+.002]){const end=new THREE.CircleGeometry(.155,9);if(z<0)end.rotateY(Math.PI);end.translate(x,y,z);add(end,"#b39868");}
  }
 }
 let count=0;
 for(const [color,parts]of batches){const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());g.scale(size,size,size);emit(geometryNodeCustomSpec(g,{name:outputName+" "+(++count),position:[p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ],color,roughness:.9,graph,targetId:nodeId,group}));}return count;
}
function bwsVillageControls(){
 const host=document.getElementById("bwsSceneStudio");if(!host||host.querySelector("[data-village-controls]"))return;
 const button=Array.from(host.querySelectorAll("button")).find(b=>b.textContent.trim()==="Generate town");if(!button)return;
 const field=document.createElement("fieldset");field.dataset.villageControls="true";field.style.cssText="margin:14px 0;padding:12px;border:1px solid #52685d;border-radius:5px";
 field.innerHTML='<legend>Plot fences &amp; props</legend><label style="display:block;margin:8px 0"><input type="checkbox" data-village-fences checked> Fence each house plot</label><label style="display:flex;justify-content:space-between;gap:8px;margin:8px 0">Props per plot <input type="number" data-village-count min="0" max="8" value="3" style="width:65px"></label><p style="font-size:12px">Node-generated barrels, crates and stacked logs. Entrance gaps remain open.</p>';
 button.before(field);
}
function bwsPopulateVillageProps(world,settings){
 bwsVillageControls();
 const host=document.getElementById("bwsSceneStudio"),fences=host?.querySelector("[data-village-fences]")?.checked??true;
 const count=Math.max(0,Math.min(8,Math.round(Number(host?.querySelector("[data-village-count]")?.value)||0)));
 settings.villageFences=fences;settings.villageProps=count;
 const obsolete=[];world.traverse(o=>{if(o.userData?.villageDecoration)obsolete.push(o);});
 for(const o of obsolete){o.removeFromParent();o.traverse(m=>{m.geometry?.dispose();if(m.material)m.material.dispose();});}
 if(!fences&&!count)return;
 const plots=new Map(),matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
 world.updateMatrixWorld(true);
 world.traverse(mesh=>{
  if(!mesh.isInstancedMesh||mesh.userData.nodeSource)return;
  mesh.geometry.computeBoundingBox();const local=mesh.geometry.boundingBox;
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);matrix.decompose(pos,quat,scale);
   const key=pos.x.toFixed(3)+":"+pos.z.toFixed(3);
   if(!plots.has(key))plots.set(key,new THREE.Box3());
   plots.get(key).union(local.clone().applyMatrix4(matrix));
  }
 });
 const root=new THREE.Group();root.name="Node-generated plot fences and props";root.userData.villageDecoration=true;
 const random=geometryNodePrng(settings.seed+42617);
 let serial=0;
 function prop(kind,x,z,angle,size,length){
  const graph=defaultGeometryNodeGraph("Village "+kind);graph.id="village-prop-"+(++serial);graph.seed=Math.floor(random()*1000000);graph.nodeOrder=["seed","villageProp","output"];graph.connections=[{id:"a",fromNodeId:"seed",toNodeId:"villageProp",toInputIndex:0},{id:"b",fromNodeId:"villageProp",toNodeId:"output",toInputIndex:0}];
  Object.assign(graph.params,{propKind:kind,propSize:size,propFenceLength:length||3,propWood:"#796044",propMetal:"#444943",assetOffsetX:0,assetOffsetY:0,assetOffsetZ:0});
  const group=new THREE.Group();group.name=graph.name;group.position.set(x,0,z);group.rotation.y=angle;group.userData.nodeSource={id:graph.id,name:graph.name,graph};
  bwsBuildVillageProp("villageProp",assetNodeSanitize(graph.params),{graph,nodeId:"villageProp",group:{id:graph.id,name:graph.name},outputName:graph.name,emit:spec=>{const mesh=geometryNodePreviewMesh(spec,new Map());mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}});
  root.add(group);
 }
 for(const bounds of plots.values()){
  const dimensions=bounds.getSize(new THREE.Vector3());if(dimensions.y<2||dimensions.x<1.5||dimensions.z<1.5)continue;
  const x0=bounds.min.x-.7,x1=bounds.max.x+.7,z0=bounds.min.z-.7,z1=bounds.max.z+.7,cx=(x0+x1)/2,cz=(z0+z1)/2;
  if(fences){
   prop("fence",x0,cz,Math.PI/2,1,z1-z0);prop("fence",x1,cz,Math.PI/2,1,z1-z0);
   const gap=Math.min(2.4,(x1-x0)*.45),length=(x1-x0-gap)/2;
   if(length>.3)for(const z of [z0,z1]){prop("fence",x0+length/2,z,0,1,length);prop("fence",x1-length/2,z,0,1,length);}
  }
  // Place small props in the side yards, between each wall and its fence.
  // Long log piles run parallel to the wall; front/back entrance gaps stay clear.
  const slots=Math.max(1,Math.floor((dimensions.z-.6)/1.05)+1);
  for(let i=0;i<Math.min(count,slots*2);i++){
   const side=i%2===0?-1:1,slot=Math.floor(i/2);
   const x=side<0?bounds.min.x-.35:bounds.max.x+.35;
   const z=slots===1?cz:bounds.min.z+.3+slot*(dimensions.z-.6)/(slots-1);
   const kind=["barrel","crate","logPile"][Math.floor(random()*3)];
   prop(kind,x,z,random()<.5?0:Math.PI,.34+random()*.06);
  }
 }
 const owner=Array.from(world.children).find(o=>{let found=false;o.traverse(m=>{if(m.isInstancedMesh&&!m.userData.nodeSource)found=true;});return found;});
 (owner||world).add(root);
}

// scene-damage-effects
function bwsWeatherTown(world,settings){
 const amount=Math.max(0,Math.min(1,settings.sceneGrime)),materials=new Set();let ground=null;
 world.traverse(mesh=>{
  if(mesh.userData?.nodeSource?.type==="sceneTerrain")ground=mesh;
  if(!mesh.isMesh||!mesh.material?.isMeshStandardMaterial||mesh.userData?.nodeSource?.type==="sceneWater"||materials.has(mesh.material))return;
  const material=mesh.material;materials.add(material);if(amount<=0)return;
  const terrain=mesh.userData?.nodeSource?.type==="sceneTerrain";
  // Remove the old periodic ground normals and vertex pattern entirely.
  if(terrain){material.normalMap?.dispose();material.normalMap=null;material.vertexColors=false;}
  const pondParams=terrain?mesh.userData.nodeSource.params:null;const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
   previous.call(material,shader);
   shader.uniforms.bwsPond={value:new THREE.Vector3(pondParams?.pondX||0,pondParams?.pondZ||0,pondParams?.pondRadius||0)};shader.uniforms.bwsGrime={value:amount};shader.uniforms.bwsWeatherSeed={value:(settings.seed%10000)*.037};shader.uniforms.bwsIsGround={value:terrain?1:0};
   shader.vertexShader='varying vec3 bwsWeatherPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 weatherVertex=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     weatherVertex=instanceMatrix*weatherVertex;
    #endif
    bwsWeatherPosition=(modelMatrix*weatherVertex).xyz;
   `);
   shader.fragmentShader=`varying vec3 bwsWeatherPosition;uniform float bwsGrime,bwsWeatherSeed,bwsIsGround;uniform vec3 bwsPond;
    float bwsWH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float bwsWN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(bwsWH(i),bwsWH(i+vec3(1,0,0)),f.x),mix(bwsWH(i+vec3(0,1,0)),bwsWH(i+vec3(1,1,0)),f.x),f.y),mix(mix(bwsWH(i+vec3(0,0,1)),bwsWH(i+vec3(1,0,1)),f.x),mix(bwsWH(i+vec3(0,1,1)),bwsWH(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float bwsWF(vec3 p){return bwsWN(p)*.57+bwsWN(p*2.13+17.3)*.28+bwsWN(p*4.37+8.1)*.15;}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 wp=bwsWeatherPosition+vec3(bwsWeatherSeed,0.0,bwsWeatherSeed*.71);
    float broad=bwsWF(wp*.23),fine=bwsWN(wp*15.0);
    vec3 sootWarp=vec3(bwsWF(wp*.43+3.1),bwsWF(wp*.43+19.7),bwsWF(wp*.43+41.3));float streak=bwsWF(wp*.85+sootWarp*2.7);
    float soot=smoothstep(.25,.72,broad*.65+streak*.35);
    float dirt=bwsGrime*(.38+.62*soot);
    float luminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    vec3 faded=mix(diffuseColor.rgb,vec3(luminance)*vec3(.92,.86,.78),bwsGrime*.7);
    vec3 grimy=mix(faded,vec3(.024,.019,.016)*( .7+fine*.6),dirt*.94);
    vec3 soil=mix(vec3(.045,.038,.027),vec3(.105,.089,.065),smoothstep(.28,.72,broad));
    soil=mix(soil,vec3(.14,.128,.108),smoothstep(.57,.75,bwsWF(wp*.8+24.0))*.65);
    soil*=.82+fine*.32;
    diffuseColor.rgb=mix(grimy,mix(diffuseColor.rgb,soil,bwsGrime),bwsIsGround);
    if(bwsIsGround>.5&&bwsPond.z>0.0){
     vec2 delta=bwsWeatherPosition.xz-bwsPond.xy;float angle=atan(delta.y,delta.x);
     float edge=1.0+.1*sin(angle*3.0+.7)+.055*cos(angle*5.0-1.1)+.025*sin(angle*9.0);
     float shore=length(delta)/(bwsPond.z*edge);
     float bank=(1.0-smoothstep(.98,1.23,shore))*(.8+.2*bwsWN(wp*4.0));
     vec3 mud=mix(vec3(.029,.025,.016),vec3(.09,.075,.045),smoothstep(.87,1.15,shore));
     diffuseColor.rgb=mix(diffuseColor.rgb,mud,bank);
    }
   `);
  };material.customProgramCacheKey=()=>previousKey+"-bws-weather-85-"+terrain;material.needsUpdate=true;
 });
 if(!ground||settings.ambientSmoke<=0||!settings.smokeEnabled||(settings.damagePercent<=0&&settings.treeBurnPercent<=0&&settings.groundBurn<=0))return;
 const bounds=new THREE.Box3().setFromObject(ground),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),random=geometryNodePrng(settings.seed+53371);
 const count=Math.ceil(settings.ambientSmoke*10),root=new THREE.Group();root.name="Drifting aftermath smoke";
 for(let i=0;i<count;i++){const smoke=bwsSceneEmitter("sceneSmoke",{smokeSize:Math.min(12,Math.max(3,size.x*.045)),smokeLifetime:14,smokeIntensity:settings.ambientSmoke*.55,smokeWind:settings.effectWind+.35,smokeColor:settings.smokeColor},settings.seed+i*127);smoke.position.set(center.x+(random()-.5)*size.x*.85,.25,center.z+(random()-.5)*size.z*.85);root.add(smoke);}
 world.add(root);
}
const BWS_CHAR_NOISE=`
 float bwsCH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float bwsCN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(bwsCH(i),bwsCH(i+vec3(1,0,0)),f.x),mix(bwsCH(i+vec3(0,1,0)),bwsCH(i+vec3(1,1,0)),f.x),f.y),mix(mix(bwsCH(i+vec3(0,0,1)),bwsCH(i+vec3(1,0,1)),f.x),mix(bwsCH(i+vec3(0,1,1)),bwsCH(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
function bwsCharredSurface(material,impact,radius,burn,fireOrigin){
 const clock={value:0};material.uniforms={fxTime:clock};
 material.onBeforeCompile=shader=>{
  shader.uniforms.bwsCoalTime=clock;shader.uniforms.bwsBurn={value:burn};shader.uniforms.bwsImpact={value:impact};shader.uniforms.bwsRadius={value:radius};shader.uniforms.bwsFireOrigin={value:fireOrigin};
  shader.vertexShader='varying vec3 bwsSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbwsSurface=position;');
  shader.fragmentShader='varying vec3 bwsSurface;uniform float bwsCoalTime,bwsBurn;uniform vec3 bwsImpact,bwsRadius,bwsFireOrigin;\n'+BWS_CHAR_NOISE+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float damageMask=1.0-smoothstep(.65,1.7,length((bwsSurface-bwsImpact)/bwsRadius));
   float hearthMask=(1.0-smoothstep(.5,2.4,length(bwsSurface.xz-bwsFireOrigin.xz)))*(1.0-smoothstep(.1,.7,abs(bwsSurface.y-bwsFireOrigin.y)));
   float coalMask=clamp(max(damageMask,hearthMask)*bwsBurn,0.0,1.0);
   float grain=bwsCN(bwsSurface*19.0)*2.0-1.0;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.022,.017,.013)+vec3(.018)*grain,coalMask*.96);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float seam=abs(bwsCN(bwsSurface*16.0+vec3(bwsCN(bwsSurface*3.0)*3.0))-.5);
   float cracks=1.0-smoothstep(.012,.045,seam);
   float patches=smoothstep(.53,.76,bwsCN(bwsSurface*2.3+17.0));
   float pulse=.65+.35*sin(bwsCoalTime*2.2+bwsSurface.x*5.0+bwsSurface.z*3.0);
   totalEmissiveRadiance+=vec3(2.8,.24,.008)*cracks*patches*coalMask*coalMask*pulse;
  `);
 };material.customProgramCacheKey=()=>"bws-charred-embers-84";material.needsUpdate=true;
}
function bwsCoalBed(size,seed){
 const root=new THREE.Group(),random=geometryNodePrng(seed+331);root.name="Raised charcoal and ember bed";
 const parts=[];for(let i=0;i<46;i++){const angle=random()*Math.PI*2,r=Math.sqrt(random())*size,g=new THREE.IcosahedronGeometry(.07+random()*.17,1);g.scale(1.3,.45+random()*.6,1);g.rotateY(random()*6.28);g.translate(Math.cos(angle)*r,.09+random()*.07,Math.sin(angle)*r);parts.push(g);}
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());const material=new THREE.MeshStandardMaterial({color:"#29221c",roughness:1});
 bwsCharredSurface(material,new THREE.Vector3(),new THREE.Vector3(size*2,2,size*2),1,new THREE.Vector3());
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.bwsAnimatedEffect=true;root.add(mesh);return root;
}
function bwsSceneFoliageMaterial(material){
 const c=material?.color;return !!c&&c.g>c.r*1.06&&c.g>c.b*1.15;
}
function bwsBurnLandscape(town,ground,points,settings){
 const amount=Math.max(0,Math.min(1,settings.groundBurn/100));
 if(amount>0){
  const g=ground.geometry,p=g.getAttribute("position"),colors=new Float32Array(p.count*3),phase=settings.seed*.017;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),noise=(Math.sin(x*.37+phase)*Math.cos(z*.29-phase)+Math.sin(x*.91+z*.67)*.35+1.35)/2.7;
   const coverage=THREE.MathUtils.smoothstep(amount-noise,-.13,.13),ash=(Math.sin(x*3.7+z*2.1)+1)*.5;
   const charcoal=new THREE.Color().setRGB(.12+ash*.13,.105+ash*.12,.09+ash*.12);
   const color=new THREE.Color(1,1,1).lerp(charcoal,coverage);colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));ground.material.vertexColors=true;ground.material.needsUpdate=true;
 }
 const random=geometryNodePrng(settings.seed+88491);let emitted=0;
 for(const p of points){
  if(!p.burned||random()*100>=settings.natureFirePercent||emitted>=12)continue;
  const root=new THREE.Group();root.name="Burning node tree";root.position.set(p.x,(p.y||0)+.08,p.z);
  const seed=settings.seed+emitted*997;
  if(settings.fireEnabled)root.add(bwsSceneEmitter("sceneFire",{...settings,effectSize:Math.min(2.5,settings.effectSize)*p.scale},seed));
  if(settings.smokeEnabled)root.add(bwsSceneEmitter("sceneSmoke",{smokeSize:Math.min(4,settings.effectSize*1.6),smokeLifetime:settings.effectLifetime*3,smokeIntensity:.6,smokeWind:settings.effectWind,smokeColor:settings.smokeColor},seed+13));
  town.add(root);emitted++;
 }
 town.userData.burnedLandscape={treeBurnPercent:settings.treeBurnPercent,groundBurn:settings.groundBurn,natureFirePercent:settings.natureFirePercent,burnedTrees:points.filter(p=>p.burned).length,activeTreeEmitters:emitted};
}
const bwsHouseDamagePieces=new WeakMap();
function bwsOriginalHousePieces(geometry){
 if(bwsHouseDamagePieces.has(geometry))return bwsHouseDamagePieces.get(geometry);
 const flat=geometry.index?geometry.toNonIndexed():geometry,position=flat.getAttribute("position"),count=position.count;
 const parent=new Int32Array(count/3);for(let i=0;i<parent.length;i++)parent[i]=i;
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const welded=new Map();
 for(let i=0;i<count;i++){const key=Math.round(position.getX(i)*10000)+":"+Math.round(position.getY(i)*10000)+":"+Math.round(position.getZ(i)*10000),triangle=Math.floor(i/3);if(welded.has(key)){const a=find(triangle),b=find(welded.get(key));if(a!==b)parent[a]=b;}else welded.set(key,triangle);}
 const groups=new Map(),v=new THREE.Vector3();
 for(let i=0;i<count;i+=3){const key=find(i/3);if(!groups.has(key))groups.set(key,{indices:[],bounds:new THREE.Box3()});const piece=groups.get(key);for(let j=0;j<3;j++){piece.indices.push(i+j);piece.bounds.expandByPoint(v.fromBufferAttribute(position,i+j));}}
 const pieces=Array.from(groups.values());for(const piece of pieces){piece.center=piece.bounds.getCenter(new THREE.Vector3());piece.size=piece.bounds.getSize(new THREE.Vector3());}
 const result={attributes:flat.attributes,pieces};bwsHouseDamagePieces.set(geometry,result);if(flat!==geometry)flat.dispose();return result;
}
function bwsCarveBurnVolume(geometry,matrix,impact,radius,floor){
 const attributes=geometry.attributes,names=Object.keys(attributes),output=Object.fromEntries(names.map(n=>[n,[]]));
 const position=attributes.position,world=new THREE.Vector3();
 function vertex(i){const data={};for(const name of names){const a=attributes[name];data[name]=[];for(let k=0;k<a.itemSize;k++)data[name].push(a.array[i*a.itemSize+k]);}return data;}
 function mix(a,b,t){const result={};for(const name of names)result[name]=a[name].map((v,k)=>v+(b[name][k]-v)*t);return result;}
 function local(v){return world.fromArray(v.position).applyMatrix4(matrix).clone();}
 function signed(v){const p=local(v);return Math.max(Math.hypot((p.x-impact.x)/radius.x,(p.y-impact.y)/radius.y,(p.z-impact.z)/radius.z)-1,(floor-p.y)/radius.y);}
 function emit(a,b,c){for(const v of [a,b,c])for(const name of names)output[name].push(...v[name]);}
 function triangle(a,b,c,depth){
  const vertices=[a,b,c],points=vertices.map(local);
  const box=new THREE.Box3().setFromPoints(points);if(box.max.y<=floor){emit(a,b,c);return;}
  let nearest=0;for(const axis of ["x","y","z"]){const d=Math.max(box.min[axis]-impact[axis],0,impact[axis]-box.max[axis])/radius[axis];nearest+=d*d;}
  if(nearest>=1){emit(a,b,c);return;}
  const values=vertices.map(signed);if(values.every(v=>v<0))return;
  // Refinement detects a hole even when all three corners lie outside it.
  const edge=Math.max(points[0].distanceTo(points[1]),points[1].distanceTo(points[2]),points[2].distanceTo(points[0]));
  if(depth<5&&edge>Math.min(radius.x,radius.y,radius.z)*.15){const ab=mix(a,b,.5),bc=mix(b,c,.5),ca=mix(c,a,.5);triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;}
  const polygon=[];for(let i=0;i<3;i++){const j=(i+1)%3,inside=values[i]>=0,next=values[j]>=0;if(inside)polygon.push(vertices[i]);if(inside!==next)polygon.push(mix(vertices[i],vertices[j],values[i]/(values[i]-values[j])));}
  for(let i=1;i+1<polygon.length;i++)emit(polygon[0],polygon[i],polygon[i+1]);
 }
 for(let i=0;i<position.count;i+=3)triangle(vertex(i),vertex(i+1),vertex(i+2),0);
 const result=new THREE.BufferGeometry();for(const name of names){const a=attributes[name];result.setAttribute(name,new THREE.BufferAttribute(new a.array.constructor(output[name]),a.itemSize,a.normalized));}geometry.dispose();return result;
}
function bwsDamageOriginalHouse(source,settings,seed){
 const root=new THREE.Group();root.name=(source.name||"House")+" - fire damaged";
 const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),random=geometryNodePrng(seed>>>0);
 const severity=Math.max(.1,Math.min(1,settings.damageSeverity)),burn=Math.max(0,Math.min(1,settings.burnAmount));
 const impact=new THREE.Vector3((random()-.5)*size.x*.55,bounds.min.y+size.y*(.72+random()*.14),(random()-.5)*size.z*.55);
 const radius=new THREE.Vector3(size.x*(.18+severity*.48),size.y*(.16+severity*.58),size.z*(.18+severity*.48));
 const distance=v=>Math.hypot((v.x-impact.x)/radius.x,(v.y-impact.y)/radius.y,(v.z-impact.z)/radius.z);
 const point=new THREE.Vector3(),worldPoint=new THREE.Vector3(),debris=[];
 source.updateWorldMatrix(true,true);
 function geometryFor(attributes,indices){const g=new THREE.BufferGeometry();for(const [name,a]of Object.entries(attributes)){const values=new a.array.constructor(indices.length*a.itemSize);for(let i=0;i<indices.length;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.array[indices[i]*a.itemSize+k];g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize,a.normalized));}return g;}
 for(const part of source.children){
  if(!part.isMesh)continue;
  const cached=bwsOriginalHousePieces(part.geometry),kept=[];
  for(const piece of cached.pieces){
   const center=piece.center.clone().applyMatrix4(part.matrixWorld),low=piece.bounds.clone().applyMatrix4(part.matrixWorld).min.y;
   // Foundation stays intact; a contiguous upper burn volume removes pieces.
   // Large connected shells must lie mostly in that region before removal.
   const spread=Math.max(piece.size.x/size.x,piece.size.y/size.y,piece.size.z/size.z);
   const remove=low>bounds.min.y+size.y*.18&&distance(center)<(spread>.6?.52:1);
   if(remove){if(debris.length<32&&spread<.32&&piece.indices.length<9000)debris.push({part,piece,attributes:cached.attributes});}
   else for(const index of piece.indices)kept.push(index);
  }
  if(!kept.length)continue;
  const g=bwsCarveBurnVolume(geometryFor(cached.attributes,kept),part.matrixWorld,impact,radius,bounds.min.y+size.y*.2),pos=g.getAttribute("position"),original=g.getAttribute("color"),colors=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
   point.fromBufferAttribute(pos,i);worldPoint.copy(point).applyMatrix4(part.matrixWorld);
   const proximity=Math.max(0,1-distance(worldPoint)/1.9),noise=.82+.18*bwsTerrainNoise(worldPoint.x*1.7+worldPoint.y*.3,worldPoint.z*1.7,seed);
   const scorch=Math.min(.96,burn*proximity*1.8*noise),shade=1-scorch;
   colors[i*3]=(original?original.getX(i):1)*shade;
   colors[i*3+1]=(original?original.getY(i):1)*shade*(1-scorch*.12);
   colors[i*3+2]=(original?original.getZ(i):1)*shade*(1-scorch*.2);
  }
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();
  const material=part.material.clone();material.vertexColors=true;material.needsUpdate=true;
  const mesh=new THREE.Mesh(g,material);mesh.position.copy(part.position);mesh.quaternion.copy(part.quaternion);mesh.scale.copy(part.scale);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }
 // Fallen fragments retain the actual house geometry, UVs and material maps.
 for(const {part,piece,attributes}of debris){
  const g=geometryFor(attributes,piece.indices);g.translate(-piece.center.x,-piece.center.y,-piece.center.z);g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(random()*Math.PI,random()*Math.PI,random()*Math.PI)));
  g.computeBoundingBox();const material=part.material.clone();material.color.multiplyScalar(1-burn*.8);
  const mesh=new THREE.Mesh(g,material);mesh.position.set((random()-.5)*size.x*.8,-g.boundingBox.min.y+.04,(random()-.5)*size.z*.8);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }
 // Find the actual surviving floor rather than placing the fire below it.
 root.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(0,bounds.min.y+size.y*.65,0),new THREE.Vector3(0,-1,0));
 const hit=ray.intersectObjects(root.children,false).find(h=>h.face&&h.face.normal.y>.6);
 const origin=new THREE.Vector3(0,hit?hit.point.y+.025:bounds.min.y+.08,0);
 root.userData.bwsFireOrigin=origin.toArray();
 for(const mesh of root.children){bwsCharredSurface(mesh.material,impact,radius,burn,origin);mesh.userData.bwsAnimatedEffect=true;}
 if(burn>0){const coals=bwsCoalBed(Math.min(size.x,size.z)*.2,seed);coals.position.copy(origin);root.add(coals);
 const fuelBounds=new THREE.Box3().setFromObject(coals);
 root.userData.bwsFireOrigin=[origin.x,Math.max(origin.y,fuelBounds.max.y-.03),origin.z];}
 root.userData.houseDamage={sourceName:source.name,seed,severity,burn,method:"original-connected-pieces"};return root;
}
const BWS_DAMAGE_EFFECT_NODES=Object.freeze({
 ruinedHouse:{title:"Ruined House",category:"Damage & Effects",fields:{ruinWidth:["Width",7,2,30,.1],ruinDepth:["Depth",8,2,30,.1],ruinHeight:["Height",7,2,30,.1],ruinDamage:["Damage",.65,.1,1,.05],ruinBurn:["Scorch",.8,0,1,.05]}},
 ruinRubble:{title:"Rubble Scatter",category:"Damage & Effects",fields:{rubbleRadius:["Radius",3,.3,12,.1],rubbleCount:["Pieces",28,1,100,1],rubbleBurn:["Scorch",.6,0,1,.05]}},
 sceneFire:{title:"Fire Emitter",category:"Damage & Effects",fields:{effectSize:["Size",2,.2,8,.1],effectLifetime:["Lifetime",2,.5,10,.1],effectIntensity:["Intensity",1,0,2,.1],effectWind:["Wind",.3,-2,2,.1],effectColor:["Fire color","#ff761b"]}},
 sceneSmoke:{title:"Smoke Emitter",category:"Damage & Effects",fields:{smokeSize:["Size",3,.2,12,.1],smokeLifetime:["Lifetime",6,1,20,.1],smokeIntensity:["Density",.7,0,1,.05],smokeWind:["Wind",.3,-2,2,.1],smokeColor:["Smoke color","#55514d"]}}
});
function bwsBuildDamageNode(type,p,{graph,nodeId,group,outputName,emit}){
 const random=geometryNodePrng(graph.seed>>>0),parts=new Map();
 function add(g,color){if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}g.deleteAttribute("uv");if(!parts.has(color))parts.set(color,[]);parts.get(color).push(g);}
 function box(w,h,d,x,y,z,color){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color);}
 function beam(a,b,width,color){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);if(v.length()<.01)return;const g=new THREE.BoxGeometry(width,v.length(),width);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g,color);}
 function rubble(radius,count,burn){for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*radius,x=Math.cos(a)*r,z=Math.sin(a)*r;if(i%3===0){const g=new THREE.BoxGeometry(.13,.13,.7+random()*1.5);g.rotateY(random()*Math.PI);g.rotateZ((random()-.5)*.3);g.translate(x,.16,z);add(g,new THREE.Color("#70523a").lerp(new THREE.Color("#211e1b"),burn).getHex());}else{const g=new THREE.IcosahedronGeometry(.12+random()*.25,0);g.scale(1.3,.7,1);g.rotateY(random()*6.28);g.translate(x,.17,z);add(g,new THREE.Color("#8d887b").lerp(new THREE.Color("#45413c"),burn).getHex());}}}
 if(type==="ruinedHouse"){
  const w=p.ruinWidth,d=p.ruinDepth,h=p.ruinHeight,damage=p.ruinDamage,burn=p.ruinBurn,wall=h*.62;
  const wood=new THREE.Color("#74523a").lerp(new THREE.Color("#211c19"),burn).getHex(),stone=new THREE.Color("#989080").lerp(new THREE.Color("#4b4540"),burn*.8);
  box(w,.08,d,0,.04,0,new THREE.Color("#71665a").lerp(new THREE.Color("#38322e"),burn).getHex());
  for(let side=0;side<4;side++){
   const length=side<2?w:d,columns=Math.ceil(length/.65),rows=Math.ceil(wall/.38),step=length/columns;
   for(let c=0;c<columns;c++){const t=(c+.5)/columns,edge=Math.abs(t-.5)*2,top=Math.max(1,Math.floor(rows*(1-damage*(.3+.55*Math.sin(t*Math.PI)))+random()*2));
    for(let row=0;row<top;row++){if(side===0&&Math.abs(t-.5)<.13&&row*.38<Math.min(2,wall*.8))continue;const a=-length/2+(c+.5)*step;
     const color=stone.clone().multiplyScalar(.83+random()*.28).getHex();
     box(side<2?step-.025:.3,.35,side<2?.3:step-.025,side<2?a:(side===2?-w/2:w/2),.25+row*.38,side<2?(side===0?d/2:-d/2):a,color);
    }
    if(c%3===0&&edge>.35){const x=side<2?-length/2+(c+.5)*step:(side===2?-w/2:w/2),z=side<2?(side===0?d/2:-d/2):-length/2+(c+.5)*step;beam([x,.1,z],[x,wall*(.7+random()*.3),z],.15,wood);}
   }
  }
  const rafters=Math.max(3,Math.ceil(d/1.4));
  for(let i=0;i<rafters;i++){const z=-d/2+i*d/(rafters-1);for(const side of [-1,1]){const a=[side*w/2,wall,z],b=[0,h,z];if(random()>damage*.8)beam(a,b,.17,wood);else beam(a,[side*w*(.15+random()*.2),wall+(h-wall)*random()*.45,z],.17,wood);}}
  beam([0,h,-d/2],[0,h,d*(.5-damage*.7)],.2,wood);
  // Surviving roof patches stay against rafters; severe ruins expose the frame.
  for(const side of [-1,1]){const retained=Math.floor((1-damage)*rafters);for(let i=0;i<retained;i++){const z=-d/2+i*d/(rafters-1);for(let r=0;r<5;r++){const a=r/5,b=(r+1)/5;beam([side*w/2*(1-a),wall+(h-wall)*a,z],[side*w/2*(1-b),wall+(h-wall)*b,z],.32,new THREE.Color("#855b48").lerp(new THREE.Color("#332824"),burn).getHex());}}}
  rubble(Math.min(w,d)*.44,Math.round(15+damage*55),burn);
 }else if(type==="ruinRubble")rubble(p.rubbleRadius,p.rubbleCount,p.rubbleBurn);
 else{const smoke=type==="sceneSmoke",size=smoke?p.smokeSize:p.effectSize,color=smoke?p.smokeColor:p.effectColor;for(let i=0;i<7;i++){const g=smoke?new THREE.IcosahedronGeometry(size*(.18+i*.025),1):new THREE.ConeGeometry(size*(.17-i*.012),size*.7,7);g.translate((random()-.5)*size*.35,size*(.25+i*.22),(random()-.5)*size*.35);add(g,color);}}
 let n=0;for(const [color,list]of parts){const geometry=mergeGeometries(list,false);list.forEach(g=>g.dispose());emit(geometryNodeCustomSpec(geometry,{name:outputName+" "+(++n),position:[p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ],color,roughness:.96,graph,targetId:nodeId,group}));}return n;
}
function bwsDamageRecipe(type,params,seed){const graph=defaultGeometryNodeGraph(BWS_DAMAGE_EFFECT_NODES[type].title);graph.seed=seed>>>0;graph.nodeOrder=["seed",type,"output"];graph.connections=[{id:"a",fromNodeId:"seed",toNodeId:type,toInputIndex:0},{id:"b",fromNodeId:type,toNodeId:"output",toInputIndex:0}];Object.assign(graph.params,params);graph.nodeParams={};graph.generatedIds=[];graph.nodePositions={seed:[30,40],[type]:[280,40],output:[560,40]};return graph;}
function bwsSceneRuin(params,seed){const graph=bwsDamageRecipe("ruinedHouse",params,seed),root=new THREE.Group();root.name="Node-generated ruin";root.userData.nodeSource={type:"ruinedHouse",graph};bwsBuildDamageNode("ruinedHouse",assetNodeSanitize(graph.params),{graph,nodeId:"ruinedHouse",group:{id:graph.id,name:graph.name},outputName:graph.name,emit:spec=>{const mesh=geometryNodePreviewMesh(spec,new Map());mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}});return root;}
let bwsCharacterEffectCaptureDepth = 0;
function bwsCharacterEyesAwake() {
 if (tPoseFittingMode) return true;
 const id=String(animationState.activeClipId||"");
 const name=String(animationState.clips?.[id]?.name||"");
 return !/(^|[\s_/-])(dead|death|asleep|sleep|dormant)([\s_/-]|$)/i.test(id+" "+name);
}
function bwsUpdateCharacterEyeVisibility() {
 const awake=bwsCharacterEyesAwake();
 for(const object of objects){
  if(object.userData.gameAsset?.necromanticEye || object.userData.gameAsset?.bwsEffect?.type === "gasFire") {
   object.visible=!object.userData.hidden && awake;
  }
 }
}
function bwsAttachCharacterGasFire(carrier, recipe) {
 const finite=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
 const seed=finite(recipe.seed,41,0,2147483647);
 const fire=bwsSceneFlame({effectSize:1,effectLifetime:finite(recipe.lifetime,1.4,.2,10),effectIntensity:finite(recipe.intensity,.85,0,2),effectWind:finite(recipe.wind,.08,-2,2),effectColor:normalizeHexColor(recipe.color,"#ff761b"),assetOffsetX:0,assetOffsetY:0,assetOffsetZ:0},seed);
 // Eye-sized flames should not emit town-sized point sprites.
 for(const child of [...fire.children]){fire.remove(child);child.geometry?.dispose();child.material?.dispose();}
 const size=Array.isArray(recipe.scale)?recipe.scale:[.09,.075,.09];
 fire.scale.set(finite(size[0],.09,.005,10),finite(size[1],.075,.005,10),finite(size[2],.09,.005,10));
 fire.name="Bone-attached gas fire";
 fire.castShadow=false;fire.receiveShadow=false;
 const cameraCallback=fire.onBeforeRender;
 fire.onBeforeRender=(renderer,renderScene,renderCamera,...args)=>{
   // Animation captures evaluate animationState.frame before rendering, too.
   fire.material.uniforms.fxTime.value=bwsCharacterEffectCaptureDepth>0
     ? animationState.frame/Math.max(1,animationState.fps)
     : performance.now()*.001;
   cameraCallback(renderer,renderScene,renderCamera,...args);
 };
 carrier.material.colorWrite=false;carrier.material.depthWrite=false;
 carrier.castShadow=false;carrier.receiveShadow=false;
 carrier.add(fire);
}
function bwsSceneFlame(params,seed){
 const p=assetNodeSanitize(params),geometry=new THREE.BoxGeometry(2,4,2);geometry.translate(0,2,0);
 const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.BackSide,uniforms:{
  fxTime:{value:0},eye:{value:new THREE.Vector3()},wind:{value:p.effectWind},speed:{value:2/p.effectLifetime},strength:{value:p.effectIntensity},tint:{value:new THREE.Color(p.effectColor)},seed:{value:(seed%10007)*.013},
  sceneDepth:{value:null},useSceneDepth:{value:0},depthViewport:{value:new THREE.Vector2(1,1)},inverseProjection:{value:new THREE.Matrix4()},viewToLocal:{value:new THREE.Matrix4()}
 },vertexShader:'varying vec3 localPosition;void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
 precision highp float;
 varying vec3 localPosition;uniform vec3 eye,tint;uniform float fxTime,wind,speed,strength,seed;
 uniform mat4 modelViewMatrix,projectionMatrix,inverseProjection,viewToLocal;
 uniform sampler2D sceneDepth;uniform float useSceneDepth;uniform vec2 depthViewport;
 float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float turbulence(vec3 p){return noise(p)*.58+noise(p*2.03)*.28+noise(p*4.07)*.14;}
 float opaqueEnd(vec3 ray,float end){
  if(useSceneDepth<.5)return end;
  vec2 uv=gl_FragCoord.xy/depthViewport;
  float depth=texture2D(sceneDepth,uv).x;
  vec4 view=inverseProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
  vec3 local=(viewToLocal*vec4(view.xyz/view.w,1.0)).xyz;
  return min(end,dot(local-eye,ray));
 }
 void main(){
  vec3 ray=normalize(localPosition-eye);
  vec3 safeRay=mix(vec3(.00001),ray,step(vec3(.00001),abs(ray)));
  vec3 a=(vec3(-1.0,0.0,-1.0)-eye)/safeRay,b=(vec3(1.0,4.0,1.0)-eye)/safeRay;
  vec3 lo=min(a,b),hi=max(a,b);float start=max(0.0,max(lo.x,max(lo.y,lo.z))),end=opaqueEnd(ray,min(hi.x,min(hi.y,hi.z)));
  if(end<=start||strength<=0.0)discard;
  float stepSize=(end-start)/64.0,time=fxTime*speed,firstFlame=-1.0;vec4 total=vec4(0);
  for(int i=0;i<64;i++){
   float sampleT=start+(float(i)+.5)*stepSize;
   vec3 q=eye+ray*sampleT;float h=clamp(q.y*.25,0.0,1.0);
   q.x-=wind*h*h*.23;
   // Separate folded reaction sheets; avoid filling the entire tapered envelope.
   float n=turbulence(vec3(q.x*4.6,q.y*2.4-time*3.8,q.z*4.6)+seed);
   float density=0.0,heat=0.0,sootDensity=0.0;
   for(int tongue=0;tongue<4;tongue++){
    float id=float(tongue);
    float rate=.27+.085*fract(sin(seed+id*17.13)*43758.5453);
    float clock=time*rate+id*.25+fract(seed*.3);
    float age=fract(clock),phase=seed+id*2.39996+floor(clock)*1.618;
    float variation=fract(sin(phase*7.73)*43758.5453);
    float life=smoothstep(0.0,.07,age)*(1.0-smoothstep(.78,1.0,age));
    float height=1.35+.45*variation+.38*sin(age*3.14159265);
    float rise=age*(2.0+.18*variation);
    float t=(q.y-rise)/height;
    if(t>0.0&&t<1.0){
     vec2 root=(.22+.20*variation)*vec2(cos(phase),sin(phase));
     vec2 bend=vec2(sin(t*6.2-time*2.7+phase),cos(t*5.1-time*2.3+phase));
     vec2 wander=vec2(sin(age*8.0+phase),cos(age*6.7+phase*1.4))*age*.12;
     vec2 center=root*(1.0-.25*t)+bend*t*(.15+.18*t)+wander;
     float width=(.27+.06*sin(phase))*pow(1.0-t,.68)+.018;
     vec2 p=(q.xz-center)/width;
     float angle=atan(p.y,p.x);
     float radius=length(p)+(n-.5)*(.55+t*.55)+sin(angle*2.0+t*7.0-time*2.2+phase)*.13;
     float shell=smoothstep(.12,.48,radius)*(1.0-smoothstep(.78,1.12,radius));
     float core=(1.0-smoothstep(.05,.55,radius))*.16*(1.0-t);
     float d=(shell+core)*smoothstep(0.0,.045,t)*(1.0-smoothstep(.8,1.0,t))*life;
     density=max(density,d);
     heat=max(heat,d*(1.0-t*.65));
     // Sparse cooler soot curls travel with the upward flame packets.
     float soot=smoothstep(.55,.77,n)*smoothstep(.25,.65,t)*(1.0-smoothstep(.75,1.35,radius))*life;
     sootDensity=max(sootDensity,soot*.65);
    }
   }
   // Small ignition layer stays on the fuel; every larger flame packet rises and dies.
   float ignition=(1.0-smoothstep(.12,.46,q.y))*smoothstep(.22,.58,n)*(1.0-smoothstep(.28,.65,length(q.xz)));
   density=max(density,ignition*.65);
   heat=max(heat,ignition*.6);
   density*=smoothstep(0.0,.018,h);
   float hot=clamp(heat,0.0,1.0);
   vec3 color=mix(tint*vec3(2.6,.6,.12),vec3(3.7,.72,.012),smoothstep(.1,.72,hot));
   color=mix(color,vec3(4.7,2.0,.16),smoothstep(.86,1.0,hot)*(1.0-smoothstep(.025,.15,h)));
   float fireAlpha=1.0-exp(-density*stepSize*4.2*strength);
   float sootAlpha=1.0-exp(-sootDensity*stepSize*2.8*strength);
   float alpha=1.0-(1.0-fireAlpha)*(1.0-sootAlpha);
   color=(color*fireAlpha*(1.0-sootAlpha)+vec3(.018,.014,.011)*sootAlpha)/max(alpha,.00001);
   if(firstFlame<0.0&&alpha>.0001)firstFlame=sampleT;
   total.rgb+=(1.0-total.a)*color*alpha;total.a+=(1.0-total.a)*alpha;
   if(total.a>.995)break;
  }
  if(total.a<.005||firstFlame<0.0)discard;
  vec4 clip=projectionMatrix*modelViewMatrix*vec4(eye+ray*firstFlame,1.0);
  gl_FragDepth=.5*(clip.z/clip.w)+.5;
  gl_FragColor=vec4(total.rgb/max(total.a,.001),total.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
 `});
 const mesh=new THREE.Mesh(geometry,material);mesh.name="Procedural volume fire";mesh.scale.setScalar(p.effectSize*.65);mesh.position.set(p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ);
 mesh.userData.bwsAnimatedEffect=true;mesh.userData.bwsFireLight={size:p.effectSize,intensity:p.effectIntensity,seed};mesh.userData.nodeSource={type:"sceneFire",graph:bwsDamageRecipe("sceneFire",params,seed)};
 mesh.onBeforeRender=(_renderer,_scene,camera)=>{
  camera.getWorldPosition(material.uniforms.eye.value);mesh.worldToLocal(material.uniforms.eye.value);
  material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
  material.uniforms.viewToLocal.value.copy(mesh.matrixWorld).invert().multiply(camera.matrixWorld);
 };
 mesh.add(bwsFireSparks(seed,p.effectIntensity));return mesh;
}
function bwsFireSparks(seed,intensity){
 const random=geometryNodePrng(seed+721),positions=[],phases=[];for(let i=0;i<18;i++){positions.push((random()-.5)*1.2,random(),(random()-.5)*1.2);phases.push(random());}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute("phase",new THREE.Float32BufferAttribute(phases,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{fxTime:{value:0},strength:{value:intensity}},vertexShader:'attribute float phase;uniform float fxTime;varying float age;void main(){age=fract(phase+fxTime*.22);vec3 p=position;p.y=.3+age*6.0;p.x+=sin(age*7.0+phase*25.0)*age*.6;p.z+=cos(age*6.0+phase*19.0)*age*.6;vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;gl_PointSize=clamp(65.0/max(1.0,-v.z),1.0,3.5);}',fragmentShader:'uniform float strength;varying float age;void main(){float d=length(gl_PointCoord-.5)*2.0;if(d>1.0)discard;gl_FragColor=vec4(1.0,.25,.015,(1.0-d)*(1.0-age)*strength*.7);}'});
 const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.name="Rising fire sparks";points.userData.bwsAnimatedEffect=true;return points;
}
function bwsSceneSmokeVolume(params,seed){
 const p=assetNodeSanitize(params);
 // Reuse the bounded volume and camera-local ray setup, not a billboard.
 const mesh=bwsSceneFlame({effectSize:p.smokeSize,effectLifetime:p.smokeLifetime,effectIntensity:p.smokeIntensity,effectWind:p.smokeWind,effectColor:p.smokeColor,assetOffsetX:p.assetOffsetX,assetOffsetY:p.assetOffsetY,assetOffsetZ:p.assetOffsetZ},seed);
 for(const child of [...mesh.children]){mesh.remove(child);child.geometry.dispose();child.material.dispose();}
 delete mesh.userData.bwsFireLight;mesh.name="Billowing volumetric smoke";mesh.userData.nodeSource={type:"sceneSmoke",graph:bwsDamageRecipe("sceneSmoke",params,seed)};
 const material=mesh.material;material.uniforms.speed.value=6/p.smokeLifetime;
 const start=material.fragmentShader.indexOf('void main()');
 material.fragmentShader=material.fragmentShader.slice(0,start)+`void main(){
  vec3 ray=normalize(localPosition-eye),safeRay=ray+vec3(.00001);
  vec3 a=(vec3(-1.0,0.0,-1.0)-eye)/safeRay,b=(vec3(1.0,4.0,1.0)-eye)/safeRay;
  vec3 lo=min(a,b),hi=max(a,b);float start=max(0.0,max(lo.x,max(lo.y,lo.z))),end=opaqueEnd(ray,min(hi.x,min(hi.y,hi.z)));if(end<=start)discard;
  float stepSize=(end-start)/32.0,time=fxTime*speed;vec4 total=vec4(0);float firstSmoke=-1.0;
  for(int i=0;i<32;i++){
   vec3 q=eye+ray*(start+(float(i)+.5)*stepSize);float h=q.y*.25;
   q.x-=wind*h*.22+sin(h*7.0-time*.65+seed)*h*.18;q.z-=cos(h*6.0-time*.5+seed)*h*.15;
   vec3 flow=vec3(q.x*3.5,q.y*2.0-time,q.z*3.5)+seed;
   float n=turbulence(flow),detail=noise(flow*2.0+5.0);
   float width=.24+h*.61+sin(q.y*5.0-time*2.0+n*3.0)*.09;
   float body=1.0-length(q.xz)/max(.1,width)+(n-.5)*1.5;
   float density=smoothstep(.02,.48,body)*smoothstep(.01,.1,h)*(1.0-smoothstep(.63,1.0,h));
   float alpha=1.0-exp(-density*stepSize*3.4*strength);if(firstSmoke<0.0&&alpha>.0001)firstSmoke=start+(float(i)+.5)*stepSize;
   float illumination=.48+.48*n+.18*detail;
   vec3 smokeColor=tint*illumination+vec3(.045,.037,.027)*(1.0-h);
   total.rgb+=(1.0-total.a)*smokeColor*alpha;total.a+=(1.0-total.a)*alpha;
  }
  if(total.a<.005||firstSmoke<0.0)discard;vec4 clip=projectionMatrix*modelViewMatrix*vec4(eye+ray*firstSmoke,1.0);gl_FragDepth=.5*(clip.z/clip.w)+.5;gl_FragColor=vec4(total.rgb/max(.001,total.a),total.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;material.needsUpdate=true;return mesh;
}
function bwsSceneEmitter(type,params,seed){
 if(type==="sceneFire")return bwsSceneFlame(params,seed);
 if(type==="sceneSmoke")return bwsSceneSmokeVolume(params,seed);
 const smoke=type==="sceneSmoke",p=assetNodeSanitize(params),random=geometryNodePrng(seed>>>0),count=smoke?24:36;
 const geometry=new THREE.BufferGeometry(),origins=[],phases=[];for(let i=0;i<count;i++){origins.push((random()-.5)*.7,random(),(random()-.5)*.7);phases.push(random());}geometry.setAttribute("position",new THREE.Float32BufferAttribute(origins,3));geometry.setAttribute("phase",new THREE.Float32BufferAttribute(phases,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:smoke?THREE.NormalBlending:THREE.AdditiveBlending,uniforms:{fxTime:{value:0},size:{value:smoke?p.smokeSize:p.effectSize},life:{value:smoke?p.smokeLifetime:p.effectLifetime},strength:{value:smoke?p.smokeIntensity:p.effectIntensity},wind:{value:smoke?p.smokeWind:p.effectWind},tint:{value:new THREE.Color(smoke?p.smokeColor:p.effectColor)},smoke:{value:smoke?1:0}},
 vertexShader:'attribute float phase; uniform float fxTime,size,life,wind,smoke; varying float age; void main(){age=fract(phase+fxTime/life);vec3 p=position; p.xz*=size*(0.6+age*smoke);p.y=age*size*(2.0+smoke*2.0);p.x+=wind*age*age*size+sin(age*8.0+phase*20.0)*size*.13;vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;gl_PointSize=clamp(size*(0.4+smoke*age)*500.0/max(1.0,-v.z),1.0,180.0);}',
 fragmentShader:'uniform vec3 tint;uniform float strength,smoke;varying float age;void main(){vec2 q=gl_PointCoord*2.0-1.0;float radius=length(q);if(radius>1.0)discard;float a=pow(1.0-radius,1.7)*sin(age*3.14159)*strength;vec3 c=mix(mix(vec3(1.0,.85,.3),tint,age),tint,smoke);gl_FragColor=vec4(c,a*mix(.8,.3,smoke));}' });
 const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.name=BWS_DAMAGE_EFFECT_NODES[type].title;points.userData.bwsAnimatedEffect=true;points.userData.nodeSource={type,graph:bwsDamageRecipe(type,params,seed)};points.position.set(p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ);return points;
}

// geometry-assets
const BWS_ASSET_NODES = Object.freeze({
 ...VEHICLE_NODES,
 ...BWS_BUILDING_NODES,
 ...BWS_SCENE_ENVIRONMENT_NODES,
 ...BWS_DETAILED_NATURE_NODES,
 ...BWS_VILLAGE_PROP_NODES,
 ...BWS_DAMAGE_EFFECT_NODES,
 barrel:{title:"Barrel",fields:{barrelHeight:["Height",2,.3,8,.1],barrelRadius:["Radius",.7,.15,3,.05],barrelBulge:["Belly",.16,0,.8,.02],barrelThickness:["Wood thickness",.07,.02,.25,.01],barrelStaves:["Staves",16,8,32,1],barrelHoops:["Iron hoops",2,1,4,1],barrelMode:["Ends","closed",["closed","open","broken"]],barrelWood:["Wood","#936937"],barrelIron:["Iron","#414944"]}},
 brickWall:{title:"Brick Wall",fields:{brickCopies:["Wall copies",1,1,12,1],brickRepeat:["Seamless horizontal repeat",false],brickLength:["Length",6,.5,20,.25],brickHeight:["Height",3,.3,10,.1],brickDepth:["Depth",.4,.1,2,.05],brickColumns:["Columns",8,1,24,1],brickRows:["Courses",8,1,20,1],brickGap:["Joint fraction",.06,0,.2,.01],brickVariation:["Color variation",.12,0,.35,.01],brickColor:["Brick","#846c58"],brickMortar:["Mortar","#494943"]}},
 houseWall:{title:"House Wall",fields:{houseWidth:["Width",6,1,20,.25],houseHeight:["Height",3,1,10,.1],houseDepth:["Thickness",.24,.1,1,.02],houseBays:["Frame bays",3,1,12,1],houseBeam:["Beam width",.16,.05,.4,.01],houseOpening:["Opening","door",["none","door","window"]],houseOpeningWidth:["Opening width",1.2,.3,5,.1],houseOpeningHeight:["Opening height",2,.3,4,.1],houseSill:["Window sill",.9,.1,3,.1],housePanel:["Plaster","#b1a58b"],houseTimber:["Timber","#65462e"]}},
 groundTiles:{title:"Ground Tiles",fields:{tileColumns:["Columns",4,1,16,1],tileRows:["Rows",4,1,16,1],tileSize:["Grid size",1,.2,4,.1],tileThickness:["Thickness",.15,.03,1,.01],tileGap:["Joint fraction",.025,0,.15,.005],tileVariation:["Color variation",.1,0,.3,.01],tileColor:["Stone","#737b72"],tileBase:["Joint base",true]}}
});
function assetNodeDefaults(){const p={assetOffsetX:0,assetOffsetY:0,assetOffsetZ:0};for(const n of Object.values(BWS_ASSET_NODES))for(const[k,f]of Object.entries(n.fields))p[k]=f[1];return p;}
function assetNodeSanitize(source){const p={};for(const n of Object.values(BWS_ASSET_NODES))for(const[k,f]of Object.entries(n.fields)){const v=source[k];p[k]=typeof f[1]==="number"?geometryNodeNumber(v,f[1],f[2],f[3]):typeof f[1]==="boolean"?(typeof v==="boolean"?v:f[1]):Array.isArray(f[2])?(f[2].includes(v)?v:f[1]):(/^#[0-9a-f]{6}$/i.test(v||"")?v:f[1]);if(typeof f[1]==="number"&&f[4]===1)p[k]=Math.round(p[k]);}for(const a of["X","Y","Z"])p["assetOffset"+a]=geometryNodeNumber(source["assetOffset"+a],0,-100,100);return p;}
function assetNodeFields(type,source,instanceId){const p=assetNodeSanitize(source);let html="";for(const[k,f]of Object.entries(BWS_ASSET_NODES[type].fields))html+=Array.isArray(f[2])?geometryNodeSelectField(f[0],k,p[k],f[2].map(x=>[x,x]),instanceId):geometryNodeField(f[0],k,p[k],{instanceId,type:typeof f[1]==="boolean"?"checkbox":typeof f[1]==="number"?"number":"color",min:f[2],max:f[3],step:f[4]});for(const a of(BWS_ASSET_NODES[type].attachment?[]:["X","Y","Z"]))html+=geometryNodeField("Offset "+a,"assetOffset"+a,p["assetOffset"+a],{instanceId,min:-100,max:100,step:.1});if(type==="brickWall")html+='<button type="button" data-geometry-wall-copy="'+geometryNodeEscape(instanceId)+'">Add copy right</button>';if(type==="brickWall")html+='<p class="geometry-node-card-note">Repeat mode: place copies exactly Length units apart on X. Edge halves share texture, UVs and color. Horizontal only.</p>';if(BWS_ASSET_NODES[type].attachment)return html+'<p class="geometry-node-card-note">Connect after House Layout or House Wall, then onward to Group Output. Uses source dimensions. Roof and Floor require House Layout.</p>';return html+'<p class="geometry-node-card-note">Y up, base at zero. Connect to Group Output. Bake keeps parts editable. Duplicate cards have independent values.</p>';}
function assetNodeSector(profile,a0,a1,steps){const vertices=[],uv=[];
 function quad(a,b,c,d,out){const ab=new THREE.Vector3().subVectors(b,a),ac=new THREE.Vector3().subVectors(c,a),reverse=ab.cross(ac).dot(out)<0;for(const i of(reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3])){vertices.push(...[a,b,c,d][i].toArray());uv.push(...[[0,0],[1,0],[1,1],[0,1]][i]);}}
 const point=(r,y,a)=>new THREE.Vector3(r*Math.cos(a),y,r*Math.sin(a));
 for(let s=0;s<steps;s++){const a=a0+(a1-a0)*s/steps,b=a0+(a1-a0)*(s+1)/steps,m=(a+b)/2;for(let j=0;j<profile.length-1;j++){const l=profile[j],h=profile[j+1];for(const inner of[false,true]){const k=inner?2:1;quad(point(l[k],l[0],a),point(l[k],l[0],b),point(h[k],h[0],b),point(h[k],h[0],a),new THREE.Vector3(Math.cos(m)*(inner?-1:1),0,Math.sin(m)*(inner?-1:1)));}}for(const top of[false,true]){const p=profile[top?profile.length-1:0];quad(point(p[2],p[0],a),point(p[1],p[0],a),point(p[1],p[0],b),point(p[2],p[0],b),new THREE.Vector3(0,top?1:-1,0));}}
 for(const end of[false,true]){const a=end?a1:a0;for(let j=0;j<profile.length-1;j++){const l=profile[j],h=profile[j+1];quad(point(l[2],l[0],a),point(l[1],l[0],a),point(h[1],h[0],a),point(h[2],h[0],a),new THREE.Vector3(-Math.sin(a)*(end?1:-1),0,Math.cos(a)*(end?1:-1)));}}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function assetNodeBuild(type,source,{graph,nodeId,group,outputName,emit,attachments=[]}){
 const p=assetNodeSanitize(source);
 if(VEHICLE_NODES[type])return buildVehicleNode(type,p,{seed:graph.seed,emit:(geometry,name,position,color,roughness)=>emit(geometryNodeCustomSpec(geometry,{name:outputName+" "+nodeId+" "+name,position:position.map((v,i)=>v+[p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ][i]),color,roughness,group,graph,targetId:nodeId}))});
 if(BWS_DAMAGE_EFFECT_NODES[type])return bwsBuildDamageNode(type,p,{graph,nodeId,group,outputName,emit});
 if(BWS_ASSET_NODES[type]?.attachment)return 0;
 if(BWS_VILLAGE_PROP_NODES[type])return bwsBuildVillageProp(type,p,{graph,nodeId,group,outputName,emit});
 if(BWS_DETAILED_NATURE_NODES[type])return bwsBuildDetailedNature(type,p,{graph,nodeId,group,outputName,emit});
 if(BWS_SCENE_ENVIRONMENT_NODES[type])return bwsBuildEnvironmentNode(type,p,{graph,nodeId,group,outputName,emit});
 if(type==="houseLayout" || (type==="houseWall" && attachments.length))return buildArchitecture(type,p,{graph,nodeId,group,outputName,emit,attachments});
 const random=geometryNodePrng(graph.seed+graph.nodeOrder.indexOf(nodeId)*7919);let count=0;
 function add(g,name,x,y,z,color,textureKey=undefined,textureParams=undefined){const spec=geometryNodeCustomSpec(g,{textureKey,textureParams,name:`${outputName} ${nodeId} ${name}`,position:[x+p.assetOffsetX,y+p.assetOffsetY,z+p.assetOffsetZ],color,group,graph,targetId:nodeId});
  emit(spec);count++;
  if(type==="brickWall")for(let copy=1;copy<p.brickCopies;copy++){
    emit({...spec,geometry:structuredClone(spec.geometry),name:spec.name+" copy "+(copy+1),position:[spec.position[0]+copy*p.brickLength,spec.position[1],spec.position[2]]});count++;
  }
 }
 function box(name,x,y,z,w,h,d,color){if(w<=.0001||h<=.0001||d<=.0001)return;add(new THREE.BoxGeometry(w,h,d),name,x,y,z,color);}
 function tint(color,amount){const c=new THREE.Color(color);c.multiplyScalar(1+(random()-.5)*amount);return '#'+c.getHexString();}
 if(type==="barrel"){
  const h=p.barrelHeight,r=p.barrelRadius,t=Math.min(p.barrelThickness,r*.35),n=p.barrelStaves,radius=y=>r+p.barrelBulge*Math.sin(Math.PI*y/h);
  for(let i=0;i<n;i++){const top=p.barrelMode==="broken"&&i%3!==0?h*(.67+random()*.25):h,profile=[];for(let j=0;j<=6;j++){const y=top*j/6,outer=radius(y);profile.push([y,outer,outer-t]);}add(assetNodeSector(profile,i*2*Math.PI/n+.002,(i+1)*2*Math.PI/n-.002,1),`wood stave ${i+1}`,0,0,0,tint(p.barrelWood,.16));}
  for(let i=0;i<p.barrelHoops;i++){const y=h*(.13+.74*(i+.5)/p.barrelHoops),band=Math.min(h*.07,.16),lo=y-band/2,hi=y+band/2;add(assetNodeSector([[lo,radius(lo)+.035,radius(lo)+.007],[hi,radius(hi)+.035,radius(hi)+.007]],0,Math.PI*2,n),`iron hoop ${i+1}`,0,0,0,p.barrelIron);}
  const capRadius=r-t+.008,capDepth=Math.min(t,h*.08);
  function lid(y,label){const poly=Array.from({length:n},(_,i)=>[capRadius*Math.cos(i*2*Math.PI/n),capRadius*Math.sin(i*2*Math.PI/n)]);
   function clip(points,bound,lower){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ia=lower?a[0]>=bound:a[0]<=bound,ib=lower?b[0]>=bound:b[0]<=bound;if(ia)out.push(a);if(ia!==ib){const f=(bound-a[0])/(b[0]-a[0]);out.push([bound,a[1]+f*(b[1]-a[1])]);}}return out;}
   for(let i=0;i<5;i++){const left=-capRadius+2*capRadius*i/5,right=-capRadius+2*capRadius*(i+1)/5,pts=clip(clip(poly,left,true),right,false);if(pts.length<3)continue;const shape=new THREE.Shape();shape.moveTo(...pts[0]);pts.slice(1).forEach(v=>shape.lineTo(...v));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:capDepth,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);add(g,`${label} plank ${i+1}`,0,y,0,tint(p.barrelWood,.14));}}
  lid(0,"bottom");if(p.barrelMode==="closed")lid(h-capDepth,"lid");
 }
 if(type==="brickWall"){
  const w=p.brickLength,h=p.brickHeight,d=p.brickDepth,cw=w/p.brickColumns,rh=h/p.brickRows,gap=p.brickGap;
  if(p.brickRepeat) add(new THREE.BoxGeometry(w,h,d*.72),"mortar core",0,h/2,0,p.brickMortar,undefined,null);
  else box("mortar core",0,h/2,0,w,h,d*.72,p.brickMortar);
  for(let row=0;row<p.brickRows;row++)for(let col=-1;col<p.brickColumns;col++){
   const fullLeft=-w/2+(col+(row%2)*.5)*cw,fullRight=fullLeft+cw;
   if(!p.brickRepeat){
    const left=Math.max(-w/2,fullLeft),right=Math.min(w/2,fullRight);
    if(right<=left)continue;
    box(`course ${row+1} brick ${col+2}`,(left+right)/2,(row+.5)*rh,0,(right-left)*(1-gap),rh*(1-gap),d,tint(p.brickColor,p.brickVariation));
    continue;
   }
   // Inset the full brick BEFORE clipping at the repeat boundary. End half-bricks
   // meet without a false mortar joint when another wall is placed at X + length.
   const left=Math.max(-w/2,fullLeft+cw*gap/2),right=Math.min(w/2,fullRight-cw*gap/2);
   if(right-left<=.0001)continue;
   const canonical=((col%p.brickColumns)+p.brickColumns)%p.brickColumns;
   const key=`repeat course ${row} brick ${canonical}`;
   const colorRandom=geometryNodePrng((graph.seed + row*73856093 + canonical*19349663)>>>0);
   const color=new THREE.Color(p.brickColor).multiplyScalar(1+(colorRandom()-.5)*p.brickVariation);
   const center=(left+right)/2,fullCenter=(fullLeft+fullRight)/2;
   const geometry=new THREE.BoxGeometry(right-left,rh*(1-gap),d);
   const pos=geometry.getAttribute("position"),normal=geometry.getAttribute("normal"),uv=geometry.getAttribute("uv");
   for(let v=0;v<pos.count;v++){
    // Preserve the UV region of the original full brick instead of stretching
    // each cut half to fill the entire source image.
    const nx=normal.getX(v),ny=normal.getY(v),nz=normal.getZ(v);
    if(Math.abs(nx)<.5){
     const u=(pos.getX(v)+center-fullCenter)/(cw*(1-gap))+.5;
     uv.setX(v,nz<-.5?1-u:u);
    }
   }
   uv.needsUpdate=true;
   add(geometry,`course ${row+1} brick ${col+2}`,center,(row+.5)*rh,0,'#'+color.getHexString(),key);
  }
 }
 if(type==="houseWall"){
  const w=p.houseWidth,h=p.houseHeight,d=p.houseDepth,b=Math.min(p.houseBeam,w*.12,h*.12);
  const ow=Math.min(p.houseOpeningWidth,w-4*b),sill=p.houseOpening==="window"?Math.min(p.houseSill,h-3*b):0;
  const oh=Math.min(p.houseOpeningHeight,h-sill-2*b),has=p.houseOpening!=="none",left=-ow/2,right=ow/2,top=sill+oh;
  // Partition the frame/infill union. No overlapping solids or coincident exterior
  // faces at rail/stud crossings; openings are removed from every material.
  const frames=[];
  function frame(x0,y0,x1,y1){frames.push({x0:Math.max(-w/2,x0),y0:Math.max(0,y0),x1:Math.min(w/2,x1),y1:Math.min(h,y1)});}
  frame(-w/2,0,w/2,b);frame(-w/2,h-b,w/2,h);
  for(let i=0;i<=p.houseBays;i++){const x=-w/2+b/2+(w-b)*i/p.houseBays;frame(x-b/2,0,x+b/2,h);}
  if(has){frame(left-b,0,left,top);frame(right,0,right+b,top);frame(left-b,top,right+b,top+b);if(sill>0)frame(left-b,sill-b,right+b,sill);}
  const unique=values=>[...new Set(values.map(v=>Math.round(v*1e8)/1e8))].sort((a,b)=>a-b);
  const xs=unique([-w/2,w/2,...frames.flatMap(r=>[r.x0,r.x1]),...(has?[left,right]:[])]);
  const ys=unique([0,h,...frames.flatMap(r=>[r.y0,r.y1]),...(has?[sill,top]:[])]);
  const rectangles=[];let previous=new Map();
  for(let row=0;row<ys.length-1;row++){
    const y0=ys[row],y1=ys[row+1],cy=(y0+y1)/2,runs=[];
    for(let col=0;col<xs.length-1;col++){
      const x0=xs[col],x1=xs[col+1],cx=(x0+x1)/2;
      if(x1-x0<1e-7||y1-y0<1e-7)continue;
      if(has&&cx>left&&cx<right&&cy>sill&&cy<top)continue;
      const timber=frames.some(r=>cx>r.x0&&cx<r.x1&&cy>r.y0&&cy<r.y1);
      const last=runs[runs.length-1];
      if(last&&last.timber===timber&&Math.abs(last.x1-x0)<1e-7)last.x1=x1;
      else runs.push({x0,x1,y0,y1,timber});
    }
    const current=new Map();
    for(const run of runs){const key=[run.x0,run.x1,run.timber].join(':');const old=previous.get(key);
      if(old&&Math.abs(old.y1-y0)<1e-7){old.y1=y1;current.set(key,old);}
      else{rectangles.push(run);current.set(key,run);}
    }
    previous=current;
  }
  rectangles.forEach((r,i)=>box((r.timber?"timber section ":"plaster panel ")+(i+1),(r.x0+r.x1)/2,(r.y0+r.y1)/2,0,r.x1-r.x0,r.y1-r.y0,r.timber?d+.05:d,r.timber?p.houseTimber:p.housePanel));
 }
 if(type==="groundTiles"){const s=p.tileSize,h=p.tileThickness,w=p.tileColumns*s,d=p.tileRows*s;if(p.tileBase)box("joint foundation",0,h*.2,0,w,h*.4,d,"#454a45");for(let row=0;row<p.tileRows;row++)for(let col=0;col<p.tileColumns;col++)box(`slab ${row+1}.${col+1}`,(col+.5)*s-w/2,h/2,(row+.5)*s-d/2,s*(1-p.tileGap),h,s*(1-p.tileGap),tint(p.tileColor,p.tileVariation));}
 return count;
}

// geometry-nodes
const GEOMETRY_NODES_STORAGE_KEY = "boltworks.geometryNodes.v1";
const GEOMETRY_NODE_DEFINITIONS = Object.freeze({
  ...Object.fromEntries(Object.entries(BWS_ASSET_NODES).map(([type, node]) => [type, Object.freeze({title:node.title || node.label || type, category:node.category || "Game Assets", input:node.attachment ? "Geometry" : "Seed", inputSockets:[node.attachment ? "Geometry" : "Seed","Texture"], output:"Geometry"})])),
  seed: Object.freeze({ title: "Seed", category: "Inputs", input: null, output: "Seed" }),
  textureRandomizer: Object.freeze({ title: "Texture / Color Randomizer", category: "Inputs", input: "Texture", inputSockets: ["Texture", "Texture 2", "Texture 3", "Texture 4"], output: "Texture" }),
  colorPalette: Object.freeze({title:"Color Palette",category:"Inputs",input:"Texture",inputSockets:["Texture"],output:"Texture"}),
  textureInput: Object.freeze({ title: "Texture Input", category: "Inputs", input: null, output: "Texture" }),
  variant: Object.freeze({ title: "Tree Variant", category: "Inputs", input: "Seed", output: "Seed" }),
  primitive: Object.freeze({ title: "Mesh Primitive", category: "Geometry", input: null, output: "Geometry" }),
  stem: Object.freeze({ title: "Tapered Stem", category: "Geometry", input: "Seed", output: "Geometry" }),
  branchArray: Object.freeze({ title: "Branch Array", category: "Geometry", input: "Geometry", output: "Geometry" }),
  clusterScatter: Object.freeze({ title: "Cluster Scatter", category: "Geometry", input: "Geometry", output: "Geometry" }),
  rocks: Object.freeze({ title: "Rock Generator", category: "Nature", input: "Seed", inputSockets: ["Seed", "Texture"], output: "Geometry" }),
  stoneWall: Object.freeze({ title: "Stone Wall", category: "Nature", input: "Seed", inputSockets: ["Seed", "Upper", "Middle", "Bottom", "Overall"], output: "Geometry" }),
  grass: Object.freeze({ title: "Grass Scatter", category: "Nature Details", input: "Geometry", output: "Geometry" }),
  moss: Object.freeze({ title: "Moss Growth", category: "Nature Details", input: "Geometry", output: "Geometry" }),
  join: Object.freeze({ title: "Join Geometry", category: "Layout", input: "Geometry", inputSockets: ["Geometry", "Geometry 2", "Geometry 3", "Geometry 4"], output: "Geometry", multiInput: true }),
  primitiveTest: Object.freeze({ title: "Primitive Smooth Test", category: "Testing", input: "Seed", output: "Geometry" }),
  roots: Object.freeze({ title: "Root Flare", category: "Growth", input: "Seed", output: "Seed" }),
  trunk: Object.freeze({ title: "Trunk", category: "Growth", input: "Seed", output: "Trunk" }),
  bend: Object.freeze({ title: "Trunk Bend", category: "Modifiers", input: "Trunk", output: "Trunk" }),
  branches: Object.freeze({ title: "Branches", category: "Growth", input: "Trunk", output: "Branches" }),
  smoothJoints: Object.freeze({ title: "Smooth Joints", category: "Modifiers", input: "Branches", output: "Branches" }),
  junctionBlend: Object.freeze({ title: "Junction Blend", category: "Modifiers", input: "Geometry", output: "Geometry" }),
  twigs: Object.freeze({ title: "Twigs", category: "Growth", input: "Branches", output: "Branches" }),
  canopy: Object.freeze({ title: "Canopy", category: "Growth", input: "Branches", output: "Canopy" }),
  knot: Object.freeze({ title: "Cut Knot", category: "Growth", input: "Trunk", output: "Geometry" }),
  cutSurface: Object.freeze({ title: "Cut Rings", category: "Modifiers", input: "Geometry", output: "Geometry" }),
  smoothGeometry: Object.freeze({ title: "Smooth Geometry", category: "Modifiers", input: "Geometry", output: "Geometry", contextOnly: true }),
  transform: Object.freeze({ title: "Output Transform", category: "Modifiers", input: "Geometry", output: "Geometry" }),
  output: Object.freeze({ title: "Group Output", category: "Output", input: "Geometry", inputSockets: ["Geometry", "Geometry 2", "Geometry 3", "Geometry 4"], multiInput: true, output: null })
});
const GEOMETRY_NODE_TYPES = Object.freeze(Object.keys(GEOMETRY_NODE_DEFINITIONS));
const GEOMETRY_NODE_SOURCE_TYPES = Object.freeze(["primitive", "primitiveTest", "stem", "trunk", "rocks", "stoneWall", ...Object.keys(BWS_ASSET_NODES).filter(type => !BWS_ASSET_NODES[type].attachment)]);
const GEOMETRY_NODE_DEFAULT_ORDER = Object.freeze(["seed", "variant", "trunk", "branches", "smoothJoints", "twigs", "canopy", "cutSurface", "output"]);
let geometryNodesRuntimeEnabled = false;
let geometryNodesInitialized = false;
let geometryNodePendingDeleteId = null;
let geometryNodesDetachedWindow = null;
const geometryNodeInteractionByDocument = new WeakMap();
const GEOMETRY_NODE_SURFACE_IDS = Object.freeze({
  sidebar: {
    root: "geometryNodesBody", select: "geometryNodeGraphSelect", newButton: "geometryNodeNewBtn",
    buildButton: "geometryNodeBuildBtn", bakeButton: "geometryNodeBakeBtn", deleteButton: "geometryNodeDeleteBtn",
    copyButton: "geometryNodeCopyBtn", pasteButton: "geometryNodePasteBtn",
    saveClusterButton: "geometryNodeSaveClusterBtn", loadClusterButton: "geometryNodeLoadClusterBtn", fileInput: "geometryNodeClusterFile",
    canvas: "geometryNodeCanvas", status: "geometryNodeStatus"
  },
  detached: {
    root: "geometryNodeDetachedRoot", select: "geometryNodeDetachedGraphSelect", newButton: "geometryNodeDetachedNewBtn",
    buildButton: "geometryNodeDetachedBuildBtn", bakeButton: "geometryNodeDetachedBakeBtn", deleteButton: "geometryNodeDetachedDeleteBtn",
    copyButton: "geometryNodeDetachedCopyBtn", pasteButton: "geometryNodeDetachedPasteBtn",
    saveClusterButton: "geometryNodeDetachedSaveClusterBtn", loadClusterButton: "geometryNodeDetachedLoadClusterBtn", fileInput: "geometryNodeDetachedClusterFile",
    canvas: "geometryNodeDetachedCanvas", status: "geometryNodeDetachedStatus"
  }
});
function geometryNodeId(prefix = "graph") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function defaultGeometryNodeGraph(name = "Procedural Geometry") {
  const nodePositions = {};
  GEOMETRY_NODE_TYPES.forEach((type, index) => { nodePositions[type] = [18 + index * 178, index % 2 ? 26 : 42]; });
  GEOMETRY_NODE_DEFAULT_ORDER.forEach((type, index) => { nodePositions[type] = [18 + index * 178, index % 2 ? 26 : 42]; });
  const nodeOrder = [...GEOMETRY_NODE_DEFAULT_ORDER];
  return {
    id: geometryNodeId("tree"),
    name,
    type: "tree",
    seed: 42,
    params: {
      ...assetNodeDefaults(),
      height: 8,
      variantStyle: "classic",
      variantSeason: "summer",
      variantMaturity: "mature",
      variantAmount: 0.55,
      smoothAxis: "xyz",
      smoothIterations: 2,
      smoothStrength: 0.72,
      smoothPreserveSize: true,
      smoothRoots: true,
      smoothTrunk: true,
      smoothBranches: true,
      smoothTwigs: true,
      smoothCanopy: false,
      smoothJoints: true,
      smoothCutRings: false,
      trunkWidth: 0.82,
      trunkSegments: 6,
      rootCount: 6,
      rootLength: 1.35,
      rootThickness: 0.34,
      trunkBend: 0.22,
      branchCount: 9,
      branchSpread: 66,
      branchLength: 2.6,
      jointSize: 0.85,
      jointTrunkSeams: false,
      twigLength: 0.45,
      twigRise: 0.72,
      canopyEnabled: true,
      canopySize: 1.25,
      canopyDensity: 2,
      knotCount: 3,
      knotSize: 0.3,
      knotInset: 0.04,
      knotRings: 4,
      cutRingCount: 7,
      cutRingDepth: 0.035,
      cutRingContrast: 0.55,
      transformX: 0,
      transformY: 0,
      transformZ: 0,
      transformRotX: 0,
      transformRotY: 0,
      transformRotZ: 0,
      transformScale: 1,
      outputName: name,
      textureName: "",
      textureData: "",
      texturePoolSeed: 0,
      texturePoolUvs: true,
      texturePoolVariation: .75,
      textureRandomize: true,
      textureVariation: 1,
      wallOverallTextureMix: .35,
      primitiveShape: "facetedBallLow",
      primitiveSizeX: 1,
      primitiveSizeY: 1,
      primitiveSizeZ: 1,
      primitiveColor: "#4f8f54",
      stemHeight: 8.5,
      stemBaseRadius: 0.48,
      stemTopRadius: 0.16,
      stemSegments: 9,
      stemSides: 12,
      stemLean: 0.18,
      stemFlare: 0.2,
      stemColor: "#754c35",
      branchArrayCount: 7,
      branchArrayLength: 2.35,
      branchArrayRise: 0.56,
      branchArrayRadius: 0.2,
      branchArrayTaper: 0.28,
      branchArrayTwist: 42,
      branchColor: "#754c35",
      junctionBlendSize: 1.18,
      junctionBlendLength: 1.45,
      clusterScatterCount: 11,
      clusterScatterSize: 1.05,
      clusterScatterSpread: 0.72,
      clusterScatterColor: "#4f8246"
      ,rockProfile: "rounded"
      ,rockArrangement: "cluster"
      ,rockCount: 6
      ,rockSize: 1.25
      ,rockVariation: 0.42
      ,rockSpacing: 1.05
      ,rockColor: "#59635f"
      ,rockColorSecondary: "#7b8782"
      ,rockColorTertiary: "#b1beb8"
      ,rockTextureName: ""
      ,rockAddInnerPanel: true
      ,wallLength: 12
      ,wallHeight: 2.8
      ,wallDepth: 1.15
      ,wallRows: 4
      ,wallColumns: 8
      ,wallDepthLayers: 3
      ,wallIrregularity: 0.32
      ,wallColorVariation: 0.58
      ,wallColor: "#5e6662"
      ,wallColorSecondary: "#7c8782"
      ,wallColorTertiary: "#b4c0ba"
      ,wallTextureName: ""
      ,wallAddInnerPanel: true
      ,joinAddInnerPanel: true
      ,joinPanelInset: 0.16
      ,joinPanelAxis: "auto"
      ,joinPanelColor: "#5e6662"
      ,grassCount: 18
      ,grassHeight: 0.48
      ,grassWidth: 0.045
      ,grassSpread: 0.35
      ,grassAvoidGeometry: true
      ,grassClearance: 0.12
      ,grassGrowNegativeX: true
      ,grassGrowPositiveX: true
      ,grassGrowNegativeZ: true
      ,grassGrowPositiveZ: true
      ,grassColor: "#376f2d"
      ,mossPlacement: "bottom"
      ,mossCoverage: 0.55
      ,mossThickness: 0.12
      ,mossMoisture: 0.72
      ,mossSunlight: 0.3
      ,mossCrackBias: 0.68
      ,mossColor: "#315f2a"
      ,natureOutputMode: "both"
    },
    nodeParams: {},
    nodeOrder,
    nodePositions,
    smoothNodes: [],
    connections: nodeOrder.slice(0, -1).map((fromNodeId, index) => ({ id: geometryNodeId("link"), fromNodeId, toNodeId: nodeOrder[index + 1] })),
    view: { x: 0, y: 0, scale: 1 },
    generatedIds: [],
    centerOutput: false,
    buildVersion: 0
  };
}
function defaultGeometryNodeProjectState() {
  return defaultEmptyGeometryNodeProjectState();
}
function defaultEmptyGeometryNodeProjectState() {
  const graph = defaultGeometryNodeGraph("Untitled Geometry");
  graph.nodeOrder = [];
  graph.nodePositions.seed = [80, 160];
  graph.nodePositions.output = [430, 160];
  graph.connections = [];
  return { version: 1, activeGraphId: graph.id, graphs: [graph] };
}
function geometryNodeNumber(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}
function sanitizeGeometryNodeGraph(value, fallbackName = "Procedural Geometry") {
  const fallback = defaultGeometryNodeGraph(fallbackName);
  const source = value && typeof value === "object" ? value : {};
  const params = source.params && typeof source.params === "object" ? source.params : {};
  const positions = source.nodePositions && typeof source.nodePositions === "object" ? source.nodePositions : {};
  const graph = {
    ...fallback,
    id: String(source.id || fallback.id),
    name: String(source.name || fallbackName).trim().slice(0, 80) || fallbackName,
    seed: Math.round(geometryNodeNumber(source.seed, fallback.seed, 0, 999999)),
    params: {
      ...params,
      ...assetNodeSanitize(params),
      height: geometryNodeNumber(params.height, fallback.params.height, 1, 30),
      variantStyle: ["classic", "broad", "round", "tall", "sparse", "bare"].includes(params.variantStyle) ? params.variantStyle : fallback.params.variantStyle,
      variantSeason: ["spring", "summer", "autumn", "winter", "snowy"].includes(params.variantSeason) ? params.variantSeason : fallback.params.variantSeason,
      variantMaturity: ["sapling", "young", "mature", "ancient"].includes(params.variantMaturity) ? params.variantMaturity : fallback.params.variantMaturity,
      variantAmount: geometryNodeNumber(params.variantAmount, fallback.params.variantAmount, 0, 1),
      smoothAxis: ["xyz", "xy", "xz", "yz", "x", "y", "z"].includes(params.smoothAxis) ? params.smoothAxis : fallback.params.smoothAxis,
      smoothIterations: Math.round(geometryNodeNumber(params.smoothIterations, fallback.params.smoothIterations, 1, 2)),
      smoothStrength: geometryNodeNumber(params.smoothStrength, fallback.params.smoothStrength, .05, 1),
      smoothPreserveSize: params.smoothPreserveSize !== false,
      smoothRoots: params.smoothRoots !== false,
      smoothTrunk: params.smoothTrunk !== false,
      smoothBranches: params.smoothBranches !== false,
      smoothTwigs: params.smoothTwigs !== false,
      smoothCanopy: params.smoothCanopy === true,
      smoothJoints: params.smoothJoints !== false,
      smoothCutRings: params.smoothCutRings === true,
      trunkWidth: geometryNodeNumber(params.trunkWidth, fallback.params.trunkWidth, 0.1, 5),
      trunkSegments: Math.round(geometryNodeNumber(params.trunkSegments, fallback.params.trunkSegments, 2, 16)),
      rootCount: Math.round(geometryNodeNumber(params.rootCount, fallback.params.rootCount, 1, 16)),
      rootLength: geometryNodeNumber(params.rootLength, fallback.params.rootLength, .2, 6),
      rootThickness: geometryNodeNumber(params.rootThickness, fallback.params.rootThickness, .05, 2),
      trunkBend: geometryNodeNumber(params.trunkBend, fallback.params.trunkBend, 0, 1.5),
      branchCount: Math.round(geometryNodeNumber(params.branchCount, fallback.params.branchCount, 0, 32)),
      branchSpread: geometryNodeNumber(params.branchSpread, fallback.params.branchSpread, 10, 88),
      branchLength: geometryNodeNumber(params.branchLength, fallback.params.branchLength, 0.3, 10),
      jointSize: geometryNodeNumber(params.jointSize, fallback.params.jointSize, .45, 1.4),
      jointTrunkSeams: params.jointTrunkSeams === true,
      twigLength: geometryNodeNumber(params.twigLength, fallback.params.twigLength, .1, 1.5),
      twigRise: geometryNodeNumber(params.twigRise, fallback.params.twigRise, .1, 1.5),
      canopyEnabled: params.canopyEnabled !== false,
      canopySize: geometryNodeNumber(params.canopySize, fallback.params.canopySize, 0.2, 5),
      canopyDensity: Math.round(geometryNodeNumber(params.canopyDensity, fallback.params.canopyDensity, 1, 4)),
      knotCount: Math.round(geometryNodeNumber(params.knotCount, fallback.params.knotCount, 1, 12)),
      knotSize: geometryNodeNumber(params.knotSize, fallback.params.knotSize, .08, 1.2),
      knotInset: geometryNodeNumber(params.knotInset, fallback.params.knotInset, -.2, .3),
      knotRings: Math.round(geometryNodeNumber(params.knotRings, fallback.params.knotRings, 2, 9)),
      cutRingCount: Math.round(geometryNodeNumber(params.cutRingCount, fallback.params.cutRingCount, 2, 14)),
      cutRingDepth: geometryNodeNumber(params.cutRingDepth, fallback.params.cutRingDepth, .01, .15),
      cutRingContrast: geometryNodeNumber(params.cutRingContrast, fallback.params.cutRingContrast, 0, 1),
      transformX: geometryNodeNumber(params.transformX, fallback.params.transformX, -50, 50),
      transformY: geometryNodeNumber(params.transformY, fallback.params.transformY, -50, 50),
      transformZ: geometryNodeNumber(params.transformZ, fallback.params.transformZ, -50, 50),
      transformRotX: geometryNodeNumber(params.transformRotX, fallback.params.transformRotX, -180, 180),
      transformRotY: geometryNodeNumber(params.transformRotY, fallback.params.transformRotY, -180, 180),
      transformRotZ: geometryNodeNumber(params.transformRotZ, fallback.params.transformRotZ, -180, 180),
      transformScale: geometryNodeNumber(params.transformScale, fallback.params.transformScale, .05, 10),
      outputName: String(params.outputName || source.name || fallbackName).trim().slice(0, 80) || fallbackName,
      textureName: typeof params.textureName === "string" ? params.textureName.slice(0, 160) : fallback.params.textureName,
      textureData: typeof params.textureData === "string" && params.textureData.startsWith("data:image/") ? params.textureData.slice(0, 16000000) : fallback.params.textureData,
      textureRandomize: params.textureRandomize !== false,
      textureVariation: geometryNodeNumber(params.textureVariation, fallback.params.textureVariation, 0, 1),
      primitiveShape: ["box", "sphere", "cylinder", "cone", "torus", "panel", "wedge", "hollowBox", "tube", "curvedPanel", "ring", "arch", "hemisphere", "dome", "capsule", "pyramid", "prism", "tetrahedron", "pyramidFrustum", "facetedBallLow", "facetedBallMedium", "facetedBallHigh", "heart", "stair"].includes(params.primitiveShape) ? params.primitiveShape : fallback.params.primitiveShape,
      primitiveSizeX: geometryNodeNumber(params.primitiveSizeX, fallback.params.primitiveSizeX, .05, 30),
      primitiveSizeY: geometryNodeNumber(params.primitiveSizeY, fallback.params.primitiveSizeY, .05, 30),
      primitiveSizeZ: geometryNodeNumber(params.primitiveSizeZ, fallback.params.primitiveSizeZ, .05, 30),
      primitiveColor: /^#[0-9a-f]{6}$/i.test(params.primitiveColor) ? params.primitiveColor : fallback.params.primitiveColor,
      stemHeight: geometryNodeNumber(params.stemHeight, fallback.params.stemHeight, .2, 40),
      stemBaseRadius: geometryNodeNumber(params.stemBaseRadius, fallback.params.stemBaseRadius, .03, 6),
      stemTopRadius: geometryNodeNumber(params.stemTopRadius, fallback.params.stemTopRadius, .01, 6),
      stemSegments: Math.round(geometryNodeNumber(params.stemSegments, fallback.params.stemSegments, 2, 32)),
      stemSides: Math.round(geometryNodeNumber(params.stemSides, fallback.params.stemSides, 5, 32)),
      stemLean: geometryNodeNumber(params.stemLean, fallback.params.stemLean, 0, 3),
      stemFlare: geometryNodeNumber(params.stemFlare, fallback.params.stemFlare, 0, 2),
      stemColor: /^#[0-9a-f]{6}$/i.test(params.stemColor) ? params.stemColor : fallback.params.stemColor,
      branchArrayCount: Math.round(geometryNodeNumber(params.branchArrayCount, fallback.params.branchArrayCount, 0, 40)),
      branchArrayLength: geometryNodeNumber(params.branchArrayLength, fallback.params.branchArrayLength, .1, 15),
      branchArrayRise: geometryNodeNumber(params.branchArrayRise, fallback.params.branchArrayRise, -.5, 2),
      branchArrayRadius: geometryNodeNumber(params.branchArrayRadius, fallback.params.branchArrayRadius, .02, 3),
      branchArrayTaper: geometryNodeNumber(params.branchArrayTaper, fallback.params.branchArrayTaper, .03, 1),
      branchArrayTwist: geometryNodeNumber(params.branchArrayTwist, fallback.params.branchArrayTwist, -180, 180),
      branchColor: /^#[0-9a-f]{6}$/i.test(params.branchColor) ? params.branchColor : fallback.params.branchColor,
      junctionBlendSize: geometryNodeNumber(params.junctionBlendSize, fallback.params.junctionBlendSize, .2, 4),
      junctionBlendLength: geometryNodeNumber(params.junctionBlendLength, fallback.params.junctionBlendLength, .2, 4),
      clusterScatterCount: Math.round(geometryNodeNumber(params.clusterScatterCount, fallback.params.clusterScatterCount, 0, 64)),
      clusterScatterSize: geometryNodeNumber(params.clusterScatterSize, fallback.params.clusterScatterSize, .05, 8),
      clusterScatterSpread: geometryNodeNumber(params.clusterScatterSpread, fallback.params.clusterScatterSpread, 0, 4),
      clusterScatterColor: /^#[0-9a-f]{6}$/i.test(params.clusterScatterColor) ? params.clusterScatterColor : fallback.params.clusterScatterColor,
      rockProfile: ["rounded", "jagged", "flat", "boulder"].includes(params.rockProfile) ? params.rockProfile : fallback.params.rockProfile,
      rockArrangement: ["single", "cluster", "line", "stack"].includes(params.rockArrangement) ? params.rockArrangement : fallback.params.rockArrangement,
      rockCount: Math.round(geometryNodeNumber(params.rockCount, fallback.params.rockCount, 1, 48)),
      rockSize: geometryNodeNumber(params.rockSize, fallback.params.rockSize, .1, 8),
      rockVariation: geometryNodeNumber(params.rockVariation, fallback.params.rockVariation, 0, 1),
      rockSpacing: geometryNodeNumber(params.rockSpacing, fallback.params.rockSpacing, .2, 4),
      rockColor: /^#[0-9a-f]{6}$/i.test(params.rockColor) ? params.rockColor : fallback.params.rockColor,
      rockColorSecondary: /^#[0-9a-f]{6}$/i.test(params.rockColorSecondary) ? params.rockColorSecondary : fallback.params.rockColorSecondary,
      rockColorTertiary: /^#[0-9a-f]{6}$/i.test(params.rockColorTertiary) ? params.rockColorTertiary : fallback.params.rockColorTertiary,
      rockTextureName: typeof params.rockTextureName === "string" ? params.rockTextureName.slice(0, 160) : fallback.params.rockTextureName,
      rockAddInnerPanel: params.rockAddInnerPanel !== false,
      wallLength: geometryNodeNumber(params.wallLength, fallback.params.wallLength, 1, 500),
      wallHeight: geometryNodeNumber(params.wallHeight, fallback.params.wallHeight, .5, 12),
      wallDepth: geometryNodeNumber(params.wallDepth, fallback.params.wallDepth, .15, 4),
      wallRows: Math.round(geometryNodeNumber(params.wallRows, fallback.params.wallRows, 1, 12)),
      wallColumns: Math.round(geometryNodeNumber(params.wallColumns, fallback.params.wallColumns, 2, 30)),
      wallDepthLayers: Math.round(geometryNodeNumber(params.wallDepthLayers, fallback.params.wallDepthLayers, 1, 4)),
      wallIrregularity: geometryNodeNumber(params.wallIrregularity, fallback.params.wallIrregularity, 0, 1),
      wallColorVariation: geometryNodeNumber(params.wallColorVariation, fallback.params.wallColorVariation, 0, 1),
      wallColor: /^#[0-9a-f]{6}$/i.test(params.wallColor) ? params.wallColor : fallback.params.wallColor,
      wallColorSecondary: /^#[0-9a-f]{6}$/i.test(params.wallColorSecondary) ? params.wallColorSecondary : fallback.params.wallColorSecondary,
      wallColorTertiary: /^#[0-9a-f]{6}$/i.test(params.wallColorTertiary) ? params.wallColorTertiary : fallback.params.wallColorTertiary,
      wallTextureName: typeof params.wallTextureName === "string" ? params.wallTextureName.slice(0, 160) : fallback.params.wallTextureName,
      wallOverallTextureMix: geometryNodeNumber(params.wallOverallTextureMix, fallback.params.wallOverallTextureMix, 0, 1),
      wallAddInnerPanel: params.wallAddInnerPanel !== false,
      joinAddInnerPanel: params.joinAddInnerPanel !== false,
      joinPanelInset: geometryNodeNumber(params.joinPanelInset, fallback.params.joinPanelInset, 0, 1.5),
      joinPanelAxis: ["auto", "x", "y", "z"].includes(params.joinPanelAxis) ? params.joinPanelAxis : fallback.params.joinPanelAxis,
      joinPanelColor: /^#[0-9a-f]{6}$/i.test(params.joinPanelColor) ? params.joinPanelColor : fallback.params.joinPanelColor,
      grassCount: Math.round(geometryNodeNumber(params.grassCount, fallback.params.grassCount, 1, 160)),
      grassHeight: geometryNodeNumber(params.grassHeight, fallback.params.grassHeight, .05, 3),
      grassWidth: geometryNodeNumber(params.grassWidth, fallback.params.grassWidth, .01, .8),
      grassSpread: geometryNodeNumber(params.grassSpread, fallback.params.grassSpread, 0, 3),
      grassAvoidGeometry: params.grassAvoidGeometry !== false,
      grassClearance: geometryNodeNumber(params.grassClearance, fallback.params.grassClearance, 0, 2),
      grassGrowNegativeX: params.grassGrowNegativeX !== false,
      grassGrowPositiveX: params.grassGrowPositiveX !== false,
      grassGrowNegativeZ: params.grassGrowNegativeZ !== false,
      grassGrowPositiveZ: params.grassGrowPositiveZ !== false,
      grassColor: /^#[0-9a-f]{6}$/i.test(params.grassColor) ? params.grassColor : fallback.params.grassColor,
      mossPlacement: ["bottom", "middle", "top", "all"].includes(params.mossPlacement) ? params.mossPlacement : fallback.params.mossPlacement,
      mossCoverage: geometryNodeNumber(params.mossCoverage, fallback.params.mossCoverage, 0, 1),
      mossThickness: geometryNodeNumber(params.mossThickness, fallback.params.mossThickness, .02, .6),
      mossMoisture: geometryNodeNumber(params.mossMoisture, fallback.params.mossMoisture, 0, 1),
      mossSunlight: geometryNodeNumber(params.mossSunlight, fallback.params.mossSunlight, 0, 1),
      mossCrackBias: geometryNodeNumber(params.mossCrackBias, fallback.params.mossCrackBias, 0, 1),
      mossColor: /^#[0-9a-f]{6}$/i.test(params.mossColor) ? params.mossColor : fallback.params.mossColor,
      paletteCount:Math.round(geometryNodeNumber(params.paletteCount,4,1,4)),
      paletteColor1:geometryNodePaletteColor(params,1),paletteColor2:geometryNodePaletteColor(params,2),paletteColor3:geometryNodePaletteColor(params,3),paletteColor4:geometryNodePaletteColor(params,4),
      natureOutputMode: ["both", "stone", "grass"].includes(params.natureOutputMode) ? params.natureOutputMode : fallback.params.natureOutputMode
    },
    nodeParams: source.nodeParams && typeof source.nodeParams === "object"
      ? Object.fromEntries(Object.entries(source.nodeParams).filter(([id, value]) => typeof id === "string" && value && typeof value === "object").slice(0, 80).map(([id, value]) => [id, { ...fallback.params, ...value }]))
      : {},
    nodeOrder: [],
    nodePositions: {},
    smoothNodes: [],
    connections: [],
    view: {
      x: geometryNodeNumber(source.view?.x, 0, -5000, 5000),
      y: geometryNodeNumber(source.view?.y, 0, -5000, 5000),
      scale: geometryNodeNumber(source.view?.scale, 1, .25, 2.5)
    },
    generatedIds: Array.isArray(source.generatedIds) ? source.generatedIds.filter(id => typeof id === "string") : [],
    centerOutput: source.centerOutput === true,
    buildVersion: Math.max(0, Math.round(Number(source.buildVersion) || 0))
  };
  const savedOrder = Array.isArray(source.nodeOrder) ? source.nodeOrder : GEOMETRY_NODE_DEFAULT_ORDER;
  graph.nodeOrder = savedOrder.filter((type, index) => typeof type === "string" && type !== "smoothGeometry" && savedOrder.indexOf(type) === index).slice(0, 80);
  if (!graph.nodeOrder.length && !Array.isArray(source.nodeOrder)) graph.nodeOrder = [...GEOMETRY_NODE_DEFAULT_ORDER];
  for (const type of GEOMETRY_NODE_TYPES) {
    const point = positions[type];
    graph.nodePositions[type] = Array.isArray(point) && point.length >= 2
      ? [geometryNodeNumber(point[0], fallback.nodePositions[type][0], 0, Number.MAX_SAFE_INTEGER), geometryNodeNumber(point[1], fallback.nodePositions[type][1], 0, Number.MAX_SAFE_INTEGER)]
      : [...fallback.nodePositions[type]];
  }
  for (const type of graph.nodeOrder.filter(type => !GEOMETRY_NODE_TYPES.includes(type))) {
    const point = positions[type];
    graph.nodePositions[type] = Array.isArray(point) && point.length >= 2
      ? [geometryNodeNumber(point[0], 40, 0, Number.MAX_SAFE_INTEGER), geometryNodeNumber(point[1], 80, 0, Number.MAX_SAFE_INTEGER)]
      : [40, 80];
  }
  if (Array.isArray(source.smoothNodes)) graph.smoothNodes = source.smoothNodes.slice(0, 48).map((node, index) => ({
    id: String(node?.id || geometryNodeId("smooth")),
    targetId: node?.targetId && graph.nodeOrder.includes(String(node.targetId)) ? String(node.targetId) : null,
    position: Array.isArray(node?.position) ? [geometryNodeNumber(node.position[0], 220 + index * 24, 0, 2200), geometryNodeNumber(node.position[1], 270 + index * 18, 0, 800)] : [220 + index * 24, 270 + index * 18],
    params: {
      axis: ["xyz", "xy", "xz", "yz", "x", "y", "z"].includes(node?.params?.axis) ? node.params.axis : graph.params.smoothAxis,
      iterations: Math.round(geometryNodeNumber(node?.params?.iterations, graph.params.smoothIterations, 1, 2)),
      strength: Math.max(.05, Number.isFinite(Number(node?.params?.strength)) ? Number(node.params.strength) : graph.params.smoothStrength),
      preserveSize: node?.params?.preserveSize !== false
    }
  }));
  if (graph.nodeOrder.includes("smoothGeometry")) {
    graph.nodeOrder = graph.nodeOrder.filter(type => type !== "smoothGeometry");
    const legacyTargets = [["roots", graph.params.smoothRoots], ["trunk", graph.params.smoothTrunk], ["branches", graph.params.smoothBranches], ["twigs", graph.params.smoothTwigs], ["canopy", graph.params.smoothCanopy], ["smoothJoints", graph.params.smoothJoints], ["cutSurface", graph.params.smoothCutRings]];
    legacyTargets.filter(([targetId, enabled]) => enabled && graph.nodeOrder.includes(targetId)).forEach(([targetId], index) => graph.smoothNodes.push({
      id: geometryNodeId("smooth"), targetId,
      position: [graph.nodePositions[targetId][0] + 28 + index * 10, Math.min(800, graph.nodePositions[targetId][1] + 245 + index * 12)],
      params: { axis: graph.params.smoothAxis, iterations: graph.params.smoothIterations, strength: graph.params.smoothStrength, preserveSize: graph.params.smoothPreserveSize }
    }));
  }
  const nodeIds = new Set([...graph.nodeOrder, ...graph.smoothNodes.map(node => node.id)]);
  if (Array.isArray(source.connections)) {
    const rawConnections = [...source.connections];
    if (Array.isArray(source.nodeOrder) && source.nodeOrder.includes("bark")) {
      const incoming = rawConnections.filter(connection => connection?.toNodeId === "bark");
      const outgoing = rawConnections.filter(connection => connection?.fromNodeId === "bark");
      for (const before of incoming) for (const after of outgoing) rawConnections.push({ id: geometryNodeId("link"), fromNodeId: before.fromNodeId, toNodeId: after.toNodeId });
    }
    const legacyInputCounts = new Map();
    const seenInputs = new Set();
    graph.connections = rawConnections.slice(0, 160).map(connection => {
      const fromNodeId = String(connection?.fromNodeId || "");
      const toNodeId = String(connection?.toNodeId || "");
      let toInputIndex = Number(connection?.toInputIndex);
      if (!Number.isInteger(toInputIndex)) {
        const legacyIndex = legacyInputCounts.get(toNodeId) || 0;
        toInputIndex = geometryNodeTypeForId(graph, fromNodeId) === "textureInput" && geometryNodeTypeForId(graph, toNodeId) === "stoneWall" ? 4 : legacyIndex;
        legacyInputCounts.set(toNodeId, legacyIndex + 1);
      }
      return { id: String(connection?.id || geometryNodeId("link")), fromNodeId, toNodeId, toInputIndex };
    }).filter(connection => {
      if (!nodeIds.has(connection.fromNodeId) || !nodeIds.has(connection.toNodeId) || connection.fromNodeId === connection.toNodeId) return false;
      const destinationType = geometryNodeTypeForId(graph, connection.toNodeId) || "smoothGeometry";
      const destinationDefinition = GEOMETRY_NODE_DEFINITIONS[destinationType] || { input: "Geometry" };
      const inputCount = Math.max(1, destinationDefinition.inputSockets?.length || 1);
      connection.toInputIndex = Math.max(0, Math.min(inputCount - 1, Number(connection.toInputIndex) || 0));
      const inputKey = `${connection.toNodeId}:${connection.toInputIndex}`;
      if (seenInputs.has(inputKey)) return false;
      seenInputs.add(inputKey);
      return true;
    });
  } else {
    const orderedIds = graph.nodeOrder.flatMap(type => [type, ...graph.smoothNodes.filter(node => node.targetId === type).map(node => node.id)]);
    graph.connections = orderedIds.slice(0, -1).map((fromNodeId, index) => ({ id: geometryNodeId("link"), fromNodeId, toNodeId: orderedIds[index + 1] }));
  }
  return graph;
}
function sanitizeGeometryNodeProjectState(value, { allowEmpty = false } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const graphs = Array.isArray(source.graphs)
    ? source.graphs.slice(0, 24).map((graph, index) => sanitizeGeometryNodeGraph(graph, `Procedural Geometry ${index + 1}`))
    : [];
  if (!graphs.length && !allowEmpty && !Array.isArray(source.graphs)) graphs.push(defaultEmptyGeometryNodeProjectState().graphs[0]);
  const activeGraphId = graphs.some(graph => graph.id === source.activeGraphId) ? source.activeGraphId : (graphs[0]?.id || null);
  return { version: 1, activeGraphId, graphs };
}
function loadGeometryNodeDraft() {
  try {
    return sanitizeGeometryNodeProjectState(JSON.parse(localStorage.getItem(GEOMETRY_NODES_STORAGE_KEY) || "null"));
  } catch {
    return defaultGeometryNodeProjectState();
  }
}
let geometryNodeProjectState = loadGeometryNodeDraft();
function geometryNodeDraftState() {
  const draft = JSON.parse(JSON.stringify(geometryNodeProjectState));
  for (const graph of draft.graphs || []) {
    if (graph.params) graph.params.textureData = "";
    for (const params of Object.values(graph.nodeParams || {})) {
      if (params) params.textureData = "";
    }
  }
  return draft;
}
function saveGeometryNodeDraft(){localStorage.setItem(GEOMETRY_NODES_STORAGE_KEY,JSON.stringify(geometryNodeDraftState()));queueMicrotask(()=>parent.postMessage({type:'bws-graph-state',state:geometryNodeProjectState},'*'));return true;}
function activeGeometryNodeGraph() {
  return geometryNodeProjectState.graphs.find(graph => graph.id === geometryNodeProjectState.activeGraphId) || null;
}
function serializeOptionalPluginProjectData() {
  return { "geometry-nodes": JSON.parse(JSON.stringify(geometryNodeProjectState)) };
}
function geometryNodeClusterPayload(graph) {
  const cleanGraph = JSON.parse(JSON.stringify(graph));
  cleanGraph.generatedIds = [];
  cleanGraph.buildVersion = 0;
  return {
    kind: "boltworks-node-cluster",
    version: 1,
    name: graph.name,
    savedAt: new Date().toISOString(),
    graph: cleanGraph
  };
}
function geometryNodeClusterString(graph, pretty = false) {
  return JSON.stringify(geometryNodeClusterPayload(graph), null, pretty ? 2 : 0);
}
function geometryNodeClusterFileName(graph) {
  const base = String(graph?.name || "node-cluster").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "node-cluster";
  return `${base}.bwnc`;
}
function setGeometryNodeStatus(message) {
  const mainStatus = document.getElementById("geometryNodeStatus");
  if (mainStatus) mainStatus.textContent = message;
  const detachedStatus = liveGeometryNodesDetachedWindow()?.document.getElementById("geometryNodeDetachedStatus");
  if (detachedStatus) detachedStatus.textContent = message;
}
function importGeometryNodeClusterText(text, sourceLabel = "node string") {
  let payload;
  try {
    payload = JSON.parse(String(text || "").trim());
  } catch {
    setGeometryNodeStatus(`Could not load ${sourceLabel}: it is not valid JSON.`);
    return false;
  }
  if (!payload || payload.kind !== "boltworks-node-cluster" || payload.version !== 1 || !payload.graph) {
    setGeometryNodeStatus(`Could not load ${sourceLabel}: expected a BoltWorks node cluster version 1.`);
    return false;
  }
  const imported = sanitizeGeometryNodeGraph(payload.graph, String(payload.name || "Imported Node Cluster"));
  imported.id = geometryNodeId("cluster");
  imported.generatedIds = [];
  imported.buildVersion = 0;
  const baseName = String(payload.name || imported.name || "Imported Node Cluster").trim().slice(0, 70) || "Imported Node Cluster";
  let name = baseName;
  let suffix = 2;
  const names = new Set(geometryNodeProjectState.graphs.map(graph => graph.name.toLowerCase()));
  while (names.has(name.toLowerCase())) name = `${baseName} ${suffix++}`.slice(0, 80);
  imported.name = name;
  imported.params.outputName = name;
  geometryNodeProjectState.graphs.push(imported);
  geometryNodeProjectState.activeGraphId = imported.id;
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  setGeometryNodeStatus(`Loaded node cluster “${name}” as a new editable graph.`);
  log(`Loaded Geometry Nodes cluster ${name}.`, { source: sourceLabel, nodes: imported.nodeOrder.length + imported.smoothNodes.length, connections: imported.connections.length });
  return true;
}
async function copyGeometryNodeClusterString(doc = document) {
  const graph = activeGeometryNodeGraph();
  if (!graph) return false;
  const value = geometryNodeClusterString(graph);
  let copied = false;
  try {
    await doc.defaultView.navigator.clipboard.writeText(value);
    copied = true;
  } catch {
    const area = doc.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    doc.body.append(area);
    area.select();
    try { copied = !!doc.execCommand?.("copy"); } catch {}
    area.remove();
  }
  setGeometryNodeStatus(copied ? `Copied “${graph.name}” as a portable node string.` : "Clipboard access was blocked. Use Save .bwnc instead.");
  return copied;
}
function pasteGeometryNodeClusterString(doc = document) {
  const value = doc.defaultView.prompt("Paste a BoltWorks node-cluster string. It will be added as a new graph:", "");
  if (value == null) return false;
  return importGeometryNodeClusterText(value, "pasted node string");
}
function saveGeometryNodeClusterFile(){const graph=activeGeometryNodeGraph();if(graph){parent.postMessage({type:'bws-graph-file',name:geometryNodeClusterFileName(graph),text:geometryNodeClusterString(graph,true)},'*');setGeometryNodeStatus('Graph file ready. Choose Download graph in the BWS header.');}}
async function loadGeometryNodeClusterFile(file) {
  if (!file) return false;
  if (!String(file.name || "").toLowerCase().endsWith(".bwnc")) {
    setGeometryNodeStatus("Choose a .bwnc BoltWorks node-cluster file.");
    return false;
  }
  try {
    return importGeometryNodeClusterText(await file.text(), file.name);
  } catch (error) {
    setGeometryNodeStatus(`Could not read ${file.name}: ${error?.message || error}`);
    return false;
  }
}
function restoreOptionalPluginProjectData(pluginData = {}) {
  geometryNodeProjectState = sanitizeGeometryNodeProjectState(pluginData["geometry-nodes"], { allowEmpty: true });
  saveGeometryNodeDraft();
  if (geometryNodesRuntimeEnabled) renderGeometryNodeEditor();
}
function resetGeometryNodeProjectState() {
  geometryNodeProjectState = defaultEmptyGeometryNodeProjectState();
  saveGeometryNodeDraft();
  if (geometryNodesRuntimeEnabled) renderGeometryNodeEditor();
}
function geometryNodeEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function geometryNodeField(label, key, value, { min = 0, max = 100, step = 1, type = "number", instanceId = "" } = {}) {
  const instance = instanceId ? ` data-geometry-instance-param="${geometryNodeEscape(instanceId)}"` : "";
  if (type === "checkbox") return `<label><span>${geometryNodeEscape(label)}</span><input data-geometry-param="${key}"${instance} type="checkbox" ${value ? "checked" : ""}></label>`;
  const limits = type === "number" ? `${min == null ? "" : ` min="${min}"`}${max == null ? "" : ` max="${max}"`} step="${step}"` : "";
  return `<label><span>${geometryNodeEscape(label)}</span><input data-geometry-param="${key}"${instance} type="${type}"${limits} value="${geometryNodeEscape(value)}"></label>`;
}
function geometryNodeSelectField(label, key, value, options, instanceId = "") {
  const instance = instanceId ? ` data-geometry-instance-param="${geometryNodeEscape(instanceId)}"` : "";
  return `<label><span>${geometryNodeEscape(label)}</span><select data-geometry-param="${key}"${instance}>${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${geometryNodeEscape(optionLabel)}</option>`).join("")}</select></label>`;
}
function geometryNodeTextureOptions(selected) {
  const options = [["", "None"]];
  if (typeof textureLibrary !== "undefined") {
    for (const entry of textureLibrary.values()) options.push([entry.name, entry.name]);
  }
  if (selected && !options.some(([value]) => value === selected)) options.push([selected, selected]);
  return options;
}
function geometryNodeTextureConnectionNote(graph, instanceId) {
  const connected = graph?.connections?.some(connection => (
    connection.toNodeId === instanceId && geometryNodeTypeForId(graph, connection.fromNodeId) === "textureInput"
  ));
  return `<p class="geometry-node-card-note">Texture: ${connected ? "connected input" : "connect a Texture Input node"}</p>`;
}
function geometryNodeShortTextureName(name) {
  const value = String(name || "");
  return value.length > 10 ? `${value.slice(0, 10)}...` : value;
}
function geometryNodeFields(graph, type, instanceId = type) {
  const p = graph.nodeParams?.[instanceId] || graph.params;
  if (BWS_ASSET_NODES[type]) return assetNodeFields(type, p, instanceId);
  if (!GEOMETRY_NODE_DEFINITIONS[type]) return '<p class="geometry-node-card-note">This node comes from a newer BWS build. Its saved data and connections are being preserved. Refresh or update BWS to edit and build it.</p>';
  if (type === "smoothGeometry") {
    const node = graph.smoothNodes.find(item => item.id === instanceId);
    const settings = node?.params || { axis: "xyz", iterations: 2, strength: .72, preserveSize: true };
    return geometryNodeSelectField("Axes", "axis", settings.axis, [["xyz", "XYZ"], ["xy", "XY"], ["xz", "XZ"], ["yz", "YZ"], ["x", "X only"], ["y", "Y only"], ["z", "Z only"]], instanceId)
      + geometryNodeField("Passes", "iterations", settings.iterations, { min: 1, max: 2, instanceId })
      + geometryNodeField("Strength", "strength", settings.strength, { min: .05, max: null, step: .05, instanceId })
      + geometryNodeField("Keep size", "preserveSize", settings.preserveSize, { type: "checkbox", instanceId });
  }
  if (type === "seed") return geometryNodeField("Value", "seed", graph.seed, { min: 0, max: 999999 });
  if(type==="colorPalette")return geometryNodeField("Active colors","paletteCount",geometryNodeNumber(p.paletteCount,4,1,4),{min:1,max:4,instanceId})+[1,2,3,4].map((n)=>geometryNodeField("Color "+n,"paletteColor"+n,geometryNodePaletteColor(p,n),{type:"color",instanceId})).join("")+'<p class="geometry-node-card-note">Connect an optional texture to tint it, or use colors alone. Connect to a generator Texture socket or a Texture / Color Randomizer. Active colors are selected per part using the graph seed.</p>';
  if (type === "textureRandomizer") return geometryNodeField("Seed offset", "texturePoolSeed", geometryNodeNumber(p.texturePoolSeed, 0, 0, 999999), { min:0, max:999999, instanceId })
    + geometryNodeField("Vary UVs", "texturePoolUvs", p.texturePoolUvs !== false, {type:"checkbox", instanceId})
    + geometryNodeField("UV variation", "texturePoolVariation", geometryNodeNumber(p.texturePoolVariation, .75, 0, 1), {min:0,max:1,step:.05,instanceId})
    + '<p class="geometry-node-card-note">Connect up to four Texture Inputs or Color Palettes here, then connect this output to a generator texture socket. One color/texture choice is selected per part, not blended. Graph seed + offset repeat the result.</p>';
  if (type === "textureInput") {
    const textureName = p.textureName || "No texture imported";
    return `<label class="geometry-node-texture-picker"><span>Image file</span><span class="geometry-node-file-button">Choose image</span><input class="geometry-node-file-input" type="file" accept="image/*" data-geometry-texture-input data-geometry-texture-instance="${geometryNodeEscape(instanceId)}"></label><p class="geometry-node-card-note geometry-node-texture-name" data-geometry-texture-name title="${geometryNodeEscape(textureName)}">${geometryNodeEscape(geometryNodeShortTextureName(textureName))}</p>`
      + geometryNodeField("Randomize", "textureRandomize", p.textureRandomize, { type: "checkbox", instanceId })
      + geometryNodeField("Variation", "textureVariation", p.textureVariation, { min: 0, max: 1, step: .05, instanceId });
  }
  if (type === "variant") return geometryNodeSelectField("Shape", "variantStyle", p.variantStyle, [["classic", "Classic"], ["broad", "Broad oak"], ["round", "Round crown"], ["tall", "Tall pine"], ["sparse", "Sparse"], ["bare", "Bare / dead"]]) + geometryNodeSelectField("Season", "variantSeason", p.variantSeason, [["spring", "Spring"], ["summer", "Summer"], ["autumn", "Autumn"], ["winter", "Winter"], ["snowy", "Snowy"]]) + geometryNodeSelectField("Age", "variantMaturity", p.variantMaturity, [["sapling", "Sapling"], ["young", "Young"], ["mature", "Mature"], ["ancient", "Ancient"]]) + geometryNodeField("Variation", "variantAmount", p.variantAmount, { min: 0, max: 1, step: .05 });
  if (type === "primitive") return geometryNodeSelectField("Shape", "primitiveShape", p.primitiveShape, [["box", "Cube"], ["sphere", "Sphere"], ["cylinder", "Cylinder"], ["cone", "Cone"], ["torus", "Torus"], ["panel", "Panel"], ["wedge", "Wedge"], ["hollowBox", "Hollow box"], ["tube", "Tube"], ["curvedPanel", "Curved panel"], ["ring", "Ring"], ["arch", "Arch"], ["hemisphere", "Hemisphere"], ["dome", "Dome"], ["capsule", "Capsule"], ["pyramid", "Pyramid"], ["prism", "Prism"], ["tetrahedron", "Tetrahedron"], ["pyramidFrustum", "Pyramid frustum"], ["facetedBallLow", "Low-poly cluster"], ["facetedBallMedium", "Detailed cluster"], ["facetedBallHigh", "High-detail cluster"], ["heart", "Heart"], ["stair", "Stair"]]) + geometryNodeField("Size X", "primitiveSizeX", p.primitiveSizeX, { min: .05, max: 30, step: .05 }) + geometryNodeField("Size Y", "primitiveSizeY", p.primitiveSizeY, { min: .05, max: 30, step: .05 }) + geometryNodeField("Size Z", "primitiveSizeZ", p.primitiveSizeZ, { min: .05, max: 30, step: .05 }) + geometryNodeField("Color", "primitiveColor", p.primitiveColor, { type: "color" });
  if (type === "stem") return geometryNodeField("Height", "stemHeight", p.stemHeight, { min: .2, max: 40, step: .1 }) + geometryNodeField("Base radius", "stemBaseRadius", p.stemBaseRadius, { min: .03, max: 6, step: .02 }) + geometryNodeField("Top radius", "stemTopRadius", p.stemTopRadius, { min: .01, max: 6, step: .02 }) + geometryNodeField("Segments", "stemSegments", p.stemSegments, { min: 2, max: 32 }) + geometryNodeField("Sides", "stemSides", p.stemSides, { min: 5, max: 32 }) + geometryNodeField("Lean", "stemLean", p.stemLean, { min: 0, max: 3, step: .02 }) + geometryNodeField("Root flare", "stemFlare", p.stemFlare, { min: 0, max: 2, step: .02 }) + geometryNodeField("Color", "stemColor", p.stemColor, { type: "color" });
  if (type === "branchArray") return geometryNodeField("Count", "branchArrayCount", p.branchArrayCount, { min: 0, max: 40 }) + geometryNodeField("Length", "branchArrayLength", p.branchArrayLength, { min: .1, max: 15, step: .05 }) + geometryNodeField("Rise", "branchArrayRise", p.branchArrayRise, { min: -.5, max: 2, step: .02 }) + geometryNodeField("Base radius", "branchArrayRadius", p.branchArrayRadius, { min: .02, max: 3, step: .02 }) + geometryNodeField("Tip ratio", "branchArrayTaper", p.branchArrayTaper, { min: .03, max: 1, step: .02 }) + geometryNodeField("Twist", "branchArrayTwist", p.branchArrayTwist, { min: -180, max: 180, step: 1 }) + geometryNodeField("Color", "branchColor", p.branchColor, { type: "color" });
  if (type === "clusterScatter") return geometryNodeField("Count", "clusterScatterCount", p.clusterScatterCount, { min: 0, max: 64 }) + geometryNodeField("Size", "clusterScatterSize", p.clusterScatterSize, { min: .05, max: 8, step: .05 }) + geometryNodeField("Spread", "clusterScatterSpread", p.clusterScatterSpread, { min: 0, max: 4, step: .05 }) + geometryNodeField("Color", "clusterScatterColor", p.clusterScatterColor, { type: "color" });
  if (type === "rocks") return geometryNodeSelectField("Profile", "rockProfile", p.rockProfile, [["rounded", "Rounded"], ["jagged", "Jagged"], ["flat", "Flat fieldstone"], ["boulder", "Boulder"]]) + geometryNodeSelectField("Arrangement", "rockArrangement", p.rockArrangement, [["single", "Single"], ["cluster", "Cluster"], ["line", "Line"], ["stack", "Stacked"]]) + geometryNodeField("Count", "rockCount", p.rockCount, { min: 1, max: 48 }) + geometryNodeField("Size", "rockSize", p.rockSize, { min: .1, max: 8, step: .05 }) + geometryNodeField("Variation", "rockVariation", p.rockVariation, { min: 0, max: 1, step: .05 }) + geometryNodeField("Spacing", "rockSpacing", p.rockSpacing, { min: .2, max: 4, step: .05 }) + geometryNodeField("Color", "rockColor", p.rockColor, { type: "color" }) + geometryNodeField("Color 2", "rockColorSecondary", p.rockColorSecondary, { type: "color" }) + geometryNodeField("Color 3", "rockColorTertiary", p.rockColorTertiary, { type: "color" }) + geometryNodeTextureConnectionNote(graph, instanceId) + geometryNodeSelectField("Nature output", "natureOutputMode", p.natureOutputMode, [["both", "Stone + grass surface"], ["stone", "Stone only"], ["grass", "Grass surface only"]]);
  if (type === "stoneWall") return geometryNodeField("Length", "wallLength", p.wallLength, { min: 1, max: 500, step: .5 }) + geometryNodeField("Height", "wallHeight", p.wallHeight, { min: .5, max: 12, step: .1 }) + geometryNodeField("Depth", "wallDepth", p.wallDepth, { min: .3, max: 6, step: .05 }) + geometryNodeField("Rows", "wallRows", p.wallRows, { min: 1, max: 12 }) + geometryNodeField("Stones / 7 units", "wallColumns", p.wallColumns, { min: 2, max: 30 }) + geometryNodeField("Depth layers", "wallDepthLayers", p.wallDepthLayers, { min: 1, max: 4 }) + geometryNodeField("Shape variation", "wallIrregularity", p.wallIrregularity, { min: 0, max: 1, step: .05 }) + geometryNodeField("Color variation", "wallColorVariation", p.wallColorVariation, { min: 0, max: 1, step: .05 }) + geometryNodeField("Base color", "wallColor", p.wallColor, { type: "color" }) + geometryNodeField("Color 2", "wallColorSecondary", p.wallColorSecondary, { type: "color" }) + geometryNodeField("Color 3", "wallColorTertiary", p.wallColorTertiary, { type: "color" }) + geometryNodeField("Overall mix", "wallOverallTextureMix", p.wallOverallTextureMix, { min: 0, max: 1, step: .05 }) + '<p class="geometry-node-card-note">Upper, Middle, and Bottom texture their wall zones. Overall randomly replaces them using Overall mix.</p>' + geometryNodeSelectField("Nature output", "natureOutputMode", p.natureOutputMode, [["both", "Stone + grass surface"], ["stone", "Stone only"], ["grass", "Grass surface only"]]);
  if (type === "grass") return geometryNodeField("Clump count", "grassCount", p.grassCount, { min: 1, max: 160 }) + geometryNodeField("Height", "grassHeight", p.grassHeight, { min: .05, max: 3, step: .02 }) + geometryNodeField("Width", "grassWidth", p.grassWidth, { min: .01, max: .8, step: .01 }) + geometryNodeField("Edge spread", "grassSpread", p.grassSpread, { min: 0, max: 3, step: .05 }) + geometryNodeField("Avoid source geometry", "grassAvoidGeometry", p.grassAvoidGeometry, { type: "checkbox" }) + geometryNodeField("Mask clearance", "grassClearance", p.grassClearance, { min: 0, max: 2, step: .02 }) + geometryNodeField("Grow on −X side", "grassGrowNegativeX", p.grassGrowNegativeX, { type: "checkbox" }) + geometryNodeField("Grow on +X side", "grassGrowPositiveX", p.grassGrowPositiveX, { type: "checkbox" }) + geometryNodeField("Grow on −Z side", "grassGrowNegativeZ", p.grassGrowNegativeZ, { type: "checkbox" }) + geometryNodeField("Grow on +Z side", "grassGrowPositiveZ", p.grassGrowPositiveZ, { type: "checkbox" }) + geometryNodeField("Color", "grassColor", p.grassColor, { type: "color" });
  if (type === "moss") return geometryNodeSelectField("Height zone", "mossPlacement", p.mossPlacement, [["bottom", "Bottom"], ["middle", "Middle"], ["top", "Top"], ["all", "All heights"]]) + geometryNodeField("Coverage", "mossCoverage", p.mossCoverage, { min: 0, max: 1, step: .05 }) + geometryNodeField("Cushion height", "mossThickness", p.mossThickness, { min: .02, max: .6, step: .01 }) + geometryNodeField("Moisture", "mossMoisture", p.mossMoisture, { min: 0, max: 1, step: .05 }) + geometryNodeField("Sun exposure", "mossSunlight", p.mossSunlight, { min: 0, max: 1, step: .05 }) + geometryNodeField("Crack preference", "mossCrackBias", p.mossCrackBias, { min: 0, max: 1, step: .05 }) + geometryNodeField("Color", "mossColor", p.mossColor, { type: "color" });
  if (type === "join") return geometryNodeField("Add inner panel", "joinAddInnerPanel", p.joinAddInnerPanel, { type: "checkbox" }) + geometryNodeSelectField("Panel direction", "joinPanelAxis", p.joinPanelAxis, [["auto", "Auto / thinnest side"], ["x", "X direction"], ["y", "Y direction"], ["z", "Z direction"]]) + geometryNodeField("Panel inset", "joinPanelInset", p.joinPanelInset, { min: 0, max: 1.5, step: .02 }) + geometryNodeField("Panel color", "joinPanelColor", p.joinPanelColor, { type: "color" }) + '<p class="geometry-node-card-note">Combines all connected geometry streams before CiS.</p>';
  if (type === "primitiveTest") return '<p class="geometry-node-card-note">Builds cube, pentagon, and low-cone before/after pairs.</p>';
  if (type === "roots") return geometryNodeField("Count", "rootCount", p.rootCount, { min: 1, max: 16 }) + geometryNodeField("Length", "rootLength", p.rootLength, { min: .2, max: 6, step: .05 }) + geometryNodeField("Thickness", "rootThickness", p.rootThickness, { min: .05, max: 2, step: .05 });
  if (type === "trunk") return geometryNodeField("Height", "height", p.height, { min: 1, max: 30, step: .25 }) + geometryNodeField("Width", "trunkWidth", p.trunkWidth, { min: .1, max: 5, step: .05 }) + geometryNodeField("Segments", "trunkSegments", p.trunkSegments, { min: 2, max: 16 });
  if (type === "bend") return geometryNodeField("Strength", "trunkBend", p.trunkBend, { min: 0, max: 1.5, step: .02 });
  if (type === "branches") return geometryNodeField("Count", "branchCount", p.branchCount, { min: 0, max: 32 }) + geometryNodeField("Spread", "branchSpread", p.branchSpread, { min: 10, max: 88 }) + geometryNodeField("Length", "branchLength", p.branchLength, { min: .3, max: 10, step: .1 });
  if (type === "smoothJoints") return geometryNodeField("Blend size", "jointSize", p.jointSize, { min: .45, max: 1.4, step: .02 }) + geometryNodeField("Seam bulbs", "jointTrunkSeams", p.jointTrunkSeams, { type: "checkbox" });
  if (type === "junctionBlend") return geometryNodeField("Collar size", "junctionBlendSize", p.junctionBlendSize, { min: .2, max: 4, step: .02 }) + geometryNodeField("Collar length", "junctionBlendLength", p.junctionBlendLength, { min: .2, max: 4, step: .02 });
  if (type === "twigs") return geometryNodeField("Length", "twigLength", p.twigLength, { min: .1, max: 1.5, step: .05 }) + geometryNodeField("Rise", "twigRise", p.twigRise, { min: .1, max: 1.5, step: .05 });
  if (type === "canopy") return geometryNodeField("Enabled", "canopyEnabled", p.canopyEnabled, { type: "checkbox" }) + geometryNodeField("Cluster size", "canopySize", p.canopySize, { min: .2, max: 5, step: .05 }) + geometryNodeField("Density", "canopyDensity", p.canopyDensity, { min: 1, max: 4 });
  if (type === "knot") return geometryNodeField("Count", "knotCount", p.knotCount, { min: 1, max: 12 }) + geometryNodeField("Size", "knotSize", p.knotSize, { min: .08, max: 1.2, step: .02 }) + geometryNodeField("Inset", "knotInset", p.knotInset, { min: -.2, max: .3, step: .01 }) + geometryNodeField("Rings", "knotRings", p.knotRings, { min: 2, max: 9 });
  if (type === "cutSurface") return geometryNodeField("Rings", "cutRingCount", p.cutRingCount, { min: 2, max: 14 }) + geometryNodeField("Depth", "cutRingDepth", p.cutRingDepth, { min: .01, max: .15, step: .005 }) + geometryNodeField("Contrast", "cutRingContrast", p.cutRingContrast, { min: 0, max: 1, step: .05 });
  if (type === "transform") return geometryNodeField("X", "transformX", p.transformX, { min: -50, max: 50, step: .1 }) + geometryNodeField("Y", "transformY", p.transformY, { min: -50, max: 50, step: .1 }) + geometryNodeField("Z", "transformZ", p.transformZ, { min: -50, max: 50, step: .1 }) + geometryNodeField("Rotate X", "transformRotX", p.transformRotX, { min: -180, max: 180, step: 1 }) + geometryNodeField("Rotate Y", "transformRotY", p.transformRotY, { min: -180, max: 180, step: 1 }) + geometryNodeField("Rotate Z", "transformRotZ", p.transformRotZ, { min: -180, max: 180, step: 1 }) + geometryNodeField("Scale", "transformScale", p.transformScale, { min: .05, max: 10, step: .05 });
  if (type === "output") return geometryNodeField("Name", "outputName", p.outputName, { type: "text" });
  return "";
}
function geometryNodeTypeForId(graph, nodeId) {
  if (graph.nodeOrder.includes(nodeId)) {
    if (GEOMETRY_NODE_DEFINITIONS[nodeId]) return nodeId;
    const baseType = String(nodeId).split("::")[0];
    return GEOMETRY_NODE_DEFINITIONS[baseType] ? baseType : null;
  }
  return graph.smoothNodes.some(node => node.id === nodeId) ? "smoothGeometry" : null;
}
function geometryNodeResolvedSourceId(graph, nodeId, visited = new Set()) {
  if (!nodeId || visited.has(nodeId)) return null;
  visited.add(nodeId);
  const type = geometryNodeTypeForId(graph, nodeId);
  if (type !== "smoothGeometry") return nodeId;
  const incoming = graph.connections.find(connection => connection.toNodeId === nodeId);
  return geometryNodeResolvedSourceId(graph, incoming?.fromNodeId, visited);
}
function geometryNodeCard(graph, type, instanceId = type) {
  const definition = GEOMETRY_NODE_DEFINITIONS[type] || { title: `Unsupported: ${type}`, category: "Compatibility", input: "Geometry", output: "Geometry" };
  const smoothNode = type === "smoothGeometry" ? graph.smoothNodes.find(node => node.id === instanceId) : null;
  const position = smoothNode?.position || graph.nodePositions[instanceId] || graph.nodePositions[type] || [18, 42];
  const sourceId = smoothNode ? geometryNodeResolvedSourceId(graph, instanceId) : null;
  const targetTitle = sourceId ? GEOMETRY_NODE_DEFINITIONS[geometryNodeTypeForId(graph, sourceId)]?.title : "";
  const instanceLabel = !smoothNode && instanceId !== type ? ` ${instanceId.split("::").pop()}` : "";
  const title = smoothNode && targetTitle ? `${definition.title}: ${targetTitle}` : `${definition.title}${instanceLabel}`;
  const outputConnected = graph.connections.some(connection => connection.fromNodeId === instanceId);
  const active = geometryNodeActiveNodeIds(graph).has(instanceId);
  const inputLabels = definition.inputSockets || (definition.input ? [definition.input] : []);
  const inputSocket = inputLabels.map((label, index) => {
    const connected = graph.connections.some(connection => connection.toNodeId === instanceId && (Number(connection.toInputIndex) || 0) === index);
    return `<div class="geometry-node-socket input-socket"><button type="button" class="geometry-node-port input ${connected ? "connected" : ""}" data-geometry-input-index="${index}" data-geometry-connect-to="${geometryNodeEscape(instanceId)}" title="Connect ${geometryNodeEscape(label)} into ${geometryNodeEscape(title)}" aria-label="Connect ${geometryNodeEscape(label)} into ${geometryNodeEscape(title)}"></button><span>${geometryNodeEscape(label)}</span></div>`;
  }).join("");
  const outputSocket = definition.output ? `<div class="geometry-node-socket output-socket"><span>${geometryNodeEscape(definition.output)}</span><button type="button" class="geometry-node-port output ${outputConnected ? "connected" : ""}" data-geometry-connect-from="${geometryNodeEscape(instanceId)}" title="Start connection from ${geometryNodeEscape(title)}" aria-label="Start connection from ${geometryNodeEscape(title)}">+</button></div>` : "";
  const rawFields = geometryNodeFields(graph, type, instanceId);
  const fields = instanceId !== type ? rawFields.replaceAll('data-geometry-param="', `data-geometry-instance-param="${geometryNodeEscape(instanceId)}" data-geometry-param="`) : rawFields;
  return `<article class="geometry-node-card ${type === "output" ? "output" : ""} ${active ? "" : "inactive"}" data-geometry-node="${geometryNodeEscape(instanceId)}" data-geometry-node-type="${type}" style="left:${position[0]}px;top:${position[1]}px"><div class="geometry-node-title" data-geometry-drag="${geometryNodeEscape(instanceId)}"><span>${geometryNodeEscape(title)}</span><button type="button" data-geometry-remove-node="${geometryNodeEscape(instanceId)}" title="Remove ${geometryNodeEscape(definition.title)} node" aria-label="Remove ${geometryNodeEscape(definition.title)} node">×</button></div>${inputSocket}<div class="geometry-node-fields">${fields}</div>${outputSocket}</article>`;
}
function geometryNodePaletteMarkup(graph) {
  const categoryOrder = ["Inputs", "Geometry", "Layout", "Modifiers", "Output", "Growth", "Nature", "Nature Details", "Testing", "Scene", "Game Assets", "Vehicles", "Architecture", "Damage & Effects"];
  const categories = [...new Set(GEOMETRY_NODE_TYPES.map(type => GEOMETRY_NODE_DEFINITIONS[type].category))].sort((a,b) => (categoryOrder.includes(a) ? categoryOrder.indexOf(a) : 999) - (categoryOrder.includes(b) ? categoryOrder.indexOf(b) : 999));
  return categories.map(category => `<section><strong>${category}</strong>${GEOMETRY_NODE_TYPES.filter(type => GEOMETRY_NODE_DEFINITIONS[type].category === category).map(type => {
    const count = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === type).length;
    return `<button type="button" data-geometry-add-node="${type}">+ ${geometryNodeEscape(GEOMETRY_NODE_DEFINITIONS[type].title)}${count ? ` (${count})` : ""}</button>`;
  }).join("")}</section>`).join("");
}
function geometryNodeCanvasSize(graph) {
  const points = [...graph.nodeOrder.map(type => graph.nodePositions[type] || [0, 0]), ...graph.smoothNodes.map(node => node.position)];
  return {
    width: Math.max(2200, ...points.map(point => point[0] + 260)),
    height: Math.max(1100, ...points.map(point => point[1] + 300))
  };
}
function geometryNodeRulersMarkup({ width, height }) {
  const xTicks = Array.from({ length: Math.ceil(width / 100) + 1 }, (_, index) => `<span style="left:${index * 100}px">${index * 100}</span>`).join("");
  const yTicks = Array.from({ length: Math.ceil(height / 100) + 1 }, (_, index) => `<span style="top:${index * 100}px">${index * 100}</span>`).join("");
  return `<div class="geometry-node-ruler-x" aria-hidden="true">${xTicks}</div><div class="geometry-node-ruler-y" aria-hidden="true">${yTicks}</div>`;
}
function geometryNodeSurface(doc, kind = "sidebar") {
  const ids = GEOMETRY_NODE_SURFACE_IDS[kind];
  if (!doc || !ids) return null;
  return Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, doc.getElementById(id)]));
}
function liveGeometryNodesDetachedWindow() {
  if (geometryNodesDetachedWindow?.closed) geometryNodesDetachedWindow = null;
  return geometryNodesDetachedWindow;
}
function geometryNodeLinkPath(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const handle = Math.max(42, Math.min(260, Math.abs(dx) * .46 + Math.abs(dy) * .22 + (dx < 0 ? 70 : 0)));
  return `M ${from[0]} ${from[1]} C ${from[0] + handle} ${from[1]}, ${to[0] - handle} ${to[1]}, ${to[0]} ${to[1]}`;
}
function geometryNodePortPoint(canvas, nodeId, direction, portIndex = 0) {
  const canvasBounds = canvas.getBoundingClientRect();
  const scaleX = canvasBounds.width / Math.max(1, canvas.offsetWidth);
  const scaleY = canvasBounds.height / Math.max(1, canvas.offsetHeight);
  const ports = canvas.querySelectorAll(`[data-geometry-node="${nodeId}"] .geometry-node-port.${direction}`);
  const port = ports[portIndex] || ports[0];
  const portBounds = port?.getBoundingClientRect();
  return portBounds ? [(portBounds.left + portBounds.width / 2 - canvasBounds.left) / scaleX, (portBounds.top + portBounds.height / 2 - canvasBounds.top) / scaleY] : null;
}
function renderGeometryNodeLinks(canvas, graph, doc = canvas?.ownerDocument) {
  const svg = canvas?.querySelector(".geometry-node-links");
  if (!canvas || !svg || !graph) return;
  const links = graph.connections.map(connection => {
    const from = geometryNodePortPoint(canvas, connection.fromNodeId, "output");
    const to = geometryNodePortPoint(canvas, connection.toNodeId, "input", Math.max(0, Number(connection.toInputIndex) || 0));
    if (!from || !to) return "";
    const path = geometryNodeLinkPath(from, to);
    return `<path class="geometry-node-link-hit" data-geometry-link="${geometryNodeEscape(connection.id)}" d="${path}"></path><path class="geometry-node-link" d="${path}"></path>`;
  });
  const interaction = geometryNodeInteractionByDocument.get(doc);
  if (interaction?.pendingFrom && interaction.pointer) {
    const from = geometryNodePortPoint(canvas, interaction.pendingFrom, "output");
    if (from) links.push(`<path class="geometry-node-link pending" d="${geometryNodeLinkPath(from, interaction.pointer)}"></path>`);
  }
  svg.innerHTML = links.join("");
}
function fitGeometryNodeSidebarOverview() {
 const viewport=document.getElementById('geometryNodeViewport'),canvas=document.getElementById('geometryNodeCanvas');
 if(!viewport||!canvas)return;
 viewport.style.height='clamp(360px, 65vh, 900px)';viewport.style.minHeight='360px';viewport.style.overflow='hidden';
 viewport.scrollLeft=viewport.scrollTop=0;viewport.style.touchAction='none';
 const graph=activeGeometryNodeGraph();
 if(graph)updateGeometryNodeDetachedView(geometryNodeSurface(document,'sidebar'),graph,document);
 viewport.dataset.fitLabel='';geometryNodeRefreshRulers(canvas);
 if(!document.getElementById('geometryNodeNavigation')){
  const bar=document.createElement('div');bar.id='geometryNodeNavigation';
  bar.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0';
  const hint=document.createElement('span');hint.textContent='Wheel: zoom | Middle-drag or Space + drag: pan';
  const fit=document.createElement('button');fit.type='button';fit.textContent='Fit nodes';
  fit.onclick=()=>{
   const g=activeGeometryNodeGraph(),cards=geometryNodeMeasuredCards(canvas);if(!g||!cards.length)return;
   const minX=Math.min(...cards.map(c=>c.x)),minY=Math.min(...cards.map(c=>c.y));
   const width=Math.max(...cards.map(c=>c.x+c.w))-minX,height=Math.max(...cards.map(c=>c.y+c.h))-minY;
   const scale=Math.max(.05,Math.min(1.5,(viewport.clientWidth-100)/Math.max(1,width),(viewport.clientHeight-80)/Math.max(1,height)));
   g.view={x:60-minX*scale,y:40-minY*scale,scale};
   updateGeometryNodeDetachedView(geometryNodeSurface(document,'sidebar'),g,document);saveGeometryNodeDraft();
  };
  bar.append(fit,hint);viewport.before(bar);
 }
}
function renderGeometryNodeSurface(doc, kind = "sidebar") {
  const surface = geometryNodeSurface(doc, kind);
  if (!surface?.canvas || !surface.select) return;
  const { canvas, select, status } = surface;
  if(kind==="sidebar"&&canvas.parentElement){canvas.parentElement.hidden=false;canvas.parentElement.style.display="block";}
  if (!geometryNodesRuntimeEnabled) {
    canvas.replaceChildren();
    select.replaceChildren();
    if (status) status.textContent = "Plugin unloaded. Saved node graphs remain in this project.";
    return;
  }
  select.innerHTML = geometryNodeProjectState.graphs.map(graph => `<option value="${geometryNodeEscape(graph.id)}" ${graph.id === geometryNodeProjectState.activeGraphId ? "selected" : ""}>${geometryNodeEscape(graph.name)}</option>`).join("");
  const graph = activeGeometryNodeGraph();
  if (surface.deleteButton) surface.deleteButton.textContent = graph && geometryNodePendingDeleteId === graph.id ? "Confirm delete graph" : "Delete graph";
  for (const button of [surface.buildButton, surface.root?.querySelector("[data-geometry-center-output]"), surface.bakeButton, surface.deleteButton, surface.copyButton, surface.saveClusterButton]) {
    if (button) button.disabled = !graph;
  }
  if (!graph) {
    canvas.innerHTML = '<div class="geometry-node-empty">No graph in this project. Choose New graph to begin.</div>';
    if (status) status.textContent = "No saved graph.";
    return;
  }
  geometryNodeInstallLayoutTools(surface,doc);
  const palette = surface.root?.querySelector("[data-geometry-node-palette]");
  if (palette) palette.innerHTML = geometryNodePaletteMarkup(graph);
  const canvasSize = geometryNodeCanvasSize(graph);
  canvas.style.width = `${canvasSize.width}px`;
  canvas.style.height = `${canvasSize.height}px`;
  canvas.innerHTML = `${geometryNodeRulersMarkup(canvasSize)}<svg class="geometry-node-links" aria-hidden="true"></svg>${graph.nodeOrder.map(nodeId => geometryNodeCard(graph, geometryNodeTypeForId(graph, nodeId), nodeId)).join("")}${graph.smoothNodes.map(node => geometryNodeCard(graph, "smoothGeometry", node.id)).join("")}`;
  if (kind === "detached") {
    canvas.style.transform = `translate(${graph.view.x}px, ${graph.view.y}px) scale(${graph.view.scale})`;
    canvas.style.transformOrigin = "top left";
    const zoomLabel = surface.root?.querySelector("[data-geometry-zoom-label]");
    if (zoomLabel) zoomLabel.textContent = `${Math.round(graph.view.scale * 100)}%`;
  }
  doc.defaultView?.requestAnimationFrame(() => {geometryNodeExpandCanvas(canvas);renderGeometryNodeLinks(canvas, graph, doc);geometryNodeRefreshRulers(canvas);geometryNodeRepairOverlap(surface,graph);});
  if (kind === "sidebar") doc.defaultView?.requestAnimationFrame(fitGeometryNodeSidebarOverview);
  if (kind === "detached") doc.title = `BoltWorks Geometry Nodes — ${graph.name}`;
  const hasGeometrySource = GEOMETRY_NODE_SOURCE_TYPES.some(type => graph.nodeOrder.some(nodeId => geometryNodeTypeForId(graph, nodeId) === type));
  const unsupportedTypes = graph.nodeOrder.filter(nodeId => !geometryNodeTypeForId(graph, nodeId));
  const missingRequired = [hasGeometrySource ? null : "geometry", graph.nodeOrder.some(nodeId => geometryNodeTypeForId(graph, nodeId) === "output") ? null : "output"].filter(Boolean);
  if (surface.buildButton) surface.buildButton.disabled = missingRequired.length > 0 || unsupportedTypes.length > 0;
  if (status) status.textContent = unsupportedTypes.length
    ? `Update or refresh BWS to build this graph. Preserved unsupported node${unsupportedTypes.length === 1 ? "" : "s"}: ${unsupportedTypes.join(", ")}.`
    : missingRequired.length
    ? `Add ${missingRequired.map(type => type === "geometry" ? "a geometry source" : GEOMETRY_NODE_DEFINITIONS[type].title).join(" and ")} before building.`
    : graph.generatedIds.length
    ? `${graph.name} is linked to ${graph.generatedIds.length} generated parts. Build again to update them.`
    : `${graph.name} is saved and ready to build. ${graph.connections.length} manual connection${graph.connections.length === 1 ? "" : "s"}.`;
}
function renderGeometryNodeEditor() {
  renderGeometryNodeSurface(document, "sidebar");
  const detachedWindow = liveGeometryNodesDetachedWindow();
  if (detachedWindow) renderGeometryNodeSurface(detachedWindow.document, "detached");
}
function geometryNodeDetachedMarkup(styleUrl) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BoltWorks Geometry Nodes</title><link rel="stylesheet" href="${geometryNodeEscape(styleUrl)}"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden}.geometry-node-popout-body{display:block!important;background:#0b1012;color:#f2f6f5}.geometry-node-popout-shell{box-sizing:border-box;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;gap:10px;width:100%;height:100%;padding:14px}.geometry-node-popout-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.geometry-node-popout-header h1{margin:0;font-size:18px}.geometry-node-popout-shell .geometry-node-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) auto}.geometry-node-popout-shell .geometry-node-actions{display:flex;flex-wrap:wrap;margin:0}.geometry-node-popout-shell .geometry-node-actions .danger{margin-left:auto}.geometry-node-popout-shell .geometry-node-viewport{min-height:0;height:100%;overflow:hidden}.geometry-node-popout-shell .geometry-node-canvas{position:relative;width:2200px;height:1100px}.geometry-node-popout-shell .geometry-node-links{position:absolute;inset:0;width:100%;height:100%}.geometry-node-popout-shell .geometry-node-card{position:absolute;width:154px}.geometry-node-popout-shell .geometry-node-title{display:flex;align-items:center;justify-content:space-between;padding:7px 9px}.geometry-node-popout-shell .geometry-node-fields{display:grid;gap:6px;padding:8px}.geometry-node-popout-shell .geometry-node-socket{position:relative;display:flex;padding:4px 8px}.geometry-node-popout-shell .output-socket{justify-content:flex-end}.geometry-node-popout-shell .geometry-node-port{position:absolute;top:50%;transform:translateY(-50%)}.geometry-node-popout-shell .geometry-node-port.input{left:-8px}.geometry-node-popout-shell .geometry-node-port.output{right:-8px}.geometry-node-popout-shell>.api-note{margin:0}</style></head><body class="geometry-node-popout-body"><main id="geometryNodeDetachedRoot" class="geometry-node-popout-shell"><header class="geometry-node-popout-header"><h1>Geometry Nodes</h1><span class="plugin-ready">Wheel: zoom · Middle drag or Space + drag: pan</span></header><div class="geometry-node-toolbar"><select id="geometryNodeDetachedGraphSelect" aria-label="Geometry node graph"></select><button id="geometryNodeDetachedNewBtn" type="button">New graph</button><button type="button" data-geometry-tree-template>Tree template</button><button type="button" data-geometry-house-template>House template</button><details class="geometry-node-palette"><summary>+ Add node</summary><div class="geometry-node-palette-list" data-geometry-node-palette></div></details></div><div class="geometry-node-actions"><button id="geometryNodeDetachedBuildBtn" class="primary" type="button">Build / Update Geometry</button><button type="button" data-geometry-center-output title="Rebuild active graph; center X/Z and rest its base on Y=0. Future builds stay centered.">Regenerate centered</button><button id="geometryNodeDetachedBakeBtn" type="button">Bake &amp; Detach</button><div class="geometry-node-view-tools"><button type="button" data-geometry-view="zoom-out" title="Zoom out">−</button><span data-geometry-zoom-label>100%</span><button type="button" data-geometry-view="zoom-in" title="Zoom in">+</button><button type="button" data-geometry-view="fit">Fit graph</button></div><button id="geometryNodeDetachedDeleteBtn" class="danger" type="button">Delete graph</button></div><div class="geometry-node-viewport"><div id="geometryNodeDetachedCanvas" class="geometry-node-canvas" aria-label="Procedural geometry node graph"></div></div><p id="geometryNodeDetachedStatus" class="api-note">Ready.</p></main></body></html>`;
}
function geometryNodeDetachedMarkupWithSharing(styleUrl) {
  const shareMarkup = '<div class="geometry-node-share-actions"><button id="geometryNodeDetachedCopyBtn" type="button">Copy node string</button><button id="geometryNodeDetachedPasteBtn" type="button">Paste node string</button><button id="geometryNodeDetachedSaveClusterBtn" type="button">Save .bwnc</button><button id="geometryNodeDetachedLoadClusterBtn" type="button">Load .bwnc</button><input id="geometryNodeDetachedClusterFile" type="file" accept=".bwnc,application/json" hidden></div>';
  return geometryNodeDetachedMarkup(styleUrl)
    .replace("grid-template-rows:auto auto auto minmax(0,1fr) auto", "grid-template-rows:auto auto auto auto minmax(0,1fr) auto")
    .replace('<div class="geometry-node-viewport">', `${shareMarkup}<div class="geometry-node-viewport">`);
}
function openGeometryNodesDetachedWindow(){document.documentElement.requestFullscreen?.().catch(error=>setGeometryNodeStatus(error.message));}
function geometryNodePrng(seed) {
  let value = (Math.round(seed) || 1) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}
function geometryNodeSegmentSpec({ shape = "cylinder", name, start, end, width, color, group }) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = Math.max(.01, direction.length());
  const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()), "XYZ");
  const radialScale = shape === "pyramidFrustum" ? width / 1.36 : width / .96;
  return {
    shape, name, position: start.clone().add(end).multiplyScalar(.5).toArray(),
    rotation: [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg),
    scale: [radialScale, length, radialScale], color, roughness: .82,
    groupId: group.id, groupName: group.name
  };
}
function geometryNodeTubeGeometry(points, radii, sides = 10, { flatBase = false } = {}) {
  const vertices = [];
  const indices = [];
  const ringCount = points.length;
  for (let ring = 0; ring < ringCount; ring++) {
    const previous = points[Math.max(0, ring - 1)];
    const next = points[Math.min(ringCount - 1, ring + 1)];
    const tangent = next.clone().sub(previous).normalize();
    const rotation = flatBase && ring === 0
      ? new THREE.Quaternion()
      : new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    const radius = Math.max(.005, Number(radii[ring] ?? radii.at(-1) ?? .1));
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const offset = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius).applyQuaternion(rotation);
      vertices.push(...points[ring].clone().add(offset).toArray());
    }
  }
  for (let ring = 0; ring < ringCount - 1; ring++) for (let side = 0; side < sides; side++) {
    const nextSide = (side + 1) % sides;
    const a = ring * sides + side;
    const b = ring * sides + nextSide;
    const c = (ring + 1) * sides + side;
    const d = (ring + 1) * sides + nextSide;
    indices.push(a, c, b, b, c, d);
  }
  const bottomCenter = vertices.length / 3;
  vertices.push(...points[0].toArray());
  const topCenter = vertices.length / 3;
  vertices.push(...points.at(-1).toArray());
  for (let side = 0; side < sides; side++) {
    const nextSide = (side + 1) % sides;
    indices.push(bottomCenter, nextSide, side);
    const topStart = (ringCount - 1) * sides;
    indices.push(topCenter, topStart + side, topStart + nextSide);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function geometryNodeContinuousTrunkGeometry(points, baseWidth, sides = 10, { topRatio = .48, rootFlare = 0 } = {}) {
  const radii = points.map((_, ring) => {
    const progress = ring / Math.max(1, points.length - 1);
    const tapered = THREE.MathUtils.lerp(baseWidth * .5, baseWidth * .5 * topRatio, progress);
    return tapered * (ring === 0 ? 1 + rootFlare : 1);
  });
  return geometryNodeTubeGeometry(points, radii, sides, { flatBase: true });
}
function geometryNodeCurvedBranchGeometry(start, end, baseRadius, tipRatio, sides = 10) {
  const direction = end.clone().sub(start);
  const up = new THREE.Vector3(0, Math.max(.08, direction.length() * .08), 0);
  const points = [
    start.clone(),
    start.clone().addScaledVector(direction, .2).addScaledVector(up, .3),
    start.clone().addScaledVector(direction, .58).addScaledVector(up, .2),
    end.clone()
  ];
  const radii = [baseRadius * 1.18, baseRadius, baseRadius * .68, baseRadius * tipRatio];
  return geometryNodeTubeGeometry(points, radii, sides);
}
function geometryNodeSmoothGeometry(sourceGeometry, { iterations = 2, strength = .72, axis = "xyz", preserveSize = true } = {}) {
  const prepared = sourceGeometry.clone();
  for (const attribute of Object.keys(prepared.attributes)) if (attribute !== "position") prepared.deleteAttribute(attribute);
  let geometry = mergeVertices(prepared, 1e-5);
  if (geometry !== prepared) prepared.dispose();
  const affectedAxes = ["x", "y", "z"].map((name, index) => axis.includes(name) ? index : -1).filter(index => index >= 0);
  for (let pass = 0; pass < iterations; pass++) {
    const position = geometry.getAttribute("position");
    const vertices = Array.from({ length: position.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(position, index));
    const indices = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: position.count }, (_, index) => index);
    const neighbors = vertices.map(() => new Set());
    const edges = new Map();
    const edge = (a, b, opposite) => {
      neighbors[a].add(b);
      neighbors[b].add(a);
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const record = edges.get(key) || { a: Math.min(a, b), b: Math.max(a, b), opposite: [] };
      record.opposite.push(opposite);
      edges.set(key, record);
    };
    for (let index = 0; index < indices.length; index += 3) {
      const [a, b, c] = indices.slice(index, index + 3);
      edge(a, b, c); edge(b, c, a); edge(c, a, b);
    }
    const blendAxes = (base, target) => {
      const result = base.clone();
      for (const component of affectedAxes) result.setComponent(component, THREE.MathUtils.lerp(base.getComponent(component), target.getComponent(component), strength));
      return result;
    };
    const nextVertices = vertices.map((vertex, index) => {
      const adjacent = [...neighbors[index]];
      if (adjacent.length < 3) return vertex.clone();
      const beta = adjacent.length === 3 ? 3 / 16 : 3 / (8 * adjacent.length);
      const target = vertex.clone().multiplyScalar(1 - adjacent.length * beta);
      adjacent.forEach(neighbor => target.addScaledVector(vertices[neighbor], beta));
      return blendAxes(vertex, target);
    });
    const edgeIndexes = new Map();
    for (const [key, record] of edges) {
      const midpoint = vertices[record.a].clone().add(vertices[record.b]).multiplyScalar(.5);
      let target = midpoint;
      if (record.opposite.length === 2) target = vertices[record.a].clone().add(vertices[record.b]).multiplyScalar(3 / 8)
        .addScaledVector(vertices[record.opposite[0]], 1 / 8).addScaledVector(vertices[record.opposite[1]], 1 / 8);
      edgeIndexes.set(key, nextVertices.length);
      nextVertices.push(blendAxes(midpoint, target));
    }
    const edgeIndex = (a, b) => edgeIndexes.get(a < b ? `${a}:${b}` : `${b}:${a}`);
    const nextIndices = [];
    for (let index = 0; index < indices.length; index += 3) {
      const [a, b, c] = indices.slice(index, index + 3);
      const ab = edgeIndex(a, b), bc = edgeIndex(b, c), ca = edgeIndex(c, a);
      nextIndices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    if (preserveSize) {
      const before = new THREE.Box3().setFromPoints(vertices);
      const after = new THREE.Box3().setFromPoints(nextVertices);
      const beforeCenter = before.getCenter(new THREE.Vector3());
      const afterCenter = after.getCenter(new THREE.Vector3());
      for (const component of affectedAxes) {
        const beforeSpan = before.max.getComponent(component) - before.min.getComponent(component);
        const afterSpan = after.max.getComponent(component) - after.min.getComponent(component);
        if (afterSpan <= 1e-8) continue;
        const scale = beforeSpan / afterSpan;
        nextVertices.forEach(vertex => vertex.setComponent(component, beforeCenter.getComponent(component) + (vertex.getComponent(component) - afterCenter.getComponent(component)) * scale));
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(nextVertices.flatMap(vertex => vertex.toArray()), 3));
    next.setIndex(nextIndices);
    next.computeVertexNormals();
    next.computeBoundingBox();
    next.computeBoundingSphere();
    geometry.dispose();
    geometry = next;
  }
  return geometry;
}
function geometryNodeActiveNodeIds(graph) {
  const active = new Set();
  const outputId = graph.nodeOrder.find(nodeId => geometryNodeTypeForId(graph, nodeId) === "output");
  const stack = outputId ? [outputId] : [];
  while (stack.length) {
    const nodeId = stack.pop();
    if (active.has(nodeId)) continue;
    active.add(nodeId);
    graph.connections.filter(connection => connection.toNodeId === nodeId).forEach(connection => stack.push(connection.fromNodeId));
  }
  return active;
}
function geometryNodeSmoothModifiers(graph, targetId, activeNodeIds = geometryNodeActiveNodeIds(graph)) {
  const result = [];
  const visited = new Set();
  const walk = nodeId => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    for (const connection of graph.connections.filter(item => item.fromNodeId === nodeId)) {
      if (!activeNodeIds.has(connection.toNodeId) || geometryNodeTypeForId(graph, connection.toNodeId) !== "smoothGeometry") continue;
      const modifier = graph.smoothNodes.find(node => node.id === connection.toNodeId);
      if (modifier) result.push(modifier);
      walk(connection.toNodeId);
    }
  };
  walk(targetId);
  return result;
}
function geometryNodeApplySmoothModifiers(sourceGeometry, modifiers) {
  let geometry = sourceGeometry;
  for (const modifier of modifiers) {
    const smoothed = geometryNodeSmoothGeometry(geometry, modifier.params);
    geometry.dispose();
    geometry = smoothed;
  }
  return geometry;
}
function geometryNodeGeneratedTarget(name) {
  if (/ Mesh primitive /.test(name)) return "primitive";
  if (/ Rock /.test(name)) return "rocks";
  if (/ Wall stone /.test(name)) return "stoneWall";
  if (/ Grass sheets/.test(name)) return "grass";
  if (/ Moss /.test(name)) return "moss";
  if (/ Stem continuous/.test(name)) return "stem";
  if (/ Branch array /.test(name)) return "branchArray";
  if (/ Cluster scatter /.test(name)) return "clusterScatter";
  if (/ Junction blend /.test(name)) return "junctionBlend";
  if (/ Root /.test(name)) return "roots";
  if (/ Trunk /.test(name)) return "trunk";
  if (/ Branch /.test(name)) return "branches";
  if (/ Twig /.test(name)) return "twigs";
  if (/ Canopy | Snow /.test(name)) return "canopy";
  if (/ Joint blend /.test(name)) return "smoothJoints";
  if (/ Knot /.test(name)) return "knot";
  if (/ Cut ring /.test(name)) return "cutSurface";
  return null;
}
function geometryNodeTextureSourceParams(graph, nodeId, visited = new Set()) {
  if (!graph || visited.has(nodeId) || visited.size >= 8) return null;
  const next = new Set(visited); next.add(nodeId);
  const type = geometryNodeTypeForId(graph, nodeId);
  const p = graph.nodeParams?.[nodeId] || graph.params;
  if(type==="colorPalette"){
   const link=graph.connections.find(c=>c.toNodeId===nodeId&&(Number(c.toInputIndex)||0)===0),input=link?geometryNodeTextureSourceParams(graph,link.fromNodeId,next):null;
   const textures=input?.textureChoices?.length?input.textureChoices:[input||{}],count=Math.round(geometryNodeNumber(p.paletteCount,4,1,4)),choices=[];
   for(let i=1;i<=count;i++)for(const texture of textures)choices.push({...texture,materialColor:geometryNodePaletteColor(p,i),textureChoices:undefined});
   return {...choices[0],textureChoices:choices.slice(0,128),texturePoolSeed:input?.texturePoolSeed||0,texturePoolUvs:input?.texturePoolUvs??input?.textureRandomize??false,texturePoolVariation:input?.texturePoolVariation??input?.textureVariation??0};
  }
  if (type === "textureInput") return p?.textureData ? p : null;
  if (type !== "textureRandomizer") return null;
  const choices = [];
  const links = (graph.connections || []).filter(c => c.toNodeId === nodeId).sort((a,b)=>(Number(a.toInputIndex)||0)-(Number(b.toInputIndex)||0));
  for (const link of links) {
    const input = geometryNodeTextureSourceParams(graph, link.fromNodeId, next);
    if (input?.textureChoices) choices.push(...input.textureChoices);
    else if (input?.textureData||input?.materialColor) choices.push(input);
    if (choices.length >= 32) break;
  }
  if (!choices.length) return null;
  // First image keeps legacy texture-presence guards compatible. Selection is per mesh below.
  return {...choices[0], textureChoices:choices.slice(0,32), textureRandomize:false,
    texturePoolSeed:Math.round(geometryNodeNumber(p.texturePoolSeed,0,0,999999)),
    texturePoolUvs:p.texturePoolUvs !== false,
    texturePoolVariation:geometryNodeNumber(p.texturePoolVariation,.75,0,1)};
}
function geometryNodeTextureInputParams(graph, targetId, inputIndex = 1) {
  const connection = graph?.connections?.find(c => c.toNodeId === targetId && (Number(c.toInputIndex)||0) === inputIndex);
  return connection ? geometryNodeTextureSourceParams(graph, connection.fromNodeId) : null;
}
function geometryNodeTexturePartSeed(graph, targetId, name, offset = 0) {
  let hash = ((Number(graph?.seed)||0) + offset) >>> 0;
  for (const c of String(targetId) + ":" + String(name)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
function geometryNodePickPartTexture(params, graph, targetId, name) {
  if (!params?.textureChoices?.length) return params;
  const random = geometryNodePrng(geometryNodeTexturePartSeed(graph,targetId,name,params.texturePoolSeed));
  const choice = params.textureChoices[Math.floor(random()*params.textureChoices.length)];
  return {...choice, textureRandomize:params.texturePoolUvs, textureVariation:params.texturePoolVariation};
}
function geometryNodeRandomizeTextureUvs(geometry, random, amount = 1) {
  const uv = geometry?.getAttribute?.("uv");
  const strength = THREE.MathUtils.clamp(Number(amount) || 0, 0, 1);
  if (!uv || strength <= 0) return;
  const turn = Math.floor(random() * 4);
  const cosine = [1, 0, -1, 0][turn];
  const sine = [0, 1, 0, -1][turn];
  const scale = 1 + (random() - .5) * strength * .9;
  const offsetU = (random() - .5) * strength * 1.8;
  const offsetV = (random() - .5) * strength * 1.8;
  const mirrorU = random() < strength * .5 ? -1 : 1;
  const mirrorV = random() < strength * .5 ? -1 : 1;
  for (let index = 0; index < uv.count; index++) {
    const u = (uv.getX(index) - .5) * scale * mirrorU;
    const v = (uv.getY(index) - .5) * scale * mirrorV;
    uv.setXY(index, u * cosine - v * sine + .5 + offsetU, u * sine + v * cosine + .5 + offsetV);
  }
  uv.needsUpdate = true;
}
function geometryNodeTextureSpec(textureName, graph = null, targetId = null, textureParamsOverride = undefined) {
  const textureParams = textureParamsOverride === undefined ? geometryNodeTextureInputParams(graph, targetId) : textureParamsOverride;
  if (textureParams?.textureData) {
    return { textureUrl: textureParams.textureData, textureName: textureParams.textureName || "Embedded texture" };
  }
  const name = String(textureName || "").trim();
  const entry = name && typeof textureLibrary !== "undefined" ? textureLibrary.get(name) : null;
  return { textureUrl: entry?.dataUrl || null, textureName: entry?.name || (name || null) };
}
function geometryNodeCustomSpec(geometry, { name, position, color, group, rotation = [0, 0, 0], roughness = .78, textureName = "", graph = null, targetId = null, textureParams = undefined, textureKey = name }) {
  const sourceTexture = textureParams === undefined ? geometryNodeTextureInputParams(graph,targetId) : textureParams;
  const selectedTexture = geometryNodePickPartTexture(sourceTexture,graph,targetId,textureKey);
  if(selectedTexture?.materialColor)color=selectedTexture.materialColor;
  const assetType = graph ? geometryNodeTypeForId(graph,targetId) : null;
  if ((sourceTexture?.textureChoices || BWS_ASSET_NODES[assetType]) && selectedTexture?.textureData && selectedTexture.textureRandomize !== false) {
    geometryNodeRandomizeTextureUvs(geometry, geometryNodePrng(geometryNodeTexturePartSeed(graph,targetId,textureKey,sourceTexture?.texturePoolSeed || 0)), selectedTexture.textureVariation ?? 1);
  }
  const data = geometryToData(geometry);
  geometry.dispose();
  return { shape: "custom", geometry: data, name, position, rotation, scale: [1, 1, 1], color, roughness, ...geometryNodeTextureSpec(textureName, graph, targetId, selectedTexture), groupId: group.id, groupName: group.name };
}
function geometryNodeInnerPanelSpec(bounds, { name, group, color, roughness = .78, inset = 0.16, axis = "auto" }) {
  if (!bounds || bounds.isEmpty?.()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) return null;
  const padding = Math.max(0, Number(inset) || 0);
  const spanX = Math.max(0.1, size.x - padding * 2);
  const spanY = Math.max(0.1, size.y - padding * 2);
  const spanZ = Math.max(0.1, size.z - padding * 2);
  const spans = [spanX, spanY, spanZ];
  const minSpan = Math.min(...spans);
  const thinAxis = axis === "x" ? 0 : axis === "y" ? 1 : axis === "z" ? 2 : spans.indexOf(minSpan);
  const thickness = Math.max(0.02, minSpan * 0.2);
  const sizeX = thinAxis === 0 ? thickness : spanX;
  const sizeY = thinAxis === 1 ? thickness : spanY;
  const sizeZ = thinAxis === 2 ? thickness : spanZ;
  const geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
  const position = bounds.getCenter(new THREE.Vector3());
  return geometryNodeCustomSpec(geometry, { name, position: position.toArray(), color, roughness, group });
}
function geometryNodeRockGeometry(profile, size, variation, random, wallStone = false) {
  const settings = {
    rounded: { sides: 11, height: .68, depth: .82, rings: [.7, 1, 1.04, .9, .55] },
    jagged: { sides: 7, height: .82, depth: .86, rings: [.68, 1.04, .9, 1, .42] },
    flat: { sides: 9, height: .46, depth: .86, rings: [.78, 1.05, 1, .86, .58] },
    boulder: { sides: 9, height: .96, depth: .9, rings: [.7, .98, 1.04, .88, .48] }
  }[wallStone ? "flat" : profile] || { sides: 9, height: .7, depth: .86, rings: [.7, 1, 1, .85, .5] };
  const vertices = [], uvs = [], indices = [];
  const sideNoise = Array.from({ length: settings.sides }, () => 1 + (random() - .5) * variation * .62);
  const angleOffsets = Array.from({ length: settings.sides }, () => (random() - .5) * Math.PI * 2 / settings.sides * variation * .48);
  // The side strip duplicates side zero at U=1. Keep both UV vertices at the
  // exact same position by sampling deformation once per unique ring/side.
  const ringNoiseByRing = settings.rings.map(() => Array.from(
    { length: settings.sides },
    () => 1 + (random() - .5) * variation * .2
  ));
  const ringShifts = settings.rings.map((_, ring) => ({
    x: (random() - .5) * size * variation * .14 * Math.sin(ring / (settings.rings.length - 1) * Math.PI),
    z: (random() - .5) * size * variation * .14 * Math.sin(ring / (settings.rings.length - 1) * Math.PI)
  }));
  const xStretch = .82 + random() * .42;
  const zStretch = .8 + random() * .4;
  const xBias = (random() - .5) * size * .14;
  const zBias = (random() - .5) * size * .12;
  for (let ring = 0; ring < settings.rings.length; ring++) {
    const t = ring / (settings.rings.length - 1);
    const y = t * settings.height * size;
    for (let side = 0; side <= settings.sides; side++) {
      const wrappedSide = side % settings.sides;
      const angle = wrappedSide / settings.sides * Math.PI * 2 + angleOffsets[wrappedSide];
      const radius = settings.rings[ring] * sideNoise[wrappedSide] * ringNoiseByRing[ring][wrappedSide];
      const crownShift = Math.sin(t * Math.PI) * 1.4;
      vertices.push(
        Math.cos(angle) * size * .56 * xStretch * radius + xBias * crownShift + ringShifts[ring].x,
        y + Math.sin(angle * 2.1 + ring) * size * variation * .025,
        Math.sin(angle) * size * .56 * settings.depth * zStretch * radius + zBias * crownShift + ringShifts[ring].z
      );
      uvs.push(side / settings.sides, t);
    }
  }
  const stride = settings.sides + 1;
  for (let ring = 0; ring < settings.rings.length - 1; ring++) for (let side = 0; side < settings.sides; side++) {
    const a = ring * stride + side, b = a + 1, c = a + stride, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const bottomRim = vertices.length / 3;
  const topRingStart = (settings.rings.length - 1) * stride;
  for (let side = 0; side < settings.sides; side++) {
    const source = side;
    vertices.push(vertices[source * 3], vertices[source * 3 + 1], vertices[source * 3 + 2]);
    const angle = side / settings.sides * Math.PI * 2;
    uvs.push(.5 + Math.cos(angle) * .48, .5 + Math.sin(angle) * .48);
  }
  const topRim = vertices.length / 3;
  for (let side = 0; side < settings.sides; side++) {
    const source = topRingStart + side;
    vertices.push(vertices[source * 3], vertices[source * 3 + 1], vertices[source * 3 + 2]);
    const angle = side / settings.sides * Math.PI * 2;
    uvs.push(.5 + Math.cos(angle) * .48, .5 + Math.sin(angle) * .48);
  }
  const bottomCenter = vertices.length / 3;
  vertices.push(0, 0, 0); uvs.push(.5, .5);
  const topCenter = vertices.length / 3;
  vertices.push(xBias * 1.45, settings.height * size * 1.02, zBias * 1.45); uvs.push(.5, .5);
  for (let side = 0; side < settings.sides; side++) {
    const next = (side + 1) % settings.sides;
    indices.push(bottomCenter, bottomRim + side, bottomRim + next);
    indices.push(topCenter, topRim + next, topRim + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox.min.y, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function geometryNodeMossOverlayGeometry(surface, placement, coverage, thickness, minY, span, random) {
  const position = surface.geometry?.getAttribute("position");
  if (!position) return null;
  const sourceIndices = surface.geometry.index?.array || Array.from({ length: position.count }, (_, index) => index);
  const vertices = [], indices = [], eligible = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let index = 0; index < sourceIndices.length; index += 3) {
    a.fromBufferAttribute(position, sourceIndices[index]);
    b.fromBufferAttribute(position, sourceIndices[index + 1]);
    c.fromBufferAttribute(position, sourceIndices[index + 2]);
    edgeA.subVectors(b, a); edgeB.subVectors(c, a); normal.crossVectors(edgeA, edgeB).normalize();
    if (normal.y < -.15) continue;
    const localY = (a.y + b.y + c.y) / 3;
    const normalized = surface.kind === "rock"
      ? localY / Math.max(.001, surface.size.y)
      : (surface.position.y + localY - minY) / span;
    const inBand = placement === "all"
      || (placement === "bottom" && normalized <= .42)
      || (placement === "middle" && normalized > .26 && normalized < .74)
      || (placement === "top" && normalized >= .56);
    if (!inBand) continue;
    eligible.push({ a: a.clone(), b: b.clone(), c: c.clone(), normal: normal.clone(), area: edgeA.cross(edgeB).length() * .5 });
  }
  if (!eligible.length) return null;
  const patchCount = Math.max(2, Math.round(2 + coverage * 9));
  for (let patch = 0; patch < patchCount; patch++) {
    const face = eligible[Math.floor(random() * eligible.length)];
    const rootA = Math.sqrt(random()), rootB = random();
    const center = face.a.clone().multiplyScalar(1 - rootA)
      .add(face.b.clone().multiplyScalar(rootA * (1 - rootB)))
      .add(face.c.clone().multiplyScalar(rootA * rootB));
    const tangent = face.b.clone().sub(face.a).normalize();
    // Keep this basis right-handed. Reversing tangent/normal mirrors the sphere
    // and turns every visible moss face inward under back-face culling.
    const bitangent = new THREE.Vector3().crossVectors(tangent, face.normal).normalize();
    const sourceLimit = Math.max(.08, Math.min(surface.size.x, surface.size.y, surface.size.z) * .42);
    const radius = THREE.MathUtils.clamp(Math.sqrt(Math.max(.0001, face.area)) * (.3 + random() * .3), .055, sourceLimit);
    const radiusX = radius * (.8 + random() * .55);
    const radiusY = radius * (.62 + random() * .5);
    const radiusNormal = Math.max(thickness * (1.15 + random() * .55), radius * (.42 + random() * .18));
    const patchCenter = center.clone().addScaledVector(face.normal, -radiusNormal * .64);
    const lump = new THREE.SphereGeometry(1, 7, 4);
    const lumpPosition = lump.getAttribute("position");
    const offset = vertices.length / 3;
    for (let vertex = 0; vertex < lumpPosition.count; vertex++) {
      const localX = lumpPosition.getX(vertex), localY = lumpPosition.getY(vertex), localZ = lumpPosition.getZ(vertex);
      const point = patchCenter.clone()
        .addScaledVector(tangent, localX * radiusX)
        .addScaledVector(face.normal, localY * radiusNormal)
        .addScaledVector(bitangent, localZ * radiusY);
      point.y = Math.max(.004 - surface.position.y, point.y);
      vertices.push(point.x, point.y, point.z);
    }
    const lumpIndices = lump.index?.array || Array.from({ length: lumpPosition.count }, (_, index) => index);
    for (const index of lumpIndices) indices.push(offset + Number(index));
    lump.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function geometryNodeCrackMossGeometry(surfaces, placement, density, thickness, minY, span, random) {
  const vertices = [], indices = [];
  const wallSurfaces = surfaces.filter(item => item.kind === "wall");
  const minWallZ = Math.min(...wallSurfaces.map(surface => surface.position.z));
  const maxWallZ = Math.max(...wallSurfaces.map(surface => surface.position.z));
  const hasSeparateFaces = maxWallZ - minWallZ > .05;
  for (const surface of wallSurfaces) {
    const normalized = (surface.position.y + surface.size.y * .5 - minY) / span;
    const inBand = placement === "all"
      || (placement === "bottom" && normalized <= .46)
      || (placement === "middle" && normalized > .24 && normalized < .76)
      || (placement === "top" && normalized >= .54);
    if (!inBand) continue;
    const faceSigns = hasSeparateFaces ? [surface.position.z <= (minWallZ + maxWallZ) * .5 ? -1 : 1] : [-1, 1];
    for (const faceSign of faceSigns) {
      if (random() > density) continue;
      const edge = random() < .78 ? (random() < .5 ? -1 : 1) : 0;
      const center = new THREE.Vector3(
        surface.position.x + edge * surface.size.x * .45 + (random() - .5) * surface.size.x * .14,
        surface.position.y + surface.size.y * (.12 + random() * .72),
        surface.position.z + faceSign * surface.size.z * .24
      );
      const radiusX = Math.max(.065, Math.min(surface.size.x * .34, surface.size.y * (.24 + random() * .3)));
      const radiusY = radiusX * (.68 + random() * .58);
      const lobes = 2 + Math.floor(random() * 4);
      for (let lobe = 0; lobe < lobes; lobe++) {
        const lobeCenter = center.clone().add(new THREE.Vector3((random() - .5) * radiusX * 1.15, (random() - .5) * radiusY * 1.2, faceSign * lobe * .004));
        const radiusDepth = Math.max(thickness * (1.35 + random() * .45), radiusX * (.48 + random() * .16), surface.size.z * .3);
        const lump = new THREE.SphereGeometry(1, 7, 5);
        const lumpPositions = lump.getAttribute("position");
        const offset = vertices.length / 3;
        for (let vertex = 0; vertex < lumpPositions.count; vertex++) {
          const localX = lumpPositions.getX(vertex), localY = lumpPositions.getY(vertex), localZ = lumpPositions.getZ(vertex);
          const wobble = 1 + Math.sin((localX + lobe * .37) * 5.3 + localY * 3.7) * .07;
          vertices.push(
            lobeCenter.x + localX * radiusX * wobble,
            Math.max(.004, lobeCenter.y + localY * radiusY * wobble),
            lobeCenter.z + localZ * radiusDepth * wobble
          );
        }
        const lumpIndices = lump.index?.array || Array.from({ length: lumpPositions.count }, (_, index) => index);
        for (const index of lumpIndices) indices.push(offset + Number(index));
        lump.dispose();
      }
    }
  }
  if (!vertices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function geometryNodeFitGeometry(geometry, sizeX, sizeY, sizeZ) {
  geometry.computeBoundingBox();
  const current = geometry.boundingBox.getSize(new THREE.Vector3());
  geometry.scale(sizeX / Math.max(.001, current.x), sizeY / Math.max(.001, current.y), sizeZ / Math.max(.001, current.z));
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox.min.y, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function geometryNodeGrassGeometry(blades, height, width, random) {
  const vertices = [];
  const indices = [];
  const addTriangle = (a, b, c) => {
    const start = vertices.length / 3;
    vertices.push(...a, ...b, ...c);
    indices.push(start, start + 1, start + 2, start + 2, start + 1, start);
  };
  for (const base of blades) {
    for (let sprout = 0; sprout < 4; sprout++) {
      const angle = sprout / 4 * Math.PI * 2 + random() * .65;
      const bladeHeight = height * (.62 + random() * .62);
      const bladeWidth = width * (.65 + random() * .55);
      const tangent = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const lateral = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(bladeWidth);
      const root = base.clone().addScaledVector(tangent, random() * width * 1.8);
      const middle = root.clone().add(new THREE.Vector3(tangent.x * bladeHeight * .12, bladeHeight * .56, tangent.z * bladeHeight * .12));
      const tip = root.clone().add(new THREE.Vector3(tangent.x * bladeHeight * (.22 + random() * .24), bladeHeight, tangent.z * bladeHeight * (.22 + random() * .24)));
      const rootLeft = root.clone().sub(lateral), rootRight = root.clone().add(lateral);
      const middleLeft = middle.clone().addScaledVector(lateral, -.45), middleRight = middle.clone().addScaledVector(lateral, .45);
      addTriangle(rootLeft.toArray(), rootRight.toArray(), middleLeft.toArray());
      addTriangle(rootRight.toArray(), middleRight.toArray(), middleLeft.toArray());
      addTriangle(middleLeft.toArray(), middleRight.toArray(), tip.toArray());
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function geometryNodeGrassPointBlocked(x, z, surfaces, clearance) {
  return surfaces.some(surface => {
    const angle = -(surface.rotationY || 0);
    const offsetX = x - surface.position.x;
    const offsetZ = z - surface.position.z;
    const localX = offsetX * Math.cos(angle) - offsetZ * Math.sin(angle);
    const localZ = offsetX * Math.sin(angle) + offsetZ * Math.cos(angle);
    const halfX = Math.max(.001, surface.size.x * .5 + clearance);
    const halfZ = Math.max(.001, surface.size.z * .5 + clearance);
    const dx = localX / halfX;
    const dz = localZ / halfZ;
    if (surface.kind === "wall") return Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
    return dx * dx + dz * dz <= 1;
  });
}
function buildGeometryNodeTree({ centerOutput = false, graphOverride = null, previewOnly = false } = {}) {
  const graph = graphOverride || activeGeometryNodeGraph();
  const previewMeshes=new Map();
  const lookupMesh=id=>previewOnly?previewMeshes.get(id):findObject(id);
  if (!graph || !GEOMETRY_NODE_SOURCE_TYPES.some(type => graph.nodeOrder.some(nodeId => geometryNodeTypeForId(graph, nodeId) === type)) || !graph.nodeOrder.some(nodeId => geometryNodeTypeForId(graph, nodeId) === "output")) return;
  // Reject oversized asset graphs before replacing an existing generated result.
  const requestedAssetNodes = geometryNodeActiveNodeIds(graph);
  if (![...requestedAssetNodes].some(id => GEOMETRY_NODE_SOURCE_TYPES.includes(geometryNodeTypeForId(graph,id)))) {
    setGeometryNodeStatus('Nothing generated. Connect a geometry source to Group Output, or choose Cargo Truck template.');
    return;
  }
  if ([...requestedAssetNodes].some(id => geometryNodeTypeForId(graph, id) === "houseBatch")) {if(previewOnly)throw Error("House Batch is not supported as a nature source.");return buildHouseBatch(graph);}
  let assetPartBudget = 0;
  for (const nodeId of requestedAssetNodes) {
    const type = geometryNodeTypeForId(graph, nodeId);
    if (!BWS_ASSET_NODES[type] || BWS_ASSET_NODES[type].attachment) continue;
    const values = assetNodeSanitize(graph.nodeParams?.[nodeId] || graph.params);
    assetPartBudget += type === "houseLayout" ? 2500 : type === "brickWall" ? ((values.brickColumns + 1) * values.brickRows + 1) * values.brickCopies
      : type === "groundTiles" ? values.tileColumns * values.tileRows + 1 : 64;
  }
  if (assetPartBudget > 3000) { setGeometryNodeStatus("Too many asset parts. Reduce counts or build smaller graphs (limit 3000 parts)."); return; }
  if(!previewOnly)recordHistory("build geometry node tree");
  if (centerOutput) graph.centerOutput = true;
  for (const id of previewOnly?[]:graph.generatedIds) {
    const mesh = lookupMesh(id);
    if (mesh) removeObject(mesh, { record: false, update: false });
  }
  const p = graph.params;
  const activeNodeIds = geometryNodeActiveNodeIds(graph);
  const activeNodes = new Set([...activeNodeIds, ...[...activeNodeIds].map(nodeId => geometryNodeTypeForId(graph, nodeId)).filter(Boolean)]);
  const useVariant = activeNodes.has("variant");
  const style = useVariant ? p.variantStyle : "classic";
  const season = useVariant ? p.variantSeason : "summer";
  const maturity = useVariant ? p.variantMaturity : "mature";
  const maturityProfile = {
    sapling: { height: .48, width: .55, branches: .45, canopy: .62 },
    young: { height: .74, width: .72, branches: .72, canopy: .82 },
    mature: { height: 1, width: 1, branches: 1, canopy: 1 },
    ancient: { height: 1.12, width: 1.42, branches: 1.34, canopy: 1.2 }
  }[maturity];
  const styleProfile = {
    classic: { height: 1, width: 1, branches: 1, branchLength: 1, canopy: 1, density: 1 },
    broad: { height: .88, width: 1.18, branches: 1.15, branchLength: 1.35, canopy: 1.18, density: 1.12 },
    round: { height: .92, width: 1, branches: .86, branchLength: 1.05, canopy: 1.35, density: 1.18 },
    tall: { height: 1.32, width: .72, branches: 1.22, branchLength: .7, canopy: .82, density: 1 },
    sparse: { height: 1.08, width: .82, branches: .62, branchLength: .86, canopy: .72, density: .5 },
    bare: { height: 1.05, width: 1.08, branches: 1.28, branchLength: 1.08, canopy: 0, density: 0 }
  }[style];
  const variation = useVariant ? .35 + p.variantAmount * 1.3 : 1;
  const usesGenericStem = activeNodes.has("stem");
  const usesGenericBranches = activeNodes.has("branchArray");
  const usesGenericClusters = activeNodes.has("clusterScatter");
  const effectiveHeight = usesGenericStem ? p.stemHeight : p.height * maturityProfile.height * styleProfile.height;
  const effectiveTrunkWidth = usesGenericStem ? p.stemBaseRadius * 2 : p.trunkWidth * maturityProfile.width * styleProfile.width;
  const effectiveTrunkSegments = usesGenericStem ? p.stemSegments : p.trunkSegments;
  const effectiveBranchCount = usesGenericBranches ? p.branchArrayCount : Math.max(0, Math.round(p.branchCount * maturityProfile.branches * styleProfile.branches));
  const effectiveBranchLength = usesGenericBranches ? p.branchArrayLength : p.branchLength * maturityProfile.height * styleProfile.branchLength;
  const effectiveCanopySize = p.canopySize * maturityProfile.canopy * styleProfile.canopy;
  const effectiveCanopyDensity = Math.max(1, Math.round(p.canopyDensity * styleProfile.density));
  const canopyColors = {
    spring: ["#79a94d", "#a0c95b", "#5f963e"],
    summer: ["#3f7437", "#568843", "#315f31"],
    autumn: ["#b64a2b", "#dd7728", "#e4a52b", "#8f3028"],
    winter: ["#23464a", "#315c5b", "#1d383d"],
    snowy: ["#3b7045", "#527f50", "#2e5c3d"]
  }[season];
  graph.buildVersion += 1;
  const outputName = String(p.outputName || graph.name || "Procedural Geometry").trim() || "Procedural Geometry";
  graph.name = outputName;
  const groupId = `geometry-nodes-${graph.id}`;
  const existingGroup = previewOnly?null:groupRecord(groupId);
  const group = existingGroup || (previewOnly?{id:groupId,name:outputName}:createSceneGroupRecord({ id: groupId, name: outputName }));
  group.name = outputName;
  const random = geometryNodePrng(graph.seed);
  const generated = [];
  const natureSurfaces = [];
  const addGenerated = spec => {
    const mesh = previewOnly?geometryNodePreviewMesh(spec,previewMeshes):addObject(spec, { record: false, select: false, update: false });
    generated.push(mesh.userData.id);
    return mesh;
  };
  for (const nodeId of graph.nodeOrder) {
    const type = geometryNodeTypeForId(graph, nodeId);
    if (!activeNodeIds.has(nodeId) || !BWS_ASSET_NODES[type] || BWS_ASSET_NODES[type].attachment) continue;
    assetNodeBuild(type, graph.nodeParams?.[nodeId] || graph.params, {
      graph, nodeId, group, outputName, attachments:buildingAttachments(graph,nodeId,activeNodeIds),
      emit: spec => { const mesh = addGenerated(spec); mesh.userData.geometryNodeSourceId = nodeId; }
    });
  }
  if (activeNodes.has("primitive")) addGenerated({
    shape: p.primitiveShape, name: `${outputName} Mesh primitive 1`, position: [0, p.primitiveSizeY * .5, 0], rotation: [0, 0, 0],
    scale: [p.primitiveSizeX, p.primitiveSizeY, p.primitiveSizeZ], color: p.primitiveColor, roughness: .82,
    groupId: group.id, groupName: group.name
  });
  if (activeNodes.has("rocks")) {
    const count = p.rockArrangement === "single" ? 1 : p.rockCount;
    const stackSlots = [];
    const clusterSlots = [];
    const stackPlaced = [];
    const rockMeshes = [];
    const rockPalette = [p.rockColor, p.rockColorSecondary, p.rockColorTertiary].map(color => new THREE.Color(color));
    const rockTextureParams = geometryNodeTextureInputParams(graph, "rocks");
    if (p.rockArrangement === "stack") {
      let remaining = count;
      const baseCount = Math.max(1, Math.ceil((Math.sqrt(8 * count + 1) - 1) / 2));
      for (let layer = 0; remaining > 0; layer++) {
        const layerCount = Math.min(Math.max(1, baseCount - layer), remaining);
        for (let inLayer = 0; inLayer < layerCount; inLayer++) stackSlots.push({ layer, inLayer, layerCount });
        remaining -= layerCount;
      }
    }
    for (let index = 0; index < count; index++) {
      const sizeSample = Math.pow(random(), 1.35);
      let scale = p.rockSize * (.42 + sizeSample * (1.08 + p.rockVariation * .36));
      let x = 0, z = 0, y = 0;
      if (p.rockArrangement === "stack") {
        const { layer, inLayer, layerCount } = stackSlots[index];
        scale *= Math.max(.58, 1.16 - layer * .16);
      }
      const geometry = geometryNodeRockGeometry(p.rockProfile, scale, p.rockVariation, random);
      if (rockTextureParams?.textureData && rockTextureParams.textureRandomize !== false) geometryNodeRandomizeTextureUvs(geometry, random, rockTextureParams.textureVariation);
      const bounds = geometry.boundingBox.getSize(new THREE.Vector3());
      if (p.rockArrangement === "line") x = (index - (count - 1) / 2) * p.rockSpacing * p.rockSize;
      else if (p.rockArrangement === "cluster" && index) {
        const anchor = clusterSlots[Math.floor(random() * clusterSlots.length)];
        const angle = random() * Math.PI * 2;
        const footprintRadius = Math.max(bounds.x, bounds.z) * .5;
        const distance = (anchor.radius + footprintRadius) * (.58 + random() * .28);
        x = anchor.x + Math.cos(angle) * distance;
        z = anchor.z + Math.sin(angle) * distance;
      } else if (p.rockArrangement === "stack") {
        const { layer, inLayer, layerCount } = stackSlots[index];
        x = (inLayer - (layerCount - 1) / 2) * p.rockSize * p.rockSpacing * .66 + (random() - .5) * p.rockSize * .055;
        z = (random() - .5) * p.rockSize * .1;
        if (layer) {
          let supports = stackPlaced.filter(item => item.layer === layer - 1 && Math.abs(item.x - x) <= (item.width + bounds.x) * .54);
          if (!supports.length) {
            const candidates = stackPlaced.filter(item => item.layer === layer - 1);
            supports = candidates.sort((left, right) => Math.abs(left.x - x) - Math.abs(right.x - x)).slice(0, 1);
          }
          const supportTop = Math.min(...supports.map(item => item.y + item.height));
          const overlap = Math.min(bounds.y, ...supports.map(item => item.height)) * (.16 + random() * .08);
          y = Math.max(0, supportTop - overlap);
        }
        stackPlaced.push({ layer, x, z, y, width: bounds.x, height: bounds.y, depth: bounds.z });
      }
      if (p.rockArrangement === "cluster") clusterSlots.push({ x, z, radius: Math.max(bounds.x, bounds.z) * .5 });
      const position = new THREE.Vector3(x, y, z);
      const rotationY = random() * Math.PI * 2;
      natureSurfaces.push({ kind: "rock", position, size: bounds.clone(), rotationY, geometry: geometry.clone() });
      const shade = rockPalette[Math.floor(random() * rockPalette.length)].clone().offsetHSL((random() - .5) * .018, 0, (random() - .5) * .1);
      rockMeshes.push(addGenerated(geometryNodeCustomSpec(geometry, { name: `${outputName} Rock ${index + 1}`, position: position.toArray(), rotation: [0, THREE.MathUtils.radToDeg(rotationY), 0], color: `#${shade.getHexString()}`, roughness: .94, textureName: p.rockTextureName, graph, targetId: "rocks", group })));
    }
    if (rockMeshes.length) {
      const clusterBounds = new THREE.Box3().makeEmpty();
      for (const surface of natureSurfaces.filter(surface => surface.kind === "rock")) {
        const positions = surface.geometry.getAttribute("position");
        const cosine = Math.cos(surface.rotationY), sine = Math.sin(surface.rotationY);
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const localX = positions.getX(vertex), localY = positions.getY(vertex), localZ = positions.getZ(vertex);
          clusterBounds.expandByPoint(new THREE.Vector3(
            localX * cosine + localZ * sine + surface.position.x,
            localY + surface.position.y,
            -localX * sine + localZ * cosine + surface.position.z
          ));
        }
      }
      const center = clusterBounds.getCenter(new THREE.Vector3());
      const centerX = center.x, centerZ = center.z;
      for (const surface of natureSurfaces.filter(surface => surface.kind === "rock")) {
        surface.position.x -= centerX;
        surface.position.z -= centerZ;
      }
      for (const mesh of rockMeshes) {
        mesh.position.x -= centerX;
        mesh.position.z -= centerZ;
      }
      clusterBounds.translate(new THREE.Vector3(-centerX, 0, -centerZ));
    }
  }
  if (activeNodes.has("stoneWall")) {
    const wallNodeIds = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === "stoneWall");
    const sharedWallParams = {};
    const wallParamKeys = ["wallLength", "wallHeight", "wallDepth", "wallRows", "wallColumns", "wallDepthLayers", "wallIrregularity", "wallColorVariation", "wallColor", "wallColorSecondary", "wallColorTertiary", "wallTextureName", "wallOverallTextureMix", "natureOutputMode"];
    for (const key of wallParamKeys) sharedWallParams[key] = p[key];
    for (const wallNodeId of wallNodeIds) {
      if (graph.nodeParams?.[wallNodeId]) Object.assign(p, graph.nodeParams[wallNodeId]);
    const wallPalette = [p.wallColor, p.wallColorSecondary, p.wallColorTertiary].map(color => new THREE.Color(color));
    const wallUpperTexture = geometryNodeTextureInputParams(graph, wallNodeId, 1);
    const wallMiddleTexture = geometryNodeTextureInputParams(graph, wallNodeId, 2);
    const wallBottomTexture = geometryNodeTextureInputParams(graph, wallNodeId, 3);
    const wallOverallTexture = geometryNodeTextureInputParams(graph, wallNodeId, 4);
    const wallBounds = new THREE.Box3().makeEmpty();
    const rowHeight = p.wallHeight / p.wallRows;
    const referenceColumns = Math.max(2, Math.round(p.wallColumns * p.wallLength / 7));
    const depthLayers = Math.max(1, p.wallDepthLayers);
    for (let layer = 0; layer < depthLayers; layer++) {
      const layerOffset = depthLayers === 1 ? 0 : THREE.MathUtils.lerp(-p.wallDepth * .24, p.wallDepth * .24, layer / (depthLayers - 1));
      for (let row = 0; row < p.wallRows; row++) {
        const rowRatio = p.wallRows <= 1 ? 0 : row / (p.wallRows - 1);
        const wallZoneTexture = rowRatio >= .67 ? wallUpperTexture : rowRatio >= .34 ? wallMiddleTexture : wallBottomTexture;
        const courseCount = Math.max(3, Math.round(referenceColumns * (.78 + rowRatio * .24) + (random() - .5) * 2));
        const nominalWidth = p.wallLength / courseCount;
        const overlap = nominalWidth * (.035 + p.wallIrregularity * .025);
        const usableWidth = p.wallLength + overlap * (courseCount - 1);
        const widthWeights = Array.from({ length: courseCount }, () => .7 + Math.pow(random(), 1.25) * (.52 + p.wallIrregularity * .3));
        const weightTotal = widthWeights.reduce((sum, value) => sum + value, 0);
        let cursor = -p.wallLength * .5;
        for (let column = 0; column < courseCount; column++) {
          const stoneWidth = usableWidth * widthWeights[column] / weightTotal;
          const courseHeightBias = 1.08 - rowRatio * .1;
          const stoneHeight = rowHeight * courseHeightBias * (.94 + random() * (.1 + p.wallIrregularity * .1));
          const stoneDepth = p.wallDepth * (depthLayers === 1 ? .92 : (.58 + random() * .12));
          const x = cursor + stoneWidth * .5;
          cursor += stoneWidth - overlap;
          const y = row * rowHeight * .84 + random() * rowHeight * .025;
          const z = layerOffset + (random() - .5) * Math.min(stoneDepth * .12, p.wallDepth * .07);
          const profileRoll = random();
          const stoneProfile = profileRoll < .62 ? "flat" : profileRoll < .86 ? "rounded" : "boulder";
          const geometry = geometryNodeRockGeometry(stoneProfile, 1, Math.min(1, p.wallIrregularity * 1.08), random);
          geometryNodeFitGeometry(geometry, stoneWidth, stoneHeight, stoneDepth);
          const useOverallTexture = wallOverallTexture?.textureData && (!wallZoneTexture?.textureData || random() < p.wallOverallTextureMix);
          const wallTextureParams = useOverallTexture ? wallOverallTexture : wallZoneTexture;
          if (wallTextureParams?.textureData && wallTextureParams.textureRandomize !== false) geometryNodeRandomizeTextureUvs(geometry, random, wallTextureParams.textureVariation);
          const position = new THREE.Vector3(x, y, z);
          const rotationY = THREE.MathUtils.degToRad((random() - .5) * (4 + p.wallIrregularity * 5));
          wallBounds.expandByPoint(position);
          wallBounds.expandByPoint(new THREE.Vector3(
            position.x + stoneWidth,
            position.y + stoneHeight,
            position.z + stoneDepth
          ));
          natureSurfaces.push({ kind: "wall", position, size: new THREE.Vector3(stoneWidth, stoneHeight, stoneDepth), rotationY, geometry: geometry.clone(), outerLayer: layer === 0 || layer === depthLayers - 1 });
          const shade = wallPalette[Math.floor(random() * wallPalette.length)].clone().offsetHSL(
            (random() - .5) * .12 * p.wallColorVariation,
            (random() - .5) * .32 * p.wallColorVariation,
            (random() - .5) * .34 * p.wallColorVariation
          );
          const shadeHsl = {};
          shade.getHSL(shadeHsl);
          shade.setHSL(shadeHsl.h, THREE.MathUtils.clamp(shadeHsl.s, .025, .32), THREE.MathUtils.clamp(shadeHsl.l, .27, .68));
          if (p.natureOutputMode !== "grass") addGenerated(geometryNodeCustomSpec(geometry, { name: `${outputName} Wall stone ${layer + 1}.${row + 1}.${column + 1}`, position: position.toArray(), rotation: [0, THREE.MathUtils.radToDeg(rotationY), 0], color: `#${shade.getHexString()}`, roughness: .9 + random() * .09, textureName: p.wallTextureName, graph, targetId: wallNodeId, textureParams: wallTextureParams, group }));
        }
      }
    }
    }
    Object.assign(p, sharedWallParams);
  }
  if (activeNodes.has("moss") && natureSurfaces.length) {
    const mossSurfaces = natureSurfaces.filter(surface => surface.kind !== "wall" || surface.outerLayer !== false);
    const minY = Math.min(...mossSurfaces.map(surface => surface.position.y));
    const maxY = Math.max(...mossSurfaces.map(surface => surface.position.y + surface.size.y));
    const span = Math.max(.01, maxY - minY);
    const habitatCoverage = Math.min(1, p.mossCoverage * (.48 + p.mossMoisture * .82) * (1 - p.mossSunlight * .58));
    mossSurfaces.forEach((surface, index) => {
      const surfaceCoverage = habitatCoverage * (1 - p.mossCrackBias * .55);
      if (random() > Math.max(.08, surfaceCoverage)) return;
      const geometry = geometryNodeMossOverlayGeometry(surface, p.mossPlacement, surfaceCoverage, p.mossThickness, minY, span, random);
      if (!geometry) return;
      addGenerated(geometryNodeCustomSpec(geometry, { name: `${outputName} Moss ${index + 1}`, position: surface.position.toArray(), rotation: [0, THREE.MathUtils.radToDeg(surface.rotationY), 0], color: p.mossColor, roughness: 1, group }));
    });
    const crackGeometry = geometryNodeCrackMossGeometry(mossSurfaces, p.mossPlacement, habitatCoverage * p.mossCrackBias, p.mossThickness, minY, span, random);
    if (crackGeometry) addGenerated(geometryNodeCustomSpec(crackGeometry, { name: `${outputName} Moss cracks`, position: [0, 0, 0], color: p.mossColor, roughness: 1, group }));
  }
  natureSurfaces.forEach(surface => surface.geometry?.dispose());
  if (activeNodes.has("grass") && natureSurfaces.length) {
    const grassNodeIds = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === "grass");
    const sharedGrassParams = {};
    const grassParamKeys = ["grassCount", "grassHeight", "grassWidth", "grassSpread", "grassAvoidGeometry", "grassClearance", "grassGrowNegativeX", "grassGrowPositiveX", "grassGrowNegativeZ", "grassGrowPositiveZ", "grassColor"];
    for (const key of grassParamKeys) sharedGrassParams[key] = p[key];
    for (const grassNodeId of grassNodeIds) {
      if (graph.nodeParams?.[grassNodeId]) Object.assign(p, graph.nodeParams[grassNodeId]);
    const blades = [];
    const grassSides = [
      p.grassGrowNegativeZ && { axis: "z", sign: -1 },
      p.grassGrowPositiveZ && { axis: "z", sign: 1 },
      p.grassGrowNegativeX && { axis: "x", sign: -1 },
      p.grassGrowPositiveX && { axis: "x", sign: 1 }
    ].filter(Boolean);
    const natureBounds = natureSurfaces.reduce((bounds, surface) => {
      const halfX = surface.size.x * .5;
      const halfZ = surface.size.z * .5;
      bounds.minX = Math.min(bounds.minX, surface.position.x - halfX);
      bounds.maxX = Math.max(bounds.maxX, surface.position.x + halfX);
      bounds.minZ = Math.min(bounds.minZ, surface.position.z - halfZ);
      bounds.maxZ = Math.max(bounds.maxZ, surface.position.z + halfZ);
      return bounds;
    }, { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    const bladeReach = p.grassWidth * 2 + p.grassHeight * .12;
    const clearance = p.grassClearance + bladeReach;
    const maxAttempts = Math.max(40, p.grassCount * 36);
    for (let attempt = 0; grassSides.length && blades.length < p.grassCount && attempt < maxAttempts; attempt++) {
      const growthSide = grassSides[attempt % grassSides.length];
      const outside = clearance + random() * p.grassSpread;
      const x = growthSide.axis === "x"
        ? (growthSide.sign < 0 ? natureBounds.minX - outside : natureBounds.maxX + outside)
        : THREE.MathUtils.lerp(natureBounds.minX, natureBounds.maxX, random());
      const z = growthSide.axis === "z"
        ? (growthSide.sign < 0 ? natureBounds.minZ - outside : natureBounds.maxZ + outside)
        : THREE.MathUtils.lerp(natureBounds.minZ, natureBounds.maxZ, random());
      if (p.grassAvoidGeometry && geometryNodeGrassPointBlocked(x, z, natureSurfaces, clearance)) continue;
      blades.push(new THREE.Vector3(x, .015, z));
    }
    if (blades.length) addGenerated(geometryNodeCustomSpec(geometryNodeGrassGeometry(blades, p.grassHeight, p.grassWidth, random), { name: `${outputName} Grass sheets ${grassNodeId}`, position: [0, 0, 0], color: p.grassColor, group }));
    }
    Object.assign(p, sharedGrassParams);
  }
  if (activeNodes.has("primitiveTest")) {
    const smoothModifiers = geometryNodeSmoothModifiers(graph, "primitiveTest", activeNodeIds);
    const testShapes = [
      ["Cube", () => new THREE.BoxGeometry(1.5, 1.5, 1.5)],
      ["Pentagon", () => new THREE.CylinderGeometry(.82, .82, 1.55, 5, 1, false)],
      ["Low cone", () => new THREE.ConeGeometry(.9, 1.7, 5, 1, false)]
    ];
    testShapes.forEach(([label, createGeometry], index) => {
      const x = (index - 1) * 2.6;
      const original = createGeometry();
      addGenerated(geometryNodeCustomSpec(original, { name: `${outputName} QA ${label} original`, position: [x, 1, -2], color: "#a85a3a", group }));
      const result = geometryNodeApplySmoothModifiers(createGeometry(), smoothModifiers);
      addGenerated(geometryNodeCustomSpec(result, { name: `${outputName} QA ${label} ${smoothModifiers.length ? "smoothed" : "copy"}`, position: [x, 1, 2], color: "#40a783", group }));
    });
  }
  if (activeNodes.has("roots")) {
    for (let index = 0; index < p.rootCount; index++) {
      const angle = index * Math.PI * 2 / p.rootCount + (random() - .5) * .28;
      const length = p.rootLength * (.78 + random() * .38);
      const start = new THREE.Vector3(0, p.rootThickness * .38, 0);
      const end = new THREE.Vector3(Math.cos(angle) * length, .04, Math.sin(angle) * length);
      addGenerated(geometryNodeSegmentSpec({
        shape: "pyramidFrustum", name: `${outputName} Root ${index + 1}`, start, end,
        width: p.rootThickness * (.8 + random() * .35), color: index % 2 ? "#593523" : "#68402a", group
      }));
    }
  }
  const trunkPoints = [new THREE.Vector3(0, 0, 0)];
  const segmentHeight = effectiveHeight / effectiveTrunkSegments;
  for (let index = 1; index <= effectiveTrunkSegments; index++) {
    const previous = trunkPoints[index - 1];
    const lean = index / effectiveTrunkSegments;
    trunkPoints.push(new THREE.Vector3(
      previous.x + (random() - .5) * (usesGenericStem ? p.stemLean : (activeNodes.has("bend") ? p.trunkBend : .22)) * lean * variation,
      index * segmentHeight,
      previous.z + (random() - .5) * (usesGenericStem ? p.stemLean : (activeNodes.has("bend") ? p.trunkBend : .22)) * lean * variation
    ));
  }
  if (activeNodes.has("trunk") || usesGenericStem) addGenerated(geometryNodeCustomSpec(
    geometryNodeContinuousTrunkGeometry(trunkPoints, effectiveTrunkWidth, usesGenericStem ? p.stemSides : (activeNodes.has("smoothJoints") ? 12 : 8), {
      topRatio: usesGenericStem ? p.stemTopRadius / Math.max(.001, p.stemBaseRadius) : .48,
      rootFlare: usesGenericStem ? p.stemFlare : 0
    }),
    { name: `${outputName} ${usesGenericStem ? "Stem" : "Trunk"} continuous`, position: [0, 0, 0], color: usesGenericStem ? p.stemColor : "#65402b", group }
  ));
  const branchTips = [];
  const branchJoints = [];
  if (activeNodes.has("branches") || usesGenericBranches) for (let index = 0; index < effectiveBranchCount; index++) {
    const vertical = effectiveBranchCount <= 1 ? .72 : .3 + index / Math.max(1, effectiveBranchCount - 1) * .58;
    const trunkIndex = Math.max(1, Math.min(effectiveTrunkSegments - 1, Math.round(vertical * effectiveTrunkSegments)));
    const start = trunkPoints[trunkIndex].clone();
    const angle = index * (Math.PI * 2 / Math.max(1, effectiveBranchCount)) + THREE.MathUtils.degToRad(usesGenericBranches ? p.branchArrayTwist : 0) + (random() - .5) * .7 * variation;
    const elevation = usesGenericBranches ? Math.atan(p.branchArrayRise) : THREE.MathUtils.degToRad(90 - p.branchSpread + (random() - .5) * 18 * variation);
    const length = effectiveBranchLength * (.82 + (random() - .5) * .48 * variation) * (1.08 - vertical * .24);
    const horizontal = Math.cos(elevation) * length;
    const end = start.clone().add(new THREE.Vector3(Math.cos(angle) * horizontal, Math.sin(elevation) * length, Math.sin(angle) * horizontal));
    const branchRadius = usesGenericBranches ? p.branchArrayRadius * (1.08 - vertical * .26) : effectiveTrunkWidth * (.25 + (1 - vertical) * .13) * .5;
    if (usesGenericBranches) addGenerated(geometryNodeCustomSpec(
      geometryNodeCurvedBranchGeometry(start, end, branchRadius, p.branchArrayTaper, Math.max(7, Math.min(18, p.stemSides))),
      { name: `${outputName} Branch array ${index + 1}`, position: [0, 0, 0], color: p.branchColor, group }
    ));
    else addGenerated(geometryNodeSegmentSpec({ shape: "cylinder", name: `${outputName} Branch ${index + 1}`, start, end, width: branchRadius * 2, color: "#603a28", group }));
    branchJoints.push({ position: start.clone(), size: usesGenericBranches ? branchRadius : effectiveTrunkWidth * (.42 - vertical * .08), direction: end.clone().sub(start).normalize() });
    branchTips.push(end);
    if (activeNodes.has("twigs")) {
      const twigStart = start.clone().lerp(end, .62);
      const twigAngle = angle + (random() > .5 ? 1 : -1) * (.45 + random() * .5);
      const twigLength = length * p.twigLength * (.8 + random() * .4);
      const twigEnd = twigStart.clone().add(new THREE.Vector3(Math.cos(twigAngle) * twigLength * .65, twigLength * p.twigRise, Math.sin(twigAngle) * twigLength * .65));
      addGenerated(geometryNodeSegmentSpec({ shape: "cylinder", name: `${outputName} Twig ${index + 1}`, start: twigStart, end: twigEnd, width: effectiveTrunkWidth * .14, color: "#563223", group }));
      branchJoints.push({ position: twigStart, size: effectiveTrunkWidth * .14 });
      branchTips.push(twigEnd);
    }
  }
  if (activeNodes.has("smoothJoints")) {
    const smoothPoints = [...branchJoints];
    if (p.jointTrunkSeams) for (let index = 1; index < trunkPoints.length - 1; index++) {
      smoothPoints.push({ position: trunkPoints[index], size: effectiveTrunkWidth * (1 - index / effectiveTrunkSegments * .52) * .46 });
    }
    smoothPoints.forEach(({ position, size }, index) => addGenerated({
      shape: "sphere", name: `${outputName} Joint blend ${index + 1}`, position: position.toArray(), rotation: [0, 0, 0],
      scale: [size * p.jointSize / .55, size * p.jointSize * 1.28 / .55, size * p.jointSize / .55],
      color: index % 2 ? "#65402d" : "#6b4631", roughness: .84, groupId: group.id, groupName: group.name
    }));
  }
  if (activeNodes.has("junctionBlend")) branchJoints.forEach(({ position, size, direction }, index) => {
    const branchDirection = direction || new THREE.Vector3(0, 1, 0);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), branchDirection), "XYZ");
    const collarRadius = size * p.junctionBlendSize;
    addGenerated({
      shape: "sphere", name: `${outputName} Junction blend ${index + 1}`,
      position: position.clone().addScaledVector(branchDirection, collarRadius * .32).toArray(),
      rotation: [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg),
      scale: [collarRadius / .55, collarRadius * p.junctionBlendLength / .55, collarRadius / .55],
      color: usesGenericBranches ? p.branchColor : "#65402d", roughness: .82, groupId: group.id, groupName: group.name
    });
  });
  if ((activeNodes.has("canopy") || usesGenericClusters) && (usesGenericClusters || p.canopyEnabled) && (usesGenericClusters || styleProfile.canopy > 0)) {
    const crown = trunkPoints.at(-1);
    const canopyPoints = [crown, ...branchTips.filter((_, index) => index % 2 === 0)];
    const totalClusters = usesGenericClusters ? p.clusterScatterCount : canopyPoints.length * effectiveCanopyDensity;
    for (let clusterIndex = 0; clusterIndex < totalClusters; clusterIndex++) {
        const pointIndex = clusterIndex % canopyPoints.length;
        const density = Math.floor(clusterIndex / canopyPoints.length);
        const point = canopyPoints[pointIndex];
        const sizeBase = usesGenericClusters ? p.clusterScatterSize : effectiveCanopySize;
        const spread = usesGenericClusters ? p.clusterScatterSpread : sizeBase;
        const size = sizeBase * (.88 + (random() - .5) * .42 * variation);
        const position = point.clone().add(new THREE.Vector3((random() - .5) * spread, (random() - .25) * spread * .65, (random() - .5) * spread));
        addGenerated({
          shape: "facetedBallLow", name: `${outputName} ${usesGenericClusters ? "Cluster scatter" : "Canopy"} ${pointIndex + 1}.${density + 1}`,
          position: position.toArray(), rotation: [random() * 35, random() * 360, random() * 35],
          scale: [size * (1 + random() * .24), size * (.85 + random() * .32), size * (1 + random() * .24)],
          color: usesGenericClusters ? p.clusterScatterColor : canopyColors[(pointIndex + density) % canopyColors.length], roughness: .9,
          groupId: group.id, groupName: group.name
        });
        if (!usesGenericClusters && season === "snowy") addGenerated({
          shape: "facetedBallLow", name: `${outputName} Snow ${pointIndex + 1}.${density + 1}`,
          position: position.clone().add(new THREE.Vector3(0, size * .48, 0)).toArray(), rotation: [0, random() * 360, 0],
          scale: [size * .78, size * .24, size * .78], color: density % 2 ? "#f2f5ed" : "#dce8e5", roughness: 1,
          groupId: group.id, groupName: group.name
        });
    }
  }
  if (activeNodes.has("knot")) for (let index = 0; index < p.knotCount; index++) {
    const vertical = .2 + (index + .5) / p.knotCount * .62;
    const segmentIndex = Math.min(effectiveTrunkSegments - 1, Math.floor(vertical * effectiveTrunkSegments));
    const localT = vertical * effectiveTrunkSegments - segmentIndex;
    const taper = 1 - vertical * .52;
    const point = trunkPoints[segmentIndex].clone().lerp(trunkPoints[segmentIndex + 1], localT);
    const angle = index * Math.PI * 2 / p.knotCount + (random() - .5) * .7;
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const surfaceRadius = effectiveTrunkWidth * taper * .5;
    const knotRadius = Math.max(.055, effectiveTrunkWidth * taper * p.knotSize);
    const faceCenter = point.clone().addScaledVector(radial, surfaceRadius - p.knotInset);
    const stubStart = point.clone().addScaledVector(radial, Math.max(.02, surfaceRadius - knotRadius * .9));
    addGenerated(geometryNodeSegmentSpec({
      shape: "cylinder", name: `${outputName} Knot ${index + 1} inward branch`, start: stubStart, end: faceCenter.clone().addScaledVector(radial, .012),
      width: knotRadius * 1.7, color: "#583522", group
    }));
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial), "XYZ");
    const rotationDegrees = [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg);
    for (let ring = 0; ring < p.knotRings; ring++) {
      const progress = ring / Math.max(1, p.knotRings - 1);
      const radius = knotRadius * (1 - progress * .76);
      addGenerated({
        shape: "cylinder", name: `${outputName} Knot ${index + 1} cut ring ${ring + 1}`,
        position: faceCenter.clone().addScaledVector(radial, .018 + ring * .006).toArray(), rotation: rotationDegrees,
        scale: [radius * 2 / .96, .018, radius * 2 / .96], color: ring % 2 ? "#81502e" : "#c28a4d", roughness: .92,
        groupId: group.id, groupName: group.name
      });
    }
  }
  if (activeNodes.has("cutSurface")) {
    const outerRadius = effectiveTrunkWidth * .52;
    const paleWood = new THREE.Color("#c58b4e");
    const darkWood = new THREE.Color("#694126");
    for (let index = 0; index < p.cutRingCount; index++) {
      const progress = index / Math.max(1, p.cutRingCount - 1);
      const radius = outerRadius * (1 - progress * .86);
      const ringColor = paleWood.clone().lerp(darkWood, (index % 2 ? .3 : .08) + p.cutRingContrast * (index % 2 ? .48 : .16));
      addGenerated({
        shape: "cylinder", name: `${outputName} Cut ring ${index + 1}`,
        position: [trunkPoints[0].x, -p.cutRingDepth * (.52 + index * .12), trunkPoints[0].z], rotation: [0, 0, 0],
        scale: [radius * 2 / .96, p.cutRingDepth, radius * 2 / .96], color: `#${ringColor.getHexString()}`, roughness: .92,
        groupId: group.id, groupName: group.name
      });
    }
  }
  if (activeNodes.has("join") && p.joinAddInnerPanel) {
    const joinedBounds = new THREE.Box3().makeEmpty();
    const wallIds = generated.filter(id => {
      const mesh = lookupMesh(id);
      return mesh && geometryNodeGeneratedTarget(mesh.name) === "stoneWall";
    });
    const boundsIds = wallIds.length ? wallIds : generated.filter(id => {
      const mesh = lookupMesh(id);
      const target = mesh ? geometryNodeGeneratedTarget(mesh.name) : null;
      return target !== "grass" && target !== "moss" && !mesh?.name.includes(" QA ");
    });
    for (const id of boundsIds) {
      const mesh = lookupMesh(id);
      if (mesh) joinedBounds.expandByObject(mesh);
    }
    const panel = geometryNodeInnerPanelSpec(joinedBounds, {
      name: `${outputName} Join inner panel`,
      color: p.joinPanelColor,
      group,
      roughness: .95,
      inset: p.joinPanelInset,
      axis: p.joinPanelAxis
    });
    if (panel) addGenerated(panel);
  }
  for (const id of generated) {
    const mesh = lookupMesh(id);
    if (!mesh || mesh.name.includes(" QA ")) continue;
    const targetId = mesh.userData.geometryNodeSourceId || geometryNodeGeneratedTarget(mesh.name);
    const modifiers = targetId ? geometryNodeSmoothModifiers(graph, targetId, activeNodeIds) : [];
    if (!modifiers.length) continue;
    mesh.geometry = geometryNodeApplySmoothModifiers(mesh.geometry, modifiers);
    mesh.userData.shape = "custom";
    mesh.userData.geometry = geometryToData(mesh.geometry);
  }
  if (activeNodes.has("transform")) {
    const offset = new THREE.Vector3(p.transformX, p.transformY, p.transformZ);
    for (const id of generated) {
      const mesh = lookupMesh(id);
      if (!mesh) continue;
      mesh.position.multiplyScalar(p.transformScale).add(offset);
      mesh.scale.multiplyScalar(p.transformScale);
      mesh.rotation.x += THREE.MathUtils.degToRad(p.transformRotX);
      mesh.rotation.y += THREE.MathUtils.degToRad(p.transformRotY);
      mesh.rotation.z += THREE.MathUtils.degToRad(p.transformRotZ);
    }
  }
  if (graph.centerOutput && generated.length) {
    const bounds = new THREE.Box3().makeEmpty();
    const meshes = generated.map(id => lookupMesh(id)).filter(Boolean);
    for (const mesh of meshes) { mesh.updateWorldMatrix(true, false); bounds.expandByObject(mesh); }
    if (!bounds.isEmpty() && [bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite)) {
      const middle = bounds.getCenter(new THREE.Vector3());
      const shift = new THREE.Vector3(middle.x, bounds.min.y, middle.z);
      for (const mesh of meshes) {
        const position = mesh.getWorldPosition(new THREE.Vector3()).sub(shift);
        if (mesh.parent) mesh.parent.worldToLocal(position);
        mesh.position.copy(position); mesh.updateMatrixWorld(true);
      }
    }
  }
  if(previewOnly){for(const surface of natureSurfaces)surface.geometry?.dispose();return [...previewMeshes.values()];}
  graph.generatedIds = generated;
  saveGeometryNodeDraft();
  updateAll();
  renderGeometryNodeEditor();
  log(generated.length ? `Built ${outputName}: ${generated.length} mesh parts.` : "Nothing generated. Check the connections to Group Output.", { parts: generated.length, seed: graph.seed, nodes: graph.nodeOrder.length, canopy: activeNodes.has("canopy") && p.canopyEnabled });
}
function bakeGeometryNodeTree() {
  const graph = activeGeometryNodeGraph();
  if (!graph || !graph.generatedIds.length) return;
  const count = graph.generatedIds.length;
  graph.generatedIds = [];
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  log(`Baked ${count} generated geometry parts. They are now ordinary editable BWS objects; the graph remains saved for future builds.`);
}
function deleteGeometryNodeGraph() {
  const graph = activeGeometryNodeGraph();
  if (!graph) return;
  if (geometryNodePendingDeleteId !== graph.id) {
    geometryNodePendingDeleteId = graph.id;
    renderGeometryNodeEditor();
    setGeometryNodeStatus('Click Confirm delete graph to remove "' + graph.name + '". Scene models are kept. Switch graphs to cancel.');
    return;
  }
  recordHistory("delete geometry node graph");
  geometryNodeProjectState.graphs = geometryNodeProjectState.graphs.filter(item => item.id !== graph.id);
  geometryNodeProjectState.activeGraphId = geometryNodeProjectState.graphs[0]?.id || null;
  geometryNodePendingDeleteId = null;
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  log('Deleted Geometry Nodes graph ' + graph.name + '. Scene objects were kept.');
}
function createGeometryNodeGraph() { createGeometryNodeBoard(false); }
function createGeometryTreeTemplate() { createGeometryNodeBoard(true); }
function createGeometryHouseTemplate() {
  if(geometryNodeProjectState.graphs.length>=24){setGeometryNodeStatus("Graph limit reached. Save/delete an unused graph first.");return;}
  recordHistory("new house template graph");
  const graph=defaultGeometryNodeGraph("Timber house");
  graph.nodeOrder=["seed","houseLayout","floor","window","window::2","door","diagonalBracing","foundation","facadeDetails","balcony","staircase","roof","chimney","output"];
  graph.nodeParams["window::2"]={...graph.params,windowLevel:1,windowWidth:.8};
  graph.connections=graph.nodeOrder.slice(0,-1).map((fromNodeId,i)=>({id:geometryNodeId("link"),fromNodeId,toNodeId:graph.nodeOrder[i+1],toInputIndex:0}));
  graph.nodeOrder.forEach((id,i)=>{graph.nodePositions[id]=[40+i*190,60];});
  graph.centerOutput=true;
  geometryNodePendingDeleteId=null;
  geometryNodeProjectState.graphs.push(graph);geometryNodeProjectState.activeGraphId=graph.id;
  saveGeometryNodeDraft();renderGeometryNodeEditor();
}
function createGeometryNodeBoard(useTree) {
  if (geometryNodeProjectState.graphs.length >= 24) { setGeometryNodeStatus("Graph limit reached. Save and delete an unused graph first."); return; }
  recordHistory(useTree ? "new tree template graph" : "new empty geometry graph");
  const name = (useTree ? "Tree template " : "Untitled Geometry ") + (geometryNodeProjectState.graphs.length + 1);
  const graph = useTree ? defaultGeometryNodeGraph(name) : defaultEmptyGeometryNodeProjectState().graphs[0];
  graph.name = name; graph.params.outputName = name;
  geometryNodePendingDeleteId = null;
  geometryNodeProjectState.graphs.push(graph);
  geometryNodeProjectState.activeGraphId = graph.id;
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
}
function geometryNodePosition(graph, nodeId) {
  return graph.smoothNodes.find(node => node.id === nodeId)?.position || graph.nodePositions[nodeId] || [18, 42];
}
function geometryNodeHasPath(graph, fromNodeId, toNodeId) {
  const stack = [fromNodeId];
  const visited = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (current === toNodeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    graph.connections.filter(connection => connection.fromNodeId === current).forEach(connection => stack.push(connection.toNodeId));
  }
  return false;
}
function connectGeometryNodes(fromNodeId, toNodeId, requestedInputIndex = 0) {
  const graph = activeGeometryNodeGraph();
  const fromType = graph && geometryNodeTypeForId(graph, fromNodeId);
  const toType = graph && geometryNodeTypeForId(graph, toNodeId);
  const fromDefinition = GEOMETRY_NODE_DEFINITIONS[fromType] || { output: "Geometry" };
  const toDefinition = GEOMETRY_NODE_DEFINITIONS[toType] || { input: "Geometry" };
  if (!graph || !fromType || !toType || fromNodeId === toNodeId || !fromDefinition.output || !toDefinition.input) return false;
  const inputLabels = toDefinition.inputSockets || [toDefinition.input];
  const toInputIndex = Math.max(0, Math.min(inputLabels.length - 1, Number(requestedInputIndex) || 0));
  const expectedInput = inputLabels[toInputIndex];
  const expectsTexture = /^Texture(?: [2-4])?$/.test(expectedInput) || ["Upper", "Middle", "Bottom", "Overall"].includes(expectedInput);
  if ((fromDefinition.output === "Texture" || expectsTexture) && (fromDefinition.output !== "Texture" || !expectsTexture)) return false;
  if (["Upper", "Middle", "Bottom", "Overall"].includes(expectedInput) && fromDefinition.output !== "Texture") return false;
  if ((fromDefinition.output === "Seed" || expectedInput === "Seed") && fromDefinition.output !== expectedInput) return false;
  if (geometryNodeHasPath(graph, toNodeId, fromNodeId)) return false;
  if (graph.connections.some(connection => connection.fromNodeId === fromNodeId && connection.toNodeId === toNodeId && (Number(connection.toInputIndex) || 0) === toInputIndex)) return true;
  graph.connections = graph.connections.filter(connection => connection.toNodeId !== toNodeId || (Number(connection.toInputIndex) || 0) !== toInputIndex);
  graph.connections.push({ id: geometryNodeId("link"), fromNodeId, toNodeId, toInputIndex });
  const smoothNode = graph.smoothNodes.find(node => node.id === toNodeId);
  if (smoothNode) smoothNode.targetId = geometryNodeResolvedSourceId(graph, fromNodeId);
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  return true;
}
function disconnectGeometryNodeLink(linkId) {
  const graph = activeGeometryNodeGraph();
  if (!graph || !graph.connections.some(connection => connection.id === linkId)) return;
  graph.connections = graph.connections.filter(connection => connection.id !== linkId);
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
}
function geometryNodeFindOpenPosition(graph, preferred = null) {
  const occupied = [...graph.nodeOrder.map(id => geometryNodePosition(graph, id)), ...graph.smoothNodes.map(node => node.position)];
  const collides = point => occupied.some(other => Math.abs(other[0] - point[0]) < 174 && Math.abs(other[1] - point[1]) < 235);
  if (preferred) {
    const point = [...preferred];
    for (let attempt = 0; attempt < 24 && collides(point); attempt++) {
      point[1] += 245;
      if (point[1] > 1900) { point[1] = 70 + (attempt % 3) * 245; point[0] += 190; }
    }
    return point;
  }
  for (let row = 0; row < 9; row++) for (let column = 0; column < 18; column++) {
    const point = [70 + column * 190, 70 + row * 245];
    if (!collides(point)) return point;
  }
  return [120, 2100];
}
function addGeometryNodeType(type, position = null) {
  const graph = activeGeometryNodeGraph();
  if (!graph || !GEOMETRY_NODE_DEFINITIONS[type]) return;
  if (type === "smoothGeometry") {
    addGeometryNodeModifier(null, type, position, false);
    return;
  }
  const instanceCount = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === type).length;
  const nodeId = instanceCount ? `${type}::${instanceCount + 1}` : type;
  if (instanceCount) {
    graph.nodeParams ||= {};
    graph.nodeParams[nodeId] = { ...graph.params };
    if (type === "textureInput") Object.assign(graph.nodeParams[nodeId], { textureName: "", textureData: "", textureRandomize: true, textureVariation: 1 });
  }
  const canonicalIndex = GEOMETRY_NODE_TYPES.indexOf(type);
  const insertIndex = graph.nodeOrder.findIndex(existingId => GEOMETRY_NODE_TYPES.indexOf(geometryNodeTypeForId(graph, existingId)) > canonicalIndex);
  graph.nodeOrder.splice(insertIndex >= 0 ? insertIndex : graph.nodeOrder.length, 0, nodeId);
  graph.nodePositions[nodeId] = geometryNodeFindOpenPosition(graph, position);
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  return nodeId;
}
function addGeometryNodeModifier(targetId = null, type = "smoothGeometry", position = null, insertIntoFlow = true) {
  const graph = activeGeometryNodeGraph();
  const targetType = graph && targetId ? geometryNodeTypeForId(graph, targetId) : null;
  if (!graph || type !== "smoothGeometry" || (targetId && (!targetType || !GEOMETRY_NODE_DEFINITIONS[targetType].output))) return;
  const targetPosition = targetId ? geometryNodePosition(graph, targetId) : [260, 240];
  const siblings = targetId ? graph.smoothNodes.filter(node => node.targetId === geometryNodeResolvedSourceId(graph, targetId)) : [];
  const node = {
    id: geometryNodeId("smooth"),
    targetId: targetId ? geometryNodeResolvedSourceId(graph, targetId) : null,
    position: geometryNodeFindOpenPosition(graph, position || [Math.min(4200, targetPosition[0] + 190 + siblings.length * 26), Math.min(2200, targetPosition[1] + siblings.length * 38)]),
    params: { axis: "xyz", iterations: 2, strength: .72, preserveSize: true }
  };
  graph.smoothNodes.push(node);
  if (targetId && insertIntoFlow) {
    const outgoing = graph.connections.find(connection => connection.fromNodeId === targetId);
    if (outgoing) {
      graph.connections = graph.connections.filter(connection => connection.id !== outgoing.id);
      graph.connections.push({ id: geometryNodeId("link"), fromNodeId: node.id, toNodeId: outgoing.toNodeId });
    }
    graph.connections.push({ id: geometryNodeId("link"), fromNodeId: targetId, toNodeId: node.id });
  }
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
}
function removeGeometryNodeType(nodeId) {
  const graph = activeGeometryNodeGraph();
  if (!graph) return;
  if (graph.smoothNodes.some(node => node.id === nodeId)) graph.smoothNodes = graph.smoothNodes.filter(node => node.id !== nodeId);
  else if (graph.nodeOrder.includes(nodeId)) graph.nodeOrder = graph.nodeOrder.filter(nodeType => nodeType !== nodeId);
  else return;
  graph.connections = graph.connections.filter(connection => connection.fromNodeId !== nodeId && connection.toNodeId !== nodeId);
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
}
function closeGeometryNodeContextMenu(doc) {
  doc?.querySelector(".geometry-node-context-menu")?.remove();
}
function mountGeometryNodeContextMenu(doc, html, clientX, clientY) {
  closeGeometryNodeContextMenu(doc);
  const menu = doc.createElement("div");
  menu.className = "geometry-node-context-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = html;
  if (menu.querySelector(".geometry-node-context-library")) menu.classList.add("geometry-node-library-menu");
  doc.body.append(menu);
  const fitMenu = () => {
    const viewportWidth = doc.defaultView?.innerWidth || 1024;
    const viewportHeight = doc.defaultView?.innerHeight || 768;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(clientX, viewportWidth - bounds.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(clientY, viewportHeight - bounds.height - 8))}px`;
  };
  fitMenu();
  menu.querySelectorAll("details").forEach(details => details.addEventListener("toggle", () => doc.defaultView?.requestAnimationFrame(fitMenu)));
}
function openGeometryNodeContextMenu(doc, card, clientX, clientY) {
  const graph = activeGeometryNodeGraph();
  const targetId = card?.dataset.geometryNode;
  const targetType = card?.dataset.geometryNodeType;
  const definition = GEOMETRY_NODE_DEFINITIONS[targetType];
  if (!graph || !targetId || !definition) return;
  const position = geometryNodePosition(graph, targetId);
  const attachedCount = graph.smoothNodes.filter(node => geometryNodeResolvedSourceId(graph, node.id) === geometryNodeResolvedSourceId(graph, targetId)).length;
  const compatibleTypes = definition.output ? GEOMETRY_NODE_TYPES.filter(type => {
    const candidate = GEOMETRY_NODE_DEFINITIONS[type];
    if (!candidate.input || type === targetType || type === "output") return false;
    return type === "smoothGeometry" || candidate.input === definition.output || candidate.input === "Geometry" || definition.output === "Geometry";
  }) : [];
  const compatibleButtons = compatibleTypes.map(type => `<button type="button" role="menuitem" data-geometry-attach-type="${type}" data-geometry-target-node="${geometryNodeEscape(targetId)}">+ ${geometryNodeEscape(GEOMETRY_NODE_DEFINITIONS[type].title)}</button>`).join("");
  const actions = definition.output
    ? `<span class="geometry-node-context-label">Connect or modify</span><button type="button" role="menuitem" data-geometry-start-link="${geometryNodeEscape(targetId)}">+ Draw connection</button>${compatibleButtons || '<span class="geometry-node-context-note">No unused compatible cards.</span>'}`
    : `<span class="geometry-node-context-note">This node has no output socket.</span>`;
  mountGeometryNodeContextMenu(doc, `<strong>${geometryNodeEscape(definition.title)}</strong>${actions}<details><summary>Advanced values</summary><dl><dt>Node ID</dt><dd>${geometryNodeEscape(targetId)}</dd><dt>Input</dt><dd>${geometryNodeEscape(definition.input || "None")}</dd><dt>Output</dt><dd>${geometryNodeEscape(definition.output || "None")}</dd><dt>Position</dt><dd>X ${Math.round(position[0])}, Y ${Math.round(position[1])}</dd><dt>Incoming</dt><dd>${graph.connections.filter(connection => connection.toNodeId === targetId).length}</dd><dt>Outgoing</dt><dd>${graph.connections.filter(connection => connection.fromNodeId === targetId).length}</dd><dt>Modifiers</dt><dd>${attachedCount}</dd></dl></details>`, clientX, clientY);
}
function openGeometryNodeBoardMenu(doc, canvasPoint, clientX, clientY) {
  const graph = activeGeometryNodeGraph();
  if (!graph) return;
  const categoryOrder = ["Inputs", "Geometry", "Layout", "Modifiers", "Output", "Growth", "Nature", "Nature Details", "Testing", "Scene", "Game Assets", "Vehicles", "Architecture", "Damage & Effects"];
  const categories = [...new Set(GEOMETRY_NODE_TYPES.map(type => GEOMETRY_NODE_DEFINITIONS[type].category))].sort((a,b) => (categoryOrder.includes(a) ? categoryOrder.indexOf(a) : 999) - (categoryOrder.includes(b) ? categoryOrder.indexOf(b) : 999));
  const list = categories.map(category => `<section><span class="geometry-node-context-label">${category}</span>${GEOMETRY_NODE_TYPES.filter(type => GEOMETRY_NODE_DEFINITIONS[type].category === category).map(type => {
    const count = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === type).length;
    return `<button type="button" data-geometry-add-node="${type}" data-geometry-add-x="${Math.round(canvasPoint[0])}" data-geometry-add-y="${Math.round(canvasPoint[1])}">+ ${geometryNodeEscape(GEOMETRY_NODE_DEFINITIONS[type].title)}${count ? ` (${count})` : ""}</button>`;
  }).join("")}</section>`).join("");
  mountGeometryNodeContextMenu(doc, `<strong>Add node here</strong><div class="geometry-node-context-library">${list}</div>`, clientX, clientY);
}
function openGeometryNodeLinkMenu(doc, linkId, clientX, clientY) {
  mountGeometryNodeContextMenu(doc, `<strong>Connection</strong><button type="button" class="danger" data-geometry-disconnect="${geometryNodeEscape(linkId)}">Disconnect</button>`, clientX, clientY);
}
function geometryNodeCanvasPoint(canvas, clientX, clientY) {
  const graph = activeGeometryNodeGraph();
  if (canvas?.id === GEOMETRY_NODE_SURFACE_IDS.detached.canvas && graph) {
    const viewportBounds = canvas.parentElement.getBoundingClientRect();
    const scale = Math.max(.01, Number(graph.view?.scale) || 1);
    return [
      Math.max(0, (clientX - viewportBounds.left - (Number(graph.view?.x) || 0)) / scale),
      Math.max(0, (clientY - viewportBounds.top - (Number(graph.view?.y) || 0)) / scale)
    ];
  }
  const bounds = canvas.getBoundingClientRect();
  return [
    (clientX - bounds.left) * canvas.offsetWidth / Math.max(1, bounds.width),
    (clientY - bounds.top) * canvas.offsetHeight / Math.max(1, bounds.height)
  ];
}
function startGeometryNodeConnection(doc, canvas, nodeId) {
  const interaction = geometryNodeInteractionByDocument.get(doc);
  if (!interaction) return;
  interaction.pendingFrom = nodeId;
  interaction.pointer = geometryNodePortPoint(canvas, nodeId, "output") || geometryNodePosition(activeGeometryNodeGraph(), nodeId);
  canvas.querySelectorAll(".geometry-node-port.output").forEach(port => port.classList.toggle("connecting", port.dataset.geometryConnectFrom === nodeId));
  renderGeometryNodeLinks(canvas, activeGeometryNodeGraph(), doc);
}
function cancelGeometryNodeConnection(doc, canvas) {
  const interaction = geometryNodeInteractionByDocument.get(doc);
  if (!interaction) return;
  interaction.pendingFrom = null;
  interaction.pointer = null;
  canvas?.querySelectorAll(".geometry-node-port.connecting").forEach(port => port.classList.remove("connecting"));
  if (canvas) renderGeometryNodeLinks(canvas, activeGeometryNodeGraph(), doc);
}
function fitGeometryNodeDetachedView(graph, viewport) {
  const points = [...graph.nodeOrder.map(id => geometryNodePosition(graph, id)), ...graph.smoothNodes.map(node => node.position)];
  if (!points.length || !viewport) return;
  const minX = Math.min(...points.map(point => point[0])) - 45;
  const minY = Math.min(...points.map(point => point[1])) - 45;
  const maxX = Math.max(...points.map(point => point[0])) + 205;
  const maxY = Math.max(...points.map(point => point[1])) + 300;
  const scale = Math.max(.25, Math.min(1.5, Math.min((viewport.clientWidth - 24) / Math.max(1, maxX - minX), (viewport.clientHeight - 24) / Math.max(1, maxY - minY))));
  graph.view.scale = scale;
  graph.view.x = (viewport.clientWidth - (maxX - minX) * scale) / 2 - minX * scale;
  graph.view.y = (viewport.clientHeight - (maxY - minY) * scale) / 2 - minY * scale;
}
function updateGeometryNodeDetachedView(surface, graph, doc) {
  if (!surface?.canvas || !graph) return;
  surface.canvas.style.transform = `translate(${graph.view.x}px, ${graph.view.y}px) scale(${graph.view.scale})`;
  surface.canvas.style.transformOrigin = "top left";
  const label = surface.root?.querySelector("[data-geometry-zoom-label]");
  if (label) label.textContent = `${Math.round(graph.view.scale * 100)}%`;
  doc.defaultView?.requestAnimationFrame(() => {renderGeometryNodeLinks(surface.canvas, graph, doc);geometryNodeRefreshRulers(surface.canvas);});
}
function renderGeometryNodeMirror(sourceKind) {
  if (sourceKind === "detached") renderGeometryNodeSurface(document, "sidebar");
  else {
    const detachedWindow = liveGeometryNodesDetachedWindow();
    if (detachedWindow) renderGeometryNodeSurface(detachedWindow.document, "detached");
  }
}
function bindGeometryNodeSurface(doc, kind = "sidebar") {
  const surface = geometryNodeSurface(doc, kind);
  if (!surface?.root || surface.root.dataset.geometryNodesBound === "true") return;
  surface.root.dataset.geometryNodesBound = "true";
  const interaction = { pendingFrom: null, pointer: null, spaceKey: false };
  geometryNodeInteractionByDocument.set(doc, interaction);
  surface.newButton?.addEventListener("click", createGeometryNodeGraph);
  surface.root.querySelector("[data-geometry-tree-template]")?.addEventListener("click", createGeometryTreeTemplate);
  surface.root.querySelector("[data-geometry-house-template]")?.addEventListener("click", createGeometryHouseTemplate);
  surface.buildButton?.addEventListener("click", buildGeometryNodeTree);
  surface.root.querySelector("[data-geometry-center-output]")?.addEventListener("click", () => buildGeometryNodeTree({centerOutput:true}));
  surface.bakeButton?.addEventListener("click", bakeGeometryNodeTree);
  surface.deleteButton?.addEventListener("click", deleteGeometryNodeGraph);
  surface.copyButton?.addEventListener("click", () => copyGeometryNodeClusterString(doc));
  surface.pasteButton?.addEventListener("click", () => pasteGeometryNodeClusterString(doc));
  surface.saveClusterButton?.addEventListener("click", () => saveGeometryNodeClusterFile(doc));
  surface.loadClusterButton?.addEventListener("click", () => surface.fileInput?.click());
  surface.fileInput?.addEventListener("change", async event => {
    await loadGeometryNodeClusterFile(event.target.files?.[0]);
    event.target.value = "";
  });
  surface.root.addEventListener("click", event => {
    const graph = activeGeometryNodeGraph();
    const wallCopy = event.target.closest("[data-geometry-wall-copy]");
    if (wallCopy && graph) {
      const nodeId=wallCopy.dataset.geometryWallCopy;
      const values=graph.nodeParams?.[nodeId] || graph.params;
      const count=assetNodeSanitize(values).brickCopies;
      if(count>=12){setGeometryNodeStatus("Maximum 12 wall copies per node. Use fewer bricks for larger repeats.");return;}
      values.brickCopies=count+1;
      values.brickRepeat=true;
      saveGeometryNodeDraft();
      renderGeometryNodeEditor();
      buildGeometryNodeTree();
      return;
    }
    const outputPort = event.target.closest("[data-geometry-connect-from]");
    if (outputPort) {
      startGeometryNodeConnection(doc, surface.canvas, outputPort.dataset.geometryConnectFrom);
      return;
    }
    const inputPort = event.target.closest("[data-geometry-connect-to]");
    if (inputPort && interaction.pendingFrom) {
      const fromNodeId = interaction.pendingFrom;
      cancelGeometryNodeConnection(doc, surface.canvas);
      connectGeometryNodes(fromNodeId, inputPort.dataset.geometryConnectTo, Number(inputPort.dataset.geometryInputIndex) || 0);
      return;
    }
    const viewButton = event.target.closest("[data-geometry-view]");
    if (viewButton && graph && kind === "detached") {
      if (viewButton.dataset.geometryView === "fit") fitGeometryNodeDetachedView(graph, surface.canvas.parentElement);
      else {
        const factor = viewButton.dataset.geometryView === "zoom-in" ? 1.2 : 1 / 1.2;
        graph.view.scale = geometryNodeNumber(graph.view.scale * factor, graph.view.scale, .25, 2.5);
      }
      updateGeometryNodeDetachedView(surface, graph, doc);
      saveGeometryNodeDraft();
      return;
    }
    const addButton = event.target.closest("[data-geometry-add-node]");
    if (addButton) {
      const x = Number(addButton.dataset.geometryAddX);
      const y = Number(addButton.dataset.geometryAddY);
      addGeometryNodeType(addButton.dataset.geometryAddNode, Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null);
      return;
    }
    const removeButton = event.target.closest("[data-geometry-remove-node]");
    if (removeButton) removeGeometryNodeType(removeButton.dataset.geometryRemoveNode);
  });
  doc.addEventListener("click", event => {
    const menu = event.target.closest(".geometry-node-context-menu");
    if (!menu) return;
    const attachButton = event.target.closest("[data-geometry-attach-type]");
    const startButton = event.target.closest("[data-geometry-start-link]");
    const addButton = event.target.closest("[data-geometry-add-node]");
    const disconnectButton = event.target.closest("[data-geometry-disconnect]");
    if (attachButton) {
      const targetId = attachButton.dataset.geometryTargetNode;
      const type = attachButton.dataset.geometryAttachType;
      if (type === "smoothGeometry") addGeometryNodeModifier(targetId, type);
      else {
        const targetPosition = geometryNodePosition(activeGeometryNodeGraph(), targetId);
        const addedId = addGeometryNodeType(type, [targetPosition[0] + 190, targetPosition[1] + 245]);
        connectGeometryNodes(targetId, addedId || type);
      }
    }
    else if (startButton) startGeometryNodeConnection(doc, surface.canvas, startButton.dataset.geometryStartLink);
    else if (addButton) addGeometryNodeType(addButton.dataset.geometryAddNode, [Number(addButton.dataset.geometryAddX), Number(addButton.dataset.geometryAddY)]);
    else if (disconnectButton) disconnectGeometryNodeLink(disconnectButton.dataset.geometryDisconnect);
    if (attachButton || startButton || addButton || disconnectButton) closeGeometryNodeContextMenu(doc);
  });
  surface.select?.addEventListener("change", event => {
    geometryNodePendingDeleteId = null;
    geometryNodeProjectState.activeGraphId = event.target.value;
    saveGeometryNodeDraft();
    renderGeometryNodeEditor();
  });
  const canvas = surface.canvas;
  surface.root.addEventListener("contextmenu", event => {
    event.preventDefault();
    const link = event.target.closest("[data-geometry-link]");
    if (link) {
      openGeometryNodeLinkMenu(doc, link.dataset.geometryLink, event.clientX, event.clientY);
      return;
    }
    const card = event.target.closest(".geometry-node-card");
    if (card) {
      openGeometryNodeContextMenu(doc, card, event.clientX, event.clientY);
      return;
    }
    if (event.target.closest(".geometry-node-canvas")) openGeometryNodeBoardMenu(doc, geometryNodeCanvasPoint(surface.canvas, event.clientX, event.clientY), event.clientX, event.clientY);
  });
  doc.addEventListener("contextmenu", event => event.preventDefault());
  doc.addEventListener("pointerdown", event => {
    if (!event.target.closest(".geometry-node-context-menu")) closeGeometryNodeContextMenu(doc);
  });
  doc.addEventListener("keydown", event => {
    if (event.code === "Space" && !event.target.matches("input,select,textarea")) interaction.spaceKey = true;
    if (event.key === "Escape") {
      closeGeometryNodeContextMenu(doc);
      cancelGeometryNodeConnection(doc, canvas);
    }
  });
  doc.addEventListener("keyup", event => { if (event.code === "Space") interaction.spaceKey = false; });
  doc.defaultView?.addEventListener("blur", () => { interaction.spaceKey = false; });
  canvas?.addEventListener("pointermove", event => {
    if (!interaction.pendingFrom) return;
    interaction.pointer = geometryNodeCanvasPoint(canvas, event.clientX, event.clientY);
    renderGeometryNodeLinks(canvas, activeGeometryNodeGraph(), doc);
  });
  if (kind === "detached" || kind === "sidebar") {
    const viewport = canvas?.parentElement;
    viewport?.addEventListener("wheel", event => {
      event.preventDefault();
      const graph = activeGeometryNodeGraph();
      if (!graph) return;
      const before = geometryNodeCanvasPoint(canvas, event.clientX, event.clientY);
      const oldScale = graph.view.scale;
      graph.view.scale = geometryNodeNumber(oldScale * Math.exp(-event.deltaY * .0012), oldScale, .05, 2.5);
      graph.view.x += before[0] * (oldScale - graph.view.scale);
      graph.view.y += before[1] * (oldScale - graph.view.scale);
      updateGeometryNodeDetachedView(surface, graph, doc);
      saveGeometryNodeDraft();
    }, { passive: false });
    viewport?.addEventListener("pointerdown", event => {
      const shouldPan = event.button === 1 || (event.button === 0 && interaction.spaceKey && !event.target.closest(".geometry-node-card"));
      const graph = activeGeometryNodeGraph();
      if (!shouldPan || !graph) return;
      event.preventDefault();
      const start = [event.clientX, event.clientY];
      const origin = [graph.view.x, graph.view.y];
      viewport.setPointerCapture?.(event.pointerId);
      const move = moveEvent => {
        graph.view.x = origin[0] + moveEvent.clientX - start[0];
        graph.view.y = origin[1] + moveEvent.clientY - start[1];
        updateGeometryNodeDetachedView(surface, graph, doc);
      };
      const finish = () => {
        viewport.removeEventListener("pointermove", move);
        viewport.removeEventListener("pointerup", finish);
        viewport.removeEventListener("pointercancel", finish);
        saveGeometryNodeDraft();
      };
      viewport.addEventListener("pointermove", move);
      viewport.addEventListener("pointerup", finish);
      viewport.addEventListener("pointercancel", finish);
    });
  }
  canvas?.addEventListener("input", event => {
    const input = event.target.closest("[data-geometry-param]");
    const graph = activeGeometryNodeGraph();
    if (!input || !graph) return;
    const key = input.dataset.geometryParam;
    const value = input.type === "checkbox" ? input.checked : (input.type === "number" ? Number(input.value) : input.value);
    const instanceId = input.dataset.geometryInstanceParam;
    if (instanceId) {
      const modifier = graph.smoothNodes.find(node => node.id === instanceId);
      if (modifier) modifier.params[key] = value;
      else if (graph.nodeParams?.[instanceId]) graph.nodeParams[instanceId][key] = value;
      else graph.params[key] = value;
    } else if (key === "seed") graph.seed = Math.round(geometryNodeNumber(value, graph.seed, 0, 999999));
    else graph.params[key] = value;
    if (key === "outputName" && String(value).trim()) graph.name = String(value).trim().slice(0, 80);
    saveGeometryNodeDraft();
    renderGeometryNodeMirror(kind);
  });
  canvas?.addEventListener("change", event => {
    const input = event.target.closest("[data-geometry-param]");
    if (input && (input.type !== "checkbox" || !event.defaultPrevented)) input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  canvas?.addEventListener("change", event => {
    const textureInput = event.target.closest("[data-geometry-texture-input]");
    const graph = activeGeometryNodeGraph();
    if (!textureInput || !graph) return;
    const file = textureInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const instanceId = textureInput.dataset.geometryTextureInstance;
      const target = instanceId && instanceId !== "textureInput" ? graph.nodeParams?.[instanceId] : graph.params;
      if (!target || typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) return;
      target.textureName = file.name.slice(0, 160);
      target.textureData = reader.result;
      saveGeometryNodeDraft();
      renderGeometryNodeEditor();
    };
    reader.onerror = () => {
      const status = document.querySelector("[data-geometry-texture-name]");
      if (status) status.textContent = "Texture import failed";
    };
    reader.readAsDataURL(file);
  });
  canvas?.addEventListener("pointerdown", event => {
    if (event.target.closest("[data-geometry-remove-node]")) return;
    const handle = event.target.closest("[data-geometry-drag]");
    const graph = activeGeometryNodeGraph();
    if (!handle || !graph || event.button !== 0) return;
    const nodeId = handle.dataset.geometryDrag;
    const card = handle.closest(".geometry-node-card");
    const modifier = graph.smoothNodes.find(node => node.id === nodeId);
    const origin = [...(modifier?.position || graph.nodePositions[nodeId])];
    const start = [event.clientX, event.clientY];
    handle.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      const scale = canvas.getBoundingClientRect().width / Math.max(1,canvas.offsetWidth);
      const x = geometryNodeNumber(origin[0] + (moveEvent.clientX - start[0]) / scale, origin[0], 0, Number.MAX_SAFE_INTEGER);
      const y = geometryNodeNumber(origin[1] + (moveEvent.clientY - start[1]) / scale, origin[1], 0, Number.MAX_SAFE_INTEGER);
      if (modifier) modifier.position = [x, y];
      else graph.nodePositions[nodeId] = [x, y];
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      geometryNodeExpandCanvas(canvas);
      renderGeometryNodeLinks(canvas, graph, doc);
      geometryNodeRefreshRulers(canvas,[x,y]);
    };
    const finish = () => {
      geometryNodeRefreshRulers(canvas);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      saveGeometryNodeDraft();
      renderGeometryNodeMirror(kind);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });
}
function initializeGeometryNodes() {
  if (geometryNodesInitialized) return;
  geometryNodesInitialized = true;
  bindGeometryNodeSurface(document, "sidebar");
  document.querySelector("#geometryNodeDetachBtn")?.addEventListener("click", openGeometryNodesDetachedWindow);
  if (typeof ResizeObserver === "function") new ResizeObserver(fitGeometryNodeSidebarOverview).observe(document.getElementById("geometryNodeViewport"));
  else window.addEventListener("resize", fitGeometryNodeSidebarOverview);
  window.addEventListener("beforeunload", () => liveGeometryNodesDetachedWindow()?.close());
}
function setGeometryNodesPluginEnabled(enabled) {
  geometryNodesRuntimeEnabled = !!enabled;
  initializeGeometryNodes();
  if (!geometryNodesRuntimeEnabled) liveGeometryNodesDetachedWindow()?.close();
  renderGeometryNodeEditor();
}
const geometryNodeLayoutSeen=new WeakSet();
function geometryNodeLayoutPrefs(){try{const p=JSON.parse(localStorage.getItem("bws-node-layout")||"{}");return {x:Math.max(20,Math.min(400,Number(p.x)||70)),y:Math.max(20,Math.min(400,Number(p.y)||70))};}catch{return {x:70,y:70};}}
function geometryNodeInstallLayoutTools(surface,doc){
if(surface.root.querySelector("[data-node-layout-tools]"))return;const p=geometryNodeLayoutPrefs(),bar=doc.createElement("div");bar.dataset.nodeLayoutTools="true";bar.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 0";
const button=doc.createElement("button");button.type="button";button.textContent="Arrange nodes";bar.appendChild(button);
for(const key of ["x","y"]){const label=doc.createElement("label");label.textContent=(key==="x"?"Horizontal":"Vertical")+" padding ";const input=doc.createElement("input");input.type="number";input.min="20";input.max="400";input.step="10";input.value=p[key];input.dataset.layoutAxis=key;input.style.width="65px";label.appendChild(input);bar.appendChild(label);}
const arrange=()=>{const graph=activeGeometryNodeGraph();if(graph)geometryNodeArrangeMeasured(surface,graph);};button.addEventListener("click",arrange);bar.addEventListener("change",()=>{const values={};for(const input of bar.querySelectorAll("input")){const value=Math.max(20,Math.min(400,Number(input.value)||70));input.value=value;values[input.dataset.layoutAxis]=value;}try{localStorage.setItem("bws-node-layout",JSON.stringify(values));}catch{}arrange();});
(surface.root.querySelector(".geometry-node-actions")||surface.root.querySelector(".geometry-node-toolbar")||surface.root).appendChild(bar);
}
function geometryNodeMeasuredCards(canvas){return [...canvas.querySelectorAll(".geometry-node-card")].map(el=>({el,id:el.dataset.geometryNode,x:parseFloat(el.style.left)||0,y:parseFloat(el.style.top)||0,w:el.offsetWidth||154,h:el.offsetHeight||300}));}
function geometryNodeExpandCanvas(canvas){const cards=geometryNodeMeasuredCards(canvas);if(!cards.length)return;canvas.style.width=Math.max(2200,...cards.map(c=>c.x+c.w+500))+"px";canvas.style.height=Math.max(1100,...cards.map(c=>c.y+c.h+500))+"px";}
function geometryNodeRepairOverlap(surface,graph){if(geometryNodeLayoutSeen.has(graph))return;const cards=geometryNodeMeasuredCards(surface.canvas);if(!cards.length||!cards[0].el.offsetHeight)return;geometryNodeLayoutSeen.add(graph);if(cards.some((a,i)=>cards.slice(i+1).some(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)))geometryNodeArrangeMeasured(surface,graph);}
function geometryNodeArrangeMeasured(surface,graph){const cards=geometryNodeMeasuredCards(surface.canvas);if(!cards.length)return;recordHistory("arrange geometry nodes");const p=geometryNodeLayoutPrefs(),columns=cards.length;let y=50;for(let i=0;i<cards.length;i+=columns){let x=50,height=0;for(const c of cards.slice(i,i+columns)){const smooth=graph.smoothNodes.find(n=>n.id===c.id);if(smooth)smooth.position=[x,y];else graph.nodePositions[c.id]=[x,y];height=Math.max(height,c.h);x+=c.w+p.x;}y+=height+p.y;}geometryNodeLayoutSeen.add(graph);saveGeometryNodeDraft();renderGeometryNodeEditor();}
function geometryNodeRefreshRulers(canvas,point=null){
const viewport=canvas?.parentElement,doc=canvas?.ownerDocument;if(!viewport||!doc||!canvas.offsetWidth)return;let overlay=viewport.querySelector(":scope > [data-node-rulers]");
if(!overlay){overlay=doc.createElement("div");overlay.dataset.nodeRulers="true";overlay.style.cssText="position:absolute;inset:0;pointer-events:none;z-index:20;overflow:hidden";viewport.style.position="relative";viewport.appendChild(overlay);}
canvas.querySelectorAll(".geometry-node-ruler-x,.geometry-node-ruler-y").forEach(el=>el.style.display="none");const c=canvas.getBoundingClientRect(),v=viewport.getBoundingClientRect(),scale=c.width/canvas.offsetWidth;if(!scale)return;const ox=c.left-v.left,oy=c.top-v.top,w=viewport.clientWidth,h=viewport.clientHeight,step=Math.pow(10,Math.ceil(Math.log10(60/scale)));overlay.replaceChildren();
function item(css,text){const el=doc.createElement("div");el.style.cssText="position:absolute;"+css;if(text!==undefined)el.textContent=text;overlay.appendChild(el);}
item("left:0;top:0;right:0;height:22px;background:#18262a;border-bottom:1px solid #61747b");item("left:0;top:22px;bottom:0;width:48px;background:#18262a;border-right:1px solid #61747b");
for(let n=Math.ceil(-ox/(step*scale));n*step*scale+ox<w;n++){const x=n*step*scale+ox;if(x>=48)item("top:0;left:"+x+"px;height:22px;border-left:1px solid #82999f;padding-left:3px;font:10px monospace;color:#d7e7e9",Math.round(n*step));}
for(let n=Math.ceil(-oy/(step*scale));n*step*scale+oy<h;n++){const y=n*step*scale+oy;if(y>=22)item("left:0;top:"+y+"px;width:48px;border-top:1px solid #82999f;font:9px monospace;color:#d7e7e9",Math.round(n*step));}
if(point){item("left:"+(ox+point[0]*scale)+"px;top:22px;bottom:0;border-left:1px dashed #63d8bd");item("left:48px;right:0;top:"+(oy+point[1]*scale)+"px;border-top:1px dashed #63d8bd");}
}
function geometryNodePaletteColor(p,n){const defaults=["#908676","#a39780","#786f62","#b1a58b"],value=p?.["paletteColor"+n];return /^#[0-9a-f]{6}$/i.test(value)?value:defaults[n-1];}
function geometryNodePreviewMesh(spec,collection){const g=spec.geometry?geometryFromData(spec.geometry):shapeFactories[spec.shape]?.();if(!g)throw Error("Unsupported preview geometry: "+spec.shape);const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:spec.color||"#ffffff",roughness:spec.roughness??.85,side:spec.doubleSided?THREE.DoubleSide:THREE.FrontSide}));m.name=spec.name||"Node output";m.position.fromArray(spec.position||[0,0,0]);m.rotation.set(...(spec.rotation||[0,0,0]).map(v=>THREE.MathUtils.degToRad(v)));m.scale.fromArray(spec.scale||[1,1,1]);m.userData={id:"scene-preview-"+collection.size,shape:spec.shape,_sceneTextureUrl:spec.textureUrl||null};m.updateMatrixWorld(true);collection.set(m.userData.id,m);return m;}

// house-batch
let houseBatchBusy=false,houseBatchStop=false;
function houseBatchSettings(graph){
 const active=geometryNodeActiveNodeIds(graph),ids=[...active];
 const source=ids.find(id=>geometryNodeTypeForId(graph,id)==='houseLayout');
 const batch=ids.find(id=>geometryNodeTypeForId(graph,id)==='houseBatch');
 if(!source||!batch)return null;
 const sources=ids.filter(id=>GEOMETRY_NODE_SOURCE_TYPES.includes(geometryNodeTypeForId(graph,id)));
 if(sources.length!==1)throw Error('House Batch requires one House Layout source. Use separate graphs for other generators.');
 return {source,active,params:assetNodeSanitize(graph.nodeParams?.[source]||graph.params),settings:assetNodeSanitize(graph.nodeParams?.[batch]||graph.params)};
}
function houseBatchOutputId(graph,index){return graph.id+'-house-'+String(index+1).padStart(3,'0');}
function houseBatchRecords(graph){return Array.isArray(graph?.params?.houseBatchOutputs)?graph.params.houseBatchOutputs:[];}
function houseBatchUiRefresh(){
 const root=document.getElementById('houseBatchTools');if(!root)return;
 const graph=activeGeometryNodeGraph();let config;
 try{config=graph&&houseBatchSettings(graph);}catch{config=null;}
 root.hidden=!config;if(!config)return;
 const select=root.querySelector('select'),old=new Set([...select.selectedOptions].map(o=>o.value));
 select.replaceChildren();
 const records=houseBatchRecords(graph);
 for(let i=0;i<config.settings.batchCount;i++){
  const id=houseBatchOutputId(graph,i),record=records.find(r=>r.id===id),option=document.createElement('option');
  option.value=String(i);option.textContent='House '+String(i+1).padStart(3,'0')+(record?' - '+record.width.toFixed(1)+' x '+record.depth.toFixed(1)+' / '+record.storeys+' floors':' - not built');option.selected=old.has(String(i));select.append(option);
 }
 root.querySelectorAll('button[data-batch-build]').forEach(b=>b.disabled=houseBatchBusy);
 root.querySelector('[data-batch-stop]').disabled=!houseBatchBusy;
}
function houseBatchCombine(specs){
 const buckets=new Map();
 for(const spec of specs){const {geometry,name,position,rotation,scale,groupId,groupName,...appearance}=spec;
  const key=JSON.stringify(appearance);let bucket=buckets.get(key);
  if(!bucket){bucket={spec,positions:[],normals:[],uvs:[]};buckets.set(key,bucket);}
  const g=geometryFromData(geometry),flat=g.index?g.toNonIndexed():g;
  const p=flat.getAttribute('position');if(!flat.getAttribute('normal'))flat.computeVertexNormals();
  const n=flat.getAttribute('normal'),uv=flat.getAttribute('uv');
  for(let i=0;i<p.count;i++){bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));bucket.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}
  if(flat!==g)flat.dispose();g.dispose();
 }
 return [...buckets.values()].map((b,i)=>({...b.spec,name:'Material section '+(i+1),geometry:{positions:b.positions,normals:b.normals,uvs:b.uvs}}));
}
async function buildHouseBatch(graph,indices=null){
 if(houseBatchBusy){setGeometryNodeStatus('A house batch is already running.');return;}
 let config;try{config=houseBatchSettings(graph);}catch(error){setGeometryNodeStatus(error.message);return;}
 if(!config)return;
 const {source,active,params,settings}=config;
 const selected=indices===null?Array.from({length:settings.batchCount},(_,i)=>i):[...new Set(indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<settings.batchCount);
 if(!selected.length){setGeometryNodeStatus('Select houses in House Outputs first.');return;}
 houseBatchBusy=true;houseBatchStop=false;houseBatchUiRefresh();
 const originalName=graph.name;let completed=0;
 try{
  recordHistory('rebuild house outputs');
  const records=houseBatchRecords(graph).map(r=>structuredClone(r));
  const attachmentTemplate=buildingAttachments(graph,source,active).filter(a=>a.type!=='houseBatch');
  const palettes=[['#bdaf92','#584132','#89513b','#928878'],['#d0c6ad','#493c32','#635e55','#88847a'],['#b3a18b','#69503c','#995e42','#9c8d76'],['#c6bca5','#504a40','#706758','#7c8176'],['#c2ab8d','#63432e','#815440','#a08f79']];
  const spacing=Math.max(settings.batchSpacing,Math.max(params.buildingWidth,params.buildingDepth)*(1+settings.batchVariation)+6);
  for(const index of selected){
   if(houseBatchStop)break;
   setGeometryNodeStatus('Building house '+(index+1)+' ('+(completed+1)+'/'+selected.length+')...');
   await new Promise(resolve=>setTimeout(resolve,0));
   const id=houseBatchOutputId(graph,index),seed=(graph.seed+Math.imul(index+1,7919))>>>0,rng=geometryNodePrng(seed);
   const p={...params,assetOffsetX:0,assetOffsetY:0,assetOffsetZ:0};
   p.buildingWidth=Math.max(4,Math.min(32,params.buildingWidth*(1+(rng()*2-1)*settings.batchVariation)));
   p.buildingDepth=Math.max(4,Math.min(32,params.buildingDepth*(1+(rng()*2-1)*settings.batchVariation)));
   if(settings.batchStoreys)p.buildingStoreys=1+Math.floor(rng()*params.buildingStoreys);
   const palette=palettes[Math.floor(rng()*palettes.length)];
   if(settings.batchPalette){p.buildingPlaster=palette[0];p.buildingTimber=palette[1];}
   const attachments=attachmentTemplate.map(a=>({...a,params:{...a.params}}));
   for(const a of attachments){
    if(a.type==='roof'){a.params.roofRise*=.85+rng()*.3;a.params.roofVariation=0;if(settings.batchPalette)a.params.roofColor=palette[2];}
    if(a.type==='foundation'){a.params.foundationVariation=0;if(settings.batchPalette)a.params.foundationColor=palette[3];}
    if(a.type==='diagonalBracing')a.params.braceStyle=['slash','alternating','cross'][Math.floor(rng()*3)];
   }
   const groupId='house-output-'+id,name=originalName+' / House '+String(index+1).padStart(3,'0');
   const group={id:groupId,name},specs=[];
   buildArchitecture('houseLayout',p,{graph:{...graph,seed},nodeId:source,group,outputName:name,attachments,emit:spec=>specs.push(spec)});
   const merged=houseBatchCombine(specs),x=(index%settings.batchColumns)*spacing,z=Math.floor(index/settings.batchColumns)*spacing;
   const cells=Array.from({length:p.buildingStoreys},(_,floor)=>({id:id+'-floor-'+(floor+1),kind:'reserved-floor-cell',floor:floor+1,bounds:{min:[-p.buildingWidth/2+p.buildingWallDepth/2,floor*p.buildingStoreyHeight,-p.buildingDepth/2+p.buildingWallDepth/2],max:[p.buildingWidth/2-p.buildingWallDepth/2,(floor+1)*p.buildingStoreyHeight,p.buildingDepth/2-p.buildingWallDepth/2]},occupied:false}));
   const signature=JSON.stringify({width:p.buildingWidth,depth:p.buildingDepth,height:p.buildingStoreyHeight,storeys:p.buildingStoreys,thick:p.buildingWallDepth,layout:attachments.filter(a=>['interiorPartition','staircase','chimney'].includes(a.type)).map(a=>({type:a.type,params:a.params}))});
   const old=records.find(r=>r.id===id),changed=!!old&&old.layoutSignature!==signature;
   const record={id,index,name,seed,width:p.buildingWidth,depth:p.buildingDepth,storeys:p.buildingStoreys,position:[x,0,z],cells,layoutSignature:signature,layoutRevision:(old?.layoutRevision||0)+(changed||!old?1:0),needsFurnishingReview:changed||!!old?.needsFurnishingReview};
   // Finish geometry preparation before replacing the old house. Other game assets are untouched.
   const previous=objects.filter(o=>o.userData?.gameAsset?.kind==='generated-house'&&o.userData.gameAsset.houseId===id);
   const added=[];
   try{
    if(!groupRecord(groupId))createSceneGroupRecord(group);
    for(const spec of merged){spec.name=name+' / '+spec.name;spec.position=[x,0,z];spec.gameAsset={kind:'generated-house',houseId:id,graphId:graph.id,cells,layoutRevision:record.layoutRevision,needsFurnishingReview:record.needsFurnishingReview};added.push(addObject(spec,{record:false,select:false,update:false}));}
   }catch(error){for(const o of added)removeObject(o,{record:false,update:false});throw error;}
   for(const o of previous)removeObject(o,{record:false,update:false});
   const at=records.findIndex(r=>r.id===id);if(at<0)records.push(record);else records[at]=record;
   graph.params.houseBatchOutputs=records;
   graph.generatedIds=objects.filter(o=>o.userData?.gameAsset?.kind==='generated-house'&&o.userData.gameAsset.graphId===graph.id).map(o=>o.userData.id);
   graph.buildVersion=(graph.buildVersion||0)+1;completed++;
   updateAll();
  }
  saveGeometryNodeDraft();
  setGeometryNodeStatus((houseBatchStop?'Stopped. ':'')+'Built '+completed+' house(s). Other outputs were kept.');
 }catch(error){console.error(error);setGeometryNodeStatus('Batch stopped: '+error.message+'. Completed houses are retained; Undo restores the previous scene.');}
 finally{houseBatchBusy=false;houseBatchUiRefresh();updateAll();}
}
function initializeHouseBatchTools(){
 const host=document.getElementById('geometryNodesBody');if(!host)return;
 const root=document.createElement('div');root.id='houseBatchTools';root.hidden=true;
 root.innerHTML='<h3>House Outputs</h3><p>Ctrl/Shift-click to select several houses. Each house keeps its own ID. Cells are reserved floor bounds, not furnished rooms.</p><select aria-label="House outputs" multiple size="7" style="width:100%"></select><div class="grid"><button type="button" data-batch-build="selected">Rebuild Selected</button><button type="button" data-batch-build="all">Rebuild All</button><button type="button" data-batch-stop>Stop after house</button></div><p>Batch parts are combined by material per house to keep the town manageable. Save Project preserves the generated houses and cell metadata; Save .bwnc preserves the recipe.</p>';
 host.prepend(root);
 root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-batch-stop')){houseBatchStop=true;return;}const graph=activeGeometryNodeGraph();if(!graph)return;buildHouseBatch(graph,b.dataset.batchBuild==='all'?null:[...root.querySelector('select').selectedOptions].map(o=>Number(o.value)));});
 document.getElementById('geometryNodeGraphSelect')?.addEventListener('change',houseBatchUiRefresh);
 const canvas=document.getElementById('geometryNodeCanvas');if(canvas)new MutationObserver(houseBatchUiRefresh).observe(canvas,{childList:true});
 houseBatchUiRefresh();
}


const els=Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.getElementById('pluginPreview').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#17262a');scene.add(new THREE.HemisphereLight(0xffffff,0x354532,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(7,12,-9);scene.add(light);
const camera=new THREE.PerspectiveCamera(45,2,.01,10000),controls=new OrbitControls(camera,renderer.domElement);camera.position.set(7,6,-12);controls.target.set(0,2,0);controls.update();
new ResizeObserver(()=>{const w=document.getElementById('pluginPreview').clientWidth;if(w){renderer.setSize(w,320);camera.aspect=w/320;camera.updateProjectionMatrix();}}).observe(document.getElementById('pluginPreview'));
let previewDetached=false;
renderer.setAnimationLoop(()=>{if(!previewDetached)renderer.render(scene,camera);});
function addObject(spec){
 if(objects.length>=5000)throw Error('Preview limit: 5,000 parts. Reduce the graph or batch size.');
 const g=spec.geometry?geometryFromData(spec.geometry):shapeFactories[spec.shape]?.();if(!g)throw Error('Unsupported shape: '+spec.shape);
 const material=new THREE.MeshStandardMaterial({color:spec.color||'#ffffff',roughness:spec.roughness??.8,side:spec.doubleSided?THREE.DoubleSide:THREE.FrontSide,vertexColors:!!g.getAttribute('color')});
 if(/^data:image\//i.test(spec.textureUrl||'')){new THREE.TextureLoader().load(spec.textureUrl,texture=>{texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.needsUpdate=true;});}
 const mesh=new THREE.Mesh(g,material);mesh.name=spec.name||'Node part';mesh.position.fromArray(spec.position||[0,0,0]);mesh.rotation.set(...(spec.rotation||[0,0,0]).map(v=>THREE.MathUtils.degToRad(v)));mesh.scale.fromArray(spec.scale||[1,1,1]);mesh.userData={...spec,id:crypto.randomUUID(),_sceneTextureUrl:spec.textureUrl||null};mesh.updateMatrixWorld(true);objects.push(mesh);scene.add(mesh);return mesh;
}
function removeObject(mesh){const index=objects.indexOf(mesh);if(index>=0)objects.splice(index,1);scene.remove(mesh);mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}
function encodeParts(meshes){return meshes.map(mesh=>{mesh.updateMatrixWorld(true);return {name:mesh.name,geometry:geometryToData(mesh.geometry),position:mesh.position.toArray(),rotation:[mesh.rotation.x,mesh.rotation.y,mesh.rotation.z],scale:mesh.scale.toArray(),color:'#'+mesh.material.color.getHexString(),roughness:mesh.material.roughness??.8,doubleSided:mesh.material.side===THREE.DoubleSide,textureUrl:mesh.userData._sceneTextureUrl||null,textureName:mesh.userData.textureName||null,gameAsset:mesh.userData.gameAsset||null};});}
function updateAll(){
 const graph=activeGeometryNodeGraph(),built=(graph?.generatedIds||[]).map(findObject).filter(Boolean);if(!built.length)return;
 const bounds=new THREE.Box3();for(const mesh of built)bounds.expandByObject(mesh);const center=bounds.getCenter(new THREE.Vector3()),size=Math.max(1,bounds.getSize(new THREE.Vector3()).length());controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(size*.65,size*.45,-size));camera.lookAt(center);controls.update();
 if(!houseBatchBusy)parent.postMessage({type:'bws-graph-result',graph,parts:encodeParts(built)},'*');
}
window.addEventListener('message',event=>{
 if(event.source!==parent)return;const data=event.data;
 if(data?.type==='bws-graph-preview-detached'){
  previewDetached=data.detached===true;document.getElementById('pluginPreview').hidden=previewDetached;
  if(previewDetached)document.getElementById('geometryNodesSection').scrollIntoView({block:'start'});
  return;
 }
 try{
  if(data?.type==='bws-graph-snapshot'){geometryNodeProjectState=sanitizeGeometryNodeProjectState(data.state,{allowEmpty:true});textureLibrary.clear();for(const texture of data.textures||[])textureLibrary.set(texture.name,texture);renderGeometryNodeEditor();setGeometryNodeStatus('Graph library copied. Changes stay here until you choose Save graphs to BWS.');}
  if(data?.type==='bws-graph-preview-request'){
   const graph=sanitizeGeometryNodeGraph(data.graph),result=buildGeometryNodeTree({graphOverride:graph,previewOnly:true})||[];
   try{parent.postMessage({type:'bws-graph-preview-result',requestId:data.requestId,parts:encodeParts(result)},'*');}finally{for(const mesh of result){mesh.geometry.dispose();mesh.material.dispose();}}
  }
 }catch(error){if(data?.requestId)parent.postMessage({type:'bws-graph-preview-error',requestId:data.requestId,message:error.message},'*');else setGeometryNodeStatus(error.message);}
});
initializeGeometryNodes();geometryNodesRuntimeEnabled=true;initializeHouseBatchTools();renderGeometryNodeEditor();
document.getElementById('geometryNodeDetachBtn').textContent='Fullscreen node editor';
document.getElementById('geometryNodeBuildBtn').textContent='Build preview';
parent.postMessage({type:'bws-plugin-ready'},'*');

// The standalone plugin cannot open the editor's old detached popup.
const oldGraphExpand=document.getElementById('geometryNodeDetachBtn');
const graphExpand=oldGraphExpand.cloneNode(true);oldGraphExpand.replaceWith(graphExpand);
graphExpand.textContent='Fullscreen workspace';graphExpand.title='Expand this plugin workspace without opening a popup';
graphExpand.addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
 catch{setGeometryNodeStatus('Fullscreen is unavailable here. The graph remains editable below.');}
});
document.addEventListener('fullscreenchange',()=>{graphExpand.textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen workspace';});
const truckTemplate=document.createElement('button');truckTemplate.type='button';truckTemplate.textContent='Cargo Truck template';
document.querySelector('[data-geometry-house-template]').after(truckTemplate);
truckTemplate.addEventListener('click',()=>{
 if(geometryNodeProjectState.graphs.length>=24){setGeometryNodeStatus('Graph library full. Free a graph slot before adding a template.');return;}
 const graph=defaultGeometryNodeGraph('Cargo Truck');graph.nodeOrder=['seed','vehicleCargoTruck','output'];
 graph.connections=[{id:geometryNodeId('link'),fromNodeId:'seed',toNodeId:'vehicleCargoTruck',toInputIndex:0},{id:geometryNodeId('link'),fromNodeId:'vehicleCargoTruck',toNodeId:'output',toInputIndex:0}];
 graph.nodePositions={seed:[40,40],vehicleCargoTruck:[330,40],output:[650,40]};graph.nodeParams={};graph.smoothNodes=[];graph.generatedIds=[];graph.params.outputName='Cargo Truck';
 geometryNodeProjectState.graphs.push(graph);geometryNodeProjectState.activeGraphId=graph.id;saveGeometryNodeDraft();renderGeometryNodeEditor();
 buildGeometryNodeTree();document.getElementById('pluginPreview').scrollIntoView({block:'start'});
});
