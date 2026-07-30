import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const SIGNERS = 1200;

const NUKE = [
  { y: '1945', t: '核兵器の実用化' },
  { y: '1955', t: 'ラッセル＝アインシュタイン宣言' },
  { y: '1957', t: 'パグウォッシュ会議' },
  { y: '1963', t: '部分的核実験禁止条約' },
  { y: '1968', t: '核不拡散条約' },
];
const AIML = [
  { y: '2017', t: 'Transformer' },
  { y: '2022', t: 'ChatGPT' },
  { y: '2026-06', t: '再帰的自己改善の研究' },
  { y: '2026-07', t: 'Pacing the Frontier' },
  { y: '?', t: '制度化' },
];

const DIFFS = [
  { k: '見えるか', a: '核：査察できる', b: 'AI：学習は外から見えない' },
  { k: '広がるコスト', a: '核：希少物質と産業基盤', b: 'AI：重みはただのファイル' },
  { k: '誰が持つか', a: '核：国家', b: 'AI：民間企業が最前線' },
  { k: '用途', a: '核：発電と兵器は別', b: 'AI：同じモデルが両方に' },
];

export default class FrontierScene extends BaseScene {
  build() {
    const rand = rng(1955);
    this.camera.position.set(0, 0.3, 12);

    // ══════ 0: 立ち上がる能力曲線と、1,200人の署名
    this.gCurve = new THREE.Group();
    this.root.add(this.gCurve);

    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const x = -5.2 + t * 10.4;
      const y = -2.2 + Math.exp(t * 3.05) * 0.115;
      pts.push(new THREE.Vector3(x, Math.min(y, 3.4), 0));
    }
    this.curve = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x4ecdc4, transparent: true })
    );
    this.gCurve.add(this.curve);
    this.curvePts = pts;

    const axG = new THREE.BufferGeometry();
    axG.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-5.4, -2.4, 0, 5.4, -2.4, 0, -5.4, -2.4, 0, -5.4, 3.4, 0], 3)
    );
    this.axes = new THREE.LineSegments(
      axG,
      new THREE.LineBasicMaterial({ color: 0x3a4d70, transparent: true })
    );
    this.gCurve.add(this.axes);
    this.axLabels = [
      { t: '時間', x: 5.0, y: -2.75 },
      { t: '能力', x: -5.1, y: 3.15 },
    ].map((d) => {
      const s = makeLabel(d.t, { fontSize: 24, height: 0.2, color: '#6b7b9c', weight: 700 });
      s.position.set(d.x, d.y, 0);
      this.gCurve.add(s);
      return s;
    });

    // 署名の点群（1,200人）
    const sp = new Float32Array(SIGNERS * 3);
    this.signSeed = [];
    for (let i = 0; i < SIGNERS; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 1.5;
      this.signSeed.push({
        tx: 2.4 + Math.cos(a) * r * 1.5,
        ty: 0.3 + Math.sin(a) * r,
        fx: (rand() - 0.5) * 14,
        fy: (rand() - 0.5) * 9,
        d: rand(),
      });
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.signers = new THREE.Points(
      sg,
      new THREE.PointsMaterial({
        color: 0xffd166,
        size: 0.055,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.gCurve.add(this.signers);

    this.curveTitle = makeLabel('Pacing the Frontier（2026-07-28）', {
      fontSize: 38,
      height: 0.34,
      color: '#ffd166',
      weight: 800,
    });
    this.curveTitle.position.set(0, 3.9, 0);
    this.gCurve.add(this.curveTitle);
    this.curveSub = makeLabel(
      'OpenAI・Anthropic・Google DeepMind・Meta の従業員 1,200人超が署名\n' +
        '「今すぐ止めろ」ではなく「ペースを調整する手段を国際的に整えよ」',
      { fontSize: 24, height: 0.42, color: '#c3d3ee', weight: 600, lineGap: 1.32 }
    );
    this.curveSub.position.set(0, -3.25, 0);
    this.curveSub.material.opacity = 0;
    this.gCurve.add(this.curveSub);

    // ══════ 1: 2本の年表
    this.gTime = new THREE.Group();
    this.gTime.visible = false;
    this.root.add(this.gTime);

    const mkTimeline = (rows, y, color, title) => {
      const g = new THREE.Group();
      g.position.y = y;
      const hex = '#' + new THREE.Color(color).getHexString();
      const lineG = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-3.2, 0, 0),
        new THREE.Vector3(4.6, 0, 0),
      ]);
      const line = new THREE.Line(
        lineG,
        new THREE.LineBasicMaterial({ color, transparent: true })
      );
      g.add(line);
      // 見出しは線の左端の上（左に置くと解説カードの下に隠れる）
      const ttl = makeLabel(title, { fontSize: 32, height: 0.3, color: hex, weight: 800 });
      ttl.center.set(0, 0.5);
      ttl.position.set(-3.15, 0.78, 0);
      g.add(ttl);
      const nodes = rows.map((r, i) => {
        const x = -2.7 + (i / (rows.length - 1)) * 6.9;
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 12, 10),
          new THREE.MeshBasicMaterial({ color, transparent: true })
        );
        dot.position.set(x, 0, 0);
        g.add(dot);
        const yr = makeLabel(r.y, { fontSize: 26, height: 0.24, color: hex, weight: 800 });
        yr.position.set(x, 0.42, 0);
        g.add(yr);
        const tx = makeLabel(r.t, { fontSize: 21, height: 0.18, color: '#c3d3ee', weight: 600 });
        tx.position.set(x, -0.42, 0);
        g.add(tx);
        return { dot, yr, tx };
      });
      this.gTime.add(g);
      return { g, line, ttl, nodes };
    };
    this.tlNuke = mkTimeline(NUKE, 1.5, 0x8ab6ff, '核');
    this.tlAI = mkTimeline(AIML, -1.5, 0x4ecdc4, 'AI');

    // 対応する節を結ぶ
    const linkPts = [];
    [1, 4].forEach((i) => {
      const x1 = -2.7 + (i / (NUKE.length - 1)) * 6.9;
      const x2 = -2.7 + (i / (AIML.length - 1)) * 6.9;
      linkPts.push(x1, 1.5 - 0.55, 0, x2, -1.5 + 0.55, 0);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linkPts, 3));
    this.tlLinks = new THREE.LineSegments(
      lg,
      new THREE.LineDashedMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0,
        dashSize: 0.16,
        gapSize: 0.13,
      })
    );
    this.tlLinks.computeLineDistances();
    this.gTime.add(this.tlLinks);

    this.tlNote = makeLabel('作った本人たちが警告する — 警告から制度化まで、核では13年かかった', {
      fontSize: 28,
      height: 0.24,
      color: '#ffd166',
      weight: 800,
    });
    this.tlNote.position.set(0, 3.2, 0);
    this.gTime.add(this.tlNote);

    // ══════ 2: 4つの相違点
    this.gDiff = new THREE.Group();
    this.gDiff.visible = false;
    this.root.add(this.gDiff);

    this.diffs = DIFFS.map((d, i) => {
      const g = new THREE.Group();
      g.position.set(0, 2.3 - i * 1.42, 0);
      const key = makeLabel(d.k, { fontSize: 30, height: 0.28, color: '#eaf3ff', weight: 800 });
      key.center.set(1, 0.5);
      key.position.set(-2.6, 0, 0);
      g.add(key);

      const mkSide = (txt, color, x) => {
        const hex = '#' + new THREE.Color(color).getHexString();
        const box = new THREE.Mesh(
          new THREE.PlaneGeometry(3.5, 0.72),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12 })
        );
        box.position.set(x, 0, -0.02);
        g.add(box);
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.PlaneGeometry(3.5, 0.72)),
          new THREE.LineBasicMaterial({ color, transparent: true })
        );
        wire.position.copy(box.position);
        g.add(wire);
        const lb = makeLabel(txt, { fontSize: 23, height: 0.2, color: hex, weight: 700 });
        lb.position.set(x, 0, 0.02);
        g.add(lb);
        return { box, wire, lb };
      };
      const left = mkSide(d.a, 0x8ab6ff, -0.55);
      const right = mkSide(d.b, 0xff8fa3, 3.35);

      this.gDiff.add(g);
      return { g, key, left, right };
    });

    this.diffNote = makeLabel('「不拡散」がそのままでは効かない。ただし計算資源だけは物理的に希少。', {
      fontSize: 27,
      height: 0.23,
      color: '#ffd166',
      weight: 800,
    });
    this.diffNote.position.set(0.5, -3.3, 0);
    this.gDiff.add(this.diffNote);

    // ══════ 3: 3つの輪
    this.gRings = new THREE.Group();
    this.gRings.visible = false;
    this.root.add(this.gRings);

    const rings = [
      { t: '企業の自主枠組み', s: '速いが、拘束力がない', r: 1.5, c: 0x4ecdc4, a: 0.95 },
      { t: '国家の法', s: '効くが、国ごとにバラバラ', r: 2.75, c: 0xffd166, a: 0.7 },
      { t: '国際的な調整', s: 'いちばん必要で、いちばん弱い', r: 4.0, c: 0xff8fa3, a: 0.32 },
    ];
    this.rings = rings.map((R, i) => {
      const hex = '#' + new THREE.Color(R.c).getHexString();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(R.r, 0.045, 8, 96),
        new THREE.MeshBasicMaterial({ color: R.c, transparent: true })
      );
      this.gRings.add(ring);
      const lb = makeLabel(R.t, { fontSize: 28, height: 0.26, color: hex, weight: 800 });
      lb.position.set(0, R.r + 0.3, 0);
      this.gRings.add(lb);
      const sb = makeLabel(R.s, { fontSize: 21, height: 0.18, color: '#9fb0d0', weight: 600 });
      sb.position.set(0, R.r + 0.03, 0);
      this.gRings.add(sb);
      return { ring, lb, sb, def: R };
    });

    this.ringNote = makeLabel('いちばん変わりにくいのは技術ではなく、構造のほう。', {
      fontSize: 32,
      height: 0.28,
      color: '#eaf3ff',
      weight: 800,
    });
    this.ringNote.position.set(0, -4.6, 0);
    this.gRings.add(this.ringNote);
  }

  update(p, bf, dt, time) {
    const grow = easeOut(this.enter(dt));
    // 署名の集まりも時間で立ち上げる（ビート0はスクロールが止まっているため）
    const sign = easeOut(clamp(grow * 1.7 - 0.6));
    const tl = ease(seg(bf, 0.6, 1.0)) * (1 - ease(seg(bf, 1.75, 2.0)));
    const df = ease(seg(bf, 1.6, 2.0)) * (1 - ease(seg(bf, 2.68, 2.9)));
    const rg = ease(seg(bf, 2.7, 3.0));

    // ── 曲線と署名
    this.gCurve.visible = bf < 1.05;
    if (this.gCurve.visible) {
      const a = 1 - ease(seg(bf, 0.75, 1.0));
      this.curve.geometry.setDrawRange(0, Math.max(2, Math.floor(this.curvePts.length * grow)));
      this.curve.material.opacity = a * 0.95;
      this.axes.material.opacity = a * 0.6;
      this.axLabels.forEach((s) => (s.material.opacity = a * 0.8));
      this.curveTitle.material.opacity = a * clamp(grow * 2);
      this.curveSub.material.opacity = a * clamp(sign * 1.6 - 0.35);

      const pos = this.signers.geometry.attributes.position.array;
      for (let i = 0; i < SIGNERS; i++) {
        const sd = this.signSeed[i];
        const t = easeOut(clamp(sign * 2.2 - sd.d * 1.2));
        pos[i * 3] = lerp(sd.fx, sd.tx, t);
        pos[i * 3 + 1] = lerp(sd.fy, sd.ty, t) + Math.sin(time * 1.1 + sd.d * 9) * 0.04;
        pos[i * 3 + 2] = (1 - t) * 3;
      }
      this.signers.geometry.attributes.position.needsUpdate = true;
      this.signers.material.opacity = a * sign * 0.9;
    }

    // ── 2本の年表
    this.gTime.visible = tl > 0.01;
    if (this.gTime.visible) {
      [this.tlNuke, this.tlAI].forEach((t2, k) => {
        t2.line.material.opacity = tl * 0.7;
        t2.ttl.material.opacity = tl;
        t2.nodes.forEach((n, i) => {
          const v = clamp(tl * 2.6 - k * 0.25 - i * 0.22);
          n.dot.material.opacity = v;
          n.yr.material.opacity = v;
          n.tx.material.opacity = v * 0.92;
          n.dot.scale.setScalar(0.9 + Math.sin(time * 2 + i) * 0.12 * v);
        });
      });
      this.tlLinks.material.opacity = clamp(tl * 2.4 - 0.5) * 0.8;
      this.tlNote.material.opacity = clamp(tl * 2.4 - 0.35);
    }

    // ── 相違点
    this.gDiff.visible = df > 0.01;
    if (this.gDiff.visible) {
      this.diffs.forEach((d, i) => {
        const t = easeOut(clamp(df * 2.8 - i * 0.32));
        d.key.material.opacity = t;
        [d.left, d.right].forEach((s, k) => {
          s.box.material.opacity = t * 0.12;
          s.wire.material.opacity = t * 0.75;
          s.lb.material.opacity = t;
        });
        d.g.position.x = lerp(-0.8, 0, t);
      });
      this.diffNote.material.opacity = clamp(df * 1.9 - 0.8);
    }

    // ── 3つの輪
    this.gRings.visible = rg > 0.01;
    if (this.gRings.visible) {
      this.rings.forEach((R, i) => {
        const t = easeOut(clamp(rg * 2.6 - i * 0.35));
        R.ring.material.opacity = t * R.def.a;
        R.lb.material.opacity = t * (0.45 + R.def.a * 0.55);
        R.sb.material.opacity = t * (0.4 + R.def.a * 0.5);
        R.ring.rotation.z = time * 0.08 * (i % 2 ? -1 : 1);
        R.ring.scale.setScalar(0.85 + t * 0.15);
      });
      this.ringNote.material.opacity = clamp(rg * 2 - 1.0);
      this.gRings.rotation.x = 0.42;
      this.gRings.position.y = 0.8;
    }

    this.camera.position.set(0, 0.2, rg > 0.01 ? lerp(12.5, 13.6, rg) : 12);
    this.camera.lookAt(0, rg > 0.01 ? 0.4 : 0.1, 0);
  }
}
