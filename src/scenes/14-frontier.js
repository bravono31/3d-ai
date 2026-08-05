import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng, inAt, outAt } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

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

    /*
     * ══════ 0: 誰が、何を求めたのか
     *
     * 伝えるのは2つ。
     *   ① 声を上げたのが、外部の批判者ではなく作っている当事者だったこと
     *   ② 求めたのが開発の停止ではなく、速度を落とせる「手段」の整備だったこと
     * ①は人の形で、②は声明の中身をそのまま並べて示す。
     * 点は本書では一貫してトークンやベクトルの意味で使っているので、人には使わない。
     */
    this.gVoice = new THREE.Group();
    this.gVoice.position.set(0.35, -0.55, 0);
    this.root.add(this.gVoice);

    this.voiceTitle = makeLabel('Pacing the Frontier（2026-07-28）', {
      fontSize: 36,
      height: 0.32,
      color: '#ffd166',
      weight: 800,
    });
    this.voiceTitle.position.set(0, 3.45, 0);
    this.gVoice.add(this.voiceTitle);

    // ── 署名した人たち。1体が10人。
    const PER_LAB = 30;
    const COLS = 5;
    const DX = 0.17;
    const DY = 0.33;
    const CROWD_X = -2.55;
    const CROWD_Y = 0.3;
    const PITCH = 1.05;
    const LABS = ['OpenAI', 'Anthropic', 'Google\nDeepMind', 'Meta'];
    const N_FIG = PER_LAB * LABS.length;

    this.figPos = [];
    LABS.forEach((name, k) => {
      const bx = CROWD_X + (k - (LABS.length - 1) / 2) * PITCH;
      for (let i = 0; i < PER_LAB; i++) {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        this.figPos.push({
          x: bx + (c - (COLS - 1) / 2) * DX,
          y: CROWD_Y + ((PER_LAB / COLS - 1) / 2 - r) * DY,
          // 隊列が機械的に見えないよう、ごく少しだけ散らす
          jx: (rand() - 0.5) * 0.035,
          ph: rand() * Math.PI * 2,
        });
      }
      const lb = makeLabel(name, {
        fontSize: 19,
        height: name.includes('\n') ? 0.3 : 0.17,
        color: '#9fb6dd',
        weight: 700,
        lineGap: 1.3,
      });
      lb.position.set(bx, CROWD_Y - 1.18, 0);
      lb.material.opacity = 0;
      this.gVoice.add(lb);
      this.figPos[this.figPos.length - 1].lab = lb;
    });
    this.labTags = LABS.map((_, k) => this.figPos[(k + 1) * PER_LAB - 1].lab);

    const figMat = () => new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true });
    this.figHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), figMat(), N_FIG);
    this.figBody = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.028, 0.058, 0.15, 6),
      figMat(),
      N_FIG
    );
    this.figHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.figBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gVoice.add(this.figHead);
    this.gVoice.add(this.figBody);
    this._fm = new THREE.Matrix4();

    this.crowdTag = makeLabel('署名したのは、作っているその人たち — 1,200人超（1体＝10人）', {
      fontSize: 24,
      height: 0.21,
      color: '#ffd166',
      weight: 800,
    });
    this.crowdTag.position.set(CROWD_X, CROWD_Y - 1.82, 0);
    this.crowdTag.material.opacity = 0;
    this.gVoice.add(this.crowdTag);

    // ── 声明の中身
    const PW = 3.95;
    const PH = 3.3;
    const PX = 2.45;
    const PY = 0.65;
    this.panelFill = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.MeshBasicMaterial({ color: 0x121a2e, transparent: true, opacity: 0 })
    );
    this.panelFill.position.set(PX, PY, -0.04);
    this.gVoice.add(this.panelFill);
    this.panelWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(PW, PH)),
      new THREE.LineBasicMaterial({ color: 0x4ecdc4, transparent: true, opacity: 0 })
    );
    this.panelWire.position.copy(this.panelFill.position);
    this.gVoice.add(this.panelWire);

    const LEFT = PX - PW / 2 + 0.22;
    /** 声明の中身は左揃えで積む。中央揃えだと箇条書きに見えない。 */
    const line = (text, y, color, size, weight = 700) => {
      const s = makeLabel(text, {
        fontSize: size,
        height: (size / 24) * 0.21 * (text.includes('\n') ? 2.3 : 1),
        color,
        weight,
        lineGap: 1.32,
      });
      s.center.set(0, 0.5);
      s.position.set(LEFT, y, 0);
      s.material.opacity = 0;
      this.gVoice.add(s);
      return s;
    };

    this.panelHead = line('この声明が求めたこと', PY + 1.32, '#eaf3ff', 26, 800);
    const divPts = [LEFT, PY + 1.05, 0, PX + PW / 2 - 0.22, PY + 1.05, 0];
    const divG = new THREE.BufferGeometry();
    divG.setAttribute('position', new THREE.Float32BufferAttribute(divPts, 3));
    this.panelDiv = new THREE.Line(
      divG,
      new THREE.LineBasicMaterial({ color: 0x4ecdc4, transparent: true, opacity: 0 })
    );
    this.gVoice.add(this.panelDiv);

    this.panelLines = [
      line('○  AI開発の速度を意図的に調整するための\n　　技術と統治の道具を、国際的に整えること', PY + 0.5, '#4ecdc4', 23),
      line('○  その整備を、米国政府が支援すること', PY - 0.3, '#4ecdc4', 23),
      line('✕  いますぐ開発を止めること — とは言っていない', PY - 0.95, '#7a8699', 23),
    ];
    this.panelNote = line(
      '背景にあるのは「AI研究そのものの自動化」への懸念',
      PY - 1.42,
      '#9fb6dd',
      19,
      600
    );

    // ── 人 → 声明 の矢印
    const ax0 = CROWD_X + 2.05;
    const ax1 = PX - PW / 2 - 0.12;
    const ay = CROWD_Y;
    const arrowPts = [ax0, ay, 0, ax1, ay, 0, ax1, ay, 0, ax1 - 0.16, ay + 0.1, 0, ax1, ay, 0, ax1 - 0.16, ay - 0.1, 0];
    const arG = new THREE.BufferGeometry();
    arG.setAttribute('position', new THREE.Float32BufferAttribute(arrowPts, 3));
    this.signArrow = new THREE.LineSegments(
      arG,
      new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0 })
    );
    this.gVoice.add(this.signArrow);
    this.signArrowTag = makeLabel('署名', {
      fontSize: 21,
      height: 0.19,
      color: '#ffd166',
      weight: 800,
    });
    this.signArrowTag.position.set((ax0 + ax1) / 2, ay + 0.22, 0);
    this.signArrowTag.material.opacity = 0;
    this.gVoice.add(this.signArrowTag);

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
    const tl = inAt(bf, 1) * (1 - outAt(bf, 2));
    const df = inAt(bf, 2) * (1 - outAt(bf, 3));
    const rg = inAt(bf, 3);

    // ── 内側からの声
    this.gVoice.visible = bf < 1.05;
    if (this.gVoice.visible) {
      const a = 1 - outAt(bf, 1);
      this.voiceTitle.material.opacity = a * clamp(grow * 2);

      /*
       * 人は InstancedMesh なので個別に濃さを変えられない。
       * 代わりに大きさで一人ずつ立ち上げ、そのあとは軽く揺らして生きている感じを出す。
       */
      const m = this._fm;
      this.figPos.forEach((f, i) => {
        const t = easeOut(clamp(grow * 2.6 - (i / this.figPos.length) * 1.4));
        const bob = Math.sin(time * 1.3 + f.ph) * 0.012;
        const x = f.x + f.jx;
        m.makeTranslation(x, f.y + 0.135 + bob, 0);
        m.scale(new THREE.Vector3(t, t, t));
        this.figHead.setMatrixAt(i, m);
        m.makeTranslation(x, f.y + bob, 0);
        m.scale(new THREE.Vector3(t, t, t));
        this.figBody.setMatrixAt(i, m);
      });
      this.figHead.instanceMatrix.needsUpdate = true;
      this.figBody.instanceMatrix.needsUpdate = true;
      this.figHead.material.opacity = a * 0.95;
      this.figBody.material.opacity = a * 0.8;
      this.labTags.forEach((s, k) => (s.material.opacity = a * clamp(grow * 3 - 0.6 - k * 0.15)));
      this.crowdTag.material.opacity = a * clamp(grow * 2.4 - 1.0);

      // 人が出そろってから、声明の中身を順に開く
      const panel = clamp(sign * 1.8 - 0.4);
      this.panelFill.material.opacity = a * panel * 0.75;
      this.panelWire.material.opacity = a * panel * 0.55;
      this.panelDiv.material.opacity = a * panel * 0.5;
      this.panelHead.material.opacity = a * panel;
      this.panelLines.forEach((s, i) => {
        s.material.opacity = a * clamp(sign * 2.4 - 0.9 - i * 0.45);
      });
      this.panelNote.material.opacity = a * clamp(sign * 2.4 - 2.2);
      this.signArrow.material.opacity = a * panel * 0.8;
      this.signArrowTag.material.opacity = a * panel;
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
