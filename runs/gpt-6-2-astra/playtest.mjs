// Use scripts/shot.mjs with --query manual --script runs/gpt-6-2-astra/playtest.mjs.
// Only the simulation clock is controlled. Every action goes through keyboard or pointer input.
import assert from 'node:assert/strict';
export default async function play(page, shot) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  const read = () => page.evaluate(() => postTest.read());
  const step = (seconds, draw = false) => page.evaluate(([s, d]) => postTest.step(s, d), [seconds, draw]);
  const key = page.keyboard;
  async function capture(name) {
    await step(0.016, true);
    await shot(name);
  }
  async function moveAxis(axis, destination) {
    let s = await read(),
      dist = destination - s[axis];
    if (Math.abs(dist) < 0.04) return;
    const k = axis === 'x' ? (dist > 0 ? 'd' : 'a') : dist > 0 ? 's' : 'w';
    await key.down(k);
    await step(Math.abs(dist) < 0.83 ? Math.sqrt(Math.abs(dist) / 36) : Math.abs(dist) / 5.45);
    await key.up(k);
    await step(0.21);
  }
  await page.locator('#world').click({ position: { x: 25, y: 20 } });
  assert.equal((await read()).state, 'play');
  await key.press('Escape');
  assert.equal((await read()).state, 'pause');
  await page.getByRole('button', { name: 'Back to work' }).click();
  assert.equal((await read()).state, 'play');
  await key.press('m');
  assert.equal((await read()).save.muted, true);
  await key.press('m');
  await key.down('s');
  await step(0.84);
  await key.up('s');
  await step(1.2);
  assert.equal((await read()).falls, 1);
  assert.equal((await read()).home, 0);
  for (let stage = 0; stage < 3; stage++) {
    let s = await read();
    assert.equal(s.stage, stage);
    for (let i = 1; i < s.platforms.length; i++) {
      s = await read();
      let p = s.platforms[i - 1],
        n = s.platforms[i];
      // Leave near the forward gunwale and steer across the channel.
      await moveAxis('z', p.z + Math.max(-0.25, Math.min(0.25, n.z - p.z)));
      await moveAxis('x', p.x + p.w * 0.5 - 0.49);
      s = await read();
      let drift = n.z - s.z,
        steer = drift > 0.12 ? 's' : drift < -0.12 ? 'w' : null;
      await key.down('d');
      await key.press('Space');
      if (steer) {
        await key.down(steer);
        await step(Math.min(0.48, Math.abs(drift) / 3.84));
        await key.up(steer);
      }
      await step(0.84 - (steer ? Math.min(0.48, Math.abs(drift) / 3.84) : 0));
      await key.up('d');
      await step(0.2);
      s = await read();
      assert.equal(
        s.pl,
        i,
        JSON.stringify({ stage, i, x: s.x, z: s.z, pl: s.pl, home: s.home, falls: s.falls }),
      );
      await moveAxis('x', n.x);
      await moveAxis('z', n.z + (stage === 0 && i === 1 ? 0.52 : 0));
      await step(0.18);
      if (s.spur?.from === i) {
        const side = s.spur.z > n.z ? 's' : 'w',
          back = side === 's' ? 'w' : 's';
        await moveAxis('x', s.spur.x);
        await key.down(side);
        await step(0.15);
        await key.press('Space');
        await step(0.63);
        await key.up(side);
        await step(0.33);
        assert.equal((await read()).pl, -1, 'Optional stamp boat');
        await moveAxis('z', s.spur.z);
        await key.down(back);
        await step(0.13);
        await key.press('Space');
        await step(0.62);
        await key.up(back);
        await step(0.4);
        assert.equal((await read()).pl, i, 'Return from optional stamp');
      }
      if ((stage === 1 && i === 3) || (stage === 2 && i === 4)) {
        await key.press('e');
        await step(1.3);
        if (stage === 1) await capture('ferry');
        await step(2.5);
        assert.equal((await read()).ferry, 1);
      }
      if (stage === 2 && i === s.platforms.length - 1) await capture('lantern-point');
    }
    await key.press('e');
    assert.equal((await read()).state, 'handoff');
    await step(1);
    assert.equal((await read()).state, 'letter');
    assert.equal((await read()).stamps, 3);
    if (stage === 0) {
      await capture('first-letter');
      await page.reload();
      await page.waitForFunction(() => !!window.postTest);
      assert.match(await page.locator('#start').innerText(), /Continue my round/);
      await key.press('Enter');
    } else await page.locator('#actions button').first().click();
  }
  let s = await read();
  assert.equal(s.state, 'end');
  assert.equal(s.save.stage, 3);
  assert.equal(
    s.save.records.reduce((a, r) => a + r.stamps, 0),
    9,
  );
  await capture('round-complete');
  await page.locator('#actions button').first().click();
  assert.equal((await read()).state, 'title');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => innerWidth === 390);
  await capture('phone-title');
  await key.press('Enter');
  await capture('phone-play');
  assert.equal((await read()).stage, 0);
  assert.deepEqual(errors, []);
  console.log(
    'Three deliveries, nine fish stamps, two ferry crossings, rescue, save/resume, replay and portrait resize passed.',
  );
}
