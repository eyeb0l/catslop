import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
export default async function(desktop){
 const context=await desktop.context().browser().newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()));
 try{
 await page.goto(desktop.url());await page.waitForFunction(()=>window.__game);
 await page.screenshot({path:new URL('shots/mobile-title.png',import.meta.url).pathname});
 await page.getByRole('button',{name:'Make a little mischief'}).tap();await page.evaluate(()=>__game.step(.2));
 assert.equal(await page.locator('#touch').isVisible(),true,'Touch UI shown on a touch device');
 const before=await page.evaluate(()=>__game.position());
 // Real touch events, including held joystick movement and release.
 const client=await context.newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:115,y:754}]});await page.evaluate(()=>__game.step(.7));await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const after=await page.evaluate(()=>__game.position());assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>1,'Joystick moves the cat');
 await page.getByRole('button',{name:'JUMP',exact:true}).tap();await page.evaluate(()=>__game.step(.2));assert.ok((await page.evaluate(()=>__game.position())).y>.4,'Touch jump works');await page.evaluate(()=>__game.step(1));
 await page.getByRole('button',{name:'SWAT',exact:true}).tap();await page.getByRole('button',{name:'PURR',exact:true}).tap();
 await page.screenshot({path:new URL('shots/mobile-touch-play.png',import.meta.url).pathname});
 await page.locator('#pause').tap();assert.equal(await page.evaluate(()=>__game.state().mode),'pause');await page.getByRole('button',{name:'Resume supper'}).tap();assert.equal(await page.evaluate(()=>__game.state().mode),'play');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);assert.deepEqual(errors,[]);
 writeFileSync(new URL('touch-report.json',import.meta.url),JSON.stringify({pass:true,viewport:'390x844',tests:['Tap to start','Touch controls visible','Joystick move and release','Touch jump','Swat and purr buttons','Pause and resume','No horizontal overflow','No console or request failures'],errors},null,2)+'\n');
 console.log('PASS touch controls at 390x844');
 }finally{await context.close();}
}
