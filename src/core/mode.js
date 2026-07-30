const KEY = '3dai.mode';
const listeners = new Set();

let current = 'simple';
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'simple' || saved === 'deep') current = saved;
} catch {
  /* localStorage が使えない環境ではデフォルトのまま */
}

export function getMode() {
  return current;
}

export function setMode(m) {
  if (m !== 'simple' && m !== 'deep') return;
  if (m === current) return;
  current = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* 保存できなくても動作は続ける */
  }
  document.documentElement.dataset.mode = m;
  listeners.forEach((fn) => fn(m));
}

export function onModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

document.documentElement.dataset.mode = current;
