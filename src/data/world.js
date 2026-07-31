import { LAND_W, LAND_H, LAND_BITS } from './land-mask.js';

/**
 * 地球儀の陸地。実際の海岸線データ（Natural Earth）から起こしたマスクを引く。
 *
 * 以前は手書きの粗いポリゴンで大陸を近似していたが、形が実物と違いすぎたので
 * 0.5° 格子のビットマスクに置き換えた。判定は表引きだけなので実行時コストは軽い。
 */

let bytes = null;
function mask() {
  if (bytes) return bytes;
  const bin = atob(LAND_BITS);
  bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** その緯度経度が陸地か */
export function isLand(lat, lon) {
  const b = mask();
  let iy = Math.floor(((90 - lat) * LAND_H) / 180);
  let ix = Math.floor(((lon + 180) * LAND_W) / 360);
  if (iy < 0) iy = 0;
  else if (iy >= LAND_H) iy = LAND_H - 1;
  ix = ((ix % LAND_W) + LAND_W) % LAND_W; // 経度は一周する
  const bit = iy * LAND_W + ix;
  return (b[bit >> 3] & (128 >> (bit & 7))) !== 0;
}

/**
 * 陸地上の [lon, lat] を返す。
 * 緯度が高いほど経線が詰まるので、経度方向の間隔を 1/cos(lat) で広げ、
 * 極付近だけ点が密集して白く潰れるのを防ぐ。
 */
export function landPoints(step = 1.0) {
  const pts = [];
  const RAD = Math.PI / 180;
  for (let lat = -89; lat <= 89; lat += step) {
    const lonStep = Math.min(step / Math.max(0.12, Math.cos(lat * RAD)), 12);
    for (let lon = -180; lon < 180; lon += lonStep) {
      if (isLand(lat, lon)) pts.push([lon, lat]);
    }
  }
  return pts;
}
