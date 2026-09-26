import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const materials = new Map<string, T.MeshStandardMaterial>();
export function material(color: number | string, roughness = .85) {
  const key = `${color}:${roughness}`;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness }));
  return materials.get(key)!;
}
const boxGeo = new T.BoxGeometry(1, 1, 1);
const sphereGeo = new T.SphereGeometry(1, 10, 8);
export function box(g: T.Group, x:number,y:number,z:number,w:number,h:number,d:number,c:number|string|T.Material) {
  const m = new T.Mesh(boxGeo, c instanceof T.Material ? c : material(c));
  m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
export function sphere(g:T.Group,x:number,y:number,z:number,r:number,c:number|string,sx=1,sy=1,sz=1) {
  const m=new T.Mesh(sphereGeo,material(c));m.position.set(x,y,z);m.scale.set(r*sx,r*sy,r*sz);m.castShadow=true;g.add(m);return m;
}
export function tube(g:T.Group,a:number[],b:number[],r:number,c:number|string,segments=7) {
  const v=new T.Vector3(...b as [number,number,number]).sub(new T.Vector3(...a as [number,number,number]));
  const m=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),segments),material(c));m.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());m.castShadow=true;g.add(m);return m;
}
export function canvasTexture(w:number,h:number,draw:(c:CanvasRenderingContext2D)=>void) {
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d')!);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
export function textured(tex:T.Texture) { return new T.MeshStandardMaterial({map:tex,roughness:.95}); }
const vertexMaterials=new Map<string,T.MeshStandardMaterial>();
function vertexBatch(source:T.Material,geo:T.BufferGeometry):T.Material {
 if(!(source instanceof T.MeshStandardMaterial)||source.transparent||source.opacity!==1||source.normalMap||source.roughnessMap||source.metalnessMap||source.aoMap||source.alphaMap||source.emissiveMap||source.bumpMap||source.displacementMap)return source;
 const key=[source.map?.uuid||'',source.roughness,source.metalness,source.side,source.alphaTest,source.depthTest,source.depthWrite,source.flatShading,source.emissive.getHex(),source.emissiveIntensity].join(':');
 let target=vertexMaterials.get(key);
 if(!target){target=source.clone();target.color.set(0xffffff);target.vertexColors=true;vertexMaterials.set(key,target);}
 const count=geo.getAttribute('position').count,existing=source.vertexColors?geo.getAttribute('color'):undefined,colors=new Float32Array(count*3);
 for(let i=0;i<count;i++){colors[i*3]=source.color.r*(existing?existing.getX(i):1);colors[i*3+1]=source.color.g*(existing?existing.getY(i):1);colors[i*3+2]=source.color.b*(existing?existing.getZ(i):1);}
 geo.setAttribute('color',new T.BufferAttribute(colors,3));
 if(!geo.getAttribute('uv'))geo.setAttribute('uv',new T.BufferAttribute(new Float32Array(count*2),2));
 if(!geo.getAttribute('normal'))geo.computeVertexNormals();
 if(!geo.index){const indices=Array.from({length:count},(_,i)=>i);geo.setIndex(indices);}
 return target;
}
function batchMeshes(root:T.Group,preserveAnimation:boolean){
 root.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(root.matrixWorld).invert(),batches=new Map<T.Material,T.BufferGeometry[]>(),remove:T.Mesh[]=[];
 root.traverse(o=>{
  if(!(o instanceof T.Mesh)||Array.isArray(o.material))return;
  if(preserveAnimation){let parent:T.Object3D|null=o;while(parent&&parent!==root){if(parent.userData.dynamic)return;parent=parent.parent;}}
  else if(o.userData.dynamic)return;
  const geo=o.geometry.clone();geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));const mat=vertexBatch(o.material,geo);
  if(!batches.has(mat))batches.set(mat,[]);batches.get(mat)!.push(geo);remove.push(o);
 });
 const released=new Set<T.BufferGeometry>();
 for(const m of remove){m.removeFromParent();if(m.geometry!==boxGeo&&m.geometry!==sphereGeo&&!released.has(m.geometry)){m.geometry.dispose();released.add(m.geometry);}}
 for(const [mat,geos]of batches){const merged=mergeGeometries(geos);for(const geo of geos)geo.dispose();if(merged){const mesh=new T.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}}
}
export function mergeStatic(root:T.Group){batchMeshes(root,false);}
const ink=0x243d3c, rubber=0x242a2a, chrome=0xc1c9bc;
function wheel(g:T.Group,x:number,y:number,z:number,r=.43,wide=.09,spokes=true) {
  const hub=new T.Group();hub.position.set(x,y,z);g.add(hub);hub.userData.dynamic=true;
  const tire=new T.Mesh(new T.TorusGeometry(r,wide,8,28),material(rubber));tire.rotation.y=Math.PI/2;tire.castShadow=true;hub.add(tire);
  for(const sign of [-1,1]){
    const rim=new T.Mesh(new T.TorusGeometry(r*.88,.019,5,28),material(chrome,.35));rim.rotation.y=Math.PI/2;rim.position.x=sign*wide*.48;hub.add(rim);
  }
  if(spokes){
    const points:number[]=[];
    for(let j=0;j<20;j++){const a=j*Math.PI/10,side=j%2?1:-1;points.push(side*.035,Math.cos(a+.4)*.06,Math.sin(a+.4)*.06,side*wide*.45,Math.cos(a)*r*.86,Math.sin(a)*r*.86);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));hub.add(new T.LineSegments(geo,new T.LineBasicMaterial({color:0xa8b4ad,transparent:true,opacity:.75})));
    tube(hub,[-wide,0,0],[wide,0,0],.042,chrome,8);
  } else {const cap=new T.Mesh(new T.CylinderGeometry(r*.54,r*.54,wide*2.2,12),material(chrome));cap.rotation.z=Math.PI/2;hub.add(cap);}
  return hub;
}
export type Model = T.Group & {userData:{wheels?:T.Group[];legs?:T.Group[];rider?:T.Group;[key:string]:unknown}};
function capsule(g:T.Group,x:number,y:number,z:number,rx:number,ry:number,rz:number,c:number|string){
 const m=new T.Mesh(new T.CapsuleGeometry(1,1,4,10),material(c));m.position.set(x,y,z);m.scale.set(rx,ry/1.5,rz);m.castShadow=true;g.add(m);return m;
}
const legUp=new T.Vector3(0,1,0),legDelta=new T.Vector3();
function placeLimb(m:T.Mesh,ay:number,az:number,by:number,bz:number){
 legDelta.set(0,by-ay,bz-az);m.position.set(0,(ay+by)/2,(az+bz)/2);m.scale.y=legDelta.length();m.quaternion.setFromUnitVectors(legUp,legDelta.normalize());
}
function rider(parent:T.Group,shirt=0xd99936,z=.1,motor=false) {
  const g=new T.Group();g.position.set(0,0,z);g.userData.dynamic=true;parent.add(g);
  const skin=0xa9754d,trousers=0x294946;
  const upper=new T.Group();upper.position.set(0,1.1,.04);upper.rotation.x=-.19;g.add(upper);
  // Tailored round shirt, broad shoulders and narrower waist.
  const contour=[new T.Vector2(0,0),new T.Vector2(.20,.01),new T.Vector2(.235,.10),new T.Vector2(.26,.40),new T.Vector2(.23,.53),new T.Vector2(.13,.60),new T.Vector2(0,.60)];
  const torso=new T.Mesh(new T.LatheGeometry(contour,12),material(shirt));torso.scale.z=.64;torso.castShadow=true;upper.add(torso);
  capsule(upper,0,.04,.005,.215,.055,.143,shirt);
  // Cloth seams, rear yoke and rolled sleeve cuffs remain visible from the chase camera.
  tube(upper,[-.19,.44,.135],[.19,.44,.135],.009,0xb77b32,5);
  tube(upper,[0,.04,.15],[0,.42,.155],.006,0xba8038,5);
  tube(upper,[-.18,.08,.135],[-.10,.14,.15],.005,0xf0ba60,5);
  tube(upper,[.11,.24,.158],[.20,.29,.14],.005,0xf0ba60,5);
  capsule(upper,0,.64,-.015,.076,.12,.071,skin);
  sphere(upper,0,.81,-.026,.172,skin,.86,1.14,.92);
  for(const sign of [-1,1])sphere(upper,sign*.148,.81,-.02,.039,skin,.65,1,.65);
  sphere(upper,0,.91,-.005,.166,motor?0x285866:0x202d2b,1,.60,1.01);
  sphere(upper,0,.84,.085,.139,motor?0x285866:0x202d2b,1,.73,.51);
  sphere(upper,0,.8,-.176,.036,skin,.8,.9,1.1);
  if(motor){box(upper,0,.84,-.151,.24,.085,.028,0x193b44);tube(upper,[-.14,.8,0],[0,.70,-.06],.012,ink);}
  else{for(const sign of [-1,1])sphere(upper,sign*.058,.847,-.172,.013,0x172c2b,1,.6,.35);}
  capsule(g,0,1.05,.08,.215,.16,.17,trousers);
  for(const sign of [-1,1]){
    const shoulder=[sign*.225,1.57,-.06],elbow=[sign*.31,1.35,-.34],hand=[sign*.34,1.25,-.76];
    const sleeve=tube(g,shoulder,elbow,.085,shirt,10);sleeve.scale.x=1.05;
    sphere(g,sign*.24,1.56,-.09,.09,shirt,1,1.1,1);
    tube(g,[sign*.305,1.38,-.31],[sign*.315,1.33,-.36],.09,0xeab55b,10);
    tube(g,elbow,hand,.048,skin,9);sphere(g,sign*.34,1.25,-.76,.065,skin,1,.8,1.2);
  }
  const legs:T.Group[]=[];
  for(const sign of [-1,1]){
    const leg=new T.Group();leg.position.set(sign*.145,1.04,.08);leg.userData.dynamic=true;g.add(leg);
    const thigh=new T.Mesh(new T.CylinderGeometry(.096,.080,1,10),material(trousers));
    const calf=new T.Mesh(new T.CylinderGeometry(.074,.053,1,10),material(trousers));
    thigh.castShadow=calf.castShadow=true;leg.add(thigh,calf);
    const knee=sphere(leg,0,-.3,-.3,.08,trousers);
    const shoe=capsule(leg,0,-.57,-.13,.072,.05,.15,0x172e2b);
    leg.userData.thigh=thigh;leg.userData.calf=calf;leg.userData.knee=knee;leg.userData.shoe=shoe;leg.userData.motor=motor;
    legs.push(leg);
  }
  return {g,legs};
}
let artMat:T.MeshStandardMaterial;
function rickshawArt() {
 if(artMat)return artMat;
 artMat=textured(canvasTexture(256,256,c=>{
  c.fillStyle='#155748';c.fillRect(0,0,256,256);c.strokeStyle='#ffc758';c.lineWidth=9;c.strokeRect(9,9,238,238);c.strokeStyle='#ed5d3d';c.lineWidth=5;c.strokeRect(22,22,212,212);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const x=128+88*Math.cos(a),y=128+88*Math.sin(a);c.fillStyle=i%2?'#f4b73d':'#e86875';c.beginPath();c.ellipse(x,y,13,7,a,0,Math.PI*2);c.fill();}
  c.fillStyle='#77c2c2';c.beginPath();c.arc(128,122, 61,0,Math.PI*2);c.fill();c.fillStyle='#f4cf69';c.beginPath();c.arc(151,93,17,0,Math.PI*2);c.fill();
  c.fillStyle='#1e7352';c.beginPath();c.moveTo(65,163);c.quadraticCurveTo(105,100,148,160);c.lineTo(192,161);c.lineTo(192,191);c.lineTo(65,191);c.fill();
  for(const [x,y,s] of [[104,129,1],[151,142,-1]]){c.save();c.translate(x,y);c.scale(s,1);c.fillStyle='#e45435';c.beginPath();c.ellipse(0,0,16,10,-.2,0,Math.PI*2);c.fill();c.beginPath();c.arc(12,-9,8,0,Math.PI*2);c.fill();c.fillStyle='#ffe7a6';c.beginPath();c.moveTo(17,-10);c.lineTo(28,-7);c.lineTo(17,-4);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(13,-11,2,0,7);c.fill();c.restore();}
  c.fillStyle='#ffe6a1';c.font='bold 21px sans-serif';c.textAlign='center';c.fillText('ঢাকা',128,220);
 }));return artMat;
}

export function createVehicle(kind:string,color=0x2a968c):Model {
 const g=new T.Group() as Model; const wheels:T.Group[]=[];g.userData.wheels=wheels;g.userData.kind=kind;
 if(kind==='bicycle'||kind==='rickshaw'||kind==='motorbike'){
  const motor=kind==='motorbike',rick=kind==='rickshaw';const r=motor?.4:.43;
  wheels.push(wheel(g,0,r,-.83,r,motor?.12:.065));
  if(rick){for(const s of [-1,1])wheels.push(wheel(g,s*.65,r,.83));}
  else wheels.push(wheel(g,0,r,.8,r,motor?.12:.065));
  const frame=color;
  for(const [a,b] of [[[0,r,.8],[0,1,.24]],[[0,1,.24],[0,.42,-.05]],[[0,.42,-.05],[0,r,.8]],[[0,1,.24],[0,1.08,-.64]],[[0,1.08,-.64],[0,.42,-.05]],[[0,1.08,-.64],[0,r,-.83]]] as number[][][])tube(g,a,b,motor?.09:.038,frame);
  tube(g,[0,1.08,-.64],[0,1.28,-.77],.032,chrome);tube(g,[-.36,1.28,-.77],[.36,1.28,-.77],.03,chrome);
  box(g,0,1.05,.23,.3,.065,.35,0x26332f);box(g,0,.6,.93,.09,.15,.05,0xd63e26);
  if(motor){sphere(g,0,.84,-.22,.32,frame,.8,.72,1.4);box(g,0,.46,.1,.4,.3,.5,ink);tube(g,[.25,.4,0],[.25,.4,.9],.075,chrome);sphere(g,0,1.1,-.9,.15,0xffe3a0);}
  if(!motor){
    for(const sign of [-1,1]){
      tube(g,[sign*.07,.43,-.83],[sign*.055,1.08,-.64],.025,chrome);
      tube(g,[sign*.12,.43,.8],[sign*.13,.92,.69],.018,chrome);
      tube(g,[sign*.13,.91,.48],[sign*.13,.91,1.04],.019,chrome);
    }
    for(const zz of [.5,.66,.83,1.0])tube(g,[-.14,.91,zz],[.14,.91,zz],.017,chrome);
    for(const zz of [-.83,.8]){
      const fender=new T.Mesh(new T.TorusGeometry(.50,.025,5,22,Math.PI*.85),material(color,.55));
      fender.rotation.y=Math.PI/2;fender.rotation.x=-Math.PI*.43;fender.position.set(0,.43,zz);g.add(fender);
    }
    const chain=new T.Mesh(new T.TorusGeometry(.145,.012,4,16),material(chrome,.5));chain.rotation.y=Math.PI/2;chain.position.set(.08,.43,-.03);g.add(chain);
    tube(g,[.10,.30,-.03],[.10,.37,.8],.01,ink,5);tube(g,[.10,.57,-.03],[.10,.49,.8],.01,ink,5);
    box(g,0,.81,1.055,.08,.12,.025,0xe45633);
  }
  const person=rider(g,0xd69d45,rick?-.25:0,motor);g.userData.legs=person.legs;g.userData.rider=person.g;
  if(rick){
    box(g,0,.63,.82,1.35,.2,1.12,0xc8473c);box(g,0,.86,.79,1.2,.27,.72,0xd65657);box(g,0,1.17,1.23,1.27,.72,.1,0x1b6858);
    box(g,0,1.13,1.291,1.12,.65,.012,rickshawArt());
    // Arched hood, decorated rear-facing panel and brass supports.
    const arch=new T.Shape();arch.moveTo(-.69,0);arch.absarc(0,0,.69,Math.PI,0,true);arch.lineTo(.69,-.05);arch.absarc(0,-.05,.64,0,Math.PI,false);arch.closePath();
    const hoodGeo=new T.ExtrudeGeometry(arch,{depth:1.04,bevelEnabled:false,curveSegments:14});
    const hood=new T.Mesh(hoodGeo,material(0x155b53));hood.position.set(0,1.54,.33);hood.castShadow=true;g.add(hood);
    const rearArch=new T.Shape();rearArch.moveTo(-.65,0);rearArch.absarc(0,0,.65,Math.PI,0,true);rearArch.lineTo(.65,-.48);rearArch.lineTo(-.65,-.48);rearArch.closePath();
    const panelGeo=new T.ShapeGeometry(rearArch,18);const positions=panelGeo.getAttribute('position'),uv=panelGeo.getAttribute('uv');
    for(let i=0;i<positions.count;i++)uv.setXY(i,(positions.getX(i)+.65)/1.3,(positions.getY(i)+.48)/1.13);
    const rearPanel=new T.Mesh(panelGeo,rickshawArt());rearPanel.position.set(0,1.54,1.385);g.add(rearPanel);
    for(const zz of [.33,1.37]){const trim=new T.Mesh(new T.TorusGeometry(.69,.025,5,24,Math.PI),material(0xe8b74c));trim.position.set(0,1.54,zz);g.add(trim);}
    for(const sign of [-1,1])for(let i=0;i<5;i++)sphere(g,sign*.7,1.48,.38+i*.23,.036,i%2?0xe98a6a:0xf1c668);
    for(const s of [-1,1]){tube(g,[s*.65,.73,.3],[s*.65,1.6,.3],.03,0xefbb54);tube(g,[s*.65,.7,1.26],[s*.65,1.61,1.26],.03,0xefbb54);}
    for(let i=0;i<9;i++){sphere(g,(i-4)*.15,1.57+Math.sqrt(Math.max(0,.55-((i-4)*.15)**2)),1.44,.043,i%2?0xf6c659:0xe65d60);}
  }
 } else {
  const bus=kind==='bus',truck=kind==='truck',cng=kind==='cng';
  const w=bus?2.2:truck?2.35:cng?1.4:1.8, len=bus?5.7:truck?5.2:cng?2.5:3.45;const r=truck?.47:.37;
  if(cng){wheels.push(wheel(g,0,r,-len*.37,r,.12,false));for(const side of [-1,1])wheels.push(wheel(g,side*w*.49,r,len*.32,r,.12,false));}
  else for(const z of [-len*.32,len*.32])for(const side of [-1,1])wheels.push(wheel(g,side*w*.49,r,z,r,.14,false));
  box(g,0,.57,0,w,.35,len,ink);
  box(g,0,.92,0,w,.52,len,color);
  if(bus){box(g,0,1.83,0,w,.98,len*.96,color);box(g,0,2.4,0,w*1.01,.18,len,0xe7d3a0);
    for(const z of [-2,-1,0,1,2])for(const s of [-1,1])box(g,s*(w/2+.008),1.87,z,.02,.62,.76,0x2d5658);
    box(g,0,1.87,-len/2-.01,w*.88,.67,.025,0x325756);box(g,0,1.87,len/2+.01,w*.85,.6,.025,0x325756);
    box(g,0,1.4,len/2+.023,w*.84,.35,.022,busDecoration());
    box(g,0,1.17,len/2+.015,w,.15,.02,0xf1c753);for(const s of [-1,1])box(g,s*w/2,1.15,0,.022,.16,len,0xf1c753);
    for(const z of [-1.9,-.8,.3,1.4])for(const s of [-1,1])sphere(g,s*w*.35,1.82,z,.13,0x885b41);
  } else if(truck){box(g,0,1.48,-1.45,w,.88,2,color);box(g,0,2,-1.4,w,.16,2,0xe9b34b);box(g,0,1.58,-2.46,w*.82,.5,.035,0x365958);box(g,0,1.57,-.43,w*.75,.37,.025,0x325756);box(g,0,1.52,1.15,w*.94,1.17,2.9,0xb86834);
    for(let j=0;j<5;j++){box(g,0,1.16+j*.17,2.61,w,.055,.04,0xe2b36b);for(const s of [-1,1])box(g,s*w*.5,1.2+j*.17,1.1,.03,.055,2.95,0xe2b36b);}box(g,0,2.17,1.1,w, .17,3,0x657853);
  }else{const canopy=cng?0x1c5144:color;box(g,0,1.35,.15,w*.9,.65,len*.56,canopy);box(g,0,1.43,len*.295,w*.78,.4,.02,0x406466);box(g,0,1.44,-len*.245,w*.79,.4,.03,0x527576);box(g,0,1.72,.11,w*.95,.12,len*.63,canopy);
   for(const s of [-1,1])box(g,s*w*.453,1.43,.05,.025,.4,len*.42,0x3b6665);
  }
  for(const s of [-1,1]){box(g,s*w*.34,.89,len/2+.025,.22,.17,.05,0xd34730);box(g,s*w*.34,.89,-len/2-.025,.28,.17,.05,0xffe4a1);}
  box(g,0,.57,len/2+.06,w*1.05,.13,.15,chrome);box(g,0,.73,len/2+.09,.45,.14,.025,0xf2d784);
  if(bus||truck){
    // Full-size silhouettes and close-range rear details make overtakes feel physical.
    for(const side of [-1,1]){
      box(g,side*w*.41,.30,len*.33,.37,.43,.05,0x203733);
      box(g,side*w*.405,.36,len*.33+.029,.27,.08,.012,0xe2bd7b);
      box(g,side*w*.42,1.1,len/2+.07,.19,.36,.10,0x202c2c);
      box(g,side*w*.42,1.17,len/2+.13,.13,.14,.02,0xda5337);
      box(g,side*w*.42,.99,len/2+.13,.13,.095,.02,0xe7a43b);
      tube(g,[side*w*.49,1.5,-len*.44],[side*(w*.5+.21),1.65,-len*.46],.025,chrome);
      box(g,side*(w*.5+.24),1.63,-len*.46,.12,.25,.16,0x25423f);
    }
    for(let i=0;i<7;i++)box(g,-w*.33+i*w*.11,.79,len/2+.08,.045,.15,.02,0x394b47);
    for(let i=0;i<22;i++){
      const x=(Math.sin(i*91.2)*.5)*w*.9,y=.61+(i%6)*.10;
      box(g,x,y,len/2+.047,.10+(i%4)*.11,.035+(i%3)*.017,.01,[0x826e4f,0x52655e,0xc09762][i%3]);
    }
    box(g,0,.46,len/2+.15,w*1.04,.16,.17,0x4a5e55);
    if(bus){
      for(let y=1.54;y<2.17;y+=.16)tube(g,[-w*.39,y,len/2+.037],[w*.39,y,len/2+.037],.009,0x253d39,5);
      for(const side of [-1,1])tube(g,[side*w*.43,1.24,len/2+.05],[side*w*.43,2.20,len/2+.05],.018,0x8c9a7b,6);
      for(let i=0;i<6;i++)box(g,0,.67+i*.055,-len/2-.045,w*.6,.02,.03,0x163b38);
      box(g,0,2.27,-len/2-.05,w*.80,.20,.026,busDecoration());
    }else{
      const tail=new T.Mesh(new T.PlaneGeometry(w*.78,.56),truckDecoration());tail.position.set(0,1.58,len/2+.04);g.add(tail);
      for(const side of [-1,1])for(let i=0;i<4;i++)tube(g,[side*w*.42,.84,2.65],[side*w*.42,2.25,1.6-i*.5],.012,0x927a4f,5);
      for(let i=0;i<6;i++)capsule(g,(i%2?1:-1)*.46,2.18+Math.floor(i/2)*.20,.4+Math.floor(i/2)*.57,.49,.22,.46,0xab9b68);
    }
  }

 }
 // Batch body parts by material while preserving the complete animated subtrees.
 if(g.userData.rider)batchVehicleBody(g.userData.rider);
 for(const w of wheels)batchVehicleBody(w);
 batchVehicleBody(g);animateVehicle(g,0,0);return g;
}
function batchVehicleBody(g:T.Group){batchMeshes(g,true);}
let busArt:T.MeshStandardMaterial;
function busDecoration(){
 if(busArt)return busArt;
 busArt=textured(canvasTexture(512,128,c=>{
 c.fillStyle='#137b75';c.fillRect(0,0,512,128);c.strokeStyle='#f6c663';c.lineWidth=5;c.strokeRect(4,4,504,120);
 c.fillStyle='#f8e5ad';c.textAlign='center';c.font='bold 38px sans-serif';c.fillText('ঢাকা পরিবহন',256,54);
 c.font='bold 21px sans-serif';c.fillText('ধীরে চলুন • নিরাপদে ফিরুন',256,92);
 for(const x of [38,474])for(let i=0;i<6;i++){c.save();c.translate(x,64);c.rotate(i*Math.PI/3);c.fillStyle=i%2?'#eb704b':'#f2bf59';c.beginPath();c.ellipse(0,14,5,11,0,0,Math.PI*2);c.fill();c.restore();}
 }));return busArt;
}
let truckArt:T.MeshStandardMaterial;
function truckDecoration(){
 if(truckArt)return truckArt;
 truckArt=textured(canvasTexture(512,160,c=>{
 c.fillStyle='#ad6236';c.fillRect(0,0,512,160);c.strokeStyle='#f3cd72';c.lineWidth=8;c.strokeRect(6,6,500,148);
 c.fillStyle='#fbe6a9';c.textAlign='center';c.font='bold 44px "Noto Sans Bengali",sans-serif';c.fillText('ধীরে চলুন',256,73);
 c.font='bold 25px "Noto Sans Bengali",sans-serif';c.fillText('বাংলাদেশ • ঢাকা',256,122);
 for(const x of [47,465]){c.fillStyle='#246e66';c.beginPath();c.ellipse(x,80,23,54,0,0,Math.PI*2);c.fill();c.fillStyle='#eeb950';c.beginPath();c.arc(x,77,14,0,Math.PI*2);c.fill();}
 }));return truckArt;
}
export function animateVehicle(g:Model,time:number,speed:number,steer=0) {
 const previous=typeof g.userData.animationTime==='number'?g.userData.animationTime:time;
 const delta=Math.max(0,Math.min(.1,time-previous));g.userData.animationTime=time;
 const velocity=Number.isFinite(speed)?Math.max(0,speed):0;
 const phase=(Number(g.userData.pedalPhase)||0)+delta*Math.min(velocity,12)*1.6;
 const wheelPhase=(Number(g.userData.wheelPhase)||0)+delta*velocity*2;
 g.userData.pedalPhase=phase;g.userData.wheelPhase=wheelPhase;
 for(const w of g.userData.wheels||[])w.rotation.x=wheelPhase;
 const legs=g.userData.legs;if(legs)legs.forEach((leg,i)=>{
   const angle=phase+i*Math.PI;
   const ankleY=leg.userData.motor?-.51:-.57+Math.sin(angle)*.19;
   const ankleZ=leg.userData.motor?-.10:-.12+Math.cos(angle)*.19;
   const upperLength=.38,lowerLength=.39,d=Math.min(.769,Math.hypot(ankleY,ankleZ));
   const along=(upperLength*upperLength-lowerLength*lowerLength+d*d)/(2*d),bend=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
   const kneeY=ankleY/d*along-ankleZ/d*bend,kneeZ=ankleZ/d*along+ankleY/d*bend;
   placeLimb(leg.userData.thigh,0,0,kneeY,kneeZ);placeLimb(leg.userData.calf,kneeY,kneeZ,ankleY,ankleZ);
   leg.userData.knee.position.set(0,kneeY,kneeZ);leg.userData.shoe.position.set(0,ankleY-.025,ankleZ-.065);
 });
 if(g.userData.rider){g.userData.rider.rotation.z=-steer*.085;g.userData.rider.position.y=Math.sin(phase*2)*.009;}
 g.rotation.z=-steer*.045;
}
export function pedestrian(shirt=0xe0af75,variant=0,animated=false):Model {
 const g=new T.Group() as Model,skin=[0x956749,0xb57f54,0x875a42][variant%3],cloth=[0x31575b,0x57777b,0x9c6b48][variant%3];
 capsule(g,0,1.02,0,.19,.34,.125,shirt);
 sphere(g,0,1.53,-.025,.15,skin,.88,1.15,1);
 sphere(g,0,1.64,-.01,.145,variant%5===0?0xe3d7b8:0x25352d,1,.5,1);
 for(const side of [-1,1])sphere(g,side*.133,1.53,-.01,.028,skin,.6,1,.7);
 sphere(g,0,1.52,-.165,.028,skin,1,1,1.3);
 if(variant%4===1){
  const skirt=new T.Mesh(new T.CylinderGeometry(.16,.23,.61,10),material(cloth));skirt.position.set(0,.5,.025);g.add(skirt);
  for(let i=0;i<6;i++)box(g,0,.24+i*.1,.247,.35,.022,.015,0x749290);
 }
 if(variant%4===2){capsule(g,.20,.87,.02,.07,.33,.14,0xc48b64);tube(g,[-.15,1.31,.13],[.20,.74,.13],.021,0x8c583d);}
 if(variant%6===3){const scarf=0xb57978;sphere(g,0,1.62,.025,.169,scarf,1,.6,1);capsule(g,-.115,1.34,.045,.074,.20,.098,scarf);capsule(g,.115,1.34,.045,.074,.20,.098,scarf);capsule(g,0,.79,.01,.204,.30,.14,shirt);}
 if(variant%6===4){tube(g,[-.16,1.31,.14],[.17,.99,.15],.027,0xcfbb86);capsule(g,.17,.79,.15,.10,.14,.08,0x8e6e4c);}
 const limbs:T.Group[]=[];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.10,.72,0);leg.userData.dynamic=animated;g.add(leg);
  tube(leg,[0,0,0],[0,-.56,.02],.065,cloth,8);capsule(leg,0,-.62,-.055,.07,.045,.12,0x253d36);batchMeshes(leg,false);limbs.push(leg);
  const arm=new T.Group();arm.position.set(side*.215,1.27,0);arm.userData.dynamic=animated;g.add(arm);
  tube(arm,[0,0,0],[side*.015,-.23,0],.067,shirt,8);tube(arm,[side*.015,-.23,0],[side*.02,-.47,-.015],.04,skin,8);sphere(arm,side*.02,-.48,-.015,.045,skin);batchMeshes(arm,false);limbs.push(arm);
 }
 if(animated){g.userData.walkLimbs=limbs;batchVehicleBody(g);}else mergeStatic(g);
 return g;
}
export function animatePedestrian(g:Model,time:number,walking=false,gesture=0){
 const limbs=g.userData.walkLimbs as T.Group[]|undefined;if(!limbs)return;
 for(let i=0;i<limbs.length;i++)limbs[i].rotation.x=walking?Math.sin(time*6+(i<2?0:Math.PI))*(i%2?.22:.32):0;
 if(gesture>0){limbs[3].rotation.x=-1.8*Math.sin(Math.min(1,gesture)*Math.PI*.65);limbs[3].rotation.z=-.25;}
 else limbs[3].rotation.z=0;
}
export function seatedCow(variant=0):Model {
 const g=new T.Group() as Model,hide=variant%2?0xb8936b:0xd4c8a8,patch=0x795944;
 sphere(g,0,.49,.06,.59,hide,.96,.78,1.6);
 for(const side of [-1,1]){
  capsule(g,side*.38,.20,-.40,.17,.14,.44,hide);capsule(g,side*.38,.20,.54,.21,.14,.32,hide);
  sphere(g,side*.32,.22,-.73,.12,patch,1,.58,1.25);
 }
 capsule(g,0,.72,-.63,.23,.40,.24,hide);
 sphere(g,0,1.04,-.88,.24,hide,.92,1.15,1.25);sphere(g,0,.95,-1.12,.19,0x9d8061,1,.57,.85);
 sphere(g,0,.56,-.69,.20,hide,.55,1.3,.6);
 for(const side of [-1,1]){
  const ear=sphere(g,side*.28,1.12,-.79,.14,hide,1.35,.35,.65);ear.rotation.z=side*.25;
  sphere(g,side*.158,1.11,-1.02,.033,0x21332c,.5,1,.65);
  tube(g,[side*.14,1.21,-.78],[side*.23,1.40,-.76],.045,0xe3dcc1,7);
  tube(g,[side*.23,1.40,-.76],[side*.21,1.50,-.83],.024,0x524b3b,6);
  sphere(g,side*.54,.57,.22,.23,patch,.075,.7,1.15);
 }
 const tail=new T.CatmullRomCurve3([new T.Vector3(.1,.58,.91),new T.Vector3(.55,.22,1.05),new T.Vector3(.67,.14,.55)]);
 g.add(new T.Mesh(new T.TubeGeometry(tail,10,.025,5,false),material(hide)));sphere(g,.67,.14,.55,.07,patch,.6,.6,1.5);
 mergeStatic(g);return g;
}
export function roadHazard(kind:'pothole'|'paan',width:number,length:number,seed=0):Model{
 const g=new T.Group() as Model,r=width/2,segments=20,positions:number[]=[],indices:number[]=[],colors:number[]=[];
 const jitter=(i:number)=>.85+.15*(Math.sin((i+seed)*71.7)*.5+.5);
 const outer=kind==='pothole'?new T.Color(0x6e766d):new T.Color(0xad4530),inner=kind==='pothole'?new T.Color(0x27332f):new T.Color(0x74372a);
 for(let ring=0;ring<3;ring++)for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,scale=ring===0?1:ring===1?.74:0;
  positions.push(Math.cos(a)*r*jitter(i)*scale,ring===0?.034:ring===1?.044:.012,Math.sin(a)*length*.5*jitter(i)*scale);
  const c=ring===0?outer:inner;colors.push(c.r,c.g,c.b);
 }
 for(let ring=0;ring<2;ring++)for(let i=0;i<segments;i++){const next=(i+1)%segments,a=ring*segments+i,b=ring*segments+next,c=(ring+1)*segments+i,d=(ring+1)*segments+next;indices.push(a,c,b,b,c,d);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
 const mat=material(0xffffff).clone();mat.vertexColors=true;g.userData.ownedMaterials=[mat];const basin=new T.Mesh(geo,mat);basin.receiveShadow=true;g.add(basin);
 if(kind==='pothole'){
  const water=new T.Mesh(new T.CircleGeometry(r*.53,16),material(0x526a65,.35));water.rotation.x=-Math.PI/2;water.scale.y=length/width;water.position.y=.021;g.add(water);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const chip=box(g,Math.cos(a)*r*.9,.047,Math.sin(a)*length*.44,.13,.045,.08,0x9d9c87);chip.rotation.y=a;}
 }else for(let i=0;i<9;i++){const a=i*2.39;const drop=new T.Mesh(new T.CircleGeometry(.045+(i%3)*.015,7),material(0xaf5238));drop.rotation.x=-Math.PI/2;drop.position.set(Math.cos(a)*r*.87,.018,Math.sin(a)*length*.43);g.add(drop);}
 mergeStatic(g);mat.dispose();g.userData.ownedMaterials=[];return g;
}

/** Dispose model-owned geometry while retaining shared primitive geometry and materials. */
export function disposeModel(model:T.Object3D){
 model.removeFromParent();
 model.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){if(o.geometry!==boxGeo&&o.geometry!==sphereGeo)o.geometry.dispose();if(o instanceof T.LineSegments){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}}});
}
