// Run with the repository's shot command and --query 'debug&manual'.
// Inputs use browser keyboard and mouse events. The debug clock advances the
// same simulation used in ordinary play, without waiting for software rendering.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const dirs = [
  { keys: ['w'], x: -.46, z: -.888 },
  { keys: ['a'], x: -.888, z: .46 },
  { keys: ['s'], x: .46, z: .888 },
  { keys: ['d'], x: .888, z: -.46 },
  { keys: ['w', 'd'], x: .303, z: -.953 },
  { keys: ['w', 'a'], x: -.953, z: -.303 },
  { keys: ['s', 'a'], x: -.303, z: .953 },
  { keys: ['s', 'd'], x: .953, z: .303 },
];

export default async (page, shot) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  const state = () => page.evaluate(() => window.__laundrette.state());
  const step = (t, render = false) => page.evaluate(([s, r]) => {
    window.__laundrette.step(s, r);
    return window.__laundrette.state();
  }, [t, render]);
  const wait = async (t) => { await step(t); };
  const navigate = async (x, z, radius = .29, duration = 120) => {
    let p = (await state()).player;
    for (let i = 0; i < duration; i++) {
      const dx = x - p.x, dz = z - p.z;
      const remaining = Math.hypot(dx, dz);
      if (remaining < radius) return;
      const direction = dirs.reduce((best, dir) => dx * dir.x + dz * dir.z > dx * best.x + dz * best.z ? dir : best);
      for (const key of direction.keys) await page.keyboard.down(key);
      p = (await step(Math.min(.105, .032 + remaining * .090))).player;
      for (const key of direction.keys) await page.keyboard.up(key);
    }
    assert.fail(`Could not reach (${x}, ${z}) from (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
  };
  const a = async (expected, index) => assert.equal((await state()).kittens[index].status, expected);
  const jumpTo = async (x, z, y) => {
    await page.keyboard.press('Space');
    await navigate(x, z, .32);
    await wait(.89);
    const p = (await state()).player;
    assert.equal(p.y, y, `Expected to land at height ${y} near ${x}, ${z}`);
  };
  const collect = async (x, z, i) => {
    await navigate(x, z, .27);
    await wait(.25);
    assert.equal((await state()).socks[i].found, true, `Sock ${i + 1}`);
  };

  assert.equal((await state()).mode, 'title');
  await page.keyboard.press('Enter');
  assert.equal((await state()).mode, 'playing');
  await page.waitForFunction(() => window.__laundrette.state().audio === 'running');
  await step(.15, true);
  await shot('opening');

  await page.keyboard.press('Escape');
  assert.equal((await state()).mode, 'paused');
  const before = (await state()).player;
  await page.keyboard.down('w');
  await wait(.5);
  await page.keyboard.up('w');
  assert.deepEqual((await state()).player, before);
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.keyboard.press('m');
  assert.equal((await state()).muted, true);
  await page.getByRole('button', { name: 'Unmute sound' }).click();
  assert.equal((await state()).muted, false);

  await collect(-6.87, 1.30, 0);
  await navigate(-3.77, .71);
  await page.keyboard.press('f');
  await a('following', 0);
  await navigate(-3.88, 3.80);
  await wait(1.55);
  await a('home', 0);
  console.log('Bobbin home');

  await navigate(-1.42, .76);
  await collect(-.85, -3.70, 1);
  await navigate(1.39, -1.45);
  await jumpTo(2.32, -1.66, .65);
  assert.equal((await state()).socks[2].found, true);
  await jumpTo(3.82, -2.18, 1.25);
  await jumpTo(4.94, -2.08, 1.85);
  await step(0, true);
  await shot('pip-on-the-counter');
  await page.mouse.click(750, 381);
  await a('following', 1);
  await collect(6.57, -1.98, 3);
  await navigate(5.58, -.26);
  await navigate(.90, 1.44);
  await navigate(-3.88, 3.66);
  await wait(1.5);
  await a('home', 1);
  console.log('Pip home');

  await collect(.19, 5.01, 5);
  await navigate(4.42, 4.81);
  await navigate(5.02, 4.76);
  await page.keyboard.press('f');
  await a('lost', 2);
  await wait(.84);
  await page.keyboard.down('Shift');
  await step(.2, true);
  await shot('moth-by-the-vacuum');
  await page.keyboard.press('f');
  await a('following', 2);
  await navigate(5.40, 4.44);
  await navigate(5.30, 1.35);
  await collect(6.53, .59, 4);
  await page.keyboard.up('Shift');
  await navigate(3.02, 1.80);
  await navigate(-3.88, 3.57);
  await step(4, true);
  await a('home', 2);
  assert.equal((await state()).mode, 'ended');
  assert.deepEqual((await state()).socks.map(s => s.found), Array(6).fill(true));
  assert.equal(await page.locator('#end-socks').textContent(), '6 / 6');
  await shot('all-tucked-in');
  await page.getByRole('button', { name: 'Stay and explore' }).click();
  await page.setViewportSize({ width: 910, height: 680 });
  await step(.2, true);
  assert.equal(await page.locator('canvas').evaluate(c => c.clientWidth), 910);
  await page.reload();
  await page.getByRole('button', { name: 'Back to the laundrette' }).click();
  await a('home', 0);
  await a('home', 1);
  await a('home', 2);
  assert.deepEqual((await state()).socks.map(s => s.found), Array(6).fill(true));
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Restart shift' }).click();
  assert.equal((await state()).mode, 'playing');
  assert.deepEqual((await state()).kittens.map(k => k.status), Array(3).fill('lost'));
  await navigate(4.03, 2.24);
  await page.keyboard.press('f');
  assert.ok(['curious', 'chasing'].includes((await state()).vacuum.state));
  await navigate(.10, 4.70);
  await page.keyboard.down('s');
  await wait(2);
  await page.keyboard.up('s');
  assert.equal((await state()).player.z, 5.79);
  assert.deepEqual(errors, []);
  console.log('Moth home, all six socks found, resize, persistence, pause, sound toggle and restart passed');

  const phone = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  try {
    const tab = await phone.newPage();
    tab.on('pageerror', error => errors.push(error.message));
    tab.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    tab.on('requestfailed', request => errors.push(request.url()));
    tab.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
    await tab.goto(page.url(), { waitUntil: 'load' });
    await tab.screenshot({ path: fileURLToPath(new URL('./shots/phone-title.png', import.meta.url)) });
    await tab.getByRole('button', { name: 'Start the rescue' }).tap();
    assert.equal(await tab.evaluate(() => window.__laundrette.state().mode), 'playing');
    const stick = await tab.locator('#stick').boundingBox();
    const session = await phone.newCDPSession(tab);
    const point = { x: stick.x + stick.width / 2, y: stick.y + 10 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await tab.evaluate(() => window.__laundrette.step(.61, false));
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(await tab.evaluate(() => window.__laundrette.state().player.z < 2.1));
    await tab.getByRole('button', { name: 'Prowl' }).tap();
    assert.equal(await tab.getByRole('button', { name: 'Prowl' }).getAttribute('aria-pressed'), 'true');
    await tab.getByRole('button', { name: 'Meow' }).tap();
    assert.ok(await tab.evaluate(() => window.__laundrette.state().player.talk > 0));
    await tab.getByRole('button', { name: 'Jump', exact: true }).tap();
    await tab.evaluate(() => window.__laundrette.step(.21));
    assert.ok(await tab.evaluate(() => window.__laundrette.state().player.y > .55));
    await tab.screenshot({ path: fileURLToPath(new URL('./shots/phone-play.png', import.meta.url)) });
    await tab.getByRole('button', { name: 'Pause' }).tap();
    await tab.getByRole('button', { name: 'Resume' }).tap();
    assert.equal(await tab.evaluate(() => window.__laundrette.state().mode), 'playing');
    assert.deepEqual(errors, []);
    console.log('Touch title, joystick, prowl, meow, jump and pause passed');
  } finally {
    await phone.close();
  }
};
