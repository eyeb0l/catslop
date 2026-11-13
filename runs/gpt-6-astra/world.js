import * as T from 'three';
import { mergeGeometries } from '../../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
export const palette={ground:0xa99484,edge:0x536c70,cream:0xf9e5bc,orange:0xd98a4e,dark:0x233d46,teal:0x4c8789,pink:0xb87167,gold:0xf3bb69,leaf:0x507766};
const mats=new Map();export function mat(c){if(!mats.has(c))mats.set(c,new T.MeshStandardMaterial({color:c,roughness:.9,emissive:[0xe7b976,0xf5d191,0xf1c983,0xdab478].includes(c)?c:0x000000,emissiveIntensity:.45}));return mats.get(c);}
const ballGeo=new T.SphereGeometry(1,12,8),boxGeo=new T.BoxGeometry(1,1,1),cylinderGeo=new T.CylinderGeometry(1,1,1,12);
export function box(parent,c,x,y,z,sx,sy,sz){const m=new T.Mesh(boxGeo,mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
export function ball(parent,c,x,y,z,sx,sy,sz){const m=new T.Mesh(ballGeo,mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
export function cyl(parent,c,x,y,z,r,h,r2){const m=new T.Mesh(r2===undefined?cylinderGeo:new T.CylinderGeometry(r,r2,h,12),mat(c));m.position.set(x,y,z);if(r2===undefined)m.scale.set(r,h,r);parent.add(m);return m;}
export function line(parent,points,c=0xeee5d0){const geo=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const o=new T.Line(geo,new T.LineBasicMaterial({color:c}));parent.add(o);return o;}
export function textLabel(text,bg='#21464c',fg='#ffe5b4',w=512,h=128){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.strokeStyle=fg;x.lineWidth=3;x.strokeRect(9,9,w-18,h-18);x.fillStyle=fg;x.font=`${Math.round(h*.38)}px Georgia`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h*.52);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});}
function sign(parent,text,x,y,z,w=3.5,h=.8,bg){const m=new T.Mesh(new T.PlaneGeometry(w,h),textLabel(text,bg));m.position.set(x,y,z);parent.add(m);return m;}
export function makeCat(col=0xdb8b4d,accent=0xffebc9){const root=new T.Group(),body=new T.Group();root.add(body);
  const torso=ball(body,col,0,.83,0,.45,.48,.76);ball(body,col,0,.82,-.48,.49,.52,.48);ball(body,accent,0,.79,.54,.31,.4,.25);
  const eyes=[],ears=[];const head=new T.Group();head.position.set(0,1.3,.65);body.add(head);ball(head,col,0,0,0,.47,.42,.4);ball(head,accent,-.155,-.17,.31,.205,.155,.15);ball(head,accent,.155,-.17,.31,.205,.155,.15);
  for(const side of [-1,1]){const e=new T.Mesh(new T.ConeGeometry(.24,.5,3),mat(col));e.position.set(side*.3,.37,-.03);e.rotation.z=side*-.22;e.rotation.y=side*.2;head.add(e);ears.push(e);const inner=new T.Mesh(new T.ConeGeometry(.13,.29,3),mat(0xcc8a83));inner.position.set(side*.3,.4,.075);inner.rotation.z=side*-.22;head.add(inner);
    eyes.push([ball(head,0xedd897,side*.215,.045,.337,.115,.115,.055),.115],[ball(head,0x1a3436,side*.215,.045,.384,.034,.09,.02),.09],[ball(head,0xffffff,side*.235,.082,.399,.022,.026,.012),.026]);
    for(let i=0;i<3;i++)line(head,[[side*.19,-.17,.43],[side*.51,-.13-i*.05,.43],[side*.7,-.09-i*.09,.39]],0xf6e8d0);
    for(let i=0;i<3;i++){const stripe=ball(body,0xb16a3c,side*.435,.94,-.32+i*.28,.03,.22,.07);stripe.rotation.z=side*.2;}
  }
  const nose=new T.Mesh(new T.ConeGeometry(.065,.07,3),mat(0xb36c6a));nose.rotation.z=Math.PI;nose.rotation.x=Math.PI/2;nose.position.set(0,-.14,.463);head.add(nose);line(head,[[0,-.18,.45],[0,-.23,.46],[-.07,-.25,.44]],0x775248);line(head,[[0,-.23,.46],[.07,-.25,.44]],0x775248);
  for(let i=-1;i<=1;i++)ball(head,0xb16a3c,i*.13,.29,.2,.035,.105,.055);
  const legs=[];for(const x of [-.29,.29])for(const z of [-.48,.45]){const leg=new T.Group();leg.position.set(x,.77,z);body.add(leg);ball(leg,col,0,-.13,0,.15,.29,.16);ball(leg,accent,0,-.47,.06,.16,.15,.22);legs.push(leg);}
  const tail=new T.Group();tail.position.set(0,1.04,-.62);body.add(tail);let p=tail;const tailBones=[];for(let i=0;i<7;i++){const b=new T.Group();if(i)b.position.y=.23;p.add(b);ball(b,i>4?0xb16a3c:col,0,.12,0,.12-i*.008,.19,.12-i*.008);tailBones.push(b);p=b;}
  const shadow=new T.Mesh(new T.CircleGeometry(.8,24),new T.MeshBasicMaterial({color:0x173338,transparent:true,opacity:.19,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;root.add(shadow);
  root.traverse(o=>{if(o.isMesh&&o!==shadow)o.castShadow=true;});
  return {root,body,head,legs,tail,tailBones,shadow,animate(t,speed,grounded,swat=0,purr=false){const phase=t*8;const blink=t%5>4.8?.08:purr?.5:1;eyes.forEach(([e,y])=>e.scale.y=y*blink);ears.forEach((e,i)=>e.rotation.x=Math.sin(t*1.7+i)*.06);legs.forEach((l,i)=>{l.rotation.x=grounded?Math.sin(phase+(i===0||i===3?0:Math.PI))*Math.min(speed*.18,.72):i%2?.65:-.6;});body.position.y=grounded?Math.abs(Math.sin(phase))*Math.min(speed*.013,.065):0;body.rotation.x=grounded?0:-.1;torso.scale.y=.48+(purr?Math.sin(t*9)*.025:Math.sin(t*2)*.008);head.rotation.x=purr?.2+Math.sin(t*4)*.04:Math.sin(t*.9)*.03;head.rotation.y=Math.sin(t*.8)*.09*(speed<.2?1:.2);tail.rotation.x=-.55+(speed>4?-.5:0);tailBones.forEach((b,i)=>{b.rotation.x=.18+Math.sin(t*2+i*.5)*.09;b.rotation.z=Math.sin(t*2+i*.4)*.1;});if(swat>0){legs[3].rotation.x=-1.5*Math.sin(swat*Math.PI);legs[3].rotation.z=-.5*Math.sin(swat*Math.PI);}else legs[3].rotation.z=0;}};
}
export function foodModel(kind){const g=new T.Group();if(kind===0){ball(g,0x8fb8b8,0,0,0,.36,.13,.15);const tail=new T.Mesh(new T.ConeGeometry(.18,.22,3),mat(0x77a4ab));tail.rotation.z=Math.PI/2;tail.position.x=-.37;g.add(tail);ball(g,0x17353c,.23,.055,.12,.027,.027,.027);ball(g,0xc2dcd0,.05,.06,0,.22,.065,.12);}else if(kind===1){cyl(g,0xe9e5d0,0,.06,0,.14,.4);cyl(g,0xf7bb75,0,.29,0,.09,.09);box(g,0x6b9da0,0,.04,.142,.2,.14,.015);}else{for(let i=0;i<5;i++){const a=(i/4-.5)*2;const p=ball(g,0xe3a355,Math.sin(a)*.26,0,Math.cos(a)*.15,.13,.14,.15);p.rotation.y=a;}ball(g,0xf3c57e,0,.09,.12,.1,.06,.13);}return g;}
export function buildWorld(scene){const staticRoot=new T.Group();scene.add(staticRoot);const colliders=[],lanterns=[],bunting=[];let seed=913;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const solid=(x,z,w,d,h,y=0)=>colliders.push({x,z,w,d,top:y+h,bottom:y});
 box(staticRoot,0x385b63,0,-1.05,0,33,1.8,32);box(staticRoot,palette.ground,0,-.12,0,32,.25,31);box(staticRoot,0xddd0b1,0,-.05,15.4,32,.3,.25);
 // Inlaid cobbles, with a warm central court and darker perimeter.
 for(let x=-15;x<=15;x++)for(let z=-14;z<=14;z++){if(rand()<.30)continue;const colors=[0xa28f82,0xb4a18e,0xb09b88,0x9b8c82];box(staticRoot,colors[Math.floor(rand()*4)],x+(z%2)*.35,-.005,z,.9,.035,.89);}
 for(const x of [-15.5,15.5]){box(staticRoot,0x557679,x,.33,0,.45,.65,31);solid(x,0,.45,31,.65);for(let z=-14;z<=14;z+=3){box(staticRoot,0x758b83,x,.6,z,.65,1.1,.65);ball(staticRoot,0xbab49a,x,1.2,z,.2,.24,.2);}}
 // Rear canal and neighbouring houses make the market feel like a little place.
 box(staticRoot,0x325d6c,0,-.4,-18,40,.1,6);for(let i=0;i<38;i++)box(staticRoot,0x6a9b9d,rand()*40-20,-.335,-15.5-rand()*5,.2+rand()*1.3,.015,.04);
 const houses=[[-12,-13,5,5,8,0xab7769],[-6.5,-14,4.6,4,6.5,0xd4b18b],[-1.5,-14,4.8,4,8.5,0x788b86],[4,-13.8,5.4,4.4,7.1,0xb4806b],[10.5,-13.5,6,5,9,0xd0a278]];
 houses.forEach(([x,z,w,d,h,c],idx)=>{box(staticRoot,c,x,h/2,z,w,h,d);solid(x,z,w,d,h);box(staticRoot,0xd9c4a2,x,h*.4,z+d/2+.05,w,.15,.15);box(staticRoot,0xe0cba7,x,h-.12,z,w+.2,.22,d+.2);
 const roof=new T.Mesh(new T.ConeGeometry(1,1,4),mat(0x3f686e));roof.position.set(x,h+1.2,z);roof.rotation.y=Math.PI/4;roof.scale.set(w*.8,2.5,d*.8);staticRoot.add(roof);box(staticRoot,0x655e58,x+w*.25,h+2,z-.3,.65,2,.65);
 for(let xx=x-w*.3;xx<x+w*.45;xx+=w*.3)for(let yy=2;yy<h-1;yy+=2.25){box(staticRoot,0x314f55,xx,yy,z+d/2+.06,.88,1.35,.09);box(staticRoot,idx%2?0xdab478:0xf1c983,xx,yy,z+d/2+.12,.63,1.1,.03);box(staticRoot,0x526766,xx,yy,z+d/2+.15,.06,1.16,.04);box(staticRoot,0x526766,xx,yy,z+d/2+.15,.72,.07,.04);box(staticRoot,0x506f70,xx,yy-.7,z+d/2+.2,1.05,.13,.3);}
 box(staticRoot,0x37545a,x,.95,z+d/2+.1,1.3,1.9,.1);ball(staticRoot,0xe0bd73,x+.4,.9,z+d/2+.2,.05,.05,.05);});
 // Distant skyline, moon and stars.
 for(let i=0;i<24;i++){const h=4+rand()*10;box(staticRoot,0x294c59,(i-12)*4,h/2-1,-29-rand()*4,3.6,h,4);}
 const moon=new T.Mesh(new T.SphereGeometry(2,24,16),new T.MeshBasicMaterial({color:0xffe4ad}));moon.position.set(12,21,-29);scene.add(moon);for(let i=0;i<65;i++){const star=new T.Mesh(new T.SphereGeometry(.025+rand()*.03,4,3),new T.MeshBasicMaterial({color:0xe8dfc5}));star.position.set(rand()*95-48,13+rand()*25,-38);scene.add(star);}
 const stalls=[];const locations=[[-9,-5,'FISH & WISHES',0x558e92],[9,-4,'MILK, PLEASE',0xbc7972],[9,8,'CRUMB & CO.',0xc59a60]];
 locations.forEach(([x,z,name,c],kind)=>{const root=new T.Group();root.position.set(x,0,z);staticRoot.add(root);box(root,0x765c4d,0,.5,0,3.8,1,1.55);box(root,0xc9a67c,0,1.03,0,4.2,.18,1.85);solid(x,z,3.8,1.55,1.12);for(let k=-1;k<=1;k++){box(root,c,k*1.22,.52,.8,1.12,.78,.04);box(root,0xe6c49b,k*1.22,.52,.835,.035,.7,.025);}for(const side of [-1,1]){cyl(root,0x7e6552,side*1.85,1.85,0,.065,3.7);solid(x+side*1.85,z,.15,.15,3.7);}for(let i=0;i<8;i++){const awning=box(root,i%2?0xe9d5af:c,-1.84+i*.525,3.05,-.12,.52,.12,2.7);awning.rotation.x=.12;box(root,i%2?0xe9d5af:c,-1.84+i*.525,2.78,1.22,.52,.38,.08);}sign(root,name,0,2.21,.27,3.3,.62,'#2d5156');
 for(let i=0;i<5;i++){const f=foodModel(kind);f.position.set((i-2)*.62,1.3,0);f.rotation.y=(rand()-.5)*.3;root.add(f);}const marker=new T.Group();marker.position.set(x,3.9,z);scene.add(marker);const diamond=new T.Mesh(new T.OctahedronGeometry(.24),new T.MeshBasicMaterial({color:0xffd58c}));marker.add(diamond);stalls.push({x,z,kind,marker,cooldown:0});});
 // The supper table: gingham, mismatched stools, small ceramic bowls.
 const table={x:-2,z:3};const rug=cyl(staticRoot,0x617e77,table.x,.025,table.z,3.35,.035);cyl(staticRoot,0xc18372,table.x,.05,table.z,2.95,.04);cyl(staticRoot,0xd7b294,table.x,.08,table.z,2.78,.03);
 cyl(staticRoot,0x79624f,table.x,.32,table.z,1.48,.58);cyl(staticRoot,0xe8ceaa,table.x,.65,table.z,1.85,.13);solid(table.x,table.z,3,3,.72);
 for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++){if(i*i+j*j>38)continue;if((i+j)%2===0)box(staticRoot,0xb97362,table.x+i*.255,.725,table.z+j*.255,.255,.018,.255);}
 for(let i=0;i<4;i++){const a=i*Math.PI/2+.3,x=table.x+Math.sin(a)*1.25,z=table.z+Math.cos(a)*1.25;cyl(staticRoot,0xf3e3bc,x,.77,z,.28,.08);cyl(staticRoot,0x537c7a,x,.82,z,.21,.06);}
 cyl(staticRoot,0x967451,table.x,.86,table.z,.2,.25);const flame=new T.Mesh(new T.SphereGeometry(.09,8,6),new T.MeshBasicMaterial({color:0xffd78d}));flame.position.set(table.x,1.07,table.z);scene.add(flame);lanterns.push(flame);
 sign(staticRoot,'THE SUPPER CLUB',-2,1.05,5.7,2.7,.55,'#5d7770');box(staticRoot,0x826c52,-2,.5,5.65,.1,1,.1);
 const lamp=(x,z,h=4)=>{cyl(staticRoot,0x365058,x,h/2,z,.065,h);box(staticRoot,0x365058,x+.25,h,z,.6,.06,.08);box(staticRoot,0xe7b976,x+.5,h-.25,z,.32,.46,.32);box(staticRoot,0x365058,x+.5,h,z,.43,.08,.43);box(staticRoot,0x365058,x+.5,h-.52,z,.39,.08,.39);const glow=new T.Mesh(new T.SphereGeometry(.13,8,6),new T.MeshBasicMaterial({color:0xffd894}));glow.position.set(x+.5,h-.23,z+.2);scene.add(glow);lanterns.push(glow);};lamp(-13,7);lamp(13,1);lamp(-4,-9);lamp(3,12);
 // Overhead festoon lights, slung between buildings.
 for(const z of [-8,10]){const pts=[];for(let i=0;i<=24;i++){const x=-14+i*28/24,y=5.4-Math.sin(i/24*Math.PI)*1.2;pts.push([x,y,z]);if(i%2===0){ball(staticRoot,0xf5d191,x,y-.12,z,.095,.14,.095);}}line(scene,pts,0x455e5d);}
 // Planters, a small tree and climbable crates: all reachable bonus bells.
 const planter=(x,z)=>{cyl(staticRoot,0xa5715b,x,.3,z,.46,.6,.34);for(let i=0;i<7;i++)ball(staticRoot,i%2?0x6c8b69:0x456d60,x+(rand()-.5)*.7,.7+rand()*.4,z+(rand()-.5)*.7,.2,.4,.2);solid(x,z,.7,.7,.6);};[[-13,-8],[-12,9],[13,12],[5,-10],[-6,10],[12,-9]].forEach(p=>planter(...p));
 const crates=[];function crate(x,z,y=0,size=1.3){box(staticRoot,0x9e7b57,x,y+size/2,z,size,size,size);for(let i=0;i<4;i++)box(staticRoot,0xb8996b,x,y+.12+i*(size-.2)/3,z+size/2+.01,size,.055,.035);for(const side of [-1,1]){box(staticRoot,0xceb17e,x+side*(size/2-.1),y+size/2,z+size/2+.035,.12,size,.06);box(staticRoot,0xc4a479,x,y+size+.015,z+side*(size/2-.08),size,.04,.13);}solid(x,z,size,size,size,y);crates.push({x,z,y:y+size});}
 crate(-11,2);crate(-12.4,2);crate(-12.4,2,1.3);crate(5,-8);crate(6.4,-8);crate(6.4,-8,1.3);crate(12,5);crate(-7,10);crate(-7,11.4);crate(-7,11.4,1.3);
 const treeX=-12,treeZ=-2;cyl(staticRoot,0x785e4d,treeX,1.7,treeZ,.19,3.4);for(let i=0;i<8;i++)ball(staticRoot,i%2?0x6e8d75:0x527768,treeX+(rand()-.5)*2,3.1+rand()*1.5,treeZ+(rand()-.5)*1.8,1.1,.9,1);solid(treeX,treeZ,.5,.5,3.4);
 // Scattered fallen leaves and quiet market details.
 for(let i=0;i<40;i++){const leaf=ball(staticRoot,0xbca46f,rand()*28-14,.045,rand()*27-13,.1,.018,.2);leaf.rotation.y=rand()*6.28;}
 for(const [x,z] of [[-8,7],[3,-7],[12,-1]]){cyl(staticRoot,0x87684e,x,.48,z,.47,.94);cyl(staticRoot,0x435e5d,x,.15,z,.49,.08);cyl(staticRoot,0x435e5d,x,.75,z,.49,.08);solid(x,z,.9,.9,.94);}
 // Merge static meshes by material to keep draw calls modest, preserving authored geometry.
 staticRoot.updateMatrixWorld(true);const buckets=new Map(),remove=[];staticRoot.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);remove.push(o);});
 for(const [material,geos] of buckets){const merged=mergeGeometries(geos,false);const m=new T.Mesh(merged,material);m.receiveShadow=true;m.castShadow=true;scene.add(m);geos.forEach(g=>g.dispose());}scene.remove(staticRoot);
 return {colliders,stalls,table,lanterns,crates};
}
