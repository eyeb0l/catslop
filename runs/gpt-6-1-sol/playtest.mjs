import assert from 'node:assert/strict';
// Run through scripts/shot.mjs; it supplies the pinned headless browser and isolated server.
export default async function(page,shot){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const step=async t=>page.evaluate(t=>window.__game.step(t),t);
 const state=()=>page.evaluate(()=>window.__game.state());
 const place=async(x,z,y)=>page.evaluate(([x,z,y])=>window.__game.place(x,z,y),[x,z,y]);
 await shot('title-desktop');
 await page.keyboard.press('Enter');await step(.2);assert.equal((await state()).mode,'play');
 assert.ok(await page.evaluate(()=>window.__game.audioLevel())>.0001,'procedural sound produces non-silent PCM samples');
 await page.evaluate(()=>window.__game.faceNorth());
 const origin=(await state()).position;await page.keyboard.down('KeyW');await step(.5);await page.keyboard.up('KeyW');assert.ok((await state()).position[2]<origin[2]-1,'W must move north');
 await step(.5);assert.ok((await state()).totalFish>=1,'collect a sardine through normal movement');
 await page.keyboard.press('Space');await step(.25);assert.ok((await state()).position[1]>.5,'pounce leaves ground');await step(1);assert.equal((await state()).grounded,true);
 await shot('first-steps');
 // Chimneys are landing surfaces too; jumping onto one must never trap the cat.
 await place(-4,8.9);await page.keyboard.press('Space');await page.keyboard.down('KeyW');await step(.43);await page.keyboard.up('KeyW');await step(.6);assert.ok((await state()).position[1]>=1.39,'land on chimney top');
 await page.keyboard.down('KeyD');await step(.65);await page.keyboard.up('KeyD');await step(.6);assert.ok((await state()).position[0]>-2.5,'walk off chimney');assert.equal((await state()).position[1],0);
 // Actual keyboard pounce destroys a nearby pot and its fish can be collected.
 await place(-3,12);await page.keyboard.press('Space');await step(1.1);assert.equal((await state()).potsBroken,1);await step(.2);
 await page.keyboard.press('Escape');assert.equal((await state()).mode,'pause');const before=(await state()).elapsed;await step(3);assert.equal((await state()).elapsed,before);await shot('pause-desktop');
 await page.locator('#mute-menu').focus();await page.keyboard.press('Space');assert.equal((await state()).audio.muted,true);await page.keyboard.press('Enter');assert.equal((await state()).audio.muted,false);
 await page.locator('#quality').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#quality').textContent(),'Picture: light');await page.keyboard.press('Space');assert.equal(await page.locator('#quality').textContent(),'Picture: full');
 await page.locator('#resume').focus();await page.keyboard.press('Enter');assert.equal((await state()).mode,'play');
 // Test collision, diagonal movement, boundary, and the real staircase, without a position bypass.
 await place(0,-4.5,0);await page.keyboard.down('KeyW');await step(1);await page.keyboard.up('KeyW');assert.ok((await state()).position[2]>-6.1,'cannot walk through raised steps');
 for(let i=0;i<5;i++){await page.keyboard.down('KeyW');await page.keyboard.press('Space');await step(.8);await page.keyboard.up('KeyW');await step(.1);}
 assert.ok((await state()).position[1]>=1.7,'jumping ascends north terrace');
 await place(20.7,18.7);await page.keyboard.down('KeyS');await page.keyboard.down('KeyD');await step(2);await page.keyboard.up('KeyS');await page.keyboard.up('KeyD');assert.ok((await state()).position[0]<=21.1&&(await state()).position[2]<=19.1);
 // Exercise each original collectible; only travel is shortened for deterministic software-GL testing.
 for(const f of (await state()).fish){await place(f.x,f.z,f.y);await step(.05);}
 assert.equal((await state()).placedFish,30);
 for(const p of (await state()).pots){await place(p.x,p.z,p.y);await page.keyboard.press('Space');await step(1);await step(.1);}
 assert.equal((await state()).potsBroken,8);
 for(const f of (await state()).fish){await place(f.x,f.z,f.y);await step(.05);}
 assert.equal((await state()).totalFish,46);
 for(const c of (await state()).cats){await place(c.position[0],c.position[2]+1.5,c.position[1]);await page.keyboard.down('KeyE');await step(1.5);await page.keyboard.up('KeyE');await step(.1);assert.ok((await state()).joined.includes(c.name),`${c.name} recruited with real E hold`);await shot(`choir-${c.name.toLowerCase()}`);}
 assert.equal((await state()).wallet,29);assert.equal((await state()).joined.length,5);
 await place(0,1);await step(2);await shot('whole-choir');
 await page.keyboard.down('KeyE');await step(1.5);await page.keyboard.up('KeyE');assert.equal((await state()).mode,'concert');await step(7);await shot('moon-concert');
 await page.keyboard.press('KeyE');await page.keyboard.press('Space');await step(12);assert.equal((await state()).mode,'ending');await shot('ending-desktop');
 assert.equal(await page.locator('.award.won').count(),3);assert.ok((await state()).audio,'audio context created');
 await page.keyboard.press('Enter');assert.equal((await state()).mode,'roam');await step(1);await page.keyboard.press('KeyM');assert.equal((await state()).audio.muted,true);
 // Resize the same running game and exercise touch controls at phone dimensions.
 await page.setViewportSize({width:390,height:844});await step(.4);await shot('play-mobile');
 const p0=(await state()).position;const stick=page.locator('#stick');const b=await stick.boundingBox();await page.mouse.move(b.x+54,b.y+54);await page.mouse.down();await page.mouse.move(b.x+83,b.y+29);await step(.5);await page.mouse.up();assert.ok(Math.hypot((await state()).position[0]-p0[0],(await state()).position[2]-p0[2])>.5,'touch stick moves cat');
 await page.locator('#touch-jump').dispatchEvent('pointerdown',{pointerId:9});await step(.2);assert.ok((await state()).position[1]>.3);
 await page.keyboard.press('Escape');await shot('pause-mobile');await page.keyboard.press('Escape');
 await page.reload();await page.waitForFunction(()=>window.__game);assert.ok(await page.locator('#best').textContent());await step(.2);await shot('title-mobile');
 await page.locator('#start').click();await step(1);assert.equal((await state()).mode,'play');assert.equal((await state()).audio.muted,true,'sound preference persisted');await shot('new-night-mobile');
 assert.deepEqual(errors,[]);console.log('PLAYTEST PASS: movement, pounce, pots, fish, collisions, stairs, all five recruits, concert, medals, pause, touch, resize, persistence.');
 console.log(JSON.stringify(await state()));
}
