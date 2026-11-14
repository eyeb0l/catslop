export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let dx = 0;
  let dy = 0;
  let leftEdge = false;
  let right = false;
  let lockFailed = false;

  const onKeyDown = (e) => {
    if (e.target instanceof HTMLInputElement && e.code !== 'Escape') return;
    if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  };
  const onKeyUp = (e) => down.delete(e.code);
  const onMove = (e) => {
    dx += e.movementX || 0;
    dy += e.movementY || 0;
  };
  const onDown = (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
    if (e.button === 0) leftEdge = true;
    if (e.button === 2) right = true;
  };
  const onUp = (e) => {
    if (e.button === 2) right = false;
  };
  const onLockError = () => {
    lockFailed = true;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('blur', () => {
    down.clear();
    right = false;
  });
  document.addEventListener('pointerlockerror', onLockError);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function tryLock() {
    if (document.pointerLockElement) return;
    try {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          lockFailed = true;
        });
      }
    } catch {
      lockFailed = true;
    }
  }

  function unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function frame() {
    const snapshot = {
      down,
      pressed: new Set(pressed),
      dx,
      dy,
      leftEdge,
      right,
      lockFailed,
      locked: Boolean(document.pointerLockElement),
    };
    dx = 0;
    dy = 0;
    leftEdge = false;
    pressed.clear();
    return snapshot;
  }

  return { frame, tryLock, unlock };
}
