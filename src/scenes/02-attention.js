import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const SEQ = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'and', 'slept'];
const N = SEQ.length;
const LAYERS = 12;

/** 因果マスク付きの、それらしい注意重み（決定論的に生成する） */
function attentionWeights() {
  const rand = rng(7);
  const w = [];
  for (let i = 0; i < N; i++) {
    const row = new Array(N).fill(0);
    for (let j = 0; j <= i; j++) {
      // 近傍・文頭・特定の長距離ペアを強めにする
      let v = 0.15 + 0.6 * Math.exp(-(i - j) * 0.7);
      if (j === 0) v += 0.35;
      if (i === 4 && j === 1) v += 0.8; // the → cat（照応）
      if (i === 7 && j === 1) v += 0.7; // slept → cat（主語）
      if (i === 5 && j === 3) v += 0.4; // mat → on
      row[j] = v * (0.75 + rand() * 0.5);
    }
    const s = row.reduce((a, b) => a + b, 0) || 1;
    w.push(row.map((v) => v / s));
  }
  return w;
}

export default class AttentionScene extends BaseScene {
  build() {
    this.camera.position.set(0, 0, 11);
    this.W = attentionWeights();

    // ══ グループ0：系列と結合の対比（逐次 → 全結合）
    this.gSeq = new THREE.Group();
    this.root.add(this.gSeq);

    const nodeGeo = new THREE.SphereGeometry(0.19, 20, 14);
    this.nodes = [];
    this.nodeX = [];
    this.seqLabels = [];
    for (let i = 0; i < N; i++) {
      const x = (i - (N - 1) / 2) * 1.28;
      this.nodeX.push(x);
      const mesh = new THREE.Mesh(
        nodeGeo,
        new THREE.MeshBasicMaterial({ color: 0x4ecdc4, transparent: true })
      );
      mesh.position.set(x, 0, 0);
      this.gSeq.add(mesh);
      this.nodes.push(mesh);

      const lb = makeLabel(SEQ[i], { fontSize: 34, height: 0.24, color: '#9fb0d0', weight: 600 });
      lb.position.set(x, -0.46, 0);
      this.gSeq.add(lb);
      this.seqLabels.push(lb);
    }

    // 逐次リンク（RNN 的な鎖）
    const chainPts = [];
    for (let i = 0; i < N - 1; i++) {
      chainPts.push(this.nodeX[i], 0, 0, this.nodeX[i + 1], 0, 0);
    }
    const chainG = new THREE.BufferGeometry();
    chainG.setAttribute('position', new THREE.Float32BufferAttribute(chainPts, 3));
    this.chain = new THREE.LineSegments(
      chainG,
      new THREE.LineBasicMaterial({ color: 0x6f7d95, transparent: true, opacity: 0 })
    );
    this.gSeq.add(this.chain);
    this.chainPulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true })
    );
    this.gSeq.add(this.chainPulse);

    // 全結合（アーチ状の注意リンク）
    const arcPts = [];
    this.arcMeta = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < i; j++) {
        const seg16 = 16;
        const h = 0.35 + (i - j) * 0.34;
        for (let k = 0; k < seg16; k++) {
          const t0 = k / seg16;
          const t1 = (k + 1) / seg16;
          const pt = (t) => [
            lerp(this.nodeX[j], this.nodeX[i], t),
            Math.sin(Math.PI * t) * h,
            Math.sin(Math.PI * t) * 0.25,
          ];
          arcPts.push(...pt(t0), ...pt(t1));
        }
        this.arcMeta.push({ i, j, w: this.W[i][j], verts: seg16 * 2 });
      }
    }
    const arcG = new THREE.BufferGeometry();
    arcG.setAttribute('position', new THREE.Float32BufferAttribute(arcPts, 3));
    const arcColors = new Float32Array((arcPts.length / 3) * 3);
    arcG.setAttribute('color', new THREE.BufferAttribute(arcColors, 3));
    this.arcs = new THREE.LineSegments(
      arcG,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.gSeq.add(this.arcs);
    this._paintArcs();

    this.seqCaption = makeLabel('逐次に読む（RNN）', {
      fontSize: 38,
      height: 0.3,
      color: '#9fb0d0',
      weight: 700,
    });
    this.seqCaption.position.set(0, 2.9, 0);
    this.gSeq.add(this.seqCaption);
    this.attCaption = makeLabel('一度に見渡す（Attention）', {
      fontSize: 38,
      height: 0.3,
      color: '#4ecdc4',
      weight: 700,
    });
    this.attCaption.position.set(0, 3.35, 0);
    this.gSeq.add(this.attCaption);

    // ══ グループ1：Q・K・V と注意行列
    this.gQKV = new THREE.Group();
    this.gQKV.visible = false;
    this.root.add(this.gQKV);

    const cellGeo = new THREE.PlaneGeometry(0.37, 0.37);
    this.matCells = new THREE.InstancedMesh(
      cellGeo,
      new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }),
      N * N
    );
    this.matCells.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * N * 3), 3);
    const mm = new THREE.Matrix4();
    const cc = new THREE.Color();
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const idx = i * N + j;
        mm.makeTranslation((j - (N - 1) / 2) * 0.42, -(i - (N - 1) / 2) * 0.42, 0);
        this.matCells.setMatrixAt(idx, mm);
        const w = this.W[i][j];
        cc.setHSL(0.5 - w * 0.14, 0.7, 0.06 + Math.min(0.62, w * 1.5));
        this.matCells.setColorAt(idx, cc);
      }
    }
    this.matCells.instanceMatrix.needsUpdate = true;
    this.matCells.instanceColor.needsUpdate = true;
    this.matCells.position.set(2.9, 0.1, 0);
    this.gQKV.add(this.matCells);

    const matTitle = makeLabel('注意の重み  softmax(QKᵀ/√dₖ)', {
      fontSize: 32,
      height: 0.26,
      color: '#9fe8e2',
      weight: 700,
    });
    matTitle.position.set(2.9, 2.2, 0);
    this.gQKV.add(matTitle);

    // Q / K / V のプレート
    this.qkv = [];
    const defs = [
      { t: 'Q', s: '何を探しているか', c: 0xffd166, y: 1.55 },
      { t: 'K', s: '自分は何者か', c: 0x4ecdc4, y: 0.1 },
      { t: 'V', s: '渡せる中身', c: 0x8ab6ff, y: -1.35 },
    ];
    defs.forEach((d) => {
      const g = new THREE.Group();
      g.position.set(-1.6, d.y, 0);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 0.95),
        new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.12 })
      );
      g.add(plate);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.5, 0.95)),
        new THREE.LineBasicMaterial({ color: d.c, transparent: true })
      );
      g.add(edge);
      const big = makeLabel(d.t, {
        fontSize: 60,
        height: 0.5,
        color: '#' + new THREE.Color(d.c).getHexString(),
        weight: 800,
      });
      big.position.set(-0.85, 0.05, 0.02);
      g.add(big);
      const sub = makeLabel(d.s, { fontSize: 30, height: 0.22, color: '#cfe0f7', weight: 600 });
      sub.position.set(0.28, 0.02, 0.02);
      g.add(sub);
      this.gQKV.add(g);
      this.qkv.push(g);
    });

    // ══ グループ2：層の積み重ね
    this.gStack = new THREE.Group();
    this.gStack.visible = false;
    this.root.add(this.gStack);
    this.plates = [];
    const plateGeo = new THREE.BoxGeometry(5.4, 0.1, 2.6);
    for (let i = 0; i < LAYERS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x2a4f6b, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(plateGeo, mat);
      mesh.position.set(0, -2.8 + i * 0.48, 0);
      this.gStack.add(mesh);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(plateGeo),
        new THREE.LineBasicMaterial({ color: 0x4ecdc4, transparent: true, opacity: 0.35 })
      );
      wire.position.copy(mesh.position);
      this.gStack.add(wire);
      this.plates.push({ mesh, wire, y: mesh.position.y });
    }
    this.stackLabels = [
      { t: '単語', y: -2.5 },
      { t: '句・係り受け', y: -0.9 },
      { t: '文の意味', y: 0.7 },
      { t: '話の流れ', y: 2.3 },
    ].map((d) => {
      const s = makeLabel(d.t, { fontSize: 32, height: 0.26, color: '#9fb0d0', weight: 600 });
      s.position.set(3.9, d.y, 0);
      this.gStack.add(s);
      return s;
    });
    const stackTitle = makeLabel('層が上がるほど抽象度が上がる', {
      fontSize: 34,
      height: 0.28,
      color: '#4ecdc4',
      weight: 700,
    });
    stackTitle.position.set(0, 3.5, 0);
    this.gStack.add(stackTitle);
    this.stackTitle = stackTitle;

    // ══ グループ3：自己回帰生成
    this.gGen = new THREE.Group();
    this.gGen.visible = false;
    this.root.add(this.gGen);
    this.genTokens = ['今日', 'の', '天気', 'は', 'とても', '良い', 'です', 'ね'].map((t, i) => {
      const s = makeLabel(t, {
        fontSize: 44,
        height: 0.5,
        color: '#eaf3ff',
        bg: 'rgba(20,30,52,0.94)',
        border: 'rgba(255,209,102,0.7)',
        weight: 700,
      });
      s.userData.aspect = s.scale.x / s.scale.y;
      this.gGen.add(s);
      return s;
    });
    this.genCaption = makeLabel('次の1トークンを予測 → 末尾に足す → 繰り返す', {
      fontSize: 34,
      height: 0.28,
      color: '#ffd166',
      weight: 700,
    });
    this.genCaption.position.set(0, 1.5, 0);
    this.gGen.add(this.genCaption);
    this.genArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.4, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true })
    );
    this.genArrow.rotation.z = -Math.PI / 2;
    this.gGen.add(this.genArrow);
  }

  _paintArcs() {
    const colors = this.arcs.geometry.attributes.color;
    const c = new THREE.Color();
    let v = 0;
    this.arcMeta.forEach((a) => {
      const inten = 0.25 + Math.min(1, a.w * 3.4) * 0.75;
      c.setHSL(0.48, 0.7, 0.12 + inten * 0.42);
      for (let k = 0; k < a.verts; k++) {
        colors.setXYZ(v++, c.r, c.g, c.b);
      }
    });
    colors.needsUpdate = true;
  }

  update(p, bf, dt, time) {
    // ── ビート0：逐次 → 全結合
    // ビート0では、スクロールを止めていても「逐次 → 全結合」の切り替わりが繰り返し見えるよう
    // 時間でも回す。スクロールを進めれば全結合側に固定される。
    const cyc = (time % 9) / 9;
    const attn = Math.max(ease(clamp((cyc - 0.34) / 0.22)), ease(seg(bf, 0.35, 0.8)));
    const out0 = ease(seg(bf, 0.78, 1.0));

    const seqA = 1 - out0;
    this.gSeq.visible = seqA > 0.02;
    if (this.gSeq.visible) {
      const a = seqA;
      this.chain.material.opacity = 0.55 * (1 - attn) * a;
      this.arcs.material.opacity = attn * 0.9 * a;
      this.seqCaption.material.opacity = (1 - attn) * a;
      this.attCaption.material.opacity = attn * a;
      this.attCaption.position.y = lerp(2.9, 3.35, attn);

      // RNN の逐次処理を「1つずつ光る」で表す
      const head = (time * 1.6) % (N + 1);
      this.nodes.forEach((n, i) => {
        const lit = Math.max(0, 1 - Math.abs(head - i) * 1.6) * (1 - attn);
        n.material.color.setHSL(0.48, 0.7, 0.42 + lit * 0.4);
        n.scale.setScalar(1 + lit * 0.5 + attn * 0.12);
        n.material.opacity = a;
      });
      const hx = clamp(head / (N - 1)) * (this.nodeX[N - 1] - this.nodeX[0]) + this.nodeX[0];
      this.chainPulse.position.set(hx, 0, 0.05);
      this.chainPulse.material.opacity = (1 - attn) * a;
      this.seqLabels.forEach((l) => (l.material.opacity = a * 0.9));
      this.gSeq.position.y = lerp(0, 1.2, out0);
    }

    // ── ビート1：Q・K・V
    const qkvIn = ease(seg(bf, 0.55, 0.95));
    const qkvOut = ease(seg(bf, 1.72, 2.0));
    this.gQKV.visible = bf > 0.8 && bf < 2.05;
    if (this.gQKV.visible) {
      const a = qkvIn * (1 - qkvOut);
      this.gQKV.traverse((o) => {
        if (o.material && !Array.isArray(o.material)) o.material.opacity = o.material.userData?.base ?? a;
      });
      // プレートの塗りは薄めに保つ
      this.qkv.forEach((g, i) => {
        g.children[0].material.opacity = a * 0.12;
        g.children[1].material.opacity = a * 0.8;
        g.children[2].material.opacity = a;
        g.children[3].material.opacity = a;
        g.position.x = lerp(-3.6, -1.6, qkvIn) + Math.sin(time * 0.7 + i) * 0.04;
      });
      this.matCells.material.opacity = a;
      this.matCells.rotation.y = Math.sin(time * 0.25) * 0.12;
    }

    // ── ビート2：層のスタック
    const stIn = ease(seg(bf, 1.55, 1.95));
    const stOut = ease(seg(bf, 2.7, 3.0));
    this.gStack.visible = bf > 1.75 && bf < 3.05;
    if (this.gStack.visible) {
      const a = stIn * (1 - stOut);
      const pulse = (time * 0.42) % 1.25;
      this.plates.forEach((pl, i) => {
        const up = clamp(stIn * (LAYERS + 2) - i);
        const t = i / (LAYERS - 1);
        const lit = Math.max(0, 1 - Math.abs(pulse - t) * 6);
        pl.mesh.position.y = lerp(pl.y - 2.2, pl.y, easeOut(up));
        pl.wire.position.y = pl.mesh.position.y;
        pl.mesh.material.opacity = a * up * (0.24 + lit * 0.5);
        pl.wire.material.opacity = a * up * (0.28 + lit * 0.7);
        pl.mesh.material.color.setHSL(0.5, 0.55, 0.18 + lit * 0.4);
      });
      this.stackLabels.forEach((s, i) => (s.material.opacity = a * clamp(stIn * 5 - i * 0.9)));
      this.stackTitle.material.opacity = a;
      this.gStack.rotation.y = Math.sin(time * 0.18) * 0.22;
      this.gStack.rotation.x = -0.12;
    }

    // ── ビート3：自己回帰生成
    const genIn = ease(seg(bf, 2.55, 2.95));
    this.gGen.visible = bf > 2.7;
    if (this.gGen.visible) {
      const cycle = 4.2;
      const t = (time % cycle) / cycle;
      const shown = 3 + Math.floor(t * (this.genTokens.length - 3 + 0.999));
      let x = 0;
      const widths = this.genTokens.map((s) => s.userData.aspect * 0.5 + 0.12);
      const total = widths.slice(0, shown).reduce((a, b) => a + b, 0);
      x = -total / 2;
      this.genTokens.forEach((s, i) => {
        if (i < shown) {
          const isNew = i === shown - 1;
          const local = (t * (this.genTokens.length - 3 + 0.999)) % 1;
          const pop = isNew ? easeOut(Math.min(1, local * 3)) : 1;
          s.visible = true;
          s.position.set(x + widths[i] / 2, 0, 0);
          const h = 0.5 * (0.6 + 0.4 * pop);
          s.scale.set(h * s.userData.aspect, h, 1);
          s.material.opacity = genIn * pop;
          x += widths[i];
        } else {
          s.visible = false;
        }
      });
      this.genArrow.position.set(x + 0.32, 0, 0);
      this.genArrow.material.opacity = genIn * 0.9;
      this.genCaption.material.opacity = genIn;
    }

    this.camera.position.z = 11;
    this.camera.lookAt(0, 0, 0);
  }
}
