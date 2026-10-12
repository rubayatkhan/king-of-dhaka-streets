import * as T from 'three';
import {box,sphere,tube,material,canvasTexture,textured,mergeStatic,createVehicle,coinParts,snackModel,type VehicleLook,animateVehicle,pedestrian,type Model,disposeModel,seatedCow,roadHazard,animatePedestrian} from './models';
import {Simulation,VEHICLES} from './simulation';
import {SHAKE_SECONDS,landingSquash,magnetOpacity,shakeOffset} from './feel';

export const pathX=(z:number)=>Math.sin(z*.008)*5+Math.sin(z*.019)*1.8;
const facades=[0xd99570,0xe8c28c,0xc98591,0x65aaa0,0xe0a48b,0xb5c7bb];
const pennants=[0xe7704c,0x32a08d,0xf0bd51].map(color=>new T.MeshStandardMaterial({color,side:T.DoubleSide}));
type Neighborhood='riverfront'|'bazaar'|'boulevard';
const shops=['শাঁখারী বাজার','চা ও আড্ডা','বাকরখানি','ঢাকা বিরিয়ানি','সদরঘাট লঞ্চ টার্মিনাল','কারওয়ান বাজার','সাইকেল মেরামত','ফুল ও শাঁখা','ঢাকা ট্রেড সেন্টার','সোনার বাংলা','মোবাইল সার্ভিস','পাইকারি বাজার','ফল ও সবজি','সদরঘাট','নদীর হাট','কাপড়ের দোকান'];
const signRows=Math.ceil(shops.length/2);
// Shared across projectile lifetimes, like the other cached materials.
const paanTargetMaterial=new T.MeshBasicMaterial({color:0xff5945,toneMapped:false});
const rand=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function signAtlas(){return textured(canvasTexture(1024,signRows*128,c=>{
 for(let i=0;i<shops.length;i++){
  c.save();c.translate((i%2)*512,Math.floor(i/2)*128);
  c.fillStyle=['#205b50','#913e34','#253f53','#be8c35'][i%4];c.fillRect(0,0,512,128);c.strokeStyle='#e5c88f';c.lineWidth=4;c.strokeRect(7,7,498,114);c.fillStyle='#ffe9ae';c.textAlign='center';c.font='bold 52px "Noto Sans Bengali", "Bangla Sangam MN", sans-serif';c.fillText(shops[i],256,84,474);c.restore();
 }
}));}
function plasterTexture(){return canvasTexture(256,256,c=>{
 c.fillStyle='#f7f6ef';c.fillRect(0,0,256,256);
 for(let i=0;i<2200;i++){c.fillStyle=`rgba(56,59,48,${rand(i)*.09})`;c.fillRect(rand(i+2)*256,rand(i+3)*256,rand(i+4)*7,rand(i+5)*5);}
 for(let i=0;i<22;i++){const x=rand(i+99)*256,y=rand(i+23)*256;c.fillStyle='rgba(75,64,47,.11)';c.beginPath();c.moveTo(x,y);for(let j=0;j<8;j++){const a=j*Math.PI/4;c.lineTo(x+Math.cos(a)*(6+rand(i+j)*17),y+Math.sin(a)*(5+rand(i+j+55)*13));}c.fill();}
 c.strokeStyle='rgba(63,59,44,.15)';c.lineWidth=.7;for(let i=0;i<9;i++){const x=rand(i+144)*256,y=rand(i+55)*256;c.beginPath();c.moveTo(x,y);c.lineTo(x+7,y+18);c.lineTo(x+2,y+32);c.lineTo(x+9,y+43);c.stroke();}
});}
export class World {
 renderer:T.WebGLRenderer; scene=new T.Scene();camera=new T.PerspectiveCamera(58,1,.1,210);
 player:Model; chunks:T.Group[]=[];actors=new Map<number,Model>();palace=new T.Group();
 private currentSimulation?:Simulation;
 private projectiles=new Map<number,Model>();private district:Neighborhood='bazaar';
 private skyLight=new T.HemisphereLight(0xd9efff,0x496d76,1.9);
 private riverMaterial=textured(canvasTexture(256,128,c=>{c.fillStyle='#4c7479';c.fillRect(0,0,256,128);for(let i=0;i<170;i++){c.fillStyle=i%3?'rgba(155,190,179,.14)':'rgba(20,57,64,.17)';c.fillRect(rand(i)*256,rand(i+33)*128,12+rand(i+55)*50,.5+rand(i+66)*2);}}));
 private sun=new T.DirectionalLight(0xffe1b9,2.5);private clock=0;private lastVehicle=-1;
 private signs=Array<T.MeshStandardMaterial>(shops.length).fill(signAtlas());private walls:T.MeshStandardMaterial[];
 private scenery:T.Group;private quality='auto';private scale=1;private frameAvg=16;private frames=0;
 private dust:T.Points;private reduced=false;private shakeRemaining=0;private shakeAmplitude=0;private sinceLanding=Infinity;
 private coinMeshes:T.InstancedMesh[]=[];private snackModels=new Map<number,Model>();private dummy=new T.Object3D();private magnetField=new T.Group();private magnetRipples:T.Mesh[]=[];private streaks!:T.InstancedMesh;private haloMaterials=new Map<string,T.SpriteMaterial>();private haloTexture?:T.Texture;
 private look:VehicleLook={};private lookKey='{}';private builtLookKey='';
 constructor(canvas:HTMLCanvasElement){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.10;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene.background=canvasTexture(4,256,c=>{const gradient=c.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#739bb4');gradient.addColorStop(.6,'#c8d8d5');gradient.addColorStop(1,'#f3d6b1');c.fillStyle=gradient;c.fillRect(0,0,4,256);});this.scene.fog=new T.Fog(0xc8d4cc,80,208);
  this.scene.add(this.skyLight);this.sun.position.set(-24,40,12);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-24,right:24,top:35,bottom:-30,near:1,far:110});this.sun.shadow.bias=-.0007;this.sun.shadow.normalBias=.035;this.scene.add(this.sun,this.sun.target);
  const texture=plasterTexture();this.walls=facades.map(color=>new T.MeshStandardMaterial({color,map:texture,roughness:1}));
  this.riverMaterial.roughness=.46;
  this.scenery=new T.Group();this.scene.add(this.scenery);
  this.makeRoad();
  this.coinMeshes=([1,5] as const).map(v=>{const p=coinParts(v);const m=new T.InstancedMesh(p.geometry,p.materials,256);m.count=0;m.frustumCulled=false;m.castShadow=true;this.scene.add(m);return m;});
  this.makeMagnetField();this.makeStreaks();
  for(let i=0;i<7;i++){const chunk=this.makeChunk(i,'bazaar');chunk.position.z=-i*48;this.chunks.push(chunk);this.scenery.add(chunk);}
  this.makePalace();this.scene.add(this.palace);
  this.player=createVehicle('bicycle');this.scene.add(this.player);
  const dustPos=[];for(let i=0;i<85;i++)dustPos.push((rand(i+801)-.5)*24,rand(i+802)*8, -rand(i+803)*65);
  const dg=new T.BufferGeometry();dg.setAttribute('position',new T.Float32BufferAttribute(dustPos,3));this.dust=new T.Points(dg,new T.PointsMaterial({color:0xffe7af,size:.06,transparent:true,opacity:.48,depthWrite:false}));this.scene.add(this.dust);
  this.resize();
 }
 private makeRoad(){
  const road=new T.Group();const surface=canvasTexture(512,512,c=>{
   c.fillStyle='#626a67';c.fillRect(0,0,512,512);
   // Repairs are quiet broken polygons, not repeating paving slabs.
   for(let patch=0;patch<8;patch++){
    const x=rand(patch+105)*480,y=rand(patch+170)*470,rx=17+rand(patch+140)*42,ry=18+rand(patch+180)*51;
    c.fillStyle=patch%2?'rgba(39,48,43,.09)':'rgba(137,140,124,.09)';c.beginPath();
    for(let j=0;j<11;j++){const a=j/11*Math.PI*2,r=.77+rand(patch*20+j)*.30;const px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r;if(j===0)c.moveTo(px,py);else c.lineTo(px,py);}
    c.closePath();c.fill();
   }
   for(let i=0;i<17000;i++){c.fillStyle=rand(i)>.5?'rgba(205,208,187,.12)':'rgba(20,33,30,.15)';c.fillRect(rand(i+1)*512,rand(i+2)*512,1.3,1.3);}
   c.strokeStyle='rgba(25,38,34,.16)';c.lineWidth=.8;
   for(let i=0;i<20;i++){const x=rand(i+45)*512,y=rand(i+76)*512;c.beginPath();c.moveTo(x,y);c.lineTo(x+4,y+13);c.lineTo(x-1,y+23);c.lineTo(x+3,y+33);c.stroke();}
   for(const x of [155,194,325,365]){const worn=c.createLinearGradient(x-13,0,x+13,0);worn.addColorStop(0,'rgba(25,38,34,0)');worn.addColorStop(.5,'rgba(25,38,34,.055)');worn.addColorStop(1,'rgba(25,38,34,0)');c.fillStyle=worn;c.fillRect(x-13,0,26,512);}
  });
  surface.wrapS=surface.wrapT=T.RepeatWrapping;surface.repeat.set(1,160);
  const points:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let i=0;i<=260;i++){const z=35-i*6,c=pathX(z);points.push(c-6,0,z,c+6,0,z);uv.push(0,i/260,1,i/260);if(i<260){const p=i*2;indices.push(p,p+1,p+2,p+1,p+3,p+2);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new T.Mesh(geo,textured(surface));mesh.receiveShadow=true;this.scene.add(mesh);
  const land=new T.Mesh(new T.PlaneGeometry(1200,4000),material(0x949b84));land.rotation.x=-Math.PI/2;land.position.y=-.09;this.scene.add(land);
  for(let i=0;i<220;i++){const z=20-i*7;box(road,pathX(z),.012,z,.09,.018,2.1,0xc9b991);for(const side of [-1,1]){const gutter=box(road,pathX(z)+side*5.65,.008,z,.7,.012,7.2,0x858775);gutter.rotation.y=Math.atan(.04*Math.cos(z*.008)+.0342*Math.cos(z*.019));}}
  mergeStatic(road);this.scene.add(road);
 }
 private makeChunk(seed:number,neighborhood:Neighborhood){
  const g=neighborhood==='bazaar'?this.makeBazaar(seed):neighborhood==='riverfront'?this.makeRiverfront(seed):this.makeBoulevard(seed);
  g.userData.neighborhood=neighborhood;
  return g;
 }
 private sign(g:T.Group,index:number,x:number,y:number,z:number,width:number,height:number,rotation=0){
  const geo=new T.PlaneGeometry(width,height),uv=geo.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.5+(index%2)*.5,uv.getY(i)/signRows+1-(Math.floor(index/2)+1)/signRows);
  const mesh=new T.Mesh(geo,this.signs[index]);mesh.position.set(x,y,z);mesh.rotation.y=rotation;g.add(mesh);
 }
 private kerb(g:T.Group,side:number){
  box(g,side*6.75,.13,-24,1.5,.26,48,0xb4b3a0);
  for(let k=0;k<24;k++)box(g,side*6.04,.19,-k*2,.16,.33,1.82,k%2?0xd6c9a8:0x4a6060);
  for(let k=0;k<4;k++){
   box(g,side*5.73,.02,-k*12-5,.43,.025,.72,0x394c49);
   for(let slot=0;slot<5;slot++)box(g,side*5.73,.037,-k*12-5.25+slot*.12,.38,.012,.022,0x7f8c7e);
  }
 }
 private cargo(g:T.Group,x:number,z:number,seed:number){
  for(let i=0;i<7;i++){
   const xx=x+(i%2)*.46,zz=z+Math.floor(i/2)*.46;
   if(seed%2){box(g,xx,.34,zz,.44,.60,.42,0xab8050);for(let rail=0;rail<3;rail++)box(g,xx,.18+rail*.17,zz+.22,.46,.045,.022,0xe0b27a);}
   else sphere(g,xx,.30,zz,.29,[0xb4a47f,0x9c9671,0xc2aa78][i%3],.8,1.2,.85);
  }
 }
 private streetLife(g:T.Group,side:number,z:number,seed:number){
  // Parked objects stay beyond x=5.3; playable hazards belong to the simulation.
  if(seed%3===0){const cng=createVehicle('cng',seed%2?0x2d7465:0x438b76);cng.position.set(side*6.45,.13,z);g.add(cng);}
  else{
   const x=side*6.12;box(g,x,.78,z,1.03,.11,1.62,0x986b3f);
   for(const dz of [-.54,.54]){const wheel=new T.Mesh(new T.TorusGeometry(.27,.031,4,12),material(0x354c42));wheel.rotation.y=Math.PI/2;wheel.position.set(x,.45,z+dz);g.add(wheel);}
   for(const edge of [-1,1])tube(g,[x+edge*.48,.72,z-.70],[x+edge*.48,.72,z-1.60],.024,0xa18d66,5);
   for(let sack=0;sack<5;sack++)sphere(g,x+(sack%2-.5)*.39,.97+Math.floor(sack/3)*.23,z+(sack%3-1)*.45,.27,[0xb9a885,0xada27e,0xc7b48d][sack%3],.8,.74,1);
  }
  for(let person=0;person<3;person++){
   const p=pedestrian([0x608f83,0xc69563,0xb46958,0xb6ae8b][(seed+person)%4],seed+person);
   p.position.set(side*(6.35+person%2*.36),.1,z-2.9-person*.61);p.rotation.y=side*(.6+person*.65);g.add(p);
  }
  for(let i=0;i<8;i++){const paper=box(g,side*(5.4+rand(seed+i)*.42),.017,z-3+rand(seed+i+99)*5,.09+rand(i)*.08,.008,.16,[0xafa889,0xc9b997,0x969a79][i%3]);paper.rotation.y=rand(i+seed)*4;}
 }
 private aircon(g:T.Group,side:number,front:number,y:number,z:number){
  box(g,front-side*.25,y,z,.48,.46,.73,0xc2be9f);
  for(let slat=0;slat<5;slat++)box(g,front-side*.50,y-.15+slat*.07,z,.018,.018,.57,0x788c81);
  tube(g,[front-side*.16,y-.2,z+.25],[front-side*.16,y-1.0,z+.25],.018,0xbcbf9a,5);
 }
 private launch(g:T.Group,x:number,z:number,seed:number){
  const boat=new T.Group();boat.position.set(x,-.3,z);boat.rotation.y=.04;g.add(boat);
  const hull=new T.Mesh(new T.CylinderGeometry(1,1,.85,10,1),material(0x284e54));hull.scale.set(2.1,1,7);hull.position.y=.4;boat.add(hull);
  box(boat,0,.85,0,4.05,.18,13.1,0xeee5cb);
  for(let deck=0;deck<2;deck++){
   const y=1.25+deck*1.17;box(boat,0,y,0,3.8,.76,11.3,deck?0xece2c2:0xe4dfc9);
   for(const side of [-1,1])for(let window=0;window<11;window++)box(boat,side*1.92,y+.1,-4.7+window*.89,.018,.40,.63,0x285c66);
   box(boat,0,y+.5,0,4.15,.16,12.1,seed%2?0x39818b:0xb36145);
   for(const side of [-1,1])tube(boat,[side*2.0,y+.86,-5.8],[side*2.0,y+.86,5.8],.022,0xe9d5aa,5);
  }
  box(boat,0,3.78,-3.6,2.9,.84,2.4,0xf0e4c9);box(boat,0,3.84,-4.82,2.45,.45,.022,0x2c5963);
  box(boat,0,3.82,-4.85,.08,.48,.026,0xc6cbb2);
  for(const side of [-1,1]){
   box(boat,side*1.47,3.86,-3.5,.026,.43,1.35,0x2c5963);
   for(const zz of [-3,2.6]){const buoy=new T.Mesh(new T.TorusGeometry(.25,.070,5,14),material(0xd78046));buoy.rotation.y=Math.PI/2;buoy.position.set(side*2.09,2.38,zz);boat.add(buoy);}
   for(let bar=0;bar<14;bar++)tube(boat,[side*2.0,2.92,-5.7+bar*.84],[side*2.0,3.45,-5.7+bar*.84],.015,0xd4d2b6,4);
   for(let mark=0;mark<13;mark++)box(boat,side*2.1,.51,-5.4+mark*.83,.022,.06+(mark%3)*.02,.30,0x4f6e68);
  }
  tube(boat,[0,4.24,-3.6],[0,5.9,-3.6],.04,0x746e57);box(boat,.36,5.55,-3.6,.68,.42,.018,0x1d7966);sphere(boat,.38,5.55,-3.58,.10,0xd95645,1,1,.1);
  for(const side of [-1,1])for(const zz of [-4,-1,2,4]){const tire=new T.Mesh(new T.TorusGeometry(.25,.075,5,10),material(0x203d3d));tire.rotation.y=Math.PI/2;tire.position.set(side*2.05,.6,zz);boat.add(tire);}
 }
 private makeRiverfront(seed:number){
  const g=new T.Group();this.kerb(g,-1);this.kerb(g,1);
  box(g,68,-.045,-24,122,.045,48,this.riverMaterial);
  // The open eastern edge changes the entire skyline and light of the ride.
  box(g,8.25,.22,-24,2.1,.44,48,0xaaa896);
  for(let k=0;k<12;k++){
   const z=-k*4;box(g,7.8,.83,z,.16,1.32,.16,0x637779);tube(g,[7.8,1.30,z],[7.8,1.30,z-4],.035,0xc3c5a9,5);
   if(k%3===0){box(g,8.85,.58,z,.24,.38,.24,0x384f4b);tube(g,[8.85,.78,z],[13,.50,z-2],.024,0x9c956e,5);}
  }
  const besidePalace=this.currentSimulation&&Math.abs(-seed*48-24-this.palace.position.z)<48;
  this.launch(g,besidePalace?55:14.2,-11,seed);this.launch(g,besidePalace?65:24,-34,seed+1);
  for(let ripple=0;ripple<24;ripple++)box(g,10+rand(seed+ripple)*58,-.011,-rand(seed+ripple+42)*48,2+rand(ripple)*6,.008,.07,0x7d9b95);
  for(let j=0;j<4;j++){
   const z=-j*12,n=seed*17+j;const h=4.8+(n%3)*1.9;
   box(g,-10,h/2,z,6.1,h,10.9,this.walls[n%6]);box(g,-6.9,1.36,z,.045,2.48,8.8,0x2a5451);
   box(g,-6.2,2.9,z,2.0,.12,9.2,n%2?0x447a79:0xb48756);
   this.sign(g,n%2?4:1,-6.83,3.6,z,8.0,.7,Math.PI/2);
   for(let dz=-3;dz<=3;dz+=1.5){box(g,-6.8,4.65,z+dz,.04,1.05,.90,0x2e535c);}
   this.cargo(g,-6.3,z+2,n);
   for(let person=0;person<3;person++){const p=pedestrian([0xc49661,0x52857c,0xd3baa1][person],n+person);p.position.set(person===2?6.6:-6.2,0,z-3+person*1.5);p.rotation.y=(person-1)*.8;g.add(p);}
  }
  if(seed%2===0){box(g,0,5.5,-31,16,.28,.34,0xceb484);for(const side of [-1,1])box(g,side*7.8,2.7,-31,.18,5.4,.18,0x758475);this.sign(g,4,0,4.8,-30.8,7.8,.95);}
  this.teaCart(g,-6.0,-8);this.streetLife(g,-1,-29,seed);
  box(g,10.0,.26,-9,3.7,.30,4.8,0x9a8b69);for(let plank=0;plank<12;plank++)box(g,10.0,.423,-11.2+plank*.39,3.65,.023,.03,0x6e7866);this.cargo(g,8.5,-10.5,seed+1);
  mergeStatic(g);return g;
 }
 private makeBoulevard(seed:number){
  const g=new T.Group();this.kerb(g,-1);this.kerb(g,1);
  for(const side of [-1,1]){
   box(g,side*9.1,.10,-24,5,.2,48,0x929d92);
   for(let j=0;j<3;j++){
    const n=seed*13+j*7+(side+1),z=-j*16,style=n%4,h=style===0?21+(n%3)*3:style===1?8.3:style===2?13.1:16.6,w=7+(n%3);
    const x=side*(12.7+w*.1+(style===0?1.1:0));
    box(g,x,h/2,z,w,h,13.2,style===0?0xb5c2bb:this.walls[n%6]);
    const front=x-side*w/2;
    box(g,x,h+.16,z,w+.18,.31,13.5,0xc8c4a9);
    for(let floor=0;floor<Math.floor(h/2.8);floor++){
      const y=2.5+floor*2.8;
      if(style===0){
       box(g,front-side*.03,y,z,.045,1.7,12.1,0x567a82);
       for(let mullion=0;mullion<8;mullion++)box(g,front-side*.07,y,z-5.8+mullion*1.65,.04,1.77,.09,0xb7b9a5);
      }else{
       for(let window=0;window<5;window++){
        const zz=z-5+window*2.45;box(g,front-side*.045,y,zz,.04,1.35,1.25,style===1?0x3c625f:0x3c616a);
        box(g,front-side*.11,y-.72,zz,.19,.13,1.45,0xd4bd97);box(g,front-side*.07,y,zz,.06,1.4,.035,0xa9a98f);
        if((window+floor+n)%4===0)this.aircon(g,side,front,y-.97,zz+.68);
       }
      }
      if(style===2||style===0)box(g,front-side*.10,y-1.0,z,.17,.16,13.0,0xd2c6ac);
    }
    if(style===3){for(const zz of [-5.7,0,5.7])box(g,front-side*.13,h*.5,z+zz,.33,h,.34,0xd6c6a3);}
    const base=new T.Group();base.position.set(front-side*.13,0,z);g.add(base);
    box(g,front-side*.15,1.0,z,.03,1.7,11.5,0x263f42);
    this.sign(g,[8,15,10,9][style],front-side*.16,3.6,z,10.8,.75,-side*Math.PI/2);
    if(style===1||style===3){
     for(let stripe=0;stripe<9;stripe++){const tarp=box(g,front-side*.7,2.61,z-5.2+stripe*1.3,1.4,.06,1.32,stripe%2?0xbabfa4:0x5d8e7d);tarp.rotation.z=side*.11;}
    }
    if(style===1){const tank=new T.Mesh(new T.CylinderGeometry(.57,.57,1.25,9),material(0x4c645c));tank.position.set(x,h+.9,z+2);g.add(tank);}
    for(let stall=0;stall<3;stall++){
      const zz=z-4+stall*4;box(g,side*7.7,1.04,zz,1.3,.8,3.3,0x99805b);box(g,side*7.5,2.58,zz,2.0,.08,3.8,[0x528875,0xcb9f57,0xab6252][stall]);
      this.cargo(g,side*7.9,zz-1,n+stall);
      for(let fruit=0;fruit<9;fruit++)sphere(g,side*(7.4+(fruit%2)*.35),1.60+Math.floor(fruit/6)*.15,zz-1+(fruit%6)*.34,.19,[0x9fa94f,0xcbab52,0xb47843][stall],1,.8,1);
    }
    const worker=pedestrian(0xaf9b70,n);worker.position.set(side*6.65,0,z+3);g.add(worker);
   }
   for(let lamp=0;lamp<3;lamp++){const z=-lamp*16-5;tube(g,[side*6.6,0,z],[side*6.6,7.3,z],.065,0x798885,6);tube(g,[side*6.6,7.3,z],[side*4.9,7.3,z],.05,0x798885,6);box(g,side*4.9,7.29,z,.65,.08,.30,0xe3d1a8);}
  }
  for(const side of [-1,1]){
   const wire=new T.CatmullRomCurve3([new T.Vector3(side*7.1,5.0,1),new T.Vector3(side*7.3,4.35,-20),new T.Vector3(side*7.1,5.15,-47)]);g.add(new T.Mesh(new T.TubeGeometry(wire,14,.013,3),material(0x475a50)));
  }
  this.streetLife(g,seed%2?1:-1,-10,seed+3);
  if(seed%3===0){
   box(g,0,5.35,-28,21,.45,2.6,0x657e79);for(const side of [-1,1]){box(g,side*7.8,2.65,-28,.45,5.3,.60,0x9caaa0);for(let stair=0;stair<13;stair++)box(g,side*9.7,.18+stair*.20,-20-stair*.64,2.9,.36+stair*.40,.68,0x8b9b92);}
   for(const zz of [-29.25,-26.75]){tube(g,[-10.5,6.46,zz],[10.5,6.46,zz],.055,0xaab8a1);for(let rail=0;rail<34;rail++)tube(g,[-10.2+rail*.62,5.55,zz],[-10.2+rail*.62,6.46,zz],.025,0x5d7773,5);}
   this.sign(g,5,0,5.62,-26.65,6.7,.65);
  }
  mergeStatic(g);return g;
 }
 private makeBazaar(seed:number){
  const g=new T.Group();
  for(const side of [-1,1]){
   box(g,side*6.65,.12,-23.5,1.3,.24,48,0xc3bfa7);
   for(let k=0;k<24;k++)box(g,side*6.03,.16,-k*2,.13,.27,1.75,k%2?0xe0d3b0:0x496366);
   for(let j=0;j<6;j++){
    const n=seed*37+j*7+(side+1)*3;const z=-j*8;const h=5.1+Math.floor(rand(n)*4)*1.85;
    const x=side*(9.4+rand(n+9)*.5);const w=4.3,d=7.3;
    box(g,x,h/2,z,w,h,d,this.walls[n%this.walls.length]);
    box(g,x,h+.13,z,w+.18,.25,d+.2,0xe1c89f);box(g,x,h+.45,z+d*.44,w,.5,.12,0x9b8c6e);
    const front=side*7.18;
    if(n%3===0){for(let row=0;row<4;row++)for(let brick=0;brick<6;brick++)box(g,front-side*.012,.33+row*.18,z-2.4+brick*.33+(row%2)*.14,.026,.14,.30,[0x9f664d,0xb67a58,0x886149][brick%3]);}
    // Open shops alternate with rolled shutters; goods add human-scale detail.
    const open=n%3!==1;
    box(g,front,1.25,z,.035,2.3,4.8,open?0x143f43:[0x277e76,0x708d84,0xb75f4e][n%3]);
    if(open){
      box(g,front-side*.04,2.17,z,.04,.45,4.78,0x3b8078);
      for(let sl=0;sl<4;sl++)box(g,front-side*.07,2.0+sl*.1,z,.025,.018,4.75,0x295a58);
      for(const y of [.48,1.04,1.62]){
        box(g,front-side*.11,y,z,.22,.065,4.5,0xc28d53);
        for(let item=0;item<10;item++){
          const iz=z-2.0+item*.44;
          box(g,front-side*.10,y+.18,iz,.19,.27,.24,[0xc9964d,0xf0cb7e,0xca5547,0x73a598][(item+n)%4]);
        }
      }
      box(g,front-side*.47,.65,z,.75,1.15,3.9,n%2?0x327e78:0xc5794e);
      box(g,front-side*.5,1.25,z,.91,.10,4.05,0xe3bd7d);
      if(n%2===0){
        for(let dish=0;dish<7;dish++)sphere(g,front-side*.53,1.34,z-1.5+dish*.48,.16,0xddbc78,1.4,.3,1);
        this.kettle(g,front-side*.54,1.34,z+.6,.22);
        for(let cup=0;cup<4;cup++)this.cup(g,front-side*.62,1.31,z-1.1+cup*.25);
      }else{
        for(let pile=0;pile<5;pile++)for(let fruit=0;fruit<5;fruit++)sphere(g,front-side*(.45+fruit%2*.17),1.41+Math.floor(fruit/3)*.12,z-1.4+pile*.66+(fruit%3)*.12,.12,[0xf1b13d,0xdc6d35,0x70a74f][pile%3],1,.85,1);
      }
    }else for(let sl=0;sl<14;sl++)box(g,front-side*.028,.26+sl*.14,z,.028,.023,4.75,0x315c5a);
    const sg=box(g,front-side*.06,2.9,z,.08,.87,5.2,this.signs[n%8]);sg.material=this.signs[n%8];
    // Box side UV is rotated relative to text; use independent sign plane facing street.
    sg.removeFromParent();const signGeo=new T.PlaneGeometry(5.2,.9),signUV=signGeo.getAttribute('uv'),signIndex=[0,1,2,3,6,7][n%6];for(let u=0;u<signUV.count;u++)signUV.setXY(u,signUV.getX(u)*.5+(signIndex%2)*.5,signUV.getY(u)/signRows+1-(Math.floor(signIndex/2)+1)/signRows);const sign=new T.Mesh(signGeo,this.signs[signIndex]);sign.rotation.y=-side*Math.PI/2;sign.position.set(front-side*.09,2.9,z);g.add(sign);
    for(let stripe=0;stripe<10;stripe++){const a=box(g,front-side*.62,2.46,z-2.5+stripe*.54,1.5,.09,.54,stripe%2?0xffe4b1:[0xc9644b,0x26897e,0xbb964d][n%3]);a.rotation.z=side*.17;box(g,front-side*1.3,2.27,z-2.5+stripe*.54,.035,.28,.54,stripe%2?0xffe4b1:0x318b7d);}
    for(let y=4;y<h-.6;y+=2.2){
      for(const dz of [-2,0,2]){
       box(g,front-side*.03,y,z+dz,.04,1.24,1.03,0x284e58);box(g,front-side*.09,y-.63,z+dz,.14,.1,1.2,0xe2cda4);
       for(const dir of [-1,1])box(g,front-side*.15,y,z+dz+dir*.62,.12,1.25,.26,[0x278d88,0x386d72][n%2]);
      }
      if(n%2===0){box(g,front-side*.38,y-.71,z,.85,.16,6.2,0xbcb69a);tube(g,[front-side*.85,y-.04,z-3],[front-side*.85,y-.04,z+3],.03,0x36463b);for(let rail=0;rail<16;rail++)tube(g,[front-side*.85,y-.64,z-3+rail*.4],[front-side*.85,y-.04,z-3+rail*.4],.018,0x36463b);}
    }
    if(n%4===0){
      for(let cloth=0;cloth<4;cloth++){box(g,front-side*.88,3.6,z-1.1+cloth*.68,.025,.65,.5,[0xd87178,0xf2d59c,0x58a6ab,0xde9d49][cloth]);}
      for(const dz of [-2.6,2.6]){box(g,front-side*.48,3.48,z+dz,.34,.27,.36,0xb3694e);sphere(g,front-side*.48,3.78,z+dz,.26,0x39836b,1,.8,1);}
    }
    if(n%3===1){
      for(const dz of [-1.5,1.5]){const arch=new T.Mesh(new T.TorusGeometry(.54,.055,4,14,Math.PI),material(0xf0ceab));arch.rotation.y=-side*Math.PI/2;arch.position.set(front-side*.12,4.63,z+dz);g.add(arch);}
      for(let tooth=0;tooth<15;tooth++)box(g,front-side*.10,h-.22,z-3.2+tooth*.46,.19,.17,.18,0xe8be91);
    }
    if(n%3===0){const tank=new T.Mesh(new T.CylinderGeometry(.7,.7,1.2,10),material(0x546258));tank.position.set(x,h+.8,z);g.add(tank);}
    if(n%2===1){box(g,side*6.9,.5,z+2.8,.6,.65,.75,0x986338);sphere(g,side*6.9,.88,z+2.8,.26,0x688347,1,.6,1);}
    const person=pedestrian([0xc38f57,0xe2c69b,0x728b84,0xa26857][n%4],n);person.position.set(side*6.45,0,z-1);person.rotation.y=side*Math.PI/3;g.add(person);
   }
   const pole=side*6.4;tube(g,[pole,0,-12],[pole,9,-12],.1,0x615e4b);
   for(let wire=0;wire<3;wire++){const curve=new T.CatmullRomCurve3([new T.Vector3(pole,8.2-wire*.2,12),new T.Vector3(pole-.3*side,7.1-wire*.18,-12),new T.Vector3(pole,8.2-wire*.2,-36)]);const line=new T.Mesh(new T.TubeGeometry(curve,18,.012,3,false),material(0x494d3e));g.add(line);}
   if(seed%2===0)this.tree(g,side*7.1,-26,seed+side);
  }
  if(seed===0){
    const parked=createVehicle('rickshaw',0xd6a447);parked.position.set(-6.28,.18,-11);parked.rotation.y=.08;const spokes:T.LineSegments[]=[];parked.traverse(o=>{if(o instanceof T.LineSegments)spokes.push(o);});for(const spoke of spokes){spoke.removeFromParent();spoke.geometry.dispose();}g.add(parked);
    this.teaCart(g,6.28,-18);
  }
  if(seed%2===1)this.teaCart(g,seed%3===0?-6.35:6.35,-33);
  this.streetLife(g,seed%2===0?1:-1,-34,seed+1);
  if(seed%2===1){
   for(const side of [-1,1]){const cloth=box(g,side*6.7,3.15,-15,1.6,.045,4.0,side>0?0x568678:0xae9270);cloth.rotation.z=side*.10;tube(g,[side*5.95,0,-17],[side*5.95,3.18,-17],.025,0x9d916c,5);}
  }
  // Overhead strings and fabric pennants make the street feel inhabited.
  const cable=new T.CatmullRomCurve3([new T.Vector3(-7,8,-19),new T.Vector3(0,6.7,-19),new T.Vector3(7,8,-19)]);g.add(new T.Mesh(new T.TubeGeometry(cable,14,.018,3),material(0x454c3f)));
  for(let i=0;i<11;i++){const t=(i+1)/12,p=cable.getPoint(t);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-.24,0,0,.24,0,0,0,-.5,0],3));geo.computeVertexNormals();const m=new T.Mesh(geo,pennants[i%3]);m.position.copy(p);g.add(m);}
  mergeStatic(g);return g;
 }
 private cup(g:T.Group,x:number,y:number,z:number){
  const cup=new T.Mesh(new T.CylinderGeometry(.055,.041,.12,7),material(0xf4d7a0));cup.position.set(x,y+.06,z);g.add(cup);
  const tea=new T.Mesh(new T.CircleGeometry(.044,7),material(0x704634));tea.rotation.x=-Math.PI/2;tea.position.set(x,y+.123,z);g.add(tea);
 }
 private kettle(g:T.Group,x:number,y:number,z:number,r:number){
  sphere(g,x,y+r*.65,z,r,0xbfc7bb,1,.76,1);sphere(g,x,y+r*1.42,z,r*.32,0x697f78,1,.5,1);
  tube(g,[x,y+r*.8,z-r*.7],[x,y+r*1.45,z-r*1.45],r*.15,0xc6c9b3);
  const handle=new T.Mesh(new T.TorusGeometry(r*.65,r*.1,5,12,Math.PI),material(0x304f50));handle.position.set(x,y+r*1.4,z);handle.rotation.y=Math.PI/2;g.add(handle);
 }
 private teaCart(g:T.Group,x:number,z:number){
  box(g,x,.85,z,.75,.70,1.7,0x309087);box(g,x,1.25,z,.91,.12,1.85,0xdba568);
  for(const dz of [-.62,.62]){const tire=new T.Mesh(new T.TorusGeometry(.28,.043,5,12),material(0x29484a));tire.rotation.y=Math.PI/2;tire.position.set(x,.40,z+dz);g.add(tire);}
  this.kettle(g,x,1.35,z-.35,.26);for(let i=0;i<4;i++)this.cup(g,x+.1,1.32,z+.18+i*.2);
  for(const dz of [-.8,.8])tube(g,[x,1.1,z+dz],[x,2.65,z+dz],.025,0xe0b878);
  box(g,x,2.65,z,1.25,.08,2.0,0xd2a951);
  const seller=pedestrian(0xeac693);seller.position.set(x+(x<0?-.52:.52),.1,z+.30);g.add(seller);
 }
 private bendChunk(g:T.Group){
  if(g.userData.bentAt===g.position.z)return;
  g.userData.bentAt=g.position.z;
  g.traverse(o=>{if(!(o instanceof T.Mesh))return;const attr=o.geometry.getAttribute('position'),normal=o.geometry.getAttribute('normal');
   if(!o.userData.straightPositions){o.userData.straightPositions=new Float32Array(attr.array);if(normal)o.userData.straightNormals=new Float32Array(normal.array);}
   const positions=o.userData.straightPositions as Float32Array,normals=o.userData.straightNormals as Float32Array|undefined;
   for(let i=0;i<attr.count;i++){
    const z=positions[i*3+2]+g.position.z;attr.setX(i,positions[i*3]+pathX(z));
    if(normal&&normals){const slope=.04*Math.cos(z*.008)+.0342*Math.cos(z*.019),nx=normals[i*3],ny=normals[i*3+1],nz=normals[i*3+2]-slope*nx,l=Math.hypot(nx,ny,nz)||1;normal.setXYZ(i,nx/l,ny/l,nz/l);}
   }
   attr.needsUpdate=true;if(normal)normal.needsUpdate=true;o.geometry.computeBoundingSphere();o.geometry.computeBoundingBox();
  });
 }
 private tree(g:T.Group,x:number,z:number,seed:number){tube(g,[x,0,z],[x+.2,5,z],.17,0x6b6347);for(let i=0;i<6;i++){const a=i*Math.PI/3;const leaf=sphere(g,x+Math.cos(a)*.95,5.3+rand(seed+i)*.8,z+Math.sin(a)*.95,1.15,[0x748255,0x4a7252,0x788954][i%3],1.2,.7,1);leaf.castShadow=true;}}
 private makePalace(){
  const g=this.palace;const pink=0xe395a1,trim=0xffc4b6,dark=0x715975;
  // A visible river wall and garden ground the palace on its own bank.
  // Its nearest edge is over 7m from the route centre, beyond the driving corridor.
  box(g,0,-.26,2,41,.72,25,0x89917a);
  box(g,0,.125,2,40.7,.06,24.7,0xc4b99a);
  box(g,0,.17,9.2,37,.025,7.3,0x6e8b61);
  box(g,0,.19,9.2,7.1,.027,8.7,0xd2bc94);
  for(const side of [-1,1]){
   box(g,side*20.5,.05,2,.20,.74,25.1,0x9ba18b);
   box(g,side*20.5,.45,2,.31,.12,25.2,0xcdc7a9);
   for(const z of [-9,0,8,14])box(g,side*20.45,.67,z,.27,.34,.30,0xd5cdb0);
   for(const x of [8,13,17]){
    box(g,side*x,.35,11.3,2.15,.34,1.55,0x66815d);
    sphere(g,side*x,.59,11.3,.55,0x658b5d,1.7,.55,1.0);
   }
  }
  box(g,0,.08,14.5,41,.72,.22,0x929a83);
  box(g,0,.49,14.5,41.2,.12,.34,0xcac5a6);

  box(g,0,.8,0,36,1.6,8,0xbd9390);box(g,0,5,0,34,8,6,pink);box(g,0,9.3,0,35,.6,7,trim);
  for(const y of [3,6.6])for(let i=-7;i<=7;i++){
   const x=i*2.1;box(g,x,y,3.06,1.15,1.75,.03,dark);
   const arch=new T.Mesh(new T.CircleGeometry(.58,12,0,Math.PI),material(dark));arch.position.set(x,y+.875,3.08);g.add(arch);
   for(const s of [-1,1])box(g,x+s*.69,y,3.18,.17,2.45,.24,trim);
  }
  box(g,0,5,0,6,9,8,pink);box(g,0,9.7,0,6.7,.5,8.4,trim);
  const drum=new T.Mesh(new T.CylinderGeometry(2.7,2.7,2.3,8),material(pink));drum.position.set(0,11,0);g.add(drum);
  const dome=new T.Mesh(new T.SphereGeometry(2.75,16,10,0,Math.PI*2,0,Math.PI/2),material(0xcd8799));dome.position.set(0,12.1,0);dome.scale.y=1.1;g.add(dome);tube(g,[0,14.7,0],[0,15.6,0],.075,0xb18658);
  for(let i=0;i<8;i++)box(g,0,.12+i*.16,7-i*.46,7,.24+i*.32,1,trim);
  for(const x of [-15,-9,9,15]){box(g,x,9.8,0,.55,1,5.4,trim);sphere(g,x,10.5,2.5,.28,trim);}
  mergeStatic(g);
 }
 setQuality(q:string){this.quality=q;this.renderer.shadowMap.enabled=q!=='low';this.resize();}
 setReduced(v:boolean){this.reduced=v;}
 shake(amplitude:number){this.shakeRemaining=SHAKE_SECONDS;this.shakeAmplitude=amplitude;}
 land(){this.sinceLanding=0;}
 setLook(look:VehicleLook){this.look=look;this.lookKey=JSON.stringify(look);}
 resize(){const w=innerWidth,h=innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const cap=this.quality==='high'?1.65:this.quality==='low'?.85:1.25;this.renderer.setPixelRatio(Math.min(devicePixelRatio,cap)*this.scale);this.renderer.setSize(w,h,false);}
 render(sim:Simulation,dt:number,steer:number,preview=false){
  const moving=sim.status==='playing'; if(moving||preview)this.clock+=dt; const z=preview?-12:sim.z;
  if(this.currentSimulation!==sim){for(const actor of this.actors.values())disposeModel(actor);this.actors.clear();for(const effect of this.projectiles.values())disposeModel(effect);this.projectiles.clear();for(const m of this.snackModels.values())disposeModel(m);this.snackModels.clear();this.currentSimulation=sim;let palaceDistance=sim.routeLength*.5;for(let d=0;d<sim.routeLength;d+=24)if(sim.neighborhoodAt(d)==='riverfront'){palaceDistance=d+95;break;}this.palace.position.set(pathX(-palaceDistance)+28,0,-palaceDistance);this.camera.position.set(pathX(sim.z)+sim.x*.43,sim.vehicleIndex>=3?4.8:3.2,sim.z+(sim.vehicleIndex>=3?8.5:5.8));}
  if(this.lastVehicle!==sim.vehicleIndex||this.builtLookKey!==this.lookKey){disposeModel(this.player);this.player=createVehicle(VEHICLES[sim.vehicleIndex].id,VEHICLES[sim.vehicleIndex].color,this.look,{player:true});this.scene.add(this.player);this.lastVehicle=sim.vehicleIndex;this.builtLookKey=this.lookKey;}
  this.player.position.set(pathX(z)+sim.x,.025+sim.y,z);this.player.rotation.y=-steer*.17-Math.atan((pathX(z-.2)-pathX(z))/.2);
  animateVehicle(this.player,this.clock,preview?2:sim.speed,steer);
  this.sinceLanding+=dt;this.player.scale.y=landingSquash(this.sinceLanding);
  this.player.rotation.z=sim.effects.stomach>0&&!this.reduced?Math.sin(this.clock*11)*.055:0;
  this.renderMagnet(sim,z);
  if(sim.invulnerable>0)this.player.visible=Math.floor(this.clock*9)%3!==0;else this.player.visible=true;
  for(let i=0;i<this.chunks.length;i++){
   let c=this.chunks[i];let chunkZ=c.position.z;
   while(chunkZ-z>55)chunkZ-=48*this.chunks.length;
   while(chunkZ-z<-290)chunkZ+=48*this.chunks.length;
   const district=sim.neighborhoodAt(Math.max(0,-chunkZ+24));
   if(c.userData.neighborhood!==district){disposeModel(c);c=this.makeChunk(Math.abs(Math.round(chunkZ/48)),district);this.chunks[i]=c;this.scenery.add(c);}
   c.position.set(0,0,chunkZ);c.rotation.y=0;this.bendChunk(c);
  }
  this.district=sim.neighborhood;
  this.palace.visible=Math.abs(this.palace.position.z-z)<190;
  const lightTint=this.district==='bazaar'?0xffd5aa:this.district==='riverfront'?0xffe4bd:0xffeace;
  this.sun.color.lerp(new T.Color(lightTint),1-Math.exp(-dt*1.2));
  const keep=new Set<number>();
  for(const actor of sim.traffic){if(actor.z-z>80||actor.z-z<-135)continue;keep.add(actor.id);let model=this.actors.get(actor.id);
   if(!model){
    if(actor.kind==='pothole'||actor.kind==='paan')model=roadHazard(actor.kind,actor.width,actor.length,actor.id);
    else if(actor.kind==='cow')model=seatedCow(actor.id);
    else if(actor.kind==='pedestrian')model=pedestrian([0xd2ba8b,0xb4865c,0x648b86][actor.id%3],actor.id,true);
    else model=createVehicle(actor.kind,[0x378e84,0xd8a157,0xb45b43,0x748c6d][actor.id%4]);
    this.actors.set(actor.id,model);this.scene.add(model);
   }
   const previousX=model.userData.previousX as number|undefined;
   const sideSpeed=previousX===undefined||dt<=0?0:(actor.x-previousX)/Math.max(dt,.001);model.userData.previousX=actor.x;
   model.position.set(pathX(actor.z)+actor.x,0,actor.z);
   if(actor.kind==='pedestrian'){
    const throwing=actor.behavior==='paan-thrower';const shot=sim.projectiles.find(p=>p.sourceId===actor.id);
    model.rotation.y=throwing?(actor.x<0?-Math.PI/2:Math.PI/2):(sideSpeed>=0?-Math.PI/2:Math.PI/2);
    animatePedestrian(model,this.clock,!throwing&&Math.abs(sideSpeed)>.02,shot?.phase==='telegraph'?shot.progress:0);
   }else if(actor.kind==='cow'){model.rotation.y=actor.id%2?.9:-.7;model.scale.y=1+Math.sin(this.clock*1.5+actor.id)*.005;}
   else{
    const turn=Math.max(-.4,Math.min(.4,sideSpeed/Math.max(3,Math.abs(actor.speed))));
    model.rotation.y=Math.atan(.04*Math.cos(actor.z*.008)+.0342*Math.cos(actor.z*.019))-turn;
    animateVehicle(model,this.clock,actor.speed,turn);
   }

  }
  for(const [id,m] of this.actors)if(!keep.has(id)){disposeModel(m);this.actors.delete(id);}
  this.renderProjectiles(sim);this.renderPickups(sim,z);
  const large=sim.vehicleIndex>=3;const camX=pathX(z)+sim.x*.43;const target=new T.Vector3(camX,large?4.8:3.2,z+(large?8.5:5.8));
  if(preview)target.set(pathX(z)+5,4.5,z+7);
  this.camera.position.lerp(target,1-Math.exp(-dt*7));const cameraBase=this.camera.position.clone();
  this.shakeRemaining=Math.max(0,this.shakeRemaining-dt);const shake=shakeOffset(this.shakeRemaining,this.shakeAmplitude,this.clock,this.reduced);
  this.camera.position.x+=shake.x;this.camera.position.y+=shake.y;this.camera.lookAt(pathX(z-7)+sim.x*.3,large?1.4:1.0,z-9);
  this.camera.fov=(innerHeight>innerWidth?70:58)+(this.reduced?0:Math.min(sim.speed,22)*.2+(sim.effects.boost>0?6:0));this.camera.updateProjectionMatrix();
  this.sun.position.set(pathX(z)-24,36,z+18);this.sun.target.position.set(pathX(z),0,z-12);
  this.renderStreaks(sim);this.dust.position.set(pathX(z),0,z);this.dust.rotation.y=this.clock*.007;
  this.renderer.render(this.scene,this.camera);this.camera.position.copy(cameraBase);
  if(this.quality==='auto'&&dt>0){this.frameAvg=this.frameAvg*.97+dt*1000*.03;if(++this.frames%180===0&&this.frameAvg>24&&this.scale>.7){this.scale=Math.max(.7,this.scale-.1);this.resize();}}
 }
 private renderPickups(sim:Simulation,z:number){
  ([1,5] as const).forEach((value,i)=>{const mesh=this.coinMeshes[i];let n=0;
   for(const coin of sim.coins){if(coin.value!==value||coin.collected||coin.z-z>25||coin.z-z<-110||n>=256)continue;
    // Coins rock to face the chase camera (so the ৳ stays readable) and a glint ripples down each trail.
    this.dummy.position.set(pathX(coin.z)+coin.x,coin.y+Math.sin(this.clock*3+coin.id*.7)*.07,coin.z);this.dummy.rotation.set(0,Math.sin(this.clock*2.2+coin.id*.45)*.85,0);this.dummy.updateMatrix();mesh.setMatrixAt(n++,this.dummy.matrix);}
   mesh.count=n;mesh.instanceMatrix.needsUpdate=true;});
  const keep=new Set<number>();
  for(const snack of sim.snacks){if(snack.eaten||snack.z-z>25||snack.z-z<-110)continue;keep.add(snack.id);let model=this.snackModels.get(snack.id);
   if(!model){model=snackModel(snack.kind);const halo=new T.Sprite(this.haloMaterial(snack.kind));halo.position.y=({cha:.2,jhalmuri:.32,chaap:.1})[snack.kind];model.add(halo);model.userData.halo=halo;this.snackModels.set(snack.id,model);this.scene.add(model);}
   model.position.set(pathX(snack.z)+snack.x,.75+Math.sin(this.clock*2.4+snack.id)*.12,snack.z);model.rotation.y=this.clock*1.6;(model.userData.halo as T.Sprite).scale.setScalar(.95+Math.sin(this.clock*3.2+snack.id)*.07);}
  for(const [id,m] of this.snackModels)if(!keep.has(id)){disposeModel(m);this.snackModels.delete(id);}
 }
 // A soft coloured glow behind each snack, shared per kind (sprites are not disposed with the model).
 private haloMaterial(kind:string){let m=this.haloMaterials.get(kind);if(!m){this.haloTexture??=canvasTexture(64,64,c=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffffffcc');g.addColorStop(.35,'#ffffff66');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,64,64);});
  m=new T.SpriteMaterial({map:this.haloTexture,color:({cha:0xffb347,jhalmuri:0xff6a3d,chaap:0x3fe0c5} as Record<string,number>)[kind]??0xffffff,blending:T.AdditiveBlending,depthWrite:false,transparent:true,opacity:.85});this.haloMaterials.set(kind,m);}return m;}
 // The jhalmuri magnet field: a red-and-gold pole ring at the real pull reach, with ripples drawn inward.
 private makeMagnetField(){
  const tex=canvasTexture(256,256,c=>{const g=c.createRadialGradient(128,128,40,128,128,128);g.addColorStop(0,'#ff8a5000');g.addColorStop(.72,'#ffb44a14');g.addColorStop(.93,'#ff8a4a5c');g.addColorStop(1,'#ff8a4a00');c.fillStyle=g;c.fillRect(0,0,256,256);c.lineWidth=7;for(let i=0;i<16;i++){c.strokeStyle=i%2?'#ffd25e':'#ef4a32';c.beginPath();c.arc(128,128,119,i*Math.PI/8+.04,(i+1)*Math.PI/8-.04);c.stroke();}});
  const disc=new T.Mesh(new T.CircleGeometry(1,48),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}));disc.rotation.x=-Math.PI/2;this.magnetField.add(disc);this.magnetField.userData.disc=disc;
  for(let i=0;i<2;i++){const ripple=new T.Mesh(new T.RingGeometry(.94,1,48),new T.MeshBasicMaterial({color:0xffd25e,transparent:true,depthWrite:false,toneMapped:false}));ripple.rotation.x=-Math.PI/2;ripple.position.y=.005;this.magnetRipples.push(ripple);this.magnetField.add(ripple);}
  this.magnetField.visible=false;this.scene.add(this.magnetField);
 }
 private renderMagnet(sim:Simulation,z:number){
  const fade=magnetOpacity(sim.effects.magnet,this.clock,this.reduced);this.magnetField.visible=fade>0;if(!this.magnetField.visible)return;
  const disc=this.magnetField.userData.disc as T.Mesh;(disc.material as T.MeshBasicMaterial).opacity=fade;
  this.magnetField.position.set(pathX(z)+sim.x,.06+sim.y,z);this.magnetField.scale.setScalar(sim.magnetReach);disc.rotation.z=this.reduced?0:this.clock*.5;
  // Ripples drift inward to show the pull; the gentler camera keeps the field still.
  this.magnetRipples.forEach((ripple,i)=>{const phase=(this.clock*.8+i*.5)%1;ripple.visible=!this.reduced;ripple.scale.setScalar(1-phase*.7);(ripple.material as T.MeshBasicMaterial).opacity=Math.sin(phase*Math.PI)*.55*fade;});
 }
 // Cha speed lines: warm streaks rushing past the camera edges in one instanced draw (off with the gentler camera).
 private makeStreaks(){
  this.streaks=new T.InstancedMesh(new T.BoxGeometry(.014,.014,1),new T.MeshBasicMaterial({color:0xffd59a,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,fog:false,toneMapped:false}),40);this.streaks.frustumCulled=false;this.streaks.visible=false;this.camera.add(this.streaks);this.scene.add(this.camera);
 }
 private renderStreaks(sim:Simulation){
  const on=sim.effects.boost>0&&!this.reduced;this.streaks.visible=on;if(!on)return;
  (this.streaks.material as T.MeshBasicMaterial).opacity=Math.min(1,sim.effects.boost)*.42;const spread=Math.tan(T.MathUtils.degToRad(this.camera.fov/2));
  for(let i=0;i<40;i++){const a=i*2.39996+rand(i)*.3,edge=.62+rand(i+40)*.5,depth=17-((rand(i+80)+this.clock*(1.1+rand(i+120)*.6))%1)*12;
   this.dummy.position.set(Math.cos(a)*edge*depth*spread*this.camera.aspect,Math.sin(a)*edge*depth*spread,-depth);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(1,1,.8+sim.speed*.07);this.dummy.updateMatrix();this.streaks.setMatrixAt(i,this.dummy.matrix);}
  this.streaks.instanceMatrix.needsUpdate=true;this.dummy.scale.set(1,1,1);
 }
 private renderProjectiles(sim:Simulation){
  const keep=new Set<number>();
  for(const shot of sim.projectiles){
   if(shot.z-sim.z>30||shot.z-sim.z<-110)continue;keep.add(shot.id);
   let effect=this.projectiles.get(shot.id);
   if(!effect){
    effect=new T.Group() as Model;
    const splat=roadHazard('paan',shot.radius*2,shot.radius*2,shot.id);effect.add(splat);effect.userData.splat=splat;
    const target=new T.Group();const rim=new T.Mesh(new T.RingGeometry(shot.radius*.75,shot.radius,24),paanTargetMaterial);rim.rotation.x=-Math.PI/2;rim.position.y=.055;target.add(rim);effect.add(target);effect.userData.target=target;
    const airborne=new T.Group();for(let i=0;i<4;i++)sphere(airborne,-i*.085,-i*.04,i*.12,.13-i*.021,0xb94e35,1,.8,1.4);mergeStatic(airborne);effect.add(airborne);effect.userData.airborne=airborne;
    this.projectiles.set(shot.id,effect);this.scene.add(effect);
   }
   const splat=effect.userData.splat as T.Group,target=effect.userData.target as T.Group,airborne=effect.userData.airborne as T.Group;
   splat.visible=shot.phase==='splash';target.visible=shot.phase==='telegraph'||shot.phase==='flying';airborne.visible=shot.phase==='flying';
   splat.position.set(pathX(shot.targetZ)+shot.targetX,0,shot.targetZ);
   target.position.copy(splat.position);target.scale.setScalar(1);
   airborne.position.set(pathX(shot.z)+shot.x,shot.y,shot.z);airborne.rotation.y=Math.atan2(shot.targetX-shot.sourceX,shot.targetZ-shot.sourceZ);
  }
  for(const [id,effect]of this.projectiles)if(!keep.has(id)){disposeModel(effect);this.projectiles.delete(id);}
 }
 getStats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,resolutionScale:this.scale,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,frameMs:Math.round(this.frameAvg)};}
}
