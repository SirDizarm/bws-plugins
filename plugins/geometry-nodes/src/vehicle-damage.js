import * as THREE from 'three';

export const VEHICLE_DAMAGE_FIELDS={
 vehicleDamageTyres:['Broken tyres','mixed',['none','flat','missing','mixed']],
 vehicleDamagePanels:['Missing and bent panels',true],
 vehicleBurn:['Fire damage / scorch',0,0,1,.05],
 vehicleFlames:['Show static flames and smoke',false]
};

// Applied per source instance, before assembly placement. Not a fire simulation.
export function createVehicleDamage(p,{seed,emit}){
 const broken=p.themeCondition==='broken',wear=p.themeWear??.45,burn=p.vehicleBurn||0;
 const engine=new THREE.Box3();
 const seenMirrorSupports=new Set(),missingMirrorSupports=new Set();
 function random(name){let h=seed>>>0;for(const c of name)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h/4294967295;}
 return {
  emit(g,name,pos,color,roughness,metadata){
   const text=name.toLowerCase(),r=random(text),panel=/panel|hood|bonnet|door|wing|mudguard|fender|sideboard|plank|tailgate|cab roof/.test(text),glass=/glass|glazing|windshield|window/.test(text),tyre=/tyre|tire|tread/.test(text)&&!/track/.test(text);
   g.computeBoundingBox();const b=g.boundingBox,c=b.getCenter(new THREE.Vector3()).add(new THREE.Vector3(...pos));
   if(/engine|bonnet|hood|counterweight/.test(text))engine.union(b.clone().translate(new THREE.Vector3(...pos)));
   const tyreMode=p.vehicleDamageTyres||'mixed',missing=broken&&tyre&&(tyreMode==='missing'||tyreMode==='mixed')&&c.x>0&&c.z<0;
   const removed=missing||(broken&&p.vehicleDamagePanels!==false&&(glass?r<.7:panel&&r<.2+wear*.35));
   const pillar=text.match(/^window pillar (-?1) /);
   if(pillar&&!seenMirrorSupports.has(pillar[1])){
    seenMirrorSupports.add(pillar[1]);
    if(removed)missingMirrorSupports.add(pillar[1]);
   }
   const mirror=text.match(/^mirror (?:arm|housing|face) (-?1)$/);
   if(removed||(mirror&&missingMirrorSupports.has(mirror[1]))){g.dispose();return;}
   if(broken&&tyre&&(tyreMode==='flat'||tyreMode==='mixed')&&c.x<0&&c.z>0){
    // Preserve the circular bead around the rim and the original ground level.
    // Spread the lower sidewall into a flat contact patch instead of shrinking
    // the entire tyre away from its unchanged wheel hardware.
    const a=g.attributes.position,base=b.min.y,cy=(b.min.y+b.max.y)/2,radius=(b.max.y-b.min.y)/2;
    if(radius>0)for(let i=0;i<a.count;i++){
     const x=a.getX(i),y=a.getY(i),dy=y-cy;
     const sidewall=THREE.MathUtils.clamp((Math.hypot(x,dy)/radius-.62)/.30,0,1);
     const lower=THREE.MathUtils.clamp((-dy/radius-.55)/.30,0,1),blend=sidewall*lower;
     a.setY(i,y+(base-y)*blend);a.setX(i,x*(1+.10*blend));
    }
    a.needsUpdate=true;g.computeVertexNormals();
   }
   if(broken&&panel&&p.vehicleDamagePanels!==false){
    const a=g.attributes.position,center=b.getCenter(new THREE.Vector3());
    for(let i=0;i<a.count;i++){const x=a.getX(i)-center.x,y=a.getY(i)-center.y;a.setZ(i,a.getZ(i)+Math.sin(x*3+y*2)*(.08+wear*.16));}g.computeVertexNormals();
   }
   if(burn){const c=new THREE.Color(color);c.lerp(new THREE.Color(tyre?'#151313':'#29211c'),burn*(.65+r*.3));color='#'+c.getHexString();roughness=.99;}
   emit(g,name,pos,color,roughness,metadata);
  },
  finish(){
   if(!p.vehicleFlames||engine.isEmpty())return 0;
   const c=engine.getCenter(new THREE.Vector3()),size=engine.getSize(new THREE.Vector3()),height=Math.max(.5,Math.min(1.8,size.y)),top=engine.max.y;
   for(let i=0;i<5;i++){
    const x=c.x+(i-2)*.17,z=c.z+Math.sin(i*2)*.15,g=new THREE.ConeGeometry(.13+(i%2)*.08,height*(.7+i*.1),7);
    emit(g,'static vehicle flame '+i,[x,top+height*.4,z],i%2?'#efa335':'#bc4b24',1,{version:1,role:'effect',joints:[],poseOnly:true});
    const smoke=new THREE.IcosahedronGeometry(.24+i*.055,1);emit(smoke,'static vehicle smoke '+i,[c.x+i*.09,top+height+i*.3,c.z],'#45423e',1,{version:1,role:'effect',joints:[],poseOnly:true});
   }
   return 10;
  }
 };
}
