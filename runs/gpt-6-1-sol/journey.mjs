import assert from 'node:assert/strict';
export default async function(page,shot){
 const capture=shot;shot=async name=>{await page.evaluate(()=>window.__game.step(0));await capture(name);};
 const step=t=>page.evaluate(t=>window.__game.step(t,false),t),state=()=>page.evaluate(()=>window.__game.state());
 await page.keyboard.press('Enter');await page.evaluate(()=>window.__game.faceNorth());
 // Full continuous route: no teleporting, inventory injection or recruitment bypasses.
 async function go(x,z){
  let lastDist=1000,stuck=0;
  for(let i=0;i<180;i++){
   const s=await state(),dx=x-s.position[0],dz=z-s.position[2],d=Math.hypot(dx,dz);if(d<.4){await step(.12);return;}
   if(Math.abs(d-lastDist)<.015)stuck++;else stuck=0;assert.ok(stuck<12,`stuck heading to ${x},${z} at ${s.position}`);lastDist=d;
   const pressed=[];if(dx>.22)pressed.push('KeyD');if(dx<-.22)pressed.push('KeyA');if(dz>.22)pressed.push('KeyS');if(dz<-.22)pressed.push('KeyW');
   for(const k of pressed)await page.keyboard.down(k);await step(.12);for(const k of pressed)await page.keyboard.up(k);
  }
  assert.fail(`Failed navigation to ${x},${z}`);
 }
 async function invite(name){const c=(await state()).cats.find(c=>c.name===name);assert.ok((await state()).wallet>=c.cost,`enough earned fish for ${name}`);await page.keyboard.down('KeyE');await step(1.4);await page.keyboard.up('KeyE');assert.ok((await state()).joined.includes(name));}
 for(const p of [[0,10.5],[1,8.7],[3.4,8.5],[4.8,8.7]])await go(...p);await invite('Pip');
 for(const p of [[-2,9],[-4,9],[-7,9],[-7,7],[-9,5],[-10.8,6.7]])await go(...p);await invite('Nori');await shot('journey-garden');
 for(const p of [[-9,4],[0,4],[7.5,6.5],[9,4.5],[11,2.4],[13,.2],[13,-1.3]])await go(...p);await invite('Fig');
 for(const p of [[11,-4],[5,-4],[0,-4.5]])await go(...p);
 // The stairs are traversed with ordinary jumps and W.
 for(let i=0;i<4;i++){await page.keyboard.down('KeyW');await page.keyboard.press('Space');await step(.8);await page.keyboard.up('KeyW');await step(.1);if((await state()).position[2]<-10)break;}
 assert.ok((await state()).position[1]>=1.7);
 for(const p of [[0,-11],[-4,-11],[-7,-11],[-8,-12]])await go(...p);await invite('Duchess');
 // Explore upper terrace for the final fee.
 for(const p of [[-4,-11],[3,-11],[5,-13],[3,-16],[12,-17],[12,-11],[9,-11.8]])await go(...p);await invite('Miso');
 await shot('journey-complete-choir');
 for(const p of [[3,-11],[0,-10],[0,-5],[0,-2],[0,1]])await go(...p);
 await page.keyboard.down('KeyE');await step(1.4);await page.keyboard.up('KeyE');assert.equal((await state()).mode,'concert');await step(5);await shot('journey-concert');await step(14);assert.equal((await state()).mode,'ending');await shot('journey-ending');
 console.log('CONTINUOUS JOURNEY PASS: keyboard-only traversal and five paid invitations to the ending.');console.log(JSON.stringify(await state()));
}
