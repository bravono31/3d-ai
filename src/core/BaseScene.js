import * as THREE from 'three';

/** 便利関数：全シーンで共有 */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** [a,b] の区間で 0→1 になる。scene の演出をビートに割り当てるのに使う。 */
export const seg = (p, a, b) => clamp((p - a) / (b - a));
/** なめらかな 0→1 */
export const ease = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** 決定論的な擬似乱数（スクロールを戻しても同じ絵になるように） */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 各章の3Dシーンの基底クラス。
 * update(p, beatFloat, dt, time) だけで見た目が決まる純関数的な作りを守る。
 */
export class BaseScene {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.camera.position.set(0, 0, 12);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.built = false;
  }

  /**
   * 章に入ってからの立ち上がり 0→1。
   * ビート0の内容は beatFloat が 0 で止まるため、スクロールでは登場演出を作れない。
   * そこで時間で立ち上げる（一度 1 になったら戻らないので、スクロールを往復しても同じ絵になる）。
   */
  enter(dt) {
    this._enter = Math.min(1, (this._enter ?? 0) + dt * 1.9);
    return this._enter;
  }

  /** 初回表示時に一度だけ呼ばれる */
  build() {}

  ensureBuilt() {
    if (!this.built) {
      this.build();
      this.built = true;
    }
  }

  /**
   * @param {number} p         章内の進捗 0→1
   * @param {number} beatFloat ビート位置（0, 1, 2… の連続値）
   * @param {number} dt        前フレームからの秒数
   * @param {number} time      起動からの秒数
   */
  update(p, beatFloat, dt, time) {}

  resize(w, h, shift = { x: 0, y: 0 }) {
    this.camera.aspect = w / h;
    if (shift.x || shift.y) {
      // 解説カードが載る分（PCは左、モバイルは下）、3D側の見え方をずらす
      this.camera.setViewOffset(w, h, -w * shift.x, h * shift.y, w, h);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    this.built = false;
  }
}
