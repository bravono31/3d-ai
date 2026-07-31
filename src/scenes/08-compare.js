import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng, inAt, outAt } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const COLS = [
  {
    id: 'claude',
    name: 'Claude',
    maker: 'Anthropic',
    color: 0xd97757,
    x: -4.1,
    words: ['安全性研究から出発', '長文・エージェント', 'Constitutional AI', 'MCP を提唱'],
  },
  {
    id: 'gpt',
    name: 'GPT',
    maker: 'OpenAI',
    color: 0x7ee081,
    x: -1.37,
    words: ['最大の消費者リーチ', '最も広いモダリティ', 'エコシステム'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    maker: 'Google DeepMind',
    color: 0x5b9dff,
    x: 1.37,
    words: ['自社製品への統合', 'TPU で垂直統合', '超長文コンテキスト'],
  },
  {
    id: 'open',
    name: 'オープン\nウェイト',
    maker: 'DeepSeek / Qwen / Kimi / Llama',
    color: 0xa78bfa,
    x: 4.1,
    words: ['自社サーバーで動かせる', '圧倒的な低コスト', '重みを改変できる'],
    late: true,
  },
];

const TASKS = [
  { t: '長い文書・コードベース\n長時間の自律作業', to: 0 },
  { t: '幅広い汎用アシスタント\n画像・音声も', to: 1 },
  { t: 'Google製品との統合\n大量処理のコスト効率', to: 2 },
  { t: 'コスト最優先\n自社ホスティング', to: 3 },
];

const SCORES = ['71.2', '74.8', '76.5', '78.1', '79.9', '81.3', '83.0', '84.6'];
const RANKS = ['1位', '2位', '3位'];

export default class CompareScene extends BaseScene {
  build() {
    const rand = rng(555);
    this.camera.position.set(0, 0.4, 11.4);

    this.cols = COLS.map((c, ci) => {
      const g = new THREE.Group();
      g.position.set(c.x, 0, 0);
      const hex = '#' + new THREE.Color(c.color).getHexString();

      const h = 3.5;
      const geo = new THREE.BoxGeometry(1.75, h, 1.1);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.14 })
      );
      mesh.position.y = -1.1;
      g.add(mesh);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: c.color, transparent: true, opacity: 0.75 })
      );
      wire.position.y = -1.1;
      g.add(wire);

      const name = makeLabel(c.name, {
        fontSize: 52,
        height: c.name.includes('\n') ? 0.86 : 0.5,
        color: hex,
        weight: 800,
        lineGap: 1.15,
      });
      name.position.set(0, 0.95, 0.6);
      g.add(name);

      const maker = makeLabel(c.maker, {
        fontSize: 24,
        height: 0.2,
        color: '#9fb0d0',
        weight: 600,
      });
      maker.position.set(0, 0.52, 0.6);
      g.add(maker);

      const words = c.words.map((w, i) => {
        const s = makeLabel(w, { fontSize: 26, height: 0.22, color: '#dbe6f8', weight: 600 });
        s.position.set(0, -0.1 - i * 0.42, 0.6);
        s.material.opacity = 0;
        return s;
      });
      words.forEach((s) => g.add(s));

      // ベンチマーク数値（あらかじめ焼いておいて切り替えるだけ）
      const scoreGrp = new THREE.Group();
      scoreGrp.position.set(0, 2.35, 0.6);
      const scores = SCORES.map((s) => {
        const sp = makeLabel(s, { fontSize: 46, height: 0.4, color: hex, weight: 800 });
        sp.visible = false;
        scoreGrp.add(sp);
        return sp;
      });
      const ranks = RANKS.map((r) => {
        const sp = makeLabel(r, {
          fontSize: 26,
          height: 0.24,
          color: '#0a1018',
          bg: hex,
          border: hex,
          weight: 800,
        });
        sp.position.set(0, 0.4, 0);
        sp.visible = false;
        scoreGrp.add(sp);
        return sp;
      });
      g.add(scoreGrp);

      this.root.add(g);
      return { g, mesh, wire, name, maker, words, scoreGrp, scores, ranks, def: c, ci };
    });

    this.shuffleTag = makeLabel('順位は数か月で入れ替わる', {
      fontSize: 40,
      height: 0.36,
      color: '#ff8fa3',
      weight: 800,
    });
    this.shuffleTag.position.set(0, 3.35, 1.2);
    this.shuffleTag.material.opacity = 0;
    this.root.add(this.shuffleTag);

    this.pickTag = makeLabel('「どれが賢いか」ではなく「何に向くか」で選ぶ', {
      fontSize: 34,
      height: 0.3,
      color: '#4ecdc4',
      weight: 800,
    });
    this.pickTag.position.set(0, 3.3, 1.2);
    this.pickTag.material.opacity = 0;
    this.root.add(this.pickTag);

    // 用途のチップ（beat 2 で各列へ飛ぶ）
    this.tasks = TASKS.map((t, i) => {
      const col = COLS[t.to];
      const hex = '#' + new THREE.Color(col.color).getHexString();
      const s = makeLabel(t.t, {
        fontSize: 25,
        height: 0.44,
        color: '#0a1018',
        bg: hex,
        border: hex,
        weight: 700,
        lineGap: 1.2,
      });
      s.userData.aspect = s.scale.x / s.scale.y;
      s.userData.from = new THREE.Vector3(0, 2.9, 2.2);
      s.userData.to = new THREE.Vector3(col.x, 2.45, 1.0);
      s.material.opacity = 0;
      this.root.add(s);
      return s;
    });
  }

  update(p, bf, dt, time) {
    const rise = easeOut(this.enter(dt));
    const bench = inAt(bf, 1);
    const benchOut = outAt(bf, 2);
    const pick = inAt(bf, 2);

    const shuffling = bench * (1 - benchOut);
    // 順位をぐるぐる入れ替える（1.6秒ごとに巡回）
    const rot = Math.floor(time / 1.6) % 3;

    this.cols.forEach((c, i) => {
      const late = c.def.late ? pick : 1;
      const t = easeOut(clamp(rise * 4 - i * 0.7)) * late;
      c.g.position.y = lerp(-1.6, 0, t);
      c.mesh.material.opacity = t * 0.14;
      c.wire.material.opacity = t * 0.75;
      c.name.material.opacity = t;
      c.maker.material.opacity = t * 0.9;
      c.words.forEach((s, k) => {
        s.material.opacity = t * clamp(rise * 3.4 - i * 0.4 - k * 0.35) * (1 - shuffling * 0.65);
      });

      // ベンチマークの数字はシャッフル中だけ見せる
      const showScores = shuffling > 0.02 && !c.def.late;
      const si = showScores ? Math.floor(time * 7 + i * 3) % SCORES.length : -1;
      c.scores.forEach((s, k) => {
        s.visible = k === si;
        if (s.visible) s.material.opacity = shuffling;
      });
      const rankIdx = showScores ? (i + rot) % 3 : -1;
      c.ranks.forEach((s, k) => {
        s.visible = k === rankIdx;
        if (s.visible) s.material.opacity = shuffling;
      });

      c.g.scale.setScalar(1 + (c.def.late ? pick * 0.02 : 0));
    });

    this.shuffleTag.material.opacity = clamp(shuffling * 1.4 - 0.35);
    this.pickTag.material.opacity = pick;

    this.tasks.forEach((s, i) => {
      const t = easeOut(clamp(pick * 2.2 - i * 0.28));
      s.material.opacity = t;
      const f = s.userData.from;
      const to = s.userData.to;
      s.position.set(lerp(f.x, to.x, t), lerp(f.y, to.y, t) + Math.sin(time * 1.3 + i) * 0.05, lerp(f.z, to.z, t));
      const h = 0.44 * (0.6 + 0.4 * t);
      s.scale.set(h * s.userData.aspect, h, 1);
    });

    this.root.rotation.y = Math.sin(time * 0.12) * 0.08;
    this.camera.position.set(0, 0.35, lerp(11.0, 12.0, pick));
    this.camera.lookAt(0, 0.2, 0);
  }
}
