import * as THREE from 'three';

export function createPreviewAxisGuide(container,camera,onView,top=8){
 const doc=container.ownerDocument,root=doc.createElement('div');
 root.style.cssText='position:absolute;right:8px;top:'+top+'px;z-index:25;width:130px;background:#102024df;border:1px solid #476358;border-radius:6px;padding:5px;box-sizing:border-box;color:#e6eee9;font:11px Verdana,sans-serif';
 root.setAttribute('aria-label','Preview axis directions');
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 120 92');svg.style.cssText='display:block;width:120px;height:92px;pointer-events:none';root.append(svg);
 const colors=['#ff7777','#8adb81','#7abaff'],marks=[];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const line=doc.createElementNS(svg.namespaceURI,'line'),label=doc.createElementNS(svg.namespaceURI,'text');
  line.setAttribute('stroke',colors[axis]);line.setAttribute('stroke-width',sign>0?'2':'1');
  if(sign<0)line.setAttribute('stroke-dasharray','3 2');
  label.setAttribute('fill',colors[axis]);label.setAttribute('text-anchor','middle');label.setAttribute('font-size','10');label.textContent=(sign>0?'+':'-')+'XYZ'[axis];svg.append(line,label);marks.push({axis,sign,line,label});
 }
 const buttons=doc.createElement('div');buttons.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:3px';
 for(const sign of [1,-1])for(let axis=0;axis<3;axis++){
  const button=doc.createElement('button');button.type='button';button.textContent=(sign>0?'+':'-')+'XYZ'[axis];button.title='View from '+button.textContent;
  button.style.cssText='padding:4px 2px;min-width:0;background:#21353c;border:1px solid #476358;border-radius:3px;color:'+colors[axis]+';font:11px Verdana,sans-serif';
  button.addEventListener('click',()=>onView(axis,sign));buttons.append(button);
 }
 root.append(buttons);container.append(root);
 return {dispose(){root.remove();},update(){
  const inverse=camera.quaternion.clone().invert();
  for(const mark of marks){const v=new THREE.Vector3();v.setComponent(mark.axis,mark.sign);v.applyQuaternion(inverse);
   mark.line.setAttribute('x1','60');mark.line.setAttribute('y1','46');mark.line.setAttribute('x2',String(60+v.x*29));mark.line.setAttribute('y2',String(46-v.y*29));
   mark.label.setAttribute('x',String(60+v.x*40));mark.label.setAttribute('y',String(49-v.y*40));mark.label.setAttribute('opacity',v.z<-.1?'.55':'1');
  }
 }};
}
