import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng, inAt, outAt } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const SEQ = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'and', 'slept'];
const N = SEQ.length;
const LAYERS = 12;

/** 具体例のトークン列の配置（build と update の両方で使う） */
const TOK_Y = 2.95;
const TOK_X = (i) => -3.25 + i * 0.94;

/**
 * Q・K・V の具体例。q が「いま処理しているトークン」、k が最も強く見に行く先。
 * 抽象的な説明だけでは伝わらないので、実際の文でこの3つを名指しする。
 */
const EXAMPLES = [
  {
    q: 7,
    k: 1,
    ask: '「誰が」寝たのか？',
    answer: '私は cat。動物で、主語になれる',
    mix: 'cat の中身を最も強く受け取る',
  },
  {
    q: 5,
    k: 3,
    ask: '「どこ」に置かれている？',
    answer: '私は on。場所の関係を示す',
    mix: 'on の中身を強く受け取る',
  },
  {
    q: 2,
    k: 1,
    ask: '「誰が」座ったのか？',
    answer: '私は cat。動物で、主語になれる',
    mix: 'cat の中身を最も強く受け取る',
  },
];

/** 因果マスク付きの、それらしい注意重み（決定論的に生成する） */
function attentionWeights() {
  const rand = rng(7);
  const w = [];
  for (let i = 0; i < N; i++) {
    const row = new Array(N).fill(0);
    for (let j = 0; j <= i; j++) {
      // 近傍・文頭・特定の係り受けを強めにする
      let v = 0.12 + 0.55 * Math.exp(-(i - j) * 0.6);
      if (j === 0) v += 0.28; // 文頭はアンカーになりやすい
      // 自己参照は実際には強く出るが、ここでは「どこを見に行くか」を示す図なので抑える
      if (j === i) v *= 0.4;
      if (i === 4 && j === 1) v += 0.8; // the → cat（照応）
      if (i === 7 && j === 1) v += 0.9; // slept → cat（主語）
      if (i === 5 && j === 3) v += 0.75; // mat → on（場所）
      if (i === 2 && j === 1) v += 0.8; // sat → cat（主語）
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

    // ── 具体例：実際の文の上で「どのトークンがどこを見るか」を示す
    this.exChips = SEQ.map((w, i) => {
      const s = makeLabel(w, {
        fontSize: 38,
        height: 0.42,
        color: '#eaf3ff',
        bg: 'rgba(16,24,42,0.95)',
        border: 'rgba(120,150,210,0.45)',
        weight: 700,
      });
      s.userData.aspect = s.scale.x / s.scale.y;
      s.position.set(TOK_X(i), TOK_Y, 0);
      this.gQKV.add(s);
      return s;
    });

    /*
     * 注意の強さぶんの光。query から各 key へ、下にたわませて引く。
     * WebGL では線の太さを変えられないので、帯（薄いメッシュ）にして
     * 重みの強さを幅で表す。細い線だと強弱がまったく伝わらない。
     */
    const SEG = 26;
    this.exBeams = SEQ.map(() => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3)
      );
      const idx = [];
      for (let s = 0; s < SEG; s++) {
        const a0 = s * 2;
        idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
      }
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: 0x4ecdc4,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      this.gQKV.add(mesh);
      return mesh;
    });
    this.BEAM_SEG = SEG;

    this.exQueryTag = makeLabel('いま処理しているトークン', {
      fontSize: 26,
      height: 0.22,
      color: '#ffd166',
      weight: 700,
    });
    this.gQKV.add(this.exQueryTag);

    // Q・K・V を実際のトークンに直接ひも付ける小さな印
    const badge = (t, hex) => {
      const s = makeLabel(t, {
        fontSize: 30,
        height: 0.3,
        color: '#0a1018',
        bg: hex,
        border: hex,
        weight: 800,
      });
      s.userData.aspect = s.scale.x / s.scale.y;
      this.gQKV.add(s);
      return s;
    };
    this.exQBadge = badge('Q', '#ffd166');
    this.exKBadge = badge('K', '#4ecdc4');
    this.exVBadge = badge('V', '#8ab6ff');

    // ── Q / K / V の3行。抽象の説明に、具体例の一行を並べる
    const defs = [
      { t: 'Q', s: '何を探しているか', c: 0xffd166, y: 1.4, key: 'ask' },
      { t: 'K', s: '自分は何者か', c: 0x4ecdc4, y: 0.3, key: 'answer' },
      { t: 'V', s: '渡せる中身', c: 0x8ab6ff, y: -0.8, key: 'mix' },
    ];
    this.qkvRows = defs.map((d) => {
      const g = new THREE.Group();
      g.position.set(0, d.y, 0);
      const hex = '#' + new THREE.Color(d.c).getHexString();

      const big = makeLabel(d.t, { fontSize: 62, height: 0.52, color: hex, weight: 800 });
      big.position.set(-3.05, 0, 0);
      g.add(big);

      const sub = makeLabel(d.s, { fontSize: 26, height: 0.21, color: '#9fb0d0', weight: 600 });
      sub.center.set(0, 0.5);
      sub.position.set(-2.6, 0.19, 0);
      g.add(sub);

      // 例ごとの具体テキストは焼き直せないので、全部作って切り替える
      const lines = EXAMPLES.map((ex) => {
        const s = makeLabel(ex[d.key], { fontSize: 29, height: 0.25, color: hex, weight: 700 });
        s.center.set(0, 0.5);
        s.position.set(-2.6, -0.21, 0);
        s.visible = false;
        g.add(s);
        return s;
      });

      this.gQKV.add(g);
      return { g, big, sub, lines };
    });

    this.qkvFormula = makeLabel('この光の強さが注意の重み  softmax(QKᵀ/√dₖ)', {
      fontSize: 27,
      height: 0.23,
      color: '#9fe8e2',
      weight: 700,
    });
    this.qkvFormula.position.set(0.4, -1.95, 0);
    this.gQKV.add(this.qkvFormula);

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
    const attn = Math.max(ease(clamp((cyc - 0.34) / 0.22)), inAt(bf, 1));
    const out0 = outAt(bf, 1);

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
    const qkvIn = inAt(bf, 1);
    const qkvOut = outAt(bf, 2);
    this.gQKV.visible = bf > 0.8 && bf < 2.05;
    if (this.gQKV.visible) {
      const a = qkvIn * (1 - qkvOut);

      // 例を順に見せる。切り替えの前後は一度暗くして、読み違えを防ぐ
      const CYCLE = 6.2;
      const phase = (time % (CYCLE * EXAMPLES.length)) / CYCLE;
      const ei = Math.floor(phase) % EXAMPLES.length;
      const local = phase - Math.floor(phase);
      const swap = clamp(local / 0.12) * (1 - clamp((local - 0.88) / 0.12));
      const ex = EXAMPLES[ei];
      const row = this.W[ex.q];
      const tokX = TOK_X;
      const dipOf = (j) => 0.4 + Math.abs(tokX(j) - tokX(ex.q)) * 0.16;

      // トークン列：query を明るく、最も強い key をその次に
      this.exChips.forEach((s, i) => {
        const isQ = i === ex.q;
        const isK = i === ex.k;
        const lit = isQ ? 1 : isK ? 0.85 : i < ex.q ? 0.5 : 0.18;
        s.material.opacity = a * lit * (0.35 + swap * 0.65);
        const h = 0.42 * (isQ ? 1.16 : 1);
        s.scale.set(h * s.userData.aspect, h, 1);
        s.position.y = TOK_Y + (isQ ? Math.sin(time * 2.4) * 0.045 : 0);
      });

      // タグは画面外へ出ないよう、端では内側に寄せる
      this.exQueryTag.material.opacity = a * swap;
      this.exQueryTag.position.set(clamp(tokX(ex.q), -2.2, 2.2), 3.82, 0);

      // Q は query に、K は最も強い相手に貼る
      const setBadge = (s, x, y, op) => {
        s.material.opacity = op;
        const h = 0.3;
        s.scale.set(h * s.userData.aspect, h, 1);
        s.position.set(x, y, 0.08);
      };
      setBadge(this.exQBadge, tokX(ex.q), TOK_Y + 0.4, a * swap);
      setBadge(this.exKBadge, tokX(ex.k), TOK_Y + 0.4, a * swap);

      // V は「中身が key から query へ流れてくる」ことを、光の帯の上を動いて示す
      const vt = (time % 2.2) / 2.2;
      const dip = dipOf(ex.k);
      setBadge(
        this.exVBadge,
        lerp(tokX(ex.k), tokX(ex.q), vt),
        TOK_Y - Math.sin(Math.PI * vt) * dip,
        a * swap * (0.25 + Math.sin(Math.PI * vt) * 0.75)
      );

      // 光の帯：query から各 key へ、重みの強さで
      const pulse = 0.75 + Math.sin(time * 2.6) * 0.25;
      this.exBeams.forEach((beam, j) => {
        const w = j <= ex.q ? row[j] : 0;
        const show = j !== ex.q && w > 0.02;
        beam.visible = show;
        if (!show) return;
        const pos = beam.geometry.attributes.position;
        const x0 = tokX(ex.q);
        const x1 = tokX(j);
        const dip = dipOf(j);
        // 幅で重みを表す。端は細くして、光が伸びていくように見せる
        const halfW = 0.012 + w * 0.115;
        for (let s = 0; s <= this.BEAM_SEG; s++) {
          const t = s / this.BEAM_SEG;
          const x = lerp(x0, x1, t);
          const y = TOK_Y - Math.sin(Math.PI * t) * dip;
          const taper = Math.sin(Math.PI * t) * 0.7 + 0.3;
          pos.setXYZ(s * 2, x, y + halfW * taper, 0.05);
          pos.setXYZ(s * 2 + 1, x, y - halfW * taper, 0.05);
        }
        pos.needsUpdate = true;
        // 最も強い相手だけ脈打たせる
        const strong = j === ex.k;
        beam.material.opacity = a * swap * Math.min(1, w * 2.6) * (strong ? pulse : 0.4);
        beam.material.color.setHex(strong ? 0xffd166 : 0x4ecdc4);
      });

      // Q・K・V の行。具体例の一行だけを出す
      this.qkvRows.forEach((r, i) => {
        r.big.material.opacity = a;
        r.sub.material.opacity = a * 0.85;
        r.lines.forEach((s, k) => {
          s.visible = k === ei;
          if (s.visible) s.material.opacity = a * swap;
        });
        r.g.position.x = lerp(-0.9, 0, qkvIn) + Math.sin(time * 0.7 + i) * 0.03;
      });

      this.qkvFormula.material.opacity = a * 0.9;
    }

    // ── ビート2：層のスタック
    const stIn = inAt(bf, 2);
    const stOut = outAt(bf, 3);
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
    const genIn = inAt(bf, 3);
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
