import assert from 'node:assert/strict';
export default async function touchAndSound(page, shot) {
  const opts = {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    },
    context = await page.context().browser().newContext(opts);
  try {
    // Observe the signal reaching the output without altering the game's gain graph.
    await context.addInitScript(() => {
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (target, ...rest) {
        if (target instanceof AudioDestinationNode && !window.outputMeter) {
          const meter = this.context.createAnalyser();
          meter.fftSize = 1024;
          connect.call(this, meter);
          window.outputMeter = meter;
        }
        return connect.call(this, target, ...rest);
      };
    });
    const phone = await context.newPage(),
      errors = [];
    phone.on('pageerror', (e) => errors.push(e.message));
    phone.on('requestfailed', (r) => errors.push(r.url()));
    await phone.goto(page.url());
    await phone.waitForFunction(() => !!window.postTest);
    await phone.getByRole('button', { name: 'Start my round' }).tap();
    assert.equal(await phone.locator('#touch').isVisible(), true);
    const client = await context.newCDPSession(phone);
    const stick = await phone.locator('#stick').boundingBox(),
      x = stick.x + stick.width * 0.85,
      y = stick.y + stick.height * 0.5;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    const moved = await phone.evaluate(() => postTest.step(0.18));
    assert.ok(moved.x > 1);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await phone.locator('#leap').tap();
    assert.ok((await phone.evaluate(() => postTest.step(0.24))).y > 1.7);
    await phone.locator('#call').tap();
    await phone.evaluate(() => postTest.step(0.03));
    assert.equal(await phone.locator('#speech').isVisible(), true);
    await phone.waitForFunction(() => {
      const a = new Float32Array(outputMeter.fftSize);
      outputMeter.getFloatTimeDomainData(a);
      return a.some((v) => Math.abs(v) > 0.001);
    });
    await phone.screenshot({ path: new URL('./shots/touch-pounce.png', import.meta.url).pathname });
    await phone.locator('#pause').tap();
    assert.equal((await phone.evaluate(() => postTest.read())).state, 'pause');
    await phone.getByRole('button', { name: 'Back to work' }).tap();
    assert.deepEqual(errors, []);
    console.log(
      'Portrait Chromium touch movement, pounce, meow, pause and a non-silent Web Audio output passed.',
    );
  } finally {
    await context.close();
  }
}
