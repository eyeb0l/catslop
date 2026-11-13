// DOM side of the game: HUD, the Tall One's notes, journal, Cat-alogue, menus.
import { GIFTS, GIFT_ORDER, SHOP, FIRST_TIME_BONUS } from './data.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor() {
    this.icons = {};
    this.on = {}; // callbacks set by the game
    this.panel = null;
    this.noteQueue = []; this.noteBusy = false;
    this.promptText = ''; this.tipText = '';
    this.el = {
      hud: $('hud'), treats: $('treats'), bag: $('bag'), goal: $('goal'), clock: $('clock'), clockIcon: $('clock-icon'),
      stealth: $('stealth'), prompt: $('prompt'), tip: $('tip'), toasts: $('toasts'), note: $('note'), touch: $('touch'),
      title: $('title'), loading: $('loading'), start: $('btn-start'), fresh: $('btn-new'), fade: $('fade'),
    };
    this.el.start.disabled = true;
    const call = (name, ...a) => { if (this.on[name]) this.on[name](...a); };

    this.el.start.addEventListener('click', () => call('start'));
    this.el.fresh.addEventListener('click', () => call('newGame'));
    $('btn-journal').addEventListener('click', () => call('journal'));
    $('btn-pause').addEventListener('click', () => call('pause'));
    $('btn-resume').addEventListener('click', () => call('close'));
    $('btn-end').addEventListener('click', () => call('close'));
    $('btn-reset').addEventListener('click', () => {
      const b = $('btn-reset');
      if (b.dataset.armed) call('reset'); else { b.dataset.armed = '1'; b.textContent = 'Really erase everything? Click again.'; }
    });
    for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => call('close'));
    for (const p of document.querySelectorAll('.panel')) p.addEventListener('mousedown', (e) => { if (e.target === p && p.id !== 'panel-end') call('close'); });
    $('set-volume').addEventListener('input', (e) => call('setting', 'volume', Number(e.target.value)));
    $('set-sens').addEventListener('input', (e) => call('setting', 'sensitivity', Number(e.target.value)));
    $('set-music').addEventListener('change', (e) => call('setting', 'music', e.target.checked));
    $('set-invert').addEventListener('change', (e) => call('setting', 'invertY', e.target.checked));
    $('set-quality').addEventListener('change', (e) => call('setting', 'quality', e.target.value));
    $('shop-list').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (b && !b.disabled) call('shop', b.dataset.id);
    });
    for (const b of this.el.touch.querySelectorAll('button')) {
      const act = b.dataset.act;
      const set = (on) => (e) => { e.preventDefault(); call('touch', act, on); };
      b.addEventListener('touchstart', set(true), { passive: false });
      b.addEventListener('touchend', set(false), { passive: false });
      b.addEventListener('touchcancel', set(false), { passive: false });
    }
  }

  ready(hasSave) {
    this.el.loading.hidden = true;
    this.el.start.disabled = false;
    if (hasSave) { this.el.start.innerHTML = 'Press <kbd>Enter</kbd> to continue'; this.el.fresh.hidden = false; }
    this.el.fade.classList.add('clear');
  }
  hideTitle() { this.el.title.classList.add('out'); this.el.hud.hidden = false; setTimeout(() => { this.el.title.hidden = true; }, 700); }
  showTouch() { this.el.touch.hidden = false; }

  // ---- HUD ------------------------------------------------------------------------------
  setTreats(n, bump) {
    this.el.treats.textContent = n;
    if (bump) {
      const t = this.el.treats.parentElement;
      t.classList.add('bump');
      setTimeout(() => t.classList.remove('bump'), 160);
    }
  }
  setBag(types, capacity) {
    const key = types.join(',') + '|' + capacity;
    if (key === this.bagKey) return;
    this.bagKey = key;
    let html = '';
    for (let i = 0; i < capacity; i++) {
      const t = types[i];
      html += t ? `<div class="slot full"><img src="${this.icons[t] || ''}" alt="${esc(GIFTS[t].name)}"></div>` : '<div class="slot"></div>';
    }
    this.el.bag.innerHTML = html;
  }
  setGoal(html) { if (html !== this.goalHtml) { this.goalHtml = html; this.el.goal.innerHTML = html; } }
  setClock(text, dark) {
    if (text !== this.clockText) { this.clockText = text; this.el.clock.textContent = text; }
    this.el.clockIcon.className = dark ? 'moon' : 'sun';
  }
  setStealth(state) {
    if (state === this.stealthState) return;
    this.stealthState = state;
    const el = this.el.stealth;
    el.className = 'stealth' + (state ? ' on' : '') + (state === 'hidden' ? ' hidden-in-grass' : state === 'loud' ? ' loud' : '');
    if (state) el.textContent = { hidden: 'Hidden in the grass', sneak: 'Sneaking', loud: 'Jingling', full: 'Mouth full' }[state];
  }
  setPrompt(html) {
    if (html === this.promptText) return;
    this.promptText = html;
    if (html) this.el.prompt.innerHTML = html;
    this.el.prompt.classList.toggle('on', !!html);
  }
  setTip(html) {
    if (html === this.tipText) return;
    this.tipText = html;
    if (html) this.el.tip.innerHTML = html;
    this.el.tip.classList.toggle('on', !!html);
  }
  toast(html, kind = '') {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.innerHTML = html;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 2400);
  }
  caught(type, first) {
    const g = GIFTS[type];
    const img = this.icons[type] ? `<img src="${this.icons[type]}" alt="">` : '';
    this.toast(first ? `${img}<span><small>New gift</small>${esc(g.name)}!</span>` : `${img}${esc(g.name)}!`, first ? 'new' : '');
  }
  /** Floating "+N" at a screen position (pixels). */
  float(text, x, y) {
    const d = document.createElement('div');
    d.className = 'float'; d.textContent = text;
    d.style.left = `${x}px`; d.style.top = `${y}px`;
    this.el.hud.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  /** The Tall One has something to say. Notes queue up and show one at a time. */
  note(n) {
    this.noteQueue.push(n);
    if (!this.noteBusy) this.nextNote();
  }
  nextNote() {
    const n = this.noteQueue.shift();
    if (!n) { this.noteBusy = false; return; }
    this.noteBusy = true;
    const el = this.el.note;
    el.innerHTML = `<h3><span>${esc(n.title)}</span><b>${esc(n.reward)}</b></h3><q>${esc(n.quote)}</q><cite>${esc(n.cite || 'the Tall One')}</cite>`;
    el.classList.add('on');
    if (this.on.noteShown) this.on.noteShown();
    const hold = this.noteQueue.length ? 2600 : 5200;
    setTimeout(() => { el.classList.remove('on'); setTimeout(() => this.nextNote(), 420); }, hold);
  }

  // ---- Panels ------------------------------------------------------------------------------
  open(name) {
    this.close();
    this.panel = name;
    $(`panel-${name}`).hidden = false;
  }
  close() {
    if (!this.panel) return;
    $(`panel-${this.panel}`).hidden = true;
    this.panel = null;
    const b = $('btn-reset'); delete b.dataset.armed; b.textContent = 'Erase progress';
  }

  openJournal(state) {
    const found = GIFT_ORDER.filter((t) => state.delivered[t]).length;
    $('journal-count').textContent = `${found} of ${GIFT_ORDER.length} kinds of gift delivered. The first of each kind is worth ${FIRST_TIME_BONUS}×.`;
    $('journal-grid').innerHTML = GIFT_ORDER.map((t) => {
      const g = GIFTS[t], n = state.delivered[t] || 0;
      const pic = this.icons[t] ? `<img src="${this.icons[t]}" alt="">` : (t === 'reddot' ? '<span style="color:#d7263d">●</span>' : '?');
      return n
        ? `<div class="gift"><div class="pic">${pic}</div><h4>${esc(g.name)} <small>×${n} · ${g.value} each</small></h4><p>${esc(g.note)}</p></div>`
        : `<div class="gift unknown"><div class="pic">${pic}</div><h4>???</h4><p>${esc(g.hint)}</p></div>`;
    }).join('');
    this.open('journal');
  }

  openShop(state) {
    $('shop-treats').textContent = state.treats;
    const order = [...SHOP].sort((a, b) => (a.kind === 'goal' ? -1 : b.kind === 'goal' ? 1 : 0));
    $('shop-list').innerHTML = order.map((it) => {
      const owned = !!state.owned[it.id];
      const worn = state.wearing.includes(it.id) || (it.kind === 'coat' && state.coat === it.id.split(':')[1]);
      let label, cls = '', disabled = false;
      if (it.kind === 'goal') {
        if (owned) { label = 'Eaten'; cls = 'owned'; disabled = true; } else { label = `<i class="biscuit"></i>${it.price}`; disabled = state.treats < it.price; }
      } else if (!owned) {
        label = it.price < 0 ? `+${-it.price} treats` : `<i class="biscuit"></i>${it.price}`;
        disabled = it.price > 0 && state.treats < it.price;
      } else if (it.kind === 'coat' || it.kind === 'hat' || it.id === 'bell') {
        label = worn ? 'Take off' : 'Wear'; cls = worn ? 'worn' : 'owned';
      } else { label = 'Owned'; cls = 'owned'; disabled = true; }
      return `<div class="item ${it.kind === 'goal' ? 'goal-item' : ''} ${it.price < 0 && !owned ? 'paid' : ''}"><h4>${esc(it.name)}</h4><p>${esc(it.blurb)}</p><button class="buy ${cls}" type="button" data-id="${it.id}" ${disabled ? 'disabled' : ''}>${label}</button></div>`;
    }).join('');
    if (this.panel !== 'shop') this.open('shop');
  }

  openPause(settings) {
    $('set-volume').value = settings.volume; $('set-sens').value = settings.sensitivity;
    $('set-music').checked = settings.music; $('set-invert').checked = settings.invertY; $('set-quality').value = settings.quality;
    this.open('pause');
  }

  openEnd(stats) {
    $('end-text').textContent = 'The flap opened. A tin slid out. It was everything the label promised: slop, premium, and forty percent more of it. The Tall One is still alive, thanks to you.';
    $('end-stats').innerHTML = stats.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    this.open('end');
  }
}
