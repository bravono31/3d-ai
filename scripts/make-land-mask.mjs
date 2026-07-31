/**
 * Natural Earth 由来の land-110m.json（TopoJSON）を、
 * 経緯度グリッドの陸地マスク（ビット列 → base64）に変換する。
 *
 * 実行時にポリゴンの内外判定を回すと重すぎるので、ここで焼いておく。
 */
import fs from 'node:fs';

const SRC = process.argv[2] ?? './land-110m.json';
const OUT = process.argv[3] ?? './land-mask.js';
const W = 720; // 経度 0.5°
const H = 360; // 緯度 0.5°

const topo = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;

// 量子化＋デルタ符号化された arc を、経緯度の点列に戻す
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * sx + tx, y * sy + ty];
  });
});

/** arc 番号の並び（負なら逆向き）を1つのリングにつなぐ */
function ring(idxs) {
  const pts = [];
  for (const i of idxs) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    // 継ぎ目の点が重複するので、2本目以降は先頭を落とす
    for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]);
  }
  return pts;
}

const geom = topo.objects.land.geometries[0];
// MultiPolygon: [ [ outerRing, hole, ... ], ... ]
const polygons = geom.arcs.map((poly) => poly.map(ring));
console.log(`polygons: ${polygons.length}, rings: ${polygons.reduce((n, p) => n + p.length, 0)}`);

// リングごとの外接矩形を持っておくと判定が桁で速くなる
const prepared = polygons.map((rings) =>
  rings.map((r) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of r) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { pts: r, x0, x1, y0, y1 };
  })
);

/** even-odd。穴も同じ規則で正しく抜ける。 */
function crossings(r, lon, lat) {
  if (lat < r.y0 || lat > r.y1 || lon < r.x0) return 0;
  const p = r.pts;
  let c = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c++;
  }
  return c;
}

const bytes = new Uint8Array((W * H) / 8);
let land = 0;
for (let iy = 0; iy < H; iy++) {
  const lat = 90 - (iy + 0.5) * (180 / H);
  for (let ix = 0; ix < W; ix++) {
    const lon = -180 + (ix + 0.5) * (360 / W);
    let inside = false;
    for (const rings of prepared) {
      let c = 0;
      for (const r of rings) c += crossings(r, lon, lat);
      if (c & 1) { inside = true; break; }
    }
    if (inside) {
      const bit = iy * W + ix;
      bytes[bit >> 3] |= 128 >> (bit & 7);
      land++;
    }
  }
}
console.log(`land cells: ${land} / ${W * H} (${((land / (W * H)) * 100).toFixed(1)}%)`);

const b64 = Buffer.from(bytes).toString('base64');
fs.writeFileSync(
  OUT,
  `/**
 * 陸地マスク。経度 ${360 / W}° × 緯度 ${180 / H}° の格子で、陸なら1。
 *
 * 出典: Natural Earth（パブリックドメイン）を world-atlas の land-110m から変換。
 * https://www.naturalearthdata.com/ / https://github.com/topojson/world-atlas
 *
 * 実行時にポリゴンの内外判定を回すと重いので、あらかじめビット列に焼いてある。
 * 生成: scripts/make-land-mask.mjs
 */
export const LAND_W = ${W};
export const LAND_H = ${H};
export const LAND_BITS =
  '${b64}';
`,
  'utf8'
);
console.log(`wrote ${OUT} (${(b64.length / 1024).toFixed(1)} KB of base64)`);
