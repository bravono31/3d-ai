import * as THREE from 'three';

const FONT_STACK = `"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",system-ui,sans-serif`;
const texCache = new Map();

/** テキストをCanvasTextureに焼く。テクスチャだけキャッシュし、マテリアルは都度作る（個別に不透明度を変えるため）。 */
function textTexture(text, o) {
  const key = `${text}|${o.fontSize}|${o.color}|${o.weight}|${o.bg}|${o.border}|${o.lineGap}`;
  const hit = texCache.get(key);
  if (hit) return hit;

  const lines = String(text).split('\n');
  const fs = o.fontSize;
  const pad = Math.round(fs * 0.42);
  const lineH = Math.round(fs * o.lineGap);

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${o.weight} ${fs}px ${FONT_STACK}`;
  const textW = Math.max(...lines.map((l) => measure.measureText(l).width));

  const cw = Math.ceil(textW + pad * 2);
  const ch = Math.ceil(lineH * lines.length + pad * 1.5);

  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const g = cv.getContext('2d');

  if (o.bg) {
    const r = Math.min(ch * 0.32, 22);
    g.beginPath();
    g.roundRect(1, 1, cw - 2, ch - 2, r);
    g.fillStyle = o.bg;
    g.fill();
    if (o.border) {
      g.lineWidth = 2.5;
      g.strokeStyle = o.border;
      g.stroke();
    }
  }

  g.font = `${o.weight} ${fs}px ${FONT_STACK}`;
  g.fillStyle = o.color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    g.fillText(l, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * lineH);
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 4;
  tex.userData.aspect = cw / ch;
  texCache.set(key, tex);
  return tex;
}

/**
 * ワールド空間で常にカメラを向くテキストスプライトを作る。
 * height はワールド単位での高さ。
 */
export function makeLabel(text, opts = {}) {
  const o = {
    fontSize: 44,
    color: '#e8eefc',
    weight: 600,
    height: 0.3,
    bg: null,
    border: null,
    lineGap: 1.25,
    opacity: 1,
    depthTest: false,
    ...opts,
  };
  const tex = textTexture(text, o);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: o.opacity,
    depthTest: o.depthTest,
    depthWrite: false,
    toneMapped: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(o.height * tex.userData.aspect, o.height, 1);
  sp.renderOrder = o.renderOrder ?? 10;
  sp.userData.baseHeight = o.height;
  return sp;
}

/** ラベルの不透明度をまとめて設定するヘルパ */
export function setOpacity(obj, v) {
  obj.traverse((c) => {
    if (c.material) {
      const ms = Array.isArray(c.material) ? c.material : [c.material];
      ms.forEach((m) => {
        m.transparent = true;
        m.opacity = v;
      });
    }
  });
}
