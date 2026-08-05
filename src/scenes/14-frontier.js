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
     * ══════ 0: 何を求めたのか（車の運転で言う）
     *
     * 声明の要旨はカードの本文にある。同じ文章を3D側に並べても意味がない。
     * 図の役目は、文章だと平板になる「操作と結果の関係」を動かして見せること。
     *   アクセルの踏み加減 → タイヤの回転 → 速度計、が連動して上下する。
     *   これが求めているもの。ただしそのペダルはまだ無いので破線で描く。
     *   ブレーキを踏めば確かに止まるが、求めているのはそれではない。
     * 署名した人数は補足なので、下端に小さな群衆として置くだけにする。
     */
    this.gVoice = new THREE.Group();
    this.gVoice.position.set(0.7, 0.1, 0);
    this.root.add(this.gVoice);

    const dashMat = (color, dash = 0.11) =>
      new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity: 0,
        dashSize: dash,
        gapSize: dash * 0.8,
      });
    const solidMat = (color) =>
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });

    /** 四角の枠。破線にすると「まだ無いもの」を表せる。 */
    const rect = (w, h, x, y, mat) => {
      const hw = w / 2;
      const hh = h / 2;
      const pts = [
        [-hw, -hh], [hw, -hh], [hw, -hh], [hw, hh],
        [hw, hh], [-hw, hh], [-hw, hh], [-hw, -hh],
      ].flatMap(([px, py]) => [px + x, py + y, 0]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const l = new THREE.LineSegments(g, mat);
      l.computeLineDistances();
      this.gVoice.add(l);
      return l;
    };
    const arrow = (x1, y1, x2, y2, color) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const h = 0.12;
      const pts = [
        x1, y1, 0, x2, y2, 0,
        x2, y2, 0, x2 - ux * h + uy * h * 0.6, y2 - uy * h - ux * h * 0.6, 0,
        x2, y2, 0, x2 - ux * h - uy * h * 0.6, y2 - uy * h + ux * h * 0.6, 0,
      ];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const l = new THREE.LineSegments(g, solidMat(color));
      this.gVoice.add(l);
      return l;
    };
    const tag = (text, x, y, color, size, weight = 700) => {
      const s = makeLabel(text, {
        fontSize: size,
        height: (size / 24) * 0.21 * (text.includes('\n') ? 2.3 : 1),
        color,
        weight,
        lineGap: 1.3,
      });
      s.position.set(x, y, 0.02);
      s.material.opacity = 0;
      this.gVoice.add(s);
      return s;
    };

    // ══ 速度計
    const GX = -2.3;
    const GY = 1.75;
    const GR = 1.0;
    this.GAUGE = { GX, GY, GR };
    const A0 = (200 * Math.PI) / 180;
    const A1 = (-20 * Math.PI) / 180;
    this.gaugeArcs = [
      { from: 0.0, to: 0.42, c: 0x4ecdc4 },
      { from: 0.42, to: 0.74, c: 0xffd166 },
      { from: 0.74, to: 1.0, c: 0xff6b6b },
    ].map((z) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const a = lerp(A0, A1, lerp(z.from, z.to, i / 24));
        pts.push(new THREE.Vector3(GX + Math.cos(a) * GR, GY + Math.sin(a) * GR, 0));
      }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), solidMat(z.c));
      this.gVoice.add(l);
      return l;
    });
    const tk = [];
    for (let i = 0; i <= 11; i++) {
      const a = lerp(A0, A1, i / 11);
      const r0 = GR - (i % 2 ? 0.07 : 0.13);
      tk.push(
        GX + Math.cos(a) * r0, GY + Math.sin(a) * r0, 0,
        GX + Math.cos(a) * (GR - 0.01), GY + Math.sin(a) * (GR - 0.01), 0
      );
    }
    const tkG = new THREE.BufferGeometry();
    tkG.setAttribute('position', new THREE.Float32BufferAttribute(tk, 3));
    this.gaugeTicks = new THREE.LineSegments(tkG, solidMat(0x6b7b9c));
    this.gVoice.add(this.gaugeTicks);

    const ndG = new THREE.BufferGeometry();
    ndG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this.needle = new THREE.Line(ndG, solidMat(0xff6b6b));
    this.gVoice.add(this.needle);
    this.needleHub = new THREE.Mesh(
      new THREE.CircleGeometry(0.07, 16),
      new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0 })
    );
    this.needleHub.position.set(GX, GY, 0.01);
    this.gVoice.add(this.needleHub);
    this.gaugeTag = tag('AI開発の速度', GX, GY - 0.36, '#eaf3ff', 24, 800);

    // ══ コンセプトカー（側面のシルエット）
    const CX = 1.95;
    const CY = 1.9;
    this.CAR = { CX, CY };
    const body = new THREE.Shape();
    // 低い着座。前後のホイールアーチで車輪を抱え込むと、浮いて見えなくなる。
    body.moveTo(-1.56, -0.2);
    body.lineTo(-1.24, -0.2);
    body.absarc(-0.88, -0.2, 0.36, Math.PI, 0, true);
    body.lineTo(0.5, -0.2);
    body.absarc(0.9, -0.2, 0.36, Math.PI, 0, true);
    body.lineTo(1.52, -0.2);
    body.quadraticCurveTo(1.64, -0.04, 1.56, 0.14);
    body.quadraticCurveTo(1.3, 0.42, 0.82, 0.56);
    body.quadraticCurveTo(0.28, 0.7, -0.2, 0.5);
    body.quadraticCurveTo(-0.62, 0.33, -1.02, 0.24);
    body.lineTo(-1.4, 0.16);
    body.quadraticCurveTo(-1.62, 0.08, -1.56, -0.2);
    body.closePath();
    this.carFill = new THREE.Mesh(
      new THREE.ShapeGeometry(body),
      new THREE.MeshBasicMaterial({ color: 0x14304a, transparent: true, opacity: 0 })
    );
    this.carLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(body.getPoints(64)),
      solidMat(0x6fd3ff)
    );
    // 未来的に見せるための光る一本線（グラスハウスの下端）
    const glass = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      glass.push(new THREE.Vector3(lerp(-0.3, 1.05, t), lerp(0.26, 0.44, Math.sin(t * Math.PI * 0.75)), 0.01));
    }
    this.carGlass = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(glass),
      solidMat(0x9fe8e2)
    );
    // 前端の光るライトバー。未来的なコンセプトカーらしさはここで出す。
    const lampG = new THREE.BufferGeometry();
    lampG.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1.52, 0.02, 0.02, -1.16, 0.09, 0.02], 3)
    );
    this.carLamp = new THREE.Line(lampG, solidMat(0xdff6f3));

    this.gCar = new THREE.Group();
    this.gCar.position.set(CX, CY, 0);
    this.gCar.add(this.carFill, this.carLine, this.carGlass, this.carLamp);
    this.gVoice.add(this.gCar);

    // タイヤ。回転が見えるようスポークを入れる。
    this.wheels = [-0.88, 0.9].map((wx) => {
      const g = new THREE.Group();
      g.position.set(wx, -0.2, 0.02);
      const rimPts = [];
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        rimPts.push(new THREE.Vector3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0));
      }
      const rim = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(rimPts),
        solidMat(0x9fb6dd)
      );
      g.add(rim);
      const sp = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        sp.push(0, 0, 0, Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0);
      }
      const spG = new THREE.BufferGeometry();
      spG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      const spokes = new THREE.LineSegments(spG, solidMat(0x6fd3ff));
      g.add(spokes);
      this.gCar.add(g);
      return { g, rim, spokes };
    });

    const roadY = CY - 0.5;
    const rdG = new THREE.BufferGeometry();
    rdG.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([CX - 2.3, roadY, 0, CX + 2.2, roadY, 0], 3)
    );
    this.road = new THREE.Line(rdG, solidMat(0x3a4d70));
    this.gVoice.add(this.road);

    // 速いときに後ろへ流れる線
    const mlPts = [];
    for (let i = 0; i < 4; i++) {
      const y = CY - 0.1 + i * 0.16;
      mlPts.push(CX - 2.15 - i * 0.1, y, 0, CX - 1.6 - i * 0.1, y, 0);
    }
    const mlG = new THREE.BufferGeometry();
    mlG.setAttribute('position', new THREE.Float32BufferAttribute(mlPts, 3));
    this.motion = new THREE.LineSegments(mlG, solidMat(0x9fe8e2));
    this.gVoice.add(this.motion);

    // ブレーキで止まるときのスリップ痕
    const skG = new THREE.BufferGeometry();
    skG.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [CX - 1.9, roadY - 0.03, 0, CX - 0.9, roadY - 0.03, 0, CX - 0.2, roadY - 0.03, 0, CX + 0.85, roadY - 0.03, 0],
        3
      )
    );
    this.skid = new THREE.LineSegments(skG, solidMat(0xff8fa3));
    this.gVoice.add(this.skid);

    /*
     * ペダル。支点は右端（かかと側）にあり、踏むとつま先側が下がる。
     * ローカルでは -x 方向へ板を伸ばし、群ごと回す。
     */
    const P_L = 0.62; //  板の長さ
    const P_W = 0.15; //  板の厚み
    const FLOOR_Y = -1.05;
    const PIV_Y = FLOOR_Y + 0.12; // 支点は床のすぐ上（かかと側）
    this.PED_GEO = { P_L, P_W, FLOOR_Y, PIV_Y };

    const pedal = (x, color, ghost) => {
      const g = new THREE.Group();
      g.position.set(x, PIV_Y, 0);
      const r = 0.045;
      const sh = new THREE.Shape();
      sh.moveTo(0, -P_W / 2);
      sh.lineTo(-P_L + r, -P_W / 2);
      sh.quadraticCurveTo(-P_L, -P_W / 2, -P_L, -P_W / 2 + r);
      sh.lineTo(-P_L, P_W / 2 - r);
      sh.quadraticCurveTo(-P_L, P_W / 2, -P_L + r, P_W / 2);
      sh.lineTo(0, P_W / 2);
      sh.closePath();
      const fill = new THREE.Mesh(
        new THREE.ShapeGeometry(sh),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 })
      );
      g.add(fill);
      const outline = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(sh.getPoints(18)),
        ghost ? dashMat(color, 0.08) : solidMat(color)
      );
      outline.computeLineDistances();
      g.add(outline);
      // 踏み面の滑り止め
      const tr = [];
      for (let i = 1; i <= 4; i++) {
        const px = -P_L * (0.14 + i * 0.17);
        tr.push(px, -P_W / 2 + 0.03, 0.01, px, P_W / 2 - 0.03, 0.01);
      }
      const trG = new THREE.BufferGeometry();
      trG.setAttribute('position', new THREE.Float32BufferAttribute(tr, 3));
      const tread = new THREE.LineSegments(trG, solidMat(color));
      g.add(tread);
      // 支点
      const hinge = new THREE.Mesh(
        new THREE.CircleGeometry(0.05, 12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 })
      );
      g.add(hinge);
      // 支点を床につなぐ台座
      const post = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.02, -0.12, 0),
        ]),
        solidMat(color)
      );
      this.gVoice.add(g);
      g.add(post);
      const floorG = new THREE.BufferGeometry();
      floorG.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([x - 0.82, FLOOR_Y, 0, x + 0.28, FLOOR_Y, 0], 3)
      );
      const floor = new THREE.Line(floorG, solidMat(0x53627e));
      this.gVoice.add(floor);
      return { g, fill, outline, tread, hinge, post, floor };
    };

    const AX = 0.95;
    const BX = 3.15;
    this.PED = { AX, BX };
    // アクセルは青（まだ無いので破線）、ブレーキは赤
    this.accel = pedal(AX, 0x5b9dff, true);
    this.brake = pedal(BX, 0xff6b6b, false);

    /*
     * 踏んでいる足。1足だけ用意し、アクセルとブレーキの間を踏み替えさせる。
     * 「踏み加減」も「踏み替え」も、足があると一目で伝わる。
     */
    const shoe = new THREE.Shape();
    shoe.moveTo(-0.36, 0);
    shoe.quadraticCurveTo(-0.4, 0.11, -0.26, 0.14);
    shoe.lineTo(0.0, 0.18);
    shoe.quadraticCurveTo(0.13, 0.21, 0.17, 0.31);
    shoe.lineTo(0.27, 0.58);
    shoe.lineTo(0.47, 0.51);
    shoe.lineTo(0.36, 0.21);
    shoe.quadraticCurveTo(0.33, 0.06, 0.31, 0);
    shoe.closePath();
    this.shoe = new THREE.Group();
    this.shoeFill = new THREE.Mesh(
      new THREE.ShapeGeometry(shoe),
      new THREE.MeshBasicMaterial({ color: 0x8fa4c6, transparent: true, opacity: 0 })
    );
    this.shoeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(shoe.getPoints(28)),
      solidMat(0xdce8ff)
    );
    this.shoe.add(this.shoeFill, this.shoeLine);
    this.shoe.scale.setScalar(0.82);
    this.gVoice.add(this.shoe);

    /*
     * 止まったあとにブレーキ側へ出す✕。
     * 停止から1秒おき、1秒のあいだに2回点滅してから点灯させる。
     */
    this.bigX = new THREE.Group();
    this.bigXParts = [-1, 1].map((sgn) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.075),
        new THREE.MeshBasicMaterial({ color: 0xff4d6a, transparent: true, opacity: 0 })
      );
      m.rotation.z = (sgn * Math.PI) / 4;
      this.bigX.add(m);
      return m;
    });
    this.bigX.position.set(BX - P_L * 0.5, PIV_Y + 0.02, 0.08);
    this.gVoice.add(this.bigX);

    this.accelTag = tag('アクセル', AX - 0.3, -1.72, '#5b9dff', 23, 800);
    this.accelNote = tag('○ 踏み加減で速度を上下できる状態', AX - 0.3, -2.05, '#5b9dff', 19, 700);
    this.accelGhost = tag('（このペダルはまだ無い）', AX - 0.3, -2.35, '#9fb6dd', 17, 600);
    this.brakeTag = tag('ブレーキ', BX - 0.3, -1.72, '#ff8fa3', 23, 800);
    this.brakeNote = tag('✕ いますぐ止める — 求めていない', BX - 0.3, -2.05, '#ff8fa3', 19, 700);

    // ペダルを作るのに要る2つの道具
    this.tools = [];
    this.toolTags = [];
    [
      { t: '技術の道具', s: '能力評価・監査・停止手順', y: -0.5 },
      { t: '統治の道具', s: '合意・条約・査察の枠組み', y: -1.24 },
    ].forEach((d) => {
      this.tools.push(rect(2.1, 0.56, GX, d.y, dashMat(0x4ecdc4)));
      this.toolTags.push(tag(d.t, GX, d.y + 0.11, '#dff6f3', 19, 800));
      this.toolTags.push(tag(d.s, GX, d.y - 0.16, '#9fb6dd', 14, 600));
    });
    this.tools.push(arrow(GX + 1.12, -0.86, AX - 1.0, -0.72, 0x4ecdc4));
    this.toolsTag = tag('この2つを国際的に整えるのが要求', GX, -1.78, '#4ecdc4', 19, 800);

    // 踏んだ結果がタイヤに出る、という対応だけ短い矢印で示す
    this.linkAccel = arrow(AX + 0.12, 0.06, CX - 0.88, CY - 0.82, 0x5b9dff);

    // ══ 署名者（補足）。整列ではなく、かたまりとして置く。
    const N_FIG = 150;
    const F_SC = 0.4;
    this.figPos = [];
    for (let i = 0; i < N_FIG; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      this.figPos.push({
        x: 0.35 + Math.cos(a) * r * 3.05,
        y: -3.05 + Math.sin(a) * r * 0.28 + (rand() - 0.5) * 0.06,
        s: 0.82 + rand() * 0.36,
        ph: rand() * Math.PI * 2,
      });
    }
    // 手前の人が上に来るよう、下にいる人ほど後に描く
    this.figPos.sort((p, q) => q.y - p.y);
    const figMat = () => new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true });
    this.figHead = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.05 * F_SC, 6, 5),
      figMat(),
      N_FIG
    );
    this.figBody = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.028 * F_SC, 0.062 * F_SC, 0.15 * F_SC, 5),
      figMat(),
      N_FIG
    );
    this.figHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.figBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gVoice.add(this.figHead, this.figBody);
    this._fm = new THREE.Matrix4();
    this._fv = new THREE.Vector3();
    this.F_SC = F_SC;

    this.crowdTag = tag(
      '署名 1,200人超 — 作っている当事者（1体＝10人）',
      0.35,
      -3.48,
      '#9fb6dd',
      15,
      600
    );

    this.voiceTitle = makeLabel('Pacing the Frontier（2026-07-28）', {
      fontSize: 33,
      height: 0.29,
      color: '#ffd166',
      weight: 800,
    });
    this.voiceTitle.position.set(0, 3.5, 0);
    this.gVoice.add(this.voiceTitle);

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

    // ── アクセルとブレーキ
    this.gVoice.visible = bf < 1.05;
    if (this.gVoice.visible) {
      const a = 1 - outAt(bf, 1);
      const { GX, GY, GR } = this.GAUGE;
      const { CX, CY } = this.CAR;
      this.voiceTitle.material.opacity = a * clamp(grow * 2);

      /*
       * 一巡させる。
       *   0.00-0.62 アクセルの踏み加減で加速・減速（求めているもの）
       *   0.68-1.00 ブレーキで止める（求めていないほう）
       * 速度はペダルに遅れて追従させる。即座に一致すると操作の実感が出ない。
       */
      const T = (time % 13) / 13;
      let press = 0; // アクセルの踏み込み 0..1
      let brake = 0;
      if (T < 0.62) {
        press = 0.5 + 0.44 * Math.sin((T / 0.62) * Math.PI * 3 - Math.PI / 2);
      } else if (T < 0.7) {
        press = lerp(0.5 + 0.44 * Math.sin(Math.PI * 3 - Math.PI / 2), 0, (T - 0.62) / 0.08);
      } else {
        brake = ease(clamp((T - 0.7) / 0.12));
      }
      const target = brake > 0 ? 0 : press;
      const k = brake > 0 ? 3.4 : 1.7;
      this._speed = lerp(this._speed ?? 0, target, Math.min(1, dt * k)) * clamp(grow * 1.4);
      const v = this._speed;

      // 針
      const deg = lerp(196, 12, v);
      const rad = (deg * Math.PI) / 180;
      const np = this.needle.geometry.attributes.position;
      np.setXYZ(0, GX, GY, 0);
      np.setXYZ(1, GX + Math.cos(rad) * (GR - 0.16), GY + Math.sin(rad) * (GR - 0.16), 0);
      np.needsUpdate = true;

      const g0 = a * clamp(grow * 2);
      this.needle.material.opacity = g0;
      this.needleHub.material.opacity = g0;
      this.gaugeArcs.forEach((l, i) => (l.material.opacity = a * clamp(grow * 3 - i * 0.35) * 0.9));
      this.gaugeTicks.material.opacity = g0 * 0.6;
      this.gaugeTag.material.opacity = g0;

      // 車とタイヤ
      this._wheelRot = (this._wheelRot ?? 0) + v * dt * 11;
      this.wheels.forEach((w) => (w.g.rotation.z = -this._wheelRot));
      this.gCar.position.set(CX + v * 0.16, CY + Math.sin(time * 2.2) * 0.012 * v, 0);
      // 減速中は前のめりになる
      this.gCar.rotation.z = -brake * 0.045 * (1 - v);
      const car = a * clamp(grow * 2.4 - 0.3);
      this.carFill.material.opacity = car * 0.85;
      this.carLine.material.opacity = car;
      this.carGlass.material.opacity = car * 0.7;
      this.carLamp.material.opacity = car * clamp(0.35 + v);
      this.wheels.forEach((w) => {
        w.rim.material.opacity = car * 0.9;
        w.spokes.material.opacity = car * 0.85;
      });
      this.road.material.opacity = car * 0.6;
      this.motion.material.opacity = car * clamp(v * 1.6 - 0.25) * 0.6;
      this.skid.material.opacity = car * brake * (1 - v) * 0.7;

      // ペダル。踏むほどつま先側が下がる。
      const { P_L, P_W, PIV_Y } = this.PED_GEO;
      /*
       * 板の向き。先端（つま先側）は、離した状態で北北西 ≒ 112.5°、
       * 踏みきると西北西 ≒ 157.5°。踏むほど寝て、先端は↙へ振り出される。
       * ローカルでは -x 向きに板を伸ばしているので、回転量は (向き - 180°)。
       */
      const angle = (u) => lerp(-1.178, -0.393, u);
      const aTheta = angle(press);
      const bTheta = angle(brake);
      this.accel.g.rotation.z = aTheta;
      this.brake.g.rotation.z = bTheta;
      const ask = clamp(sign * 1.8 - 0.3);
      const accelOn = a * ask * (brake > 0.1 ? 0.5 : 1);
      this.accel.fill.material.opacity = accelOn * 0.22;
      this.accel.outline.material.opacity = accelOn * 0.95;
      this.accel.tread.material.opacity = accelOn * 0.55;
      this.accel.hinge.material.opacity = accelOn * 0.9;
      this.accel.post.material.opacity = accelOn * 0.6;
      this.accel.floor.material.opacity = a * ask * 0.8;
      this.accelTag.material.opacity = accelOn;
      this.accelNote.material.opacity = accelOn;
      this.accelGhost.material.opacity = accelOn * 0.85;
      this.linkAccel.material.opacity = accelOn * 0.45;

      const brakeOn = a * ask * (brake > 0.1 ? 1 : 0.5);
      this.brake.fill.material.opacity = brakeOn * 0.4;
      this.brake.outline.material.opacity = brakeOn * 0.95;
      this.brake.tread.material.opacity = brakeOn * 0.6;
      this.brake.hinge.material.opacity = brakeOn * 0.85;
      this.brake.post.material.opacity = brakeOn * 0.6;
      this.brake.floor.material.opacity = a * ask * 0.8;
      this.brakeTag.material.opacity = brakeOn;
      this.brakeNote.material.opacity = a * ask * (brake > 0.1 ? 1 : 0.55);

      // 足はアクセルからブレーキへ踏み替える。移る間はいったん持ち上げる。
      const foot = brake > 0 ? 1 : clamp((T - 0.62) / 0.08);
      const { AX, BX } = this.PED;
      // 靴は板の上面に密着させる。離すと踏んでいるように見えない。
      const ox = -P_L * 0.45;
      const oy = P_W / 2 + 0.015;
      const fx = (bx, th) => bx + ox * Math.cos(th) - oy * Math.sin(th);
      const fy = (th) => PIV_Y + ox * Math.sin(th) + oy * Math.cos(th);
      this.shoe.position.set(
        lerp(fx(AX, aTheta), fx(BX, bTheta), foot),
        lerp(fy(aTheta), fy(bTheta), foot) + Math.sin(Math.PI * foot) * 0.34,
        0.04
      );
      this.shoe.rotation.z = lerp(aTheta, bTheta, foot);
      this.shoeFill.material.opacity = a * ask * 0.8;
      this.shoeLine.material.opacity = a * ask * 0.95;

      /*
       * 止まりきってから✕を出す。
       * 停止の1秒後に点き、1秒のあいだに2回点滅してから点灯したままにする。
       */
      if (brake > 0.5 && v < 0.02) {
        this._stoppedAt = this._stoppedAt ?? time;
      } else if (brake < 0.05) {
        this._stoppedAt = null;
      }
      let xOn = 0;
      if (this._stoppedAt != null) {
        const e = time - this._stoppedAt;
        if (e >= 2) xOn = 1;
        else if (e >= 1) xOn = Math.floor((e - 1) / 0.25) % 2 === 0 ? 1 : 0;
      }
      this.bigX.position.set(
        BX - P_L * 0.5 * Math.cos(bTheta),
        PIV_Y - P_L * 0.5 * Math.sin(bTheta) + 0.02,
        0.08
      );
      this.bigXParts.forEach((m) => (m.material.opacity = a * ask * xOn));

      const tools = clamp(sign * 2.2 - 1.0);
      this.tools.forEach((o) => (o.material.opacity = a * tools * 0.7));
      this.toolTags.forEach((s) => (s.material.opacity = a * tools));
      this.toolsTag.material.opacity = a * clamp(sign * 2.4 - 1.5);

      // 署名者。補足なので最後に、動きも小さく。
      const m = this._fm;
      const sc = this.F_SC;
      this.figPos.forEach((f, i) => {
        const t = easeOut(clamp(grow * 2.6 - (i / this.figPos.length) * 1.2)) * f.s;
        const bob = Math.sin(time * 1.2 + f.ph) * 0.004;
        this._fv.set(t, t, t);
        m.makeTranslation(f.x, f.y + 0.135 * sc * f.s + bob, 0);
        m.scale(this._fv);
        this.figHead.setMatrixAt(i, m);
        m.makeTranslation(f.x, f.y + bob, 0);
        m.scale(this._fv);
        this.figBody.setMatrixAt(i, m);
      });
      this.figHead.instanceMatrix.needsUpdate = true;
      this.figBody.instanceMatrix.needsUpdate = true;
      this.figHead.material.opacity = a * 0.8;
      this.figBody.material.opacity = a * 0.65;
      this.crowdTag.material.opacity = a * clamp(grow * 2.4 - 1.2) * 0.9;
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
