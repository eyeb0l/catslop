import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const root=new URL('.',import.meta.url);
export default async function(page,shot){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
 await page.waitForFunction(()=>window.__game);
 const state=()=>page.evaluate(()=>__game.state());
 const step=seconds=>page.evaluate(s=>__game.step(s),seconds);
 const press=async key=>{await page.keyboard.press(key);await step(.2);};
 await shot('01-title');await press('Enter');assert.equal((await state()).mode,'play');
 const initial=(await state()).player;await page.keyboard.down('w');await step(.5);await page.keyboard.up('w');assert.ok(Math.hypot((await state()).player.x-initial.x,(await state()).player.z-initial.z)>1,'W moves the cat');
 await press('Space');assert.ok((await state()).player.y>.3,'Space jumps');await step(1);
 await shot('02-first-steps');
 // The route planner supplies only movement keys. Collision, acceleration,
 // pickups, swats, progression and jumping remain the actual game simulation.
 async function go(x,z){return page.evaluate(({x,z})=>{
  const snap=__game.state(), cs=snap.colliders, spacing=.5;
  const key=(a,b)=>a+','+b;
  const blocked=(x,z)=>Math.abs(x)>14.7||Math.abs(z)>14.7||cs.some(c=>Math.abs(x-c.x)<c.w/2+.5&&Math.abs(z-c.z)<c.d/2+.5);
  const start=[Math.max(-29,Math.min(29,Math.round(snap.player.x/spacing))),Math.max(-29,Math.min(29,Math.round(snap.player.z/spacing)))],goal=[Math.round(x/spacing),Math.round(z/spacing)];
  const queue=[start], seen=new Set([key(...start)]),prev=new Map();let found=null;
  for(let q=0;q<queue.length;q++){const p=queue[q];if(Math.hypot(p[0]-goal[0],p[1]-goal[1])<1.1){found=p;break;}for(const d of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const n=[p[0]+d[0],p[1]+d[1]],k=key(...n);if(seen.has(k)||blocked(n[0]*spacing,n[1]*spacing)||blocked((p[0]+d[0])*spacing,p[1]*spacing)||blocked(p[0]*spacing,(p[1]+d[1])*spacing))continue;seen.add(k);prev.set(k,p);queue.push(n);}}
  if(!found)throw Error('No walking route to '+x+','+z);
  const path=[];for(let p=found;key(...p)!==key(...start);p=prev.get(key(...p)))path.push([p[0]*spacing,p[1]*spacing]);path.reverse();path.push([x,z]);
  let ticks=0;for(const [tx,tz]of path){for(let i=0;i<100;i++){const p=__game.position(),dx=tx-p.x,dz=tz-p.z;if(Math.hypot(dx,dz)<.25)break;const rx=(22*dx-16*dz)/Math.hypot(22,16),forward=(-16*dx-22*dz)/Math.hypot(16,22),angle=Math.atan2(-forward,rx),ix=Math.round(Math.cos(angle)),iz=Math.round(Math.sin(angle));const keys=[];if(ix>0)keys.push('KeyD');if(ix<0)keys.push('KeyA');if(iz>0)keys.push('KeyS');if(iz<0)keys.push('KeyW');__game.keys(keys);__game.step(1/60);ticks++;if(i===99)throw Error('Stuck at '+JSON.stringify(p)+' aiming '+tx+','+tz);}}
  __game.keys([]);__game.step(.18);return {position:__game.position(),ticks};
 },{x,z});}
 const results=[];
 for(let course=0;course<3;course++){
  for(let trip=0;trip<5;trip++){
   let s=await state();if(s.stage!==course)break;
   const stall=s.stalls[course];await go(stall.x,stall.z+1.9);
   for(let attempt=0;attempt<4;attempt++){
    await press('f');await step(1.4);
    s=await state();
    for(const f of s.foods){if(f.kind!==course)continue;const current=await state();if(current.carried>=current.capacity||current.carried+current.served>=[4,5,6][course])break;await go(f.x,f.z);await step(.2);}
    s=await state();if(s.carried>=s.capacity||s.carried+s.served>=[4,5,6][course])break;
    await go(stall.x,stall.z+1.9);await step(1.3);
   }
   s=await state();assert.ok(s.carried>0,'Swat and collect food');if(trip===0)await shot(`03-course-${course+1}-haul`);
   await go(-2,6.1);await press('e');s=await state();
   results.push({course,trip,stage:s.stage,served:s.served,carried:s.carried,mode:s.mode});
   if(s.mode==='perk'){await shot(`04-gift-${course+1}`);if(course===0){await page.reload();await page.waitForFunction(()=>window.__game);await press('Enter');assert.equal((await state()).mode,'perk','Unchosen reward survives reload');}await press(course===0?'1':'3');assert.equal((await state()).mode,'play');}
  }
  assert.equal((await state()).stage,course+1,`Course ${course+1} completed`);
 }
 await shot('05-table-ready');await page.keyboard.down('e');await step(2.6);await page.keyboard.up('e');assert.equal((await state()).mode,'ending');assert.equal((await state()).won,true);await shot('06-supper-ending');
 await page.getByRole('button',{name:'Stay a little longer'}).click();await step(.1);assert.equal((await state()).mode,'play');
 await press('Escape');assert.equal((await state()).mode,'pause');await shot('07-pause');await press('Escape');assert.equal((await state()).mode,'play');
 await press('m');assert.equal(await page.locator('#sound').textContent(),'♫ OFF');await press('m');

 // Collect the ground bell, then jump onto both levels of the stacked crates.
 await go(-3,-8);await step(.3);assert.ok((await state()).bells.includes(4));
 async function hop(x,z,seconds=1.25){await press('Space');await page.evaluate(({x,z,seconds})=>{for(let i=0;i<seconds*60;i++){const p=__game.position(),dx=x-p.x,dz=z-p.z;const rx=(22*dx-16*dz)/Math.hypot(22,16),f=(-16*dx-22*dz)/Math.hypot(16,22),angle=Math.atan2(-f,rx),ix=Math.round(Math.cos(angle)),iz=Math.round(Math.sin(angle));const codes=[];if(Math.hypot(dx,dz)>.15){if(ix>0)codes.push('KeyD');if(ix<0)codes.push('KeyA');if(iz>0)codes.push('KeyS');if(iz<0)codes.push('KeyW');}__game.keys(codes);__game.step(1/60);}__game.keys([]);__game.step(.15);},{x,z,seconds});}
 await go(-11,3.8);await hop(-11,2);assert.ok((await state()).player.y>1.2,'Land on the lower crate');
 await hop(-12.4,2);assert.ok((await state()).bells.includes(0),'Jump to the high bell');await shot('10-high-bell');
 await hop(-10,4);await go(12,6.8);await hop(12,5);assert.ok((await state()).bells.includes(3));await hop(10.5,6.5);
 await go(5,-6.2);await hop(5,-8);await hop(6.4,-8);assert.ok((await state()).bells.includes(1));await hop(4,-6);
 await go(-7,8.2);await hop(-7,10);await hop(-7,11.4);assert.ok((await state()).bells.includes(2));assert.equal((await state()).bells.length,5);await shot('11-all-bells');await hop(-5,10);
 // A sustained push against the wall must not escape the playable island.
 await go(13.7,13.7);await page.evaluate(()=>{__game.keys(['KeyD']);__game.step(4);__game.keys([]);});const boundary=(await state()).player;assert.ok(Math.abs(boundary.x)<=14.8&&Math.abs(boundary.z)<=14.8);
 await go(-2,6.1);
 await page.setViewportSize({width:390,height:844});await step(.5);await shot('08-mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await page.setViewportSize({width:1280,height:720});await step(.5);await shot('09-feast');await page.screenshot({path:new URL('cover.jpg',root).pathname,type:'jpeg',quality:90});
 await page.reload();await page.waitForFunction(()=>window.__game);assert.match(await page.locator('#start').textContent(),/Continue/);await press('Enter');assert.equal((await state()).stage,3);assert.equal((await state()).won,true);
 const final=await state();assert.equal(final.audio,'running');assert.deepEqual(errors,[]);
 const report={pass:true,tests:['Title Enter start','W movement','Space jump','All three stalls via collision-aware walking','Swat, falling food, automatic pickup','Capacity limit','All 15 servings','Capacity and jump rewards by keyboard','Unchosen reward survives reload','All five bells through movement and jumps','Landing on both crate heights','Boundary collision','Purr finale','Ending continue','Pause and resume with Escape','Mute and unmute','390x844 resize','Save and reload','AudioContext running','No console or request failures'],trips:results,final};
 writeFileSync(new URL('playtest-report.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,stage:final.stage,time:final.time,drawCalls:final.drawCalls,errors}));
}
