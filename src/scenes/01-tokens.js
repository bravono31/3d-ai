import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, rng } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const TOKENS = ['言語', 'モデル', 'は', '次', 'の', 'トークン', 'を', '予測', 'する'];
const VEC_CELLS = 14;

const CLUSTERS = [
  { c: [-3.5, 1.3, -0.8], color: 0x4ecdc4, name: '動物', words: ['犬', '猫', '鳥'] },
  { c: [3.3, -0.5, 0.7], color: 0xffd166, name: '金融', words: ['銀行', '金利', '投資'] },
  { c: [0.3, 2.7, 1.6], color: 0x8ab6ff, name: 'プログラム', words: ['コード', '関数', '変数'] },
  { c: [-1.5, -2.5, -1.4], color: 0xff8fa3, name: '感情', words: ['喜び', '悲しみ'] },
];

export default class TokensScene extends BaseScene {
  build() {
    const rand = rng(1337);
    this.camera.position.set(0, 0, 7.6);

    // ── トークンのチップ
    this.chips = TOKENS.map((t) =>
      makeLabel(t, {
        fontSize: 48,
        height: 0.52,
        color: '#eaf3ff',
        bg: 'rgba(20,30,52,0.94)',
        border: 'rgba(78,205,196,0.65)',
        weight: 700,
      })
    );
    this.chips.forEach((c) => this.root.add(c));
    // 縦横比を控えておき、拡大縮小しても文字が歪まないようにする
    this.chipAspect = this.chips.map((c) => c.scale.x / c.scale.y);

    // 密着状態と分離状態のx座標を用意しておく
    const widths = this.chips.map((c) => c.scale.x);
    const cum = (gap) => {
      const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
      let x = -total / 2;
      return widths.map((w) => {
        const cx = x + w / 2;
        x += w + gap;
        return cx;
      });
    };
    this.tightX = cum(0.01);
    this.spreadX = cum(0.3);

    // 区切りの縦線
    const tickG = new THREE.BufferGeometry();
    const tv = [];
    for (let i = 0; i < TOKENS.length - 1; i++) {
      const x = (this.spreadX[i] + widths[i] / 2 + this.spreadX[i + 1] - widths[i + 1] / 2) / 2;
      tv.push(x, -0.36, 0, x, 0.36, 0);
    }
    tickG.setAttribute('position', new THREE.Float32BufferAttribute(tv, 3));
    this.ticks = new THREE.LineSegments(
      tickG,
      new THREE.LineBasicMaterial({ color: 0x4ecdc4, transparent: true, opacity: 0 })
    );
    this.root.add(this.ticks);

    // ── 埋め込みベクトル（チップの下に伸びる数値の帯）
    const cellGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    const cellMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    this.cells = new THREE.InstancedMesh(cellGeo, cellMat, TOKENS.length * VEC_CELLS);
    this.cells.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(TOKENS.length * VEC_CELLS * 3),
      3
    );
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    this.cellBase = [];
    for (let i = 0; i < TOKENS.length; i++) {
      for (let j = 0; j < VEC_CELLS; j++) {
        const idx = i * VEC_CELLS + j;
        const y = -0.62 - j * 0.16;
        this.cellBase.push({ x: this.spreadX[i], y });
        m.makeTranslation(this.spreadX[i], y, 0);
        this.cells.setMatrixAt(idx, m);
        const v = rand();
        col.setHSL(0.5 - v * 0.12, 0.65, 0.28 + v * 0.42);
        this.cells.setColorAt(idx, col);
      }
    }
    this.cells.instanceMatrix.needsUpdate = true;
    this.cells.instanceColor.needsUpdate = true;
    this.root.add(this.cells);

    // ── 意味空間の点群
    const N = 1800;
    const pos = new Float32Array(N * 3);
    const colr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const cl = CLUSTERS[i % CLUSTERS.length];
      const spread = 1.05 + rand() * 0.5;
      const gx = (rand() + rand() + rand() - 1.5) * spread;
      const gy = (rand() + rand() + rand() - 1.5) * spread;
      const gz = (rand() + rand() + rand() - 1.5) * spread;
      // 1割は「どのクラスタにも属さない」語として散らす
      const loose = rand() < 0.1 ? 3.4 : 1;
      pos[i * 3] = cl.c[0] + gx * loose;
      pos[i * 3 + 1] = cl.c[1] + gy * loose;
      pos[i * 3 + 2] = cl.c[2] + gz * loose;
      col.set(cl.color).multiplyScalar(0.55 + rand() * 0.6);
      colr[i * 3] = col.r;
      colr[i * 3 + 1] = col.g;
      colr[i * 3 + 2] = col.b;
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    cg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    this.cloud = new THREE.Points(
      cg,
      new THREE.PointsMaterial({
        size: 0.055,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.root.add(this.cloud);

    // クラスタの見出しと代表語
    this.clusterLabels = [];
    CLUSTERS.forEach((cl) => {
      const hex = '#' + new THREE.Color(cl.color).getHexString();
      const head = makeLabel(cl.name, { fontSize: 40, height: 0.34, color: hex, weight: 700 });
      head.position.set(cl.c[0], cl.c[1] + 1.5, cl.c[2]);
      this.root.add(head);
      this.clusterLabels.push(head);
      cl.words.forEach((w, i) => {
        const s = makeLabel(w, { fontSize: 34, height: 0.25, color: '#cfe0f7', weight: 600 });
        const a = (i / cl.words.length) * Math.PI * 2;
        s.position.set(cl.c[0] + Math.cos(a) * 0.95, cl.c[1] + Math.sin(a) * 0.75, cl.c[2] + 0.5);
        this.root.add(s);
        this.clusterLabels.push(s);
      });
    });

    // チップが飛んでいく先（意味空間の中の位置）
    this.chipTargets = this.chips.map(() => {
      const cl = CLUSTERS[Math.floor(rand() * CLUSTERS.length)];
      return new THREE.Vector3(
        cl.c[0] + (rand() - 0.5) * 2.4,
        cl.c[1] + (rand() - 0.5) * 2.0,
        cl.c[2] + (rand() - 0.5) * 2.0
      );
    });
  }

  update(p, bf, dt, time) {
    const spread = ease(seg(bf, 0.0, 0.7));
    const vecIn = ease(seg(bf, 0.5, 0.95));
    const toCloud = ease(seg(bf, 1.3, 1.95));

    this.ticks.material.opacity = spread * 0.7 * (1 - toCloud);

    const m = new THREE.Matrix4();
    this.chips.forEach((chip, i) => {
      const x0 = lerp(this.tightX[i], this.spreadX[i], spread);
      const t = this.chipTargets[i];
      // ばらつかせて飛ばすと「一斉に散る」感じが出る
      const d = easeOut(Math.min(1, Math.max(0, toCloud * 1.5 - i * 0.05)));
      chip.position.set(lerp(x0, t.x, d), lerp(0, t.y, d), lerp(0, t.z, d));
      const h = lerp(0.52, 0.32, d);
      chip.scale.set(h * this.chipAspect[i], h, 1);
      chip.material.opacity = 1;
    });

    this.cells.material.opacity = vecIn * (1 - toCloud);
    if (this.cells.material.opacity > 0.001) {
      for (let i = 0; i < TOKENS.length; i++) {
        for (let j = 0; j < VEC_CELLS; j++) {
          const idx = i * VEC_CELLS + j;
          const b = this.cellBase[idx];
          const grow = Math.min(1, Math.max(0, vecIn * (VEC_CELLS + 3) - j));
          const wob = Math.sin(time * 1.6 + i * 0.7 + j * 0.45) * 0.03;
          m.makeTranslation(this.chips[i].position.x, b.y + wob, 0);
          m.scale(new THREE.Vector3(grow, grow, grow));
          this.cells.setMatrixAt(idx, m);
        }
      }
      this.cells.instanceMatrix.needsUpdate = true;
    }

    this.cloud.material.opacity = toCloud * 0.95;
    this.clusterLabels.forEach((l) => (l.material.opacity = Math.max(0, toCloud * 1.3 - 0.3)));

    this.root.rotation.y = Math.sin(time * 0.11) * 0.18 * toCloud;
    this.camera.position.z = lerp(7.6, 13.2, toCloud);
    this.camera.position.y = lerp(0, 0.5, toCloud);
    this.camera.lookAt(0, lerp(0, 0.3, toCloud), 0);
  }
}
