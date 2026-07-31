import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, inAt, outAt } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const SLOTS = ['重み', '学習コード', '学習データ'];

const TIERS = [
  {
    id: 'closed',
    name: 'クローズド',
    sub: 'GPT / Claude / Gemini',
    color: 0xff6b6b,
    x: -2.9,
    open: [false, false, false],
    pro: '安全対策を集中管理\n問題が起きたら止められる',
    con: '中身を検証できない\n価格と提供条件を握られる',
  },
  {
    id: 'weights',
    name: 'オープンウェイト',
    sub: 'Llama / DeepSeek / Qwen / Kimi',
    color: 0xffd166,
    x: 0.5,
    open: [true, false, false],
    pro: '自社運用でデータを外に出さない\n改変でき、価格が下がる',
    con: '一度配ったら取り消せない\n安全装置を外せてしまう',
  },
  {
    id: 'source',
    name: 'オープンソース',
    sub: 'OLMo など少数',
    color: 0x4ecdc4,
    x: 3.4,
    open: [true, true, true],
    pro: '科学として再現・検証できる',
    con: '全部公開する動機が乏しい',
  },
];

export default class OpennessScene extends BaseScene {
  build() {
    this.camera.position.set(0, 0.4, 12);

    // ══════ 3つの段階
    this.tiers = TIERS.map((T) => {
      const g = new THREE.Group();
      g.position.set(T.x, 0, 0);
      const hex = '#' + new THREE.Color(T.color).getHexString();

      const name = makeLabel(T.name, { fontSize: 40, height: 0.4, color: hex, weight: 800 });
      name.position.set(0, 2.35, 0);
      g.add(name);
      const sub = makeLabel(T.sub, { fontSize: 22, height: 0.19, color: '#9fb0d0', weight: 600 });
      sub.position.set(0, 1.98, 0);
      g.add(sub);

      // 3つのスロット：公開されているものは中身が詰まっている
      const slots = SLOTS.map((s, i) => {
        const y = 1.25 - i * 0.85;
        const isOpen = T.open[i];
        const geo = new THREE.BoxGeometry(2.3, 0.62, 1.0);
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({
            color: isOpen ? T.color : 0x1a2438,
            transparent: true,
            opacity: 0,
          })
        );
        mesh.position.y = y;
        g.add(mesh);
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: isOpen ? T.color : 0x51617f,
            transparent: true,
            opacity: 0,
          })
        );
        wire.position.y = y;
        g.add(wire);
        const lb = makeLabel(isOpen ? s : s + '  ✕', {
          fontSize: 26,
          height: 0.23,
          color: isOpen ? '#0a1018' : '#66799a',
          weight: 800,
        });
        lb.position.set(0, y, 0.55);
        g.add(lb);
        return { mesh, wire, lb, isOpen };
      });

      // 長所・短所
      const pro = makeLabel('＋ ' + T.pro, {
        fontSize: 22,
        height: 0.36,
        color: '#a9e6a0',
        weight: 700,
        lineGap: 1.3,
      });
      pro.position.set(0, -1.65, 0);
      pro.material.opacity = 0;
      g.add(pro);
      const con = makeLabel('− ' + T.con, {
        fontSize: 22,
        height: 0.36,
        color: '#ff9aa5',
        weight: 700,
        lineGap: 1.3,
      });
      con.position.set(0, -2.25, 0);
      con.material.opacity = 0;
      g.add(con);

      this.root.add(g);
      return { g, name, sub, slots, pro, con, def: T };
    });

    this.tierNote = makeLabel('「オープンソースAI」と呼ばれるものの多くは、実際にはオープンウェイト', {
      fontSize: 28,
      height: 0.24,
      color: '#ffd166',
      weight: 800,
    });
    this.tierNote.position.set(0, 3.15, 0.5);
    this.tierNote.material.opacity = 0;
    this.root.add(this.tierNote);

    // ══════ 2つのリスクの綱引き
    this.gDebate = new THREE.Group();
    this.gDebate.visible = false;
    this.root.add(this.gDebate);

    this.beam = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 0.11, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xcfe0f7, transparent: true })
    );
    this.gDebate.add(this.beam);
    this.fulcrum = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 0.8, 4),
      new THREE.MeshBasicMaterial({ color: 0x51617f, transparent: true })
    );
    this.fulcrum.position.y = -0.55;
    this.gDebate.add(this.fulcrum);

    const mkPan = (text, sub, color, sign) => {
      const g = new THREE.Group();
      const hex = '#' + new THREE.Color(color).getHexString();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 1.15, 1.0),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 })
      );
      g.add(box);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(2.5, 1.15, 1.0)),
        new THREE.LineBasicMaterial({ color, transparent: true })
      );
      g.add(wire);
      const lb = makeLabel(text, { fontSize: 32, height: 0.3, color: hex, weight: 800 });
      lb.position.set(0, 0.18, 0.55);
      g.add(lb);
      const sb = makeLabel(sub, {
        fontSize: 21,
        height: 0.32,
        color: '#c3d3ee',
        weight: 600,
        lineGap: 1.25,
      });
      sb.position.set(0, -0.28, 0.55);
      g.add(sb);
      g.userData = { box, wire, lb, sb, sign };
      this.gDebate.add(g);
      return g;
    };
    this.panL = mkPan('拡散リスク', '悪用できる\n配ったら取り消せない', 0xff6b6b, -1);
    this.panR = mkPan('集中リスク', '少数の企業に\n能力と判断が集まる', 0x8ab6ff, 1);

    this.debateTag = makeLabel('どちらも本物のリスク。だから決着しない。', {
      fontSize: 32,
      height: 0.28,
      color: '#eaf3ff',
      weight: 800,
    });
    this.debateTag.position.set(0, 2.5, 0);
    this.gDebate.add(this.debateTag);

    this.signTag = makeLabel('2026-07：230社超が広範な規制に反対する書簡へ署名', {
      fontSize: 26,
      height: 0.22,
      color: '#ffd166',
      weight: 700,
    });
    this.signTag.position.set(0, -2.4, 0);
    this.gDebate.add(this.signTag);

    // ══════ 実務での組み合わせ
    this.gMix = new THREE.Group();
    this.gMix.visible = false;
    this.root.add(this.gMix);

    const hub = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 1),
      new THREE.MeshBasicMaterial({ color: 0xeaf3ff, transparent: true, wireframe: true })
    );
    hub.position.set(0, 1.5, 0);
    this.gMix.add(hub);
    this.hub = hub;
    const hubTag = makeLabel('実務のタスク', {
      fontSize: 28,
      height: 0.25,
      color: '#eaf3ff',
      weight: 800,
    });
    hubTag.position.set(0, 2.3, 0);
    this.gMix.add(hubTag);
    this.hubTag = hubTag;

    const routes = [
      { t: '難しい判断・少量', d: 'クローズドAPI', c: 0xff6b6b, x: -3.2 },
      { t: '定型処理・大量', d: '自社ホストの小型モデル', c: 0xffd166, x: 3.2 },
    ];
    this.routes = routes.map((r) => {
      const g = new THREE.Group();
      g.position.set(r.x, -1.5, 0);
      const hex = '#' + new THREE.Color(r.c).getHexString();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.1, 0.9),
        new THREE.MeshBasicMaterial({ color: r.c, transparent: true, opacity: 0.18 })
      );
      g.add(box);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(3.2, 1.1, 0.9)),
        new THREE.LineBasicMaterial({ color: r.c, transparent: true })
      );
      g.add(wire);
      const lb = makeLabel(r.d, { fontSize: 28, height: 0.26, color: hex, weight: 800 });
      lb.position.set(0, 0.1, 0.5);
      g.add(lb);
      const sb = makeLabel(r.t, { fontSize: 22, height: 0.19, color: '#c3d3ee', weight: 600 });
      sb.position.set(0, -0.28, 0.5);
      g.add(sb);

      const lineG = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 1.5, 0),
        new THREE.Vector3(r.x, -0.95, 0),
      ]);
      const line = new THREE.Line(
        lineG,
        new THREE.LineBasicMaterial({ color: r.c, transparent: true, opacity: 0 })
      );
      this.gMix.add(line);
      this.gMix.add(g);
      return { g, box, wire, lb, sb, line };
    });
  }

  update(p, bf, dt, time) {
    const build = easeOut(this.enter(dt));
    const pros = inAt(bf, 1) * (1 - outAt(bf, 2));
    const tierOut = outAt(bf, 2);
    const debate = inAt(bf, 2) * (1 - outAt(bf, 3));
    const mix = inAt(bf, 3);

    // ── 3段階
    this.root.children.forEach(() => {});
    this.tiers.forEach((tr, ti) => {
      const t = easeOut(clamp(build * 3.6 - ti * 0.7));
      const a = t * (1 - tierOut);
      tr.g.visible = a > 0.01;
      tr.name.material.opacity = a;
      tr.sub.material.opacity = a * 0.9;
      tr.slots.forEach((s, i) => {
        const st = clamp(build * 5 - ti * 0.7 - i * 0.5) * (1 - tierOut);
        s.mesh.material.opacity = st * (s.isOpen ? 0.75 : 0.35);
        s.wire.material.opacity = st * (s.isOpen ? 0.95 : 0.5);
        s.lb.material.opacity = st * (s.isOpen ? 1 : 0.75);
      });
      tr.pro.material.opacity = pros;
      tr.con.material.opacity = pros;
      tr.g.position.y = lerp(-0.6, 0, t) + (pros > 0 ? 0.35 : 0);
      tr.g.rotation.y = Math.sin(time * 0.25 + ti) * 0.05;
    });
    this.tierNote.material.opacity = clamp(build * 2 - 0.9) * (1 - tierOut);

    // ── 綱引き
    this.gDebate.visible = debate > 0.01;
    if (this.gDebate.visible) {
      const tilt = Math.sin(time * 0.85) * 0.13;
      this.beam.rotation.z = tilt;
      this.beam.material.opacity = debate * 0.9;
      this.fulcrum.material.opacity = debate * 0.8;
      [this.panL, this.panR].forEach((pn) => {
        const s = pn.userData.sign;
        pn.position.set(s * 3.0, Math.sin(tilt) * 3.0 * s - 1.05, 0);
        pn.userData.box.material.opacity = debate * 0.18;
        pn.userData.wire.material.opacity = debate * 0.85;
        pn.userData.lb.material.opacity = debate;
        pn.userData.sb.material.opacity = debate * 0.9;
      });
      this.debateTag.material.opacity = debate;
      this.signTag.material.opacity = clamp(debate * 1.8 - 0.6);
      this.gDebate.position.y = 0.2;
    }

    // ── 組み合わせ
    this.gMix.visible = mix > 0.01;
    if (this.gMix.visible) {
      this.hub.material.opacity = mix * 0.9;
      this.hub.rotation.y = time * 0.4;
      this.hubTag.material.opacity = mix;
      this.routes.forEach((r, i) => {
        const t = clamp(mix * 2.4 - i * 0.3);
        r.box.material.opacity = t * 0.18;
        r.wire.material.opacity = t * 0.85;
        r.lb.material.opacity = t;
        r.sb.material.opacity = t * 0.9;
        r.line.material.opacity = t * (0.4 + Math.sin(time * 2.2 + i) * 0.2);
      });
    }

    this.camera.position.set(0, 0.35, lerp(12.2, 11.2, Math.max(debate, mix)));
    this.camera.lookAt(0, 0.1, 0);
  }
}
