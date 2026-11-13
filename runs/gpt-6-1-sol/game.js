import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Everything visible and audible is authored here. No runtime network assets.
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2, clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const rand = (a,b) => a + Math.random() * (b-a);
const flat = v => Math.hypot(v.x,v.z);
const angleTo = (a,b,t) => a + Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
let seed=62841;
function seeded(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const manual = params.has('debug') && params.has('manual');
let mode='title', previousMode='play', elapsed=0, worldTime=0, muted=false, quality='full', restartArmed=false;
let wallet=0, totalFish=0, placedFish=0, potsBroken=0, purrs=0, concertTime=0, toastTime=0;
let best=null;
try {best=JSON.parse(localStorage.getItem('midnight-purrade-best')||'null');muted=localStorage.getItem('midnight-purrade-muted')==='1';}catch{}
if(best)$('best').textContent=`Best night: ${best.fish} fish found · ${best.pots}/8 pots liberated`;

const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
$('game').appendChild(renderer.domElement);renderer.domElement.tabIndex=-1;
const scene=new THREE.Scene();scene.background=new THREE.Color('#263958');scene.fog=new THREE.FogExp2('#263958',.012);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,180);
scene.add(new THREE.HemisphereLight('#b6cbe9','#384559',1.45));
const moonlight=new THREE.DirectionalLight('#c7d9ff',2.1);moonlight.position.set(-12,22,9);scene.add(moonlight);moonlight.castShadow=true;moonlight.shadow.mapSize.set(1024,1024);Object.assign(moonlight.shadow.camera,{left:-30,right:30,top:28,bottom:-28,near:1,far:80});moonlight.shadow.bias=-.0004;moonlight.shadow.normalBias=.035;moonlight.shadow.intensity=.6;
const cafeGlow=new THREE.PointLight('#ffc784',14,10,2);cafeGlow.position.set(9,2.8,9);scene.add(cafeGlow);
const stageGlow=new THREE.PointLight('#ed9daf',7,9,2);stageGlow.position.set(0,3.5,0);scene.add(stageGlow);
const warm=new THREE.DirectionalLight('#ffc882',.95);warm.position.set(10,5,-7);scene.add(warm);
const materials=new Map();
function mat(color,emissive=0){const key=color+':'+emissive;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.84,metalness:0,flatShading:false,emissive:color,emissiveIntensity:emissive}));return materials.get(key);}
const geo={sphere:new THREE.SphereGeometry(1,12,8),box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,12),ear:new THREE.ConeGeometry(1,1,3),torus:new THREE.TorusGeometry(1,.12,6,24)};
const statics=[];
function mesh(kind,color,pos=[0,0,0],scale=[1,1,1],parent=scene,staticMesh=false){const m=new THREE.Mesh(geo[kind],typeof color==='string'?mat(color):color);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(staticMesh)statics.push(m);return m;}
function box(color,x,y,z,w,h,d,parent=scene,stat=true){return mesh('box',color,[x,y,z],[w,h,d],parent,stat);}
function ball(color,x,y,z,w,h,d,parent=scene,stat=false){return mesh('sphere',color,[x,y,z],[w,h,d],parent,stat);}
function cyl(color,x,y,z,r,h,parent=scene,stat=true){return mesh('cylinder',color,[x,y,z],[r,h,r],parent,stat);}
function line(points,color,parent=scene){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color}));parent.add(l);return l;}
function sign(text,x,y,z,w=3,h=1,colour='#fbe8bb',ink='#253650'){
 const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d');g.fillStyle=colour;g.fillRect(0,0,512,192);g.strokeStyle=ink;g.lineWidth=6;g.strokeRect(12,12,488,168);g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';g.font='bold 47px Georgia';g.fillText(text,256,98,460);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));m.position.set(x,y,z);scene.add(m);return m;
}
// Soft contact shadows are generated once, rather than rendered as costly shadow maps.
const sc=document.createElement('canvas');sc.width=sc.height=64;const sx=sc.getContext('2d');const grad=sx.createRadialGradient(32,32,2,32,32,32);grad.addColorStop(0,'rgba(8,18,36,.55)');grad.addColorStop(1,'rgba(8,18,36,0)');sx.fillStyle=grad;sx.fillRect(0,0,64,64);
const shadowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false});
function shadow(x,z,r=1.3){const m=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2),shadowMat);m.rotation.x=-Math.PI/2;m.position.set(x,.018,z);scene.add(m);return m;}
const platforms=[], obstacles=[];
function platform(x,z,w,d,h,color='#546d8a'){box(color,x,h/2,z,w,h,d);platforms.push({x,z,w,d,h});}
function obstacle(x,z,w,d,h,y=0,color='#667b91'){box(color,x,y+h/2,z,w,h,d);obstacles.push({x,z,w,d,h:y+h});}
function floorAt(x,z,y=100){let h=0;for(const p of [...platforms,...obstacles])if(Math.abs(x-p.x)<p.w/2+.1&&Math.abs(z-p.z)<p.d/2+.1&&p.h<=y+.32)h=Math.max(h,p.h);return h;}
function solidAt(x,z,y){for(const p of [...obstacles,...platforms])if(Math.abs(x-p.x)<p.w/2+.38&&Math.abs(z-p.z)<p.d/2+.38&&p.h>y+.34)return true;return false;}
// A single walkable rooftop, with a raised north terrace. The parapet is the boundary.
box('#354d6d',0,-1.31,0,44,2.4,40);box('#536f8d',0,-.08,0,43.5,.16,39.5);
for(let x=-21;x<=21;x+=2.2)box('#64829b',x,.006,0,.025,.012,39);
for(let z=-19;z<=19;z+=2.2)box('#64829b',0,.008,z,43,.012,.025);
for(const s of [-1,1]){box('#758ba1',s*21.8,.32,0,.4,.64,40);box('#758ba1',0,.32,s*19.8,44,.64,.4);box('#a0afbd',s*21.8,.67,0,.6,.1,40);box('#a0afbd',0,.67,s*19.8,44,.1,.6);}
platform(0,-13.6,28,11,1.8,'#617b92');
for(let i=1;i<=4;i++)platform(0,-5.6-i*.78,5,1.55,i*.36,'#a0a9af');
box('#b2b5b1',0,1.86,-8.2,28,.12,.18);
// Warm windows and a sleepy surrounding city, modelled rather than textured.
for(let i=0;i<28;i++){
 const a=i/28*TAU, dist=34+seeded()*18,x=Math.sin(a)*dist,z=Math.cos(a)*dist,h=4+seeded()*15;
 const w=3+seeded()*4,d=3+seeded()*4;
 box(['#263b59','#2e4562','#314b68'][i%3],x,h/2-9,z,w,h,d);
 box('#4a617c',x,h-8.9,z,w+.3,.25,d+.3);
 for(let k=0;k<4;k++)for(let j=0;j<3;j++)if(seeded()>.34)box(mat('#e7be78',.65),x-w/2+.5+j*(w-1)/2,h-10-k*1.4,z+d/2+.015,.4,.65,.03);
}
const moon=ball(mat('#fff0ba',.8),-26,29,-52,5,5,5);ball('#263958',-23.7,30,-49,4.6,4.6,4.6);
const starG=new THREE.BufferGeometry(),starPos=[];for(let i=0;i<160;i++){const a=seeded()*TAU,r=60+seeded()*20;starPos.push(Math.sin(a)*r,16+seeded()*40,Math.cos(a)*r);}starG.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));scene.add(new THREE.Points(starG,new THREE.PointsMaterial({color:'#f8e5b5',size:.15,sizeAttenuation:true})));
// The concert's circular rug and hand-painted sign.
cyl('#243a56',0,.06,0,3.6,.12);cyl('#cc8393',0,.135,0,3.25,.05);cyl('#313e61',0,.17,0,2.95,.04);
const stageRing=mesh('torus',mat('#eac77e',.3),[0,.2,0],[3.04,3.04,3.04]);stageRing.rotation.x=Math.PI/2;
for(let i=0;i<10;i++){const a=i/10*TAU;ball('#e9bb7d',Math.sin(a)*3.2,.19,Math.cos(a)*3.2,.065,.03,.065,scene,true);}
box('#d7b88d',-3.8,.9,-2.9,.12,1.8,.12);box('#d7b88d',3.8,.9,-2.9,.12,1.8,.12);sign('The Moon Club',0,1.45,-2.91,5.2,1.25);
// The yellow awning café: Pip's corner.
obstacle(10.5,12,5,2,2.9,0,'#345873');box('#e1b879',10.5,3,12,5.3,.18,2.3);
for(let i=0;i<6;i++){const m=box(i%2?'#f7da92':'#d5a35d',8.2+i*.9,2.5,10.2,.9,.15,2.1);m.rotation.x=-.15;}
box(mat('#ffcf83',.6),10.5,1.4,10.97,3.9,1.5,.06);sign('SARDINE SOCIAL',10.5,2.64,10.94,3.8,.6);
for(let i=0;i<3;i++){cyl('#b99170',6+i*1.7,.75,14,.48,1.5);cyl('#ddbd87',6+i*1.7,1.55,14,.58,.15);}
// Garden nook.
function plant(x,z,y=0,s=1){cyl('#bc8d7c',x,y+.28*s,z,.35*s,.55*s);cyl('#e4b5a0',x,y+.55*s,z,.4*s,.14*s);for(let i=0;i<5;i++){const a=i*TAU/5;const l=ball(i%2?'#89a58c':'#afbc93',x+Math.sin(a)*.2*s,y+.92*s,z+Math.cos(a)*.2*s,.13*s,.45*s,.2*s,scene,true);l.rotation.z=Math.sin(a)*.6;l.rotation.x=Math.cos(a)*.6;}}
for(let i=0;i<5;i++){obstacle(-17.7,1+i*2,2.6,1.1,.65,0,'#b19a85');for(let j=0;j<3;j++)plant(-18.4+j*.7,1+i*2,.5,.7);}
for(let i=0;i<3;i++){obstacle(-10-i*2,10.8,1.4,1.4,.7,0,'#b09b8c');plant(-10-i*2,10.8,.6,1.3);}
box('#d0b18c',-15,1.2,4,.12,2.4,.12);box('#d0b18c',-9,1.2,4,.12,2.4,.12);sign('PLEASE DO NOT EAT THE BEES',-12,1.9,4,4.9,.8,'#bbc8a3');
// Linen flapping above the east terrace, no collision with the line.
const laundry=[];
for(const z of [-6,3]){cyl('#d6bea0',16,1.5,z,.07,3);}
line([[16,2.9,-6],[16,2.6,-1.5],[16,2.9,3]],'#d7c7b2');
for(let i=0;i<5;i++){const m=box(['#dfd1bc','#aaabc1','#e2a3a3'][i%3],16,2,-4.8+i*1.45,.045,1.2,.9,scene,false);laundry.push(m);box('#c5a67b',16,2.63,-4.8+i*1.45,.12,.16,.12);}
// Duchess's salon, and Miso's observatory.
obstacle(-10,-16.7,5.2,2.2,1.9,1.8,'#7f758c');box('#c8a6ac',-10,3.78,-16.7,5.5,.18,2.5);sign('MADAME, AFTER DARK',-10,3.1,-15.56,4.4,.65,'#efd0c8');
for(let i=0;i<3;i++)cyl(['#b89baa','#cbb3ad','#b79aa8'][i],-12+i*1.5,2,-13,.6,.4);
for(const x of [7,11])for(const z of [-17,-13])box('#343f55',x,3.4,z,.16,3.2,.16);
cyl('#899397',9,4.4,-15,2.9,2.8);cyl('#bcc2b6',9,5.85,-15,3.05,.18);mesh('cone','#657e89',[9,6.65,-15],[3.1,1.5,3.1],scene,true);
line([[9,6.5,-15],[9,8,-15]],'#b9b9b1');ball('#e4c57c',9,8.1,-15,.14,.14,.14,scene,true);
// Crates make forgiving pounce playgrounds.
for(const [x,z,h] of [[-5,14,.65],[-4,14,1.2],[-5,12.8,.65],[17,9,.7],[18,9,1.35],[-17,-12,.6]]){
 platform(x,z,1.2,1.2,h,'#9c887c');box('#d0b18d',x,h+.02,z,1.22,.06,1.22);box('#756959',x,h/2,z+.61,.11,h,.03);
}
// Chimneys.
for(const [x,z,y] of [[-4,7,0],[18,-12,0],[-18,-16,0]]){obstacle(x,z,1.6,1.7,1.4,y,'#947b80');box('#ba9a90',x,y+1.48,z,2,.2,2);cyl('#344557',x,y+1.6,z,.55,.18);}
// Bulb garlands, warm and deliberately sparse.
for(const z of [7,-8]){
 for(const x of [-20,20])cyl('#a5a0a0',x,2.2,z,.06,4.4);
 const points=[];for(let i=0;i<=32;i++){const x=-20+i*1.25,y=4.4-1.1*Math.sin(i/32*Math.PI);points.push([x,y,z]);if(i%2===0){ball(mat(i%4?'#edba83':'#e5abaf',1),x,y-.13,z,.11,.16,.11,scene,true);}}
 line(points,'#a6a49b');
}
const lamps=[];
for(const [x,z] of [[-19,15],[19,16],[-19,-6],[19,-7],[-13,-18],[13,-18]]){
 cyl('#283f58',x,1.65,z,.055,3.3);box('#384f62',x,3.2,z,.5,.7,.5);ball(mat('#ffcf86',1),x,3.2,z,.2,.3,.2,scene,true);
}
// Static geometry is merged by material: hundreds of roof details become a few draws.
scene.updateMatrixWorld(true);
const batches=new Map();for(const m of statics){const g=m.geometry.clone();g.applyMatrix4(m.matrixWorld);if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(g);m.removeFromParent();}
for(const [material,gs] of batches){const merged=mergeGeometries(gs,false);const batch=new THREE.Mesh(merged,material);batch.castShadow=true;batch.receiveShadow=true;scene.add(batch);gs.forEach(g=>g.dispose());}

function bakeParts(parent,exclude=[]){
 const buckets=new Map(),lines=new Map();
 for(const m of [...parent.children]){
  if(exclude.includes(m))continue;
  if(m.isMesh){m.updateMatrix();const g=m.geometry.clone().applyMatrix4(m.matrix);if(!buckets.has(m.material))buckets.set(m.material,[]);buckets.get(m.material).push(g);m.removeFromParent();}
  else if(m.isLine){const a=m.geometry.attributes.position.array,key=m.material.color.getHex();if(!lines.has(key))lines.set(key,[]);const dst=lines.get(key);for(let j=0;j<a.length-3;j+=3)dst.push(...a.slice(j,j+3),...a.slice(j+3,j+6));m.removeFromParent();m.geometry.dispose();}
 }
 for(const [material,gs]of buckets){const m=new THREE.Mesh(mergeGeometries(gs,false),material);m.castShadow=true;m.receiveShadow=true;parent.add(m);gs.forEach(g=>g.dispose());}
 for(const [color,points]of lines){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));parent.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color})));}
}
function makeCat(colour,accent,name){
 const root=new THREE.Group();scene.add(root);const rig=new THREE.Group();root.add(rig);
 const fur=mat(colour),dark=mat(accent),cream=mat('#f6dfb6'),pink=mat('#d99b9e');
 const body=ball(fur,0,.69,.05,.43,.5,.7,rig);
 ball(cream,0,.56,-.25,.3,.36,.3,rig);
 const eyes=[],ears=[];const head=new THREE.Group();head.position.set(0,1.04,-.47);rig.add(head);
 ball(fur,0,0,0,.43,.39,.38,head);ball(fur,0,.09,.02,.4,.32,.32,head);
 for(const s of [-1,1]){
  const ear=mesh('ear',fur,[s*.29,.36,.005],[.23,.48,.17],head);ear.rotation.z=-s*.16;ear.rotation.y=Math.PI/2;ears.push(ear);
  const inner=mesh('ear',pink,[s*.29,.38,-.075],[.125,.29,.025],head);inner.rotation.z=-s*.16;inner.rotation.y=Math.PI/2;
  ball(cream,s*.16,-.12,-.31,.2,.14,.13,head);
  const eyeRig=new THREE.Group();eyeRig.position.set(s*.2,.045,-.327);head.add(eyeRig);eyes.push(eyeRig);
  ball('#d6d6a4',0,0,0,.115,.12,.04,eyeRig);
  ball('#213449',0,0,-.037,.035,.092,.018,eyeRig);ball('#fff1d6',-s*.02,.04,-.051,.023,.024,.01,eyeRig);
  for(let i=0;i<3;i++)line([[s*.17,-.13,-.39],[s*(.48+i*.015),-.09-i*.055,-.36]],'#e9d6b8',head);
  ball(dark,s*.38,.04,.02,.035,.08,.18,head);
 }
 mesh('ear',pink,[0,-.09,-.421],[.065,.07,.04],head).rotation.z=Math.PI;
 line([[0,-.14,-.429],[0,-.18,-.422],[-.07,-.2,-.4]],'#614d54',head);line([[0,-.18,-.422],[.07,-.2,-.4]],'#614d54',head);
 for(let i=0;i<3;i++){const stripe=ball(dark,(i-1)*.12,.28,-.23,.04,.1,.055,head);stripe.rotation.z=(i-1)*-.23;}
 const legs=[];
 for(const x of [-.27,.27])for(const z of [-.4,.45]){
  const hip=new THREE.Group();hip.position.set(x,.63,z);rig.add(hip);mesh('cylinder',fur,[0,-.21,0],[.115,.46,.115],hip);ball(cream,0,-.47,-.065,.145,.12,.2,hip);legs.push(hip);
 }
 for(const z of [0,.2,.4]){ball(dark,.39,.82,z,.04,.19,.065,rig);ball(dark,-.39,.82,z,.04,.19,.065,rig);}
 const tail=new THREE.Group();tail.position.set(0,.66,.59);rig.add(tail);const links=[];let parent=tail;
 const curve=new THREE.CatmullRomCurve3([[0,0,0],[0,.42,.12],[.04,.85,.12],[.2,1.12,.06],[.4,1.08,-.08],[.42,.91,-.14]].map(p=>new THREE.Vector3(...p)));
 const tailMesh=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.085,6,false),fur);tailMesh.castShadow=true;tail.add(tailMesh);ball(dark,.42,.92,-.14,.088,.14,.088,tail);
 const mouth=ball('#59434b',0,-.215,-.397,.065,.06,.025,head);mouth.visible=false;
 const collar=mesh('torus','#d98b9d',[0,.87,-.4],[.32,.32,.32],rig);collar.rotation.x=1.32;
 ball('#e9c77d',0,.68,-.66,.085,.085,.065,rig);
 bakeParts(head,[mouth,...ears,...head.children.filter(m=>m.geometry===geo.ear)]);bakeParts(rig,[body]);
 const sh=shadow(0,0,1.1);
 return{root,rig,body,head,legs,tail,links,sh,eyes,ears,mouth,idle:0,name,phase:rand(0,TAU),speed:0,blink:rand(2,6),baseColour:colour};
}
const player=makeCat('#e4ac68','#ad744d','You');player.root.position.set(0,0,13);player.root.rotation.y=Math.PI+.35;
const velocity=new THREE.Vector3();let vy=0,grounded=true,jumpCooldown=0,meowCooldown=0,stepTimer=0,chargeCat=null;
const cats=[
 {name:'Pip',role:'Tiny voice. Enormous opinions.',cost:2,x:6,z:8.7,y:0,colour:'#dfd2b6',accent:'#8e897e',line:'“I only sing in the key of dinner.”',joinedLine:'Pip joined. The triangle department is open.'},
 {name:'Nori',role:'A gardener with a velvet baritone.',cost:3,x:-12,z:6.7,y:0,colour:'#455365',accent:'#283644',line:'“Three fish. And please leave the bees alone.”',joinedLine:'Nori joined. A bass line with whiskers.'},
 {name:'Fig',role:'The laundry’s resident percussionist.',cost:3,x:14,z:-1.3,y:0,colour:'#d4a096',accent:'#956a72',line:'“My agent says I should be paid in fish.”',joinedLine:'Fig joined. No rhythm, plenty of confidence.'},
 {name:'Duchess',role:'Strictly an after-dark soprano.',cost:4,x:-9,z:-12.5,y:1.8,colour:'#dddcd5',accent:'#9ba6aa',line:'“Darling, I don’t get out of bed for fewer than four.”',joinedLine:'Duchess joined. The moon is a little nervous.'},
 {name:'Miso',role:'An astronomer. A terrible accordionist.',cost:5,x:8,z:-11.8,y:1.8,colour:'#b99968',accent:'#756448',line:'“Five fish and I’ll show the moon my new song.”',joinedLine:'Miso joined. This is officially a purrade.'}
].map((c,i)=>({...c,index:i,cat:makeCat(c.colour,c.accent,c.name),joined:false,charge:0}));
function nameplate(c){
 const cv=document.createElement('canvas');cv.width=256;cv.height=128;const g=cv.getContext('2d');g.fillStyle='#fff1cf';g.beginPath();g.roundRect(4,4,248,100,18);g.fill();g.beginPath();g.moveTo(113,103);g.lineTo(128,120);g.lineTo(143,103);g.fill();g.textAlign='center';g.fillStyle='#233b56';g.font='bold 29px Georgia';g.fillText(c.name,128,42);g.font='21px Trebuchet MS';g.fillText(`${c.cost} sardines + a song`,128,77);
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));sprite.scale.set(2.9,1.45,1);sprite.position.set(c.x,c.y+2.6,c.z);scene.add(sprite);return sprite;
}
for(const c of cats){c.cat.root.position.set(c.x,c.y,c.z);c.cat.root.rotation.y=rand(-.6,.6);c.label=nameplate(c);const token=document.createElement('span');token.className='cat-token';token.textContent=c.name[0];token.title=c.name;$('roster').appendChild(token);c.token=token;}
// Collectibles are little sculpted golden sardines, not UI icons in the world.
const fish=[];
const fishPlaces=[[0,10.5],[1,8.7],[3.4,8.5],[7.5,6.5],[9,4.5],[11,2.4],[13,.2],[17,-2],[17,-5],[-2,11],[-4,9],[-7,7],[-9,5],[-13,3],[-16,0],[-13,-3],[-9,-5],[-5,-5],[-2,-5.8],[0,-7],[0,-9.5],[-4,-11],[-7,-11],[-12,-11],[3,-11],[5,-13],[11,-11],[12,-17],[3,-16],[-4,-17]];
function addFish(x,z,y=0,bonus=false){const root=new THREE.Group();root.position.set(x,y+.7,z);scene.add(root);ball(mat('#f8d47e',.25),0,0,0,.32,.13,.12,root);const tail=mesh('ear',mat('#f8d47e',.25),[-.35,0,0],[.18,.3,.08],root);tail.rotation.z=Math.PI/2;ball('#544b4b',.17,.027,-.11,.024,.025,.015,root);const halo=mesh('torus',mat('#f0ce7e',.25),[0,-.22,0],[.35,.35,.35],root);halo.rotation.x=Math.PI/2;fish.push({root,x,z,y,bonus,taken:false,phase:rand(0,TAU)});}
for(const [x,z]of fishPlaces)addFish(x,z,floorAt(x,z));
const pots=[];
for(const [x,z]of [[-3,12],[3,5],[-8,1],[12,4],[-16,-4],[17,-9],[-4,-14],[5,-16]]){
 const y=floorAt(x,z),root=new THREE.Group();scene.add(root);root.position.set(x,y,z);
 cyl('#bf8f87',0,.28,0,.35,.56,root,false);cyl('#e8b5a0',0,.56,0,.41,.14,root,false);cyl('#62545c',0,.635,0,.31,.025,root,false);
 for(let j=0;j<3;j++){const leaf=ball('#8cab9b',Math.sin(j*2)*.14,.82,Math.cos(j*2)*.14,.1,.3,.1,root);leaf.rotation.z=j*.7;}
 pots.push({root,x,z,y,broken:false});
}
const particles=[];const particleGeo=new THREE.SphereGeometry(1,5,3);
function burst(x,y,z,color,n=12,power=2){for(let i=0;i<n&&particles.length<140;i++){const m=new THREE.Mesh(particleGeo,mat(color));m.position.set(x,y,z);m.scale.setScalar(rand(.025,.09));scene.add(m);particles.push({m,v:new THREE.Vector3(rand(-power,power),rand(1,power+1),rand(-power,power)),life:rand(.6,1.3),max:1.3});}}
const rings=[];
function pulse(x,y,z,color='#f5d28d'){const m=mesh('torus',new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}),[x,y+.15,z],[.5,.5,.5]);m.rotation.x=Math.PI/2;rings.push({m,t:0});}
// A tiny score: pentatonic celesta + plucked bass + brushed noise + choir vowels.
let audio=null;
const notes=[0,2,4,7,9,7,4,2,0,4,7,9,12,9,7,4];
function startAudio(){if(audio){audio.ctx.resume().catch(()=>{});return;}try{
 const ctx=new AudioContext(),master=ctx.createGain(),music=ctx.createGain(),fx=ctx.createGain();master.gain.value=muted?0:.65;master.connect(ctx.destination);music.gain.value=.36;music.connect(master);fx.gain.value=.55;fx.connect(master);
 const noise=ctx.createBuffer(1,ctx.sampleRate*.25,ctx.sampleRate);const nd=noise.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=(Math.random()*2-1)*Math.exp(-i/nd.length*4);
 audio={ctx,master,music,fx,noise,next:ctx.currentTime+.1,beat:0};ctx.resume().catch(()=>{});
 }catch{}}
function tone(freq,t,dur=.3,vol=.1,type='sine',bus='fx'){
 if(!audio)return;const{ctx}=audio,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(audio[bus]);o.start(t);o.stop(t+dur+.03);
}
function sound(kind,variant=0){if(!audio)return;const t=audio.ctx.currentTime;
 if(kind==='fish'){tone(740,t,.16,.13);tone(1110,t+.065,.22,.07);}
 if(kind==='jump'){const o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(480,t+.16);g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.0001,t+.2);o.connect(g);g.connect(audio.fx);o.start(t);o.stop(t+.22);}
 if(kind==='land')tone(75,t,.12,.11,'sine');
 if(kind==='pot'){const src=audio.ctx.createBufferSource(),g=audio.ctx.createGain(),f=audio.ctx.createBiquadFilter();src.buffer=audio.noise;f.type='highpass';f.frequency.value=1500;g.gain.value=.25;src.connect(f);f.connect(g);g.connect(audio.fx);src.start(t);tone(180,t,.2,.1,'triangle');}
 if(kind==='join')for(let i=0;i<5;i++)tone(330*2**([0,4,7,12,16][i]/12),t+i*.1,.6,.13,'sine');
 if(kind==='meow'){
  const o=audio.ctx.createOscillator(),g=audio.ctx.createGain(),f=audio.ctx.createBiquadFilter();o.type='sawtooth';const base=370+variant*42;o.frequency.setValueAtTime(base*.72,t);o.frequency.exponentialRampToValueAtTime(base*1.2,t+.1);o.frequency.exponentialRampToValueAtTime(base*.8,t+.45);f.type='lowpass';f.frequency.setValueAtTime(1200,t);f.frequency.exponentialRampToValueAtTime(550,t+.48);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.07);g.gain.exponentialRampToValueAtTime(.0001,t+.5);o.connect(f);f.connect(g);g.connect(audio.fx);o.start(t);o.stop(t+.53);
 }
}
function updateMusic(){if(!audio||audio.ctx.state!=='running')return;
 const {ctx}=audio;if(mode==='pause'||mode==='title'){audio.next=ctx.currentTime+.1;return;}if(audio.next<ctx.currentTime-.3)audio.next=ctx.currentTime+.04;
 const count=cats.filter(c=>c.joined).length;
 while(audio.next<ctx.currentTime+.18){const b=audio.beat++,t=audio.next,mel=notes[b%notes.length];
  tone(261.63*2**(mel/12),t,.7,.07,'sine','music');
  if(b%4===0){tone(65.41*2**([0,0,5,7][Math.floor(b/4)%4]/12),t,1.4,.15,'triangle','music');}
  if(count>=1&&b%2===0){tone(1568,t,.13,.025,'sine','music');tone(2349,t,.12,.012,'sine','music');}
  if(count>=2&&b%4===0)tone(130.8*2**(mel/12),t,1.3,.06,'sine','music');
  if(count>=3){const s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();s.buffer=audio.noise;f.type='highpass';f.frequency.value=6500;g.gain.value=b%2?.025:.045;s.connect(f);f.connect(g);g.connect(audio.music);s.start(t);}
  if(count>=4&&b%4===0){for(const n of [0,4,7])tone(261.63*2**(n/12),t,1.6,.025,'triangle','music');}
  if(count>=5&&b%2)tone(523.25*2**(notes[(b+4)%16]/12),t,.3,.035,'triangle','music');
  audio.next+=mode==='concert'?.255:.35;
 }
}
function mute(){muted=!muted;try{localStorage.setItem('midnight-purrade-muted',String(muted?1:0));}catch{}if(audio)audio.master.gain.setTargetAtTime(muted?0:.65,audio.ctx.currentTime,.08);updateSoundButtons();}
function updateSoundButtons(){$('sound').textContent=$('mute-menu').textContent=muted?'♫ Sound off':'♫ Sound on';}updateSoundButtons();

const trail=[new THREE.Vector3(0,0,13)];
const keys=new Set();let orbit=.68,mouseDrag=null,touchMove={x:0,y:0},touchSing=false;
function message(text,seconds=4){$('toast').textContent=text;$('toast').classList.add('visible');toastTime=seconds;}
function updateHUD(){
 $('fish').textContent=wallet;$('choir').textContent=`${cats.filter(c=>c.joined).length} / 5`;
 for(const c of cats)c.token.classList.toggle('joined',c.joined);
 const remaining=cats.filter(c=>!c.joined),next=remaining[0];
 if(next){$('chapter').textContent=remaining.length===5?'The gathering':`The gathering · ${5-remaining.length} voices found`;$('objective').textContent=`Find ${next.name}`;$('subgoal').textContent=next.index===0?'Follow the little fish. Pip is waiting by the yellow awning.':next.index===1?'The rooftop garden has a very low, very sleepy voice.':next.index===2?'Listen for a racket under the washing line.':next.index===3?'Pounce up the wide steps to the north terrace.':'One last voice is hiding below the water tower.';}
 else{$('chapter').textContent='The grand finale';$('objective').textContent='Wake the moon';$('subgoal').textContent='Bring everyone to the pink bandstand. Sing together to begin the concert.';}
}
function start(){if(mode!=='title')return;mode='play';renderer.domElement.focus();$('title').hidden=true;$('hud').hidden=false;startAudio();updateHUD();message('Tonight’s mission: five cats, one moon, absolutely no permission.',5);}
function pause(){if(mode==='title'||mode==='ending')return;if(mode==='pause'){mode=previousMode;$('menu').hidden=true;renderer.domElement.focus();if(audio)audio.music.gain.setTargetAtTime(.36,audio.ctx.currentTime,.12);}else{previousMode=mode;mode='pause';$('menu').hidden=false;$('resume').focus();keys.clear();touchSing=false;touchMove={x:0,y:0};if(audio)audio.music.gain.setTargetAtTime(.1,audio.ctx.currentTime,.12);}}
function doMeow(){if(mode!=='play'&&mode!=='roam'&&mode!=='concert')return;if(meowCooldown>0)return;meowCooldown=.8;purrs++;sound('meow');pulse(player.root.position.x,player.root.position.y,player.root.position.z);player.singTime=.65;
 cats.filter(c=>c.joined).forEach((c,i)=>{c.singDelay=.13+i*.11;c.singTime=.7;});
 const near=nearCat();if(near&&!near.joined&&wallet<near.cost)message(`${near.name}: ${near.line} (${near.cost-wallet} more fish)`,3.5);
 if(!near&&purrs===2)message('Every great singer has a fish-based appearance fee.',3.5);
}
function jump(){if((mode!=='play'&&mode!=='roam'&&mode!=='concert')||!grounded||jumpCooldown>0)return;vy=7.5;grounded=false;jumpCooldown=.32;sound('jump');player.rig.scale.set(1.08,.85,1.08);}
function nearCat(){let bestC=null,dist=2.4;for(const c of cats){if(c.joined)continue;const d=player.root.position.distanceTo(c.cat.root.position);if(d<dist){dist=d;bestC=c;}}return bestC;}
function recruit(c){c.joined=true;c.charge=0;wallet-=c.cost;c.label.visible=false;chargeCat=null;sound('join');burst(c.x,c.y+1,c.z,'#f5cd7a',25,3);pulse(c.x,c.y,c.z,'#ffadb9');message(c.joinedLine,5);updateHUD();if(cats.every(c=>c.joined))message('The whole choir! Gather at the pink bandstand and hold E.',6);}
function beginConcert(){mode='concert';concertTime=0;stageGlow.intensity=32;keys.clear();player.root.position.set(0,0,1.35);velocity.set(0,0,0);orbit=.1;$('prompt').innerHTML='A small, glorious racket.<small>Press E to sing. Space to take a bow.</small>';$('mission').style.opacity=0;$('roster').style.opacity=0;message('The Midnight Purrade presents: “Mrrp in D minor”',6);}
function finish(){mode='ending';$('ending').hidden=false;$('roam').focus();$('prompt').textContent='';$('end-stats').textContent=`${Math.floor(elapsed/60)}m ${Math.floor(elapsed%60)}s · ${totalFish} fish found · ${purrs} unsolicited meows`;
 const earned=[true,placedFish===fishPlaces.length,potsBroken===8],labels=['Moon choir','Every sardine','Pot liberation'];$('awards').innerHTML=labels.map((l,i)=>`<div class="award ${earned[i]?'won':''}"><b>${earned[i]?'✦':'·'}</b>${l}</div>`).join('');
 $('end-line').textContent=earned.every(Boolean)?'Every fish found. Every pot improved. The city will remember you.':'Five strangers. One spectacularly unqualified band.';
 const record={fish:Math.max(best?.fish||0,totalFish),pots:Math.max(best?.pots||0,potsBroken),won:true};try{localStorage.setItem('midnight-purrade-best',JSON.stringify(record));}catch{}best=record;
}
function roam(){if(mode!=='ending')return;mode='roam';$('ending').hidden=true;renderer.domElement.focus();$('mission').style.opacity=1;$('roster').style.opacity=1;$('chapter').textContent='After the applause';$('objective').textContent='The rooftops are yours';$('subgoal').textContent=`Find the remaining fish and flowerpots, or just enjoy being a cat. ${potsBroken}/8 pots pounced.`;}
$('title').addEventListener('click',start);$('pause').onclick=pause;$('resume').onclick=pause;$('sound').onclick=mute;$('mute-menu').onclick=mute;$('roam').onclick=roam;$('again').onclick=()=>location.reload();
$('restart').onclick=()=>{if(restartArmed)location.reload();else{restartArmed=true;$('restart-note').hidden=false;}};
$('quality').onclick=()=>{quality=quality==='full'?'light':'full';renderer.shadowMap.enabled=quality==='full';renderer.setPixelRatio(quality==='full'?Math.min(devicePixelRatio,1.6):1);renderer.setSize(innerWidth,innerHeight);$('quality').textContent=`Picture: ${quality}`;};
window.addEventListener('keydown',e=>{
 if(e.code==='Tab'&&(mode==='pause'||mode==='ending')){const panel=mode==='pause'?$('menu'):$('ending'),buttons=[...panel.querySelectorAll('button')],first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
 if(e.target instanceof HTMLButtonElement && ['Enter','Space'].includes(e.code))return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&e.code!=='Tab')e.preventDefault();
 if(e.code==='Enter'){if(mode==='title')start();else if(mode==='pause')pause();else if(mode==='ending')roam();return;}
 if(e.code==='Escape'&&!e.repeat){pause();return;}if(e.code==='KeyM'&&!e.repeat){mute();return;}if(mode==='title'){return;}
 if(e.code==='Space'&&!e.repeat)jump();if(e.code==='KeyE'&&!e.repeat)doMeow();if(e.code==='KeyR')orbit=.68;keys.add(e.code);
});window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(mode==='play'||mode==='roam'||mode==='concert')pause();});
renderer.domElement.addEventListener('pointerdown',e=>{if(mode==='play'||mode==='roam'){mouseDrag={x:e.clientX,y:e.clientY,last:e.clientX,moved:false};renderer.domElement.setPointerCapture(e.pointerId);}});
renderer.domElement.addEventListener('pointermove',e=>{if(mouseDrag){if(Math.hypot(e.clientX-mouseDrag.x,e.clientY-mouseDrag.y)>5)mouseDrag.moved=true;if(mouseDrag.moved)orbit-=(e.clientX-mouseDrag.last)*.006;mouseDrag.last=e.clientX;}});
renderer.domElement.addEventListener('pointerup',()=>{if(mouseDrag&&!mouseDrag.moved)doMeow();mouseDrag=null;});
const stick=$('stick');let stickId=null;
stick.addEventListener('pointerdown',e=>{e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e);});
function stickMove(e){if(e.pointerId!==stickId)return;const b=stick.getBoundingClientRect(),x=(e.clientX-b.left-b.width/2)/38,y=(e.clientY-b.top-b.height/2)/38,l=Math.max(1,Math.hypot(x,y));touchMove={x:x/l,y:y/l};stick.firstElementChild.style.transform=`translate(${touchMove.x*30}px,${touchMove.y*30}px)`;}
stick.addEventListener('pointermove',stickMove);function stickEnd(){stickId=null;touchMove={x:0,y:0};stick.firstElementChild.style.transform='';}stick.addEventListener('pointerup',stickEnd);stick.addEventListener('pointercancel',stickEnd);
$('touch-jump').addEventListener('pointerdown',e=>{e.preventDefault();jump();});$('touch-sing').addEventListener('pointerdown',e=>{e.preventDefault();touchSing=true;doMeow();$('touch-sing').setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel'])$('touch-sing').addEventListener(event,()=>touchSing=false);

function animateCat(c,dt,speed,time,singing=false){
 const moving=speed>.15,run=speed>4.2;c.phase+=dt*(moving?(run?13:9):1.8);
 const squash=grounded?1:clamp(1-vy*.018,.88,1.12);
 const desiredY=c===player? squash:1;c.rig.scale.lerp(new THREE.Vector3(1,desiredY,1),Math.min(1,dt*10));
 c.rig.position.y=moving?Math.abs(Math.sin(c.phase))* (run?.09:.045):Math.sin(time*2+c.phase)*.015;
 c.body.rotation.x=moving?Math.sin(c.phase)*.035:0;
 c.head.rotation.x=singing?-.24:Math.sin(time*.8+c.phase)*.025;c.head.rotation.y=moving?0:Math.sin(time*.45+c.phase)*.12;
 for(let i=0;i<4;i++)c.legs[i].rotation.x=moving?Math.sin(c.phase+(i===0||i===3?0:Math.PI))*(run?.65:.42):0;
 c.tail.rotation.x=-.3+Math.sin(time*1.7+c.phase)*.09;c.tail.rotation.z=Math.sin(time*2.1+c.phase)*.22;
 c.links.forEach((l,i)=>{l.rotation.x=i<4?.13:.35;l.rotation.z=Math.sin(time*2-i*.5+c.phase)*.08;});
 c.sh.position.set(c.root.position.x,floorAt(c.root.position.x,c.root.position.z,c.root.position.y)+.025,c.root.position.z);c.sh.scale.setScalar(1+Math.max(0,c.root.position.y-floorAt(c.root.position.x,c.root.position.z,c.root.position.y))*.15);
 c.blink-=dt;if(c.blink<-.12)c.blink=rand(2,5);
 c.eyes.forEach(e=>e.scale.y=c.blink<0?.12:1);c.mouth.visible=singing;
 c.ears.forEach((e,i)=>e.rotation.z=(i===0?1:-1)*.16+Math.max(0,Math.sin(time*.8+c.phase)-.96)*5);
 c.idle=moving?0:c.idle+dt;
 if(!moving&&!singing&&c.idle>6&&c.idle%12<9){const t=c.idle%12;c.legs[0].rotation.x=-1.3;c.legs[0].rotation.z=-.25;c.head.rotation.x=.25+Math.sin(time*7)*.08;c.head.rotation.z=.16;c.rig.rotation.z=.06;}else{c.legs[0].rotation.z=0;c.head.rotation.z=0;c.rig.rotation.z=0;}
}
function breakPots(){const p=player.root.position;for(const pot of pots)if(!pot.broken&&Math.hypot(p.x-pot.x,p.z-pot.z)<1.35&&Math.abs(p.y-pot.y)<1.5){pot.broken=true;pot.root.visible=false;potsBroken++;sound('pot');burst(pot.x,pot.y+.4,pot.z,'#d5a295',18,3);addFish(pot.x-.4,pot.z,pot.y,true);addFish(pot.x+.4,pot.z,pot.y,true);if(potsBroken===1)message('The pot was clearly in your way. Two bonus sardines!',4);else if(potsBroken===8)message('All eight pots liberated. You are a gardening catastrophe.',4);}}
function movePlayer(dt){
 let ix=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touchMove.x;
 let iz=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-touchMove.y;
 const len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}
 const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?7:4.6;
 const target=new THREE.Vector3(Math.cos(orbit)*ix-Math.sin(orbit)*iz,0,-Math.sin(orbit)*ix-Math.cos(orbit)*iz).multiplyScalar(speed);
 velocity.lerp(target,1-Math.exp(-dt*(len?11:15)));
 const p=player.root.position,nx=clamp(p.x+velocity.x*dt,-21.1,21.1),nz=clamp(p.z+velocity.z*dt,-19.1,19.1);
 if(!solidAt(nx,p.z,p.y))p.x=nx;else velocity.x=0;
 if(!solidAt(p.x,nz,p.y))p.z=nz;else velocity.z=0;
 const oldY=p.y;vy-=19*dt;p.y+=vy*dt;const floor=floorAt(p.x,p.z,oldY);
 if(p.y<=floor&&vy<=0){if(!grounded&&vy<-2){sound('land');burst(p.x,floor+.1,p.z,'#b9c4ce',5,1);player.rig.scale.set(1.12,.82,1.12);breakPots();}p.y=floor;vy=0;grounded=true;}else grounded=false;
 if(!grounded&&vy<2)breakPots();
 const actualSpeed=flat(velocity);player.speed=actualSpeed;if(actualSpeed>.15)player.root.rotation.y=angleTo(player.root.rotation.y,Math.atan2(-velocity.x,-velocity.z),1-Math.exp(-dt*15));
 stepTimer-=dt;if(grounded&&actualSpeed>1&&stepTimer<0){stepTimer=actualSpeed>5?.17:.26;if(audio)tone(rand(70,95),audio.ctx.currentTime,.045,.013,'triangle');}
}
function followCats(dt){
 if(mode==='play'||mode==='roam'){if(trail[0].distanceTo(player.root.position)>.16){trail.unshift(player.root.position.clone());if(trail.length>500)trail.pop();}}
 const joined=cats.filter(c=>c.joined);for(const c of cats){const cat=c.cat;let target;
 if(c.joined){
  if(mode==='concert'||mode==='ending'){const a=(c.index/5)*TAU;target=new THREE.Vector3(Math.sin(a)*2,0,Math.cos(a)*2-.3);}
  else{const gap=(joined.indexOf(c)+1)*1.65;let distance=0;target=trail[trail.length-1].clone();for(let k=1;k<trail.length;k++){const d=trail[k-1].distanceTo(trail[k]);if(distance+d>=gap){target=trail[k-1].clone().lerp(trail[k],(gap-distance)/Math.max(.001,d));break;}distance+=d;}}
  const d=target.clone().sub(cat.root.position);d.y=0;const dist=flat(d);let speed=dist>1?Math.min(7,dist*2):0;
  if(speed){d.normalize();cat.root.position.addScaledVector(d,speed*dt);cat.root.rotation.y=angleTo(cat.root.rotation.y,Math.atan2(-d.x,-d.z),1-Math.exp(-dt*9));}
  const fy=(mode==='concert'||mode==='ending')?0:Math.max(floorAt(cat.root.position.x,cat.root.position.z),target.y);cat.root.position.y=lerp(cat.root.position.y,fy,Math.min(1,dt*9));cat.speed=speed;
  if(mode==='concert'){cat.root.rotation.y=angleTo(cat.root.rotation.y,Math.atan2(cat.root.position.x,cat.root.position.z),dt*4);cat.rig.position.y+=Math.abs(Math.sin(worldTime*7+c.index))*.2;}
 }else{
  cat.speed=0;const d=player.root.position.clone().sub(cat.root.position);if(flat(d)<4)cat.root.rotation.y=angleTo(cat.root.rotation.y,Math.atan2(-d.x,-d.z),dt*3);
  c.label.position.y=c.y+2.65+Math.sin(worldTime*1.5+c.index)*.07;
  c.label.material.opacity=mode==='title'?0:clamp(1-(flat(d)-11)/8,0,1);
 }
 if(c.singDelay>0){c.singDelay-=dt;if(c.singDelay<=0){sound('meow',c.index+1);pulse(cat.root.position.x,cat.root.position.y,cat.root.position.z,'#e8b2c3');}}
 if(c.singTime>0)c.singTime-=dt;
 animateCat(cat,dt,cat.speed,worldTime,c.singTime>0||mode==='concert');
 if(mode==='concert')cat.rig.position.y+=Math.abs(Math.sin(worldTime*7+c.index))*.2;
 }}
let promptKind='',stageCharge=0;
function interactions(dt){
 const p=player.root.position;
 for(const f of fish){if(f.taken)continue;f.root.rotation.y=worldTime*1.5+f.phase;f.root.position.y=f.y+.65+Math.sin(worldTime*2.5+f.phase)*.12;
  if(Math.hypot(f.x-p.x,f.z-p.z)<.9&&Math.abs(p.y-f.y)<1.15){f.taken=true;f.root.visible=false;wallet++;totalFish++;if(!f.bonus)placedFish++;sound('fish');burst(f.x,f.y+.8,f.z,'#f7d581',7,1.7);updateHUD();}
 }
 if(mode!=='play'&&mode!=='roam')return;
 const c=nearCat(),singing=keys.has('KeyE')||touchSing;
 let prompt='';
 if(c){
  if(wallet>=c.cost){if(singing){c.charge+=dt;chargeCat=c;player.singTime=.2;c.cat.singTime=.2;if(c.charge>=1.3)recruit(c);}else c.charge=Math.max(0,c.charge-dt*2);
   if(!c.joined){const progress=c.charge>0?` · ${Math.round(c.charge/1.3*100)}%`:'';prompt=`<kbd>E</kbd> Hold to sing with ${c.name}${progress}<small>${c.cost} sardines · ${c.role}</small>`;}
  }else prompt=`${c.name} would like ${c.cost} sardines<small>Find ${c.cost-wallet} more · <kbd>E</kbd> say hello</small>`;
 }else if(cats.every(c=>c.joined)&&Math.hypot(p.x,p.z)<3.4&&mode==='play'){
  prompt=`<kbd>E</kbd> Hold to wake the moon<small>Your whole wonderfully terrible choir is ready.</small>`;
  stageCharge=singing?stageCharge+dt:0;if(stageCharge>1.3)beginConcert();
 }else{
  stageCharge=0;for(const c of cats)c.charge=0;
  const pot=pots.find(pot=>!pot.broken&&Math.hypot(p.x-pot.x,p.z-pot.z)<2);
  if(pot)prompt='<kbd>Space</kbd> Pounce on the pot<small>A perfectly reasonable place to hide a sardine.</small>';
  else if(elapsed<16)prompt='<kbd>W A S D</kbd> wander · <kbd>Space</kbd> pounce<small>Collect the golden sardines. The choir has standards.</small>';
 }
 if(innerWidth<700)prompt=prompt.replaceAll('<kbd>E</kbd>','<kbd>Sing</kbd>').replaceAll('<kbd>Space</kbd>','<kbd>Pounce</kbd>').replaceAll('<kbd>W A S D</kbd> wander · <kbd>Pounce</kbd> pounce','Use the stick to wander · Pounce to jump');
 if(mode==='play'||mode==='roam')$('prompt').innerHTML=prompt;
}
const mapCtx=$('map').getContext('2d');
function drawMap(){const g=mapCtx,w=184;g.clearRect(0,0,w,w);g.save();g.translate(92,92);g.rotate(-orbit);g.scale(3.7,3.7);g.fillStyle='#627990';g.fillRect(-22,-20,44,40);g.strokeStyle='#b7c7d0';g.lineWidth=.2;g.strokeRect(-22,-20,44,40);g.fillStyle='#8195a4';g.fillRect(-14,-19.1,28,11);g.fillStyle='#d792a2';g.beginPath();g.arc(0,0,3.2,0,TAU);g.fill();
 for(const f of fish)if(!f.taken){g.fillStyle='#f4cf7c';g.beginPath();g.arc(f.x,f.z,.25,0,TAU);g.fill();}
 for(const c of cats){g.fillStyle=c.joined?'#eab2b7':'#fff1cf';g.beginPath();g.arc(c.cat.root.position.x,c.cat.root.position.z,c.joined?.55:.85,0,TAU);g.fill();if(!c.joined){g.fillStyle='#243950';g.font='1.5px Arial';g.textAlign='center';g.fillText(c.name[0],c.x,c.z+.5);}}
 const p=player.root.position;g.save();g.translate(p.x,p.z);g.rotate(-player.root.rotation.y);g.fillStyle='#f8cf75';g.strokeStyle='#25394e';g.lineWidth=.25;g.beginPath();g.moveTo(0,-1.3);g.lineTo(-.85,1);g.lineTo(.85,1);g.closePath();g.fill();g.stroke();g.restore();g.restore();}
const cameraTarget=new THREE.Vector3(0,0,13),desiredCam=new THREE.Vector3();let mapTick=0;
function updateCamera(dt){
 if(mode==='title'){desiredCam.set(3.5,3.6,19);camera.position.lerp(desiredCam,1-Math.exp(-dt*3));cameraTarget.set(-1.7,.95,12.5);camera.lookAt(cameraTarget);return;}
 const p=player.root.position;
 const concert=mode==='concert'||mode==='ending';const focus=concert?new THREE.Vector3(0,.7,0):p.clone().add(new THREE.Vector3(0,.5,0));
 cameraTarget.lerp(focus,1-Math.exp(-dt*(concert?2.1:7)));
 const dist=concert?12.5:(innerWidth<700?19:14),ang=concert?.3+Math.sin(worldTime*.08)*.3:orbit;
 desiredCam.copy(cameraTarget).add(new THREE.Vector3(Math.sin(ang)*dist,concert?9.5:12.5,Math.cos(ang)*dist));
 camera.position.lerp(desiredCam,1-Math.exp(-dt*5));camera.lookAt(cameraTarget);
}
camera.position.set(3.5,3.6,19);camera.lookAt(-1.7,.95,12.5);
let lowFrames=0,frameSamples=0,totalFrameTime=0,autoReduced=false;
let simulationOnly=false;
function tick(dt){
 dt=Math.min(dt,.05);if(mode==='pause'){if(!simulationOnly)renderer.render(scene,camera);return;}worldTime+=dt;
 jumpCooldown=Math.max(0,jumpCooldown-dt);meowCooldown=Math.max(0,meowCooldown-dt);
 if(mode==='play'||mode==='roam'){elapsed+=dt;movePlayer(dt);interactions(dt);}
 if(mode==='concert'){concertTime+=dt;player.root.rotation.y=Math.PI+Math.sin(worldTime*3)*.16;vy-=19*dt;player.root.position.y=Math.max(0,player.root.position.y+vy*dt);if(player.root.position.y===0){grounded=true;vy=0;}if(!reduced&&Math.random()<dt*8)burst(rand(-3,3),rand(2,4),rand(-2,2),['#f7ce7b','#eca9b7','#a7c5c1'][Math.floor(rand(0,3))],4,2);if(concertTime>18)finish();}
 if(player.singTime>0)player.singTime-=dt;
 animateCat(player,dt,mode==='title'?0:player.speed,worldTime,player.singTime>0||mode==='concert');
 if(mode==='concert')player.rig.position.y+=Math.abs(Math.sin(worldTime*7))*.16;
 if(mode==='title'){player.head.rotation.y=Math.sin(worldTime*.5)*.12;player.root.rotation.y=Math.PI+.35+Math.sin(worldTime*.3)*.08;}
 followCats(dt);
 for(const m of laundry)m.rotation.x=Math.sin(worldTime*1.8+m.position.z)*.13;
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=dt*5;p.m.position.addScaledVector(p.v,dt);p.m.rotation.x+=dt*3;p.m.scale.multiplyScalar(Math.max(.85,1-dt*1.5));if(p.life<=0){p.m.removeFromParent();particles.splice(i,1);}}
 for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.t+=dt;r.m.scale.setScalar(.5+r.t*3);r.m.material.opacity=Math.max(0,.8-r.t);if(r.t>.8){r.m.removeFromParent();r.m.material.dispose();rings.splice(i,1);}}
 if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');}
 updateCamera(dt);updateMusic();mapTick+=dt;if(mapTick>.1){drawMap();mapTick=0;}
 if(!simulationOnly)renderer.render(scene,camera);
}
let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=(now-last)/1000;last=now;if(!manual){tick(dt);
 // Lower fill cost after sustained slow rendering, while never changing simulation rules.
 if(mode==='play'&&!autoReduced){totalFrameTime+=dt;frameSamples++;if(frameSamples===180){if(totalFrameTime/frameSamples>.035){autoReduced=true;quality='light';renderer.shadowMap.enabled=false;renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);$('quality').textContent='Picture: light';}frameSamples=0;totalFrameTime=0;}}
 }}requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
// Deterministic browser test seam. Present only behind ?debug, never used by normal play.
if(params.has('debug'))window.__game={
 step(seconds,render=true){simulationOnly=true;for(let t=0;t<seconds;t+=1/60)tick(Math.min(1/60,seconds-t));simulationOnly=false;if(render)renderer.render(scene,camera);},
 state(){return{mode,wallet,totalFish,placedFish,potsBroken,elapsed,position:player.root.position.toArray(),grounded,joined:cats.filter(c=>c.joined).map(c=>c.name),cats:cats.map(c=>({name:c.name,cost:c.cost,position:c.cat.root.position.toArray(),joined:c.joined})),fish:fish.filter(f=>!f.taken).map(f=>({x:f.x,z:f.z,y:f.y,bonus:f.bonus})),pots:pots.filter(p=>!p.broken).map(p=>({x:p.x,z:p.z,y:p.y})),audio:audio?{state:audio.ctx.state,beat:audio.beat,muted}:null,drawCalls:renderer.info.render.calls};},
 // Navigation helpers are deliberately test-only: tests still use real keys for movement and invitations.
 place(x,z,y){player.root.position.set(x,y??floorAt(x,z),z);velocity.set(0,0,0);vy=0;grounded=true;},
 faceNorth(){orbit=0;},
 async audioLevel(){if(!audio)return 0;const a=audio.ctx.createAnalyser();a.fftSize=2048;audio.master.connect(a);sound('meow');await new Promise(r=>setTimeout(r,150));const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);audio.master.disconnect(a);return Math.sqrt(data.reduce((n,v)=>n+v*v,0)/data.length);},
};
updateHUD();tick(0);
