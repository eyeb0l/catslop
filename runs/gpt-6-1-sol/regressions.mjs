import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Uses the existing shot runner, pinned Chromium, and deterministic simulation.
export default async function(page, shot) {
 const artifacts=process.env.CATSLOP_ARTIFACT_DIR||fileURLToPath(new URL('./shots/',import.meta.url));mkdirSync(artifacts,{recursive:true});
 const failures=[], browserErrors=[];
 const watch=p=>{
  p.on('pageerror',e=>browserErrors.push(e.message));
  p.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text());});
  p.on('requestfailed',r=>browserErrors.push(`${r.url()}: ${r.failure()?.errorText}`));
  p.on('response',r=>{if(r.status()>=400)browserErrors.push(`${r.status()} ${r.url()}`);});
 };
 watch(page);
 async function test(name,fn){try{await fn();console.log(`PASS: ${name}`);}catch(e){failures.push(`${name}: ${e.message}`);console.log(`FAIL: ${name}: ${e.message}`);}}
 const step=(t,render=false)=>page.evaluate(([t,render])=>window.__game.step(t,render),[t,render]);
 const state=()=>page.evaluate(()=>window.__game.state());
 const place=(x,z,y)=>page.evaluate(([x,z,y])=>window.__game.place(x,z,y),[x,z,y]);
 const record=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('midnight-purrade-best')));
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>window.__game);
 await page.keyboard.press('Enter');

 // Record the real map's world transform, rather than duplicating its rotation formula.
 await page.evaluate(()=>{
  const ctx=document.querySelector('#map').getContext('2d'),fillRect=ctx.fillRect;
  ctx.fillRect=function(x,y,w,h){if(x===-22&&y===-20&&w===44&&h===40){const m=this.getTransform();window.__mapWorld={a:m.a,b:m.b,c:m.c,d:m.d};}return fillRect.call(this,x,y,w,h);};
 });
 async function mapDirection(){
  await place(0,4);const before=(await state()).position;
  await page.keyboard.down('KeyW');await step(.7);await page.keyboard.up('KeyW');
  const after=(await state()).position,m=await page.evaluate(()=>window.__mapWorld),dx=after[0]-before[0],dz=after[2]-before[2];
  const screenX=m.a*dx+m.c*dz,screenY=m.b*dx+m.d*dz;
  assert.ok(Math.abs(screenX)<.01&&screenY<-1,`W should point up the map; got (${screenX.toFixed(3)}, ${screenY.toFixed(3)})`);
 }
 await test('minimap agrees with W at the initial camera angle',mapDirection);
 await page.mouse.move(600,400);await page.mouse.down();await page.mouse.move(600+(.68-Math.PI/2)/.006,400);await page.mouse.up();
 await test('minimap agrees with W after rotating the camera west',mapDirection);
 await step(0,true);await shot('regression-map-desktop');
 await page.evaluate(()=>window.__game.faceNorth());

 await test('terrace descent remains escapable after stopping on its edge',async()=>{
  await place(13.5,-10,1.8);await page.keyboard.down('KeyD');await step(.18);await page.keyboard.up('KeyD');await step(1);
  const edge=(await state()).position;await page.keyboard.down('KeyD');await step(.6);await page.keyboard.up('KeyD');await step(.6);
  const escaped=(await state()).position;assert.ok(escaped[0]>edge[0]+1&&escaped[1]===0,`edge ${edge}; attempted escape ${escaped}`);
  // The aligned footprints must still block walking into the terrace from below.
  await place(15,-10,0);await page.keyboard.down('KeyA');await step(1);await page.keyboard.up('KeyA');
  assert.ok((await state()).position[0]>=14.37,'terrace wall still blocks entry');
 });

 // Earn only the invitation fees, leaving fish and pots for post-concert play.
 for(const f of (await state()).fish.slice(0,17)){await place(f.x,f.z,f.y);await step(.05);}
 for(const c of (await state()).cats){await place(c.position[0],c.position[2]+1.5,c.position[1]);await page.keyboard.down('KeyE');await step(1.5);await page.keyboard.up('KeyE');}
 assert.equal((await state()).joined.length,5);
 await place(0,1);await page.keyboard.down('KeyE');await step(1.5);await page.keyboard.up('KeyE');await step(19);
 assert.equal((await state()).mode,'ending');const concertRecord=await record();
 await page.locator('#roam').click();assert.equal((await state()).mode,'roam');
 await test('post-concert fish improvements are saved immediately',async()=>{
  const f=(await state()).fish[0];await place(f.x,f.z,f.y);await step(.05);
  assert.ok((await state()).totalFish>concertRecord.fish);assert.equal((await record()).fish,(await state()).totalFish);
 });
 await test('post-concert pot improvements are saved immediately',async()=>{
  const p=(await state()).pots[0];await place(p.x,p.z,p.y);await page.keyboard.press('Space');await step(.2);
  assert.equal((await state()).potsBroken,1);assert.equal((await record()).pots,1);
 });
 await test('roaming improvements survive reload and preserve higher previous bests',async()=>{
  const totals=await state();await page.reload();await page.waitForFunction(()=>window.__game);
  assert.equal((await record()).fish,totals.totalFish);assert.equal((await record()).pots,totals.potsBroken);
  assert.match(await page.locator('#best').textContent(),new RegExp(`${totals.totalFish} fish found`));
  // Completing a poorer night must never replace higher fish or pot records.
  await page.evaluate(()=>localStorage.setItem('midnight-purrade-best',JSON.stringify({fish:46,pots:8,won:true})));
  await page.reload();await page.waitForFunction(()=>window.__game);await page.keyboard.press('Enter');
  for(const f of (await state()).fish.slice(0,17)){await place(f.x,f.z,f.y);await step(.05);}
  for(const c of (await state()).cats){await place(c.position[0],c.position[2]+1.5,c.position[1]);await page.keyboard.down('KeyE');await step(1.5);await page.keyboard.up('KeyE');}
  await place(0,1);await page.keyboard.down('KeyE');await step(1.5);await page.keyboard.up('KeyE');await step(19);await page.locator('#roam').click();
  const f=(await state()).fish[0];await place(f.x,f.z,f.y);await step(.05);assert.deepEqual(await record(),{fish:46,pots:8,won:true});
 });

 const phoneContext=await page.context().browser().newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 try{
  const phone=await phoneContext.newPage();watch(phone);await phone.goto(page.url());await phone.waitForFunction(()=>window.__game);
  await phone.locator('#start').tap();
  const sim=t=>phone.evaluate(t=>window.__game.step(t),t),phoneState=()=>phone.evaluate(()=>window.__game.state());
  await sim(.2);await phone.screenshot({path:shotPath('regression-phone-portrait')});
  await phone.setViewportSize({width:844,height:390});await sim(.2);
  await test('landscape phone touch controls are visible and receive input',async()=>{
   for(const selector of ['#stick','#touch-sing','#touch-jump']){
    assert.ok(await phone.locator(selector).isVisible(),`${selector} is visible at 844x390`);
    assert.ok(await phone.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),`${selector} receives input`);
   }
   const cdp=await phoneContext.newCDPSession(phone);
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   const b=await phone.locator('#stick').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   const before=(await phoneState()).position;
   await touch('touchStart',[{x,y,id:1}]);await touch('touchMove',[{x:x+32,y:y-20,id:1}]);await sim(.6);await touch('touchEnd',[]);
   const moved=(await phoneState()).position;assert.ok(Math.hypot(moved[0]-before[0],moved[2]-before[2])>1,'real touch drag moves cat');
   await phone.locator('#touch-jump').tap();await sim(.2);assert.ok((await phoneState()).position[1]>.3,'touch pounce leaves ground');await sim(1);
   for(const f of (await phoneState()).fish.slice(0,3)){await phone.evaluate(f=>window.__game.place(f.x,f.z,f.y),f);await sim(.05);}
   const cat=(await phoneState()).cats[0];await phone.evaluate(c=>window.__game.place(c.position[0],c.position[2]+1.5,c.position[1]),cat);
   const sing=await phone.locator('#touch-sing').boundingBox();await touch('touchStart',[{x:sing.x+sing.width/2,y:sing.y+sing.height/2,id:2}]);await sim(1.5);await touch('touchEnd',[]);
   assert.ok((await phoneState()).joined.includes(cat.name),'holding touch Sing recruits a cat');
   await cdp.detach();
  });
  await sim(.2);await phone.screenshot({path:shotPath('regression-phone-landscape')});
 }finally{await phoneContext.close();}
 await test('browser console and network stay clean',async()=>assert.deepEqual(browserErrors,[]));
 assert.deepEqual(failures,[],'review regressions');

 function shotPath(name){return join(artifacts,`${name}.png`);}
}
