import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng, inAt, outAt } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const GW = 104; // 画像グリッドの横
const GH = 62; //             縦
const COUNT = GW * GH;
const FRAMES = 6;

/** 生成結果に見立てた絵をオフスクリーンに描き、画素を点群の目標色として使う */
function paintTarget() {
  const cv = document.createElement('canvas');
  cv.width = GW;
  cv.height = GH;
  const g = cv.getContext('2d', { willReadFrequently: true });

  const sky = g.createLinearGradient(0, 0, 0, GH);
  sky.addColorStop(0, '#1b2a5e');
  sky.addColorStop(0.45, '#7a4c8f');
  sky.addColorStop(0.72, '#e0765c');
  sky.addColorStop(1, '#f5b26b');
  g.fillStyle = sky;
  g.fillRect(0, 0, GW, GH);

  // 太陽
  const sun = g.createRadialGradient(GW * 0.68, GH * 0.62, 1, GW * 0.68, GH * 0.62, 11);
  sun.addColorStop(0, '#fff3c4');
  sun.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = sun;
  g.fillRect(GW * 0.68 - 14, GH * 0.62 - 14, 28, 28);
  g.fillStyle = '#ffe9a8';
  g.beginPath();
  g.arc(GW * 0.68, GH * 0.62, 5.2, 0, Math.PI * 2);
  g.fill();

  // 遠景の山
  g.fillStyle = '#4b3a6b';
  g.beginPath();
  g.moveTo(0, GH * 0.74);
  g.lineTo(GW * 0.18, GH * 0.52);
  g.lineTo(GW * 0.34, GH * 0.7);
  g.lineTo(GW * 0.52, GH * 0.46);
  g.lineTo(GW * 0.74, GH * 0.72);
  g.lineTo(GW, GH * 0.58);
  g.lineTo(GW, GH * 0.8);
  g.lineTo(0, GH * 0.8);
  g.closePath();
  g.fill();

  // 近景
  g.fillStyle = '#241a38';
  g.beginPath();
  g.moveTo(0, GH * 0.86);
  g.lineTo(GW * 0.26, GH * 0.72);
  g.lineTo(GW * 0.58, GH * 0.88);
  g.lineTo(GW * 0.82, GH * 0.76);
  g.lineTo(GW, GH * 0.85);
  g.lineTo(GW, GH);
  g.lineTo(0, GH);
  g.closePath();
  g.fill();

  // 水面の反射
  g.fillStyle = 'rgba(255,190,120,0.16)';
  for (let i = 0; i < 7; i++) {
    g.fillRect(GW * 0.6, GH * 0.9 + i * 1.2, 14 - i, 0.8);
  }

  return g.getImageData(0, 0, GW, GH).data;
}

export default class DiffusionScene extends BaseScene {
  build() {
    const rand = rng(9001);
    this.camera.position.set(0, 0, 8.4);
    const px = paintTarget();

    const noise = new Float32Array(COUNT * 3);
    const image = new Float32Array(COUNT * 3);
    const latent = new Float32Array(COUNT * 3);
    const video = new Float32Array(COUNT * 3);
    const imgCol = new Float32Array(COUNT * 3);
    const noiseCol = new Float32Array(COUNT * 3);

    const IW = 8.2;
    const IH = (IW * GH) / GW;

    for (let i = 0; i < COUNT; i++) {
      const gx = i % GW;
      const gy = Math.floor(i / GW);

      // 画像状態：格子に並ぶ
      image[i * 3] = (gx / (GW - 1) - 0.5) * IW;
      image[i * 3 + 1] = -(gy / (GH - 1) - 0.5) * IH;
      image[i * 3 + 2] = 0;

      // ノイズ状態：立方体の中にばらまく
      noise[i * 3] = (rand() - 0.5) * IW * 1.35;
      noise[i * 3 + 1] = (rand() - 0.5) * IH * 1.9;
      noise[i * 3 + 2] = (rand() - 0.5) * 5.5;

      // 潜在状態：小さく密な板
      latent[i * 3] = image[i * 3] * 0.3;
      latent[i * 3 + 1] = image[i * 3 + 1] * 0.3;
      latent[i * 3 + 2] = (rand() - 0.5) * 0.55;

      // 動画状態：6枚のフレームに分けて奥行き方向へ
      const f = i % FRAMES;
      const k = Math.floor(i / FRAMES);
      const fw = 42;
      const fx = k % fw;
      const fy = Math.min(Math.floor(k / fw), 24);
      video[i * 3] = (fx / (fw - 1) - 0.5) * 3.5 + (f - (FRAMES - 1) / 2) * 0.16;
      video[i * 3 + 1] = -(fy / 24 - 0.5) * 2.1;
      video[i * 3 + 2] = (f - (FRAMES - 1) / 2) * 1.35;

      const o = i * 4;
      imgCol[i * 3] = px[o] / 255;
      imgCol[i * 3 + 1] = px[o + 1] / 255;
      imgCol[i * 3 + 2] = px[o + 2] / 255;

      const n = 0.28 + rand() * 0.5;
      noiseCol[i * 3] = n * 0.72;
      noiseCol[i * 3 + 1] = n * 0.82;
      noiseCol[i * 3 + 2] = n;
    }

    this.states = { noise, image, latent, video, imgCol, noiseCol };
    this.posAttr = new THREE.BufferAttribute(new Float32Array(noise), 3);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(noiseCol), 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.075,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
    );
    this.root.add(this.points);

    // ── 潜在空間の枠
    const boxGeo = new THREE.BoxGeometry(IW * 0.3 + 0.3, IH * 0.3 + 0.3, 0.9);
    this.latentBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: 0x4ecdc4, transparent: true, opacity: 0 })
    );
    this.root.add(this.latentBox);

    this.latentTag = makeLabel('潜在空間（約 1/8 に圧縮）', {
      fontSize: 30,
      height: 0.26,
      color: '#9fe8e2',
      weight: 700,
    });
    this.latentTag.position.set(0, -1.5, 0);
    this.root.add(this.latentTag);

    // ── プロンプトのトークン
    const words = ['夕暮れ', 'の', '山', '写実的'];
    this.prompt = words.map((w, i) => {
      const s = makeLabel(w, {
        fontSize: 36,
        height: 0.36,
        color: '#1a1405',
        bg: '#ffd166',
        border: '#ffd166',
        weight: 800,
      });
      s.userData.aspect = s.scale.x / s.scale.y;
      s.userData.from = new THREE.Vector3(-5.2, 1.9 - i * 0.62, 1.6);
      this.root.add(s);
      return s;
    });
    const pl = [];
    this.prompt.forEach((s) => {
      pl.push(s.userData.from.x, s.userData.from.y, s.userData.from.z, 0, 0, 0);
    });
    const plG = new THREE.BufferGeometry();
    plG.setAttribute('position', new THREE.Float32BufferAttribute(pl, 3));
    this.promptLines = new THREE.LineSegments(
      plG,
      new THREE.LineBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.root.add(this.promptLines);
    this.promptTag = makeLabel('クロスアテンションで全ステップに効き続ける', {
      fontSize: 28,
      height: 0.24,
      color: '#ffd166',
      weight: 700,
    });
    this.promptTag.position.set(0, 2.5, 0);
    this.root.add(this.promptTag);

    // ── 動画のフレーム枠
    this.frames = [];
    for (let f = 0; f < FRAMES; f++) {
      const fg = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(3.7, 2.3)),
        new THREE.LineBasicMaterial({ color: 0x8ab6ff, transparent: true, opacity: 0 })
      );
      fg.position.set((f - (FRAMES - 1) / 2) * 0.16, 0, (f - (FRAMES - 1) / 2) * 1.35);
      this.root.add(fg);
      this.frames.push(fg);
    }
    this.videoTag = makeLabel('時空間パッチを Transformer でデノイズ（DiT）', {
      fontSize: 30,
      height: 0.26,
      color: '#8ab6ff',
      weight: 700,
    });
    this.videoTag.position.set(0, 1.85, 0);
    this.root.add(this.videoTag);

    this.stepTag = makeLabel('ノイズ → 反復デノイズ → 画像', {
      fontSize: 32,
      height: 0.28,
      color: '#cfe0f7',
      weight: 700,
    });
    this.stepTag.position.set(0, 2.5, 0);
    this.root.add(this.stepTag);

    this._tmp = new THREE.Vector3();
  }

  update(p, bf, dt, time) {
    const s = this.states;
    // ビート0では、スクロールを止めていてもデノイズが繰り返し起きるように時間で回す。
    // ビート1以降はスクロールで 1 に固定され、以後は画像が確定する。
    const cyc = (time % 7) / 7;
    const timeDen = ease(clamp(cyc / 0.62));
    // 画像が出来上がってから圧縮に移るよう、この章だけは2段階に分ける
    const den = Math.max(timeDen, ease(seg(bf, 0.05, 0.45))); // ノイズ→画像
    const lat = ease(seg(bf, 0.42, 0.92)); // 画像→潜在
    const prm = inAt(bf, 2); // プロンプト注入
    const vid = inAt(bf, 3); // 潜在→動画フレーム

    const pos = this.posAttr.array;
    const col = this.colAttr.array;
    // 収束の残りゆらぎ：まだノイズが取れていない分だけ震えさせる
    const jitter = (1 - den) * 0.35 + (den < 1 ? 0.02 : 0);

    for (let i = 0; i < COUNT; i++) {
      const o = i * 3;
      let x = lerp(s.noise[o], s.image[o], den);
      let y = lerp(s.noise[o + 1], s.image[o + 1], den);
      let z = lerp(s.noise[o + 2], s.image[o + 2], den);

      if (lat > 0) {
        x = lerp(x, s.latent[o], lat);
        y = lerp(y, s.latent[o + 1], lat);
        z = lerp(z, s.latent[o + 2], lat);
      }
      if (vid > 0) {
        x = lerp(x, s.video[o], vid);
        y = lerp(y, s.video[o + 1], vid);
        z = lerp(z, s.video[o + 2], vid);
      }

      if (jitter > 0.005) {
        const ph = i * 0.37;
        x += Math.sin(time * 3.1 + ph) * jitter * 0.32;
        y += Math.cos(time * 2.7 + ph * 1.3) * jitter * 0.32;
        z += Math.sin(time * 2.2 + ph * 0.7) * jitter * 0.5;
      }

      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;

      col[o] = lerp(s.noiseCol[o], s.imgCol[o], den);
      col[o + 1] = lerp(s.noiseCol[o + 1], s.imgCol[o + 1], den);
      col[o + 2] = lerp(s.noiseCol[o + 2], s.imgCol[o + 2], den);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.points.material.size = lerp(0.075, 0.05, Math.max(lat, vid));

    // 枠とラベル
    this.latentBox.material.opacity = lat * (1 - vid) * 0.85;
    this.latentBox.scale.setScalar(1);
    this.latentTag.material.opacity = lat * (1 - vid) * (1 - prm * 0.4);
    this.stepTag.material.opacity = (1 - lat) * clamp(den * 1.6);

    const px = prm * (1 - vid);
    this.prompt.forEach((sp, i) => {
      const f = sp.userData.from;
      const t = easeOut(clamp(prm * 1.6 - i * 0.12));
      sp.position.set(lerp(f.x, -0.2, t * 0.55), lerp(f.y, f.y * 0.35, t), lerp(f.z, 0.5, t));
      sp.material.opacity = px;
    });
    const plPos = this.promptLines.geometry.attributes.position;
    this.prompt.forEach((sp, i) => {
      plPos.setXYZ(i * 2, sp.position.x, sp.position.y, sp.position.z);
      plPos.setXYZ(i * 2 + 1, 0, 0, 0);
    });
    plPos.needsUpdate = true;
    this.promptLines.material.opacity = px * (0.35 + Math.sin(time * 3) * 0.15);
    this.promptTag.material.opacity = px;

    this.frames.forEach((f, i) => {
      f.material.opacity = vid * 0.55 * clamp(vid * 3 - i * 0.25);
    });
    this.videoTag.material.opacity = vid;

    // カメラ：動画のときだけ斜めから見せる
    const ang = vid * 0.55;
    this.camera.position.set(Math.sin(ang) * 9.2, lerp(0, 1.1, vid), Math.cos(ang) * 9.2);
    this.camera.position.z = lerp(8.4, this.camera.position.z, vid);
    this.camera.lookAt(0, 0, 0);
    this.root.rotation.y = Math.sin(time * 0.12) * 0.06 * (1 - vid);
  }
}
