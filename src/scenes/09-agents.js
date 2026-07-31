import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, inAt, outAt } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const STATIONS = ['計画', '調査', '編集', '実行', '検証', '修正'];
const LOOP_R = 1.7;

export default class AgentsScene extends BaseScene {
  build() {
    this.camera.position.set(0, 0.2, 11);

    // ══ 左：チャット（1往復）
    this.chat = new THREE.Group();
    this.root.add(this.chat);

    const mkBox = (label, color, x, sub) => {
      const g = new THREE.Group();
      g.position.x = x;
      const hex = '#' + new THREE.Color(color).getHexString();
      const geo = new THREE.BoxGeometry(1.5, 1.5, 1.0);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 })
      );
      g.add(mesh);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })
      );
      g.add(wire);
      const lb = makeLabel(label, { fontSize: 36, height: 0.34, color: hex, weight: 800 });
      lb.position.set(0, 0.05, 0.55);
      g.add(lb);
      const sb = makeLabel(sub, { fontSize: 24, height: 0.2, color: '#9fb0d0', weight: 600 });
      sb.position.set(0, -1.1, 0);
      g.add(sb);
      return { g, mesh, wire, lb, sb };
    };

    this.human = mkBox('人', 0x8ab6ff, -1.5, '文脈を集めて貼る');
    this.model = mkBox('モデル', 0x4ecdc4, 1.5, 'テキストを返すだけ');
    this.chat.add(this.human.g, this.model.g);

    this.chatPulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true })
    );
    this.chat.add(this.chatPulse);

    const trackG = new THREE.BufferGeometry();
    trackG.setAttribute('position', new THREE.Float32BufferAttribute([-0.72, 0, 0, 0.72, 0, 0], 3));
    this.chatTrack = new THREE.Line(
      trackG,
      new THREE.LineBasicMaterial({ color: 0x51617f, transparent: true, opacity: 0.7 })
    );
    this.chat.add(this.chatTrack);

    this.chatTitle = makeLabel('チャット：1往復', {
      fontSize: 40,
      height: 0.36,
      color: '#8ab6ff',
      weight: 800,
    });
    this.chatTitle.position.set(0, 2.6, 0);
    this.chat.add(this.chatTitle);

    this.chatUse = makeLabel('調べもの・下書き・相談・学習', {
      fontSize: 27,
      height: 0.23,
      color: '#cfe0f7',
      weight: 700,
    });
    this.chatUse.position.set(0, -2.5, 0);
    this.chatUse.material.opacity = 0;
    this.chat.add(this.chatUse);

    // ══ 右：エージェント（閉じたループ）
    this.agent = new THREE.Group();
    this.agent.position.x = 3.0;
    this.agent.visible = false;
    this.root.add(this.agent);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(LOOP_R, 0.022, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x4ecdc4, transparent: true, opacity: 0.55 })
    );
    this.agent.add(this.ring);

    this.stations = STATIONS.map((s, i) => {
      const a = Math.PI / 2 - (i / STATIONS.length) * Math.PI * 2;
      const x = Math.cos(a) * LOOP_R;
      const y = Math.sin(a) * LOOP_R;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 14, 12),
        new THREE.MeshBasicMaterial({ color: 0x4ecdc4, transparent: true })
      );
      dot.position.set(x, y, 0);
      this.agent.add(dot);
      const lb = makeLabel(s, {
        fontSize: 30,
        height: 0.28,
        color: '#eaf3ff',
        bg: 'rgba(10,18,32,0.92)',
        border: 'rgba(78,205,196,0.6)',
        weight: 700,
      });
      lb.userData.aspect = lb.scale.x / lb.scale.y;
      lb.position.set(x * 1.42, y * 1.42, 0);
      this.agent.add(lb);
      return { dot, lb, a, x, y };
    });

    this.agentPulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true })
    );
    this.agent.add(this.agentPulse);

    this.agentTitle = makeLabel('エージェント：ループが回る', {
      fontSize: 40,
      height: 0.36,
      color: '#4ecdc4',
      weight: 800,
    });
    this.agentTitle.position.set(0, 2.6, 0);
    this.agent.add(this.agentTitle);

    this.agentSub = makeLabel('Claude Code / Codex', {
      fontSize: 26,
      height: 0.22,
      color: '#9fb0d0',
      weight: 700,
    });
    this.agentSub.position.set(0, 2.22, 0);
    this.agent.add(this.agentSub);

    this.agentUse = makeLabel('複数ファイルの改修・移行・テストを通すまで', {
      fontSize: 27,
      height: 0.23,
      color: '#cfe0f7',
      weight: 700,
    });
    this.agentUse.position.set(0, -2.5, 0);
    this.agentUse.material.opacity = 0;
    this.agent.add(this.agentUse);

    // ループの中心＝同じモデル
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({ color: 0x4ecdc4, transparent: true, wireframe: true })
    );
    this.agent.add(this.core);

    // 器（ファイルシステム・シェル・git への権限）
    const shellGeo = new THREE.BoxGeometry(5.1, 5.4, 2.4);
    this.shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(shellGeo),
      new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0 })
    );
    this.agent.add(this.shell);
    this.shellTags = ['ファイルシステム', 'シェル', 'git', '権限モデル'].map((t, i) => {
      const s = makeLabel(t, { fontSize: 24, height: 0.2, color: '#ffd166', weight: 700 });
      const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 2.7, Math.sin(a) * 2.45, 1.2);
      s.material.opacity = 0;
      this.agent.add(s);
      return s;
    });

    // ══ 「中身は同じモデル」
    this.sameTag = makeLabel('中身は同じモデル。違うのは器のほう。', {
      fontSize: 34,
      height: 0.3,
      color: '#ffd166',
      weight: 800,
    });
    this.sameTag.position.set(0, -3.55, 1.5);
    this.sameTag.material.opacity = 0;
    this.root.add(this.sameTag);

    const linkG = new THREE.BufferGeometry();
    linkG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this.link = new THREE.Line(
      linkG,
      new THREE.LineDashedMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0,
        dashSize: 0.18,
        gapSize: 0.14,
      })
    );
    this.root.add(this.link);

    this.criteria = makeLabel('分かれ目は「検証を自動化できるか」', {
      fontSize: 32,
      height: 0.28,
      color: '#4ecdc4',
      weight: 800,
    });
    this.criteria.position.set(0, 3.7, 1.5);
    this.criteria.material.opacity = 0;
    this.root.add(this.criteria);
  }

  update(p, bf, dt, time) {
    const intro = easeOut(this.enter(dt));
    const split = inAt(bf, 1); // 右にループが出る
    const same = inAt(bf, 2); // 同じモデル・違う器
    const use = inAt(bf, 3); // 使い分け

    // ── チャット側
    this.chat.position.x = lerp(0, -3.6, split);
    this.chat.scale.setScalar(lerp(1, 0.9, split));
    [this.human, this.model].forEach((b, i) => {
      const t = easeOut(clamp(intro * 2.4 - i * 0.5));
      b.mesh.material.opacity = t * 0.16;
      b.wire.material.opacity = t * 0.8;
      b.lb.material.opacity = t;
      b.sb.material.opacity = t * 0.85 * (1 - use * 0.3);
    });
    this.chatTrack.material.opacity = intro * 0.7;
    this.chatTitle.material.opacity = intro;

    // 質問 → 回答 の1往復
    const cyc = (time % 3.4) / 3.4;
    const tri = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
    this.chatPulse.position.set(lerp(-0.72, 0.72, tri), 0, 0.1);
    this.chatPulse.material.opacity = intro;
    this.chatPulse.scale.setScalar(0.85 + Math.sin(time * 5) * 0.12);
    this.chatUse.material.opacity = use;

    // ── エージェント側
    this.agent.visible = split > 0.01;
    if (this.agent.visible) {
      const t = split;
      this.ring.material.opacity = t * 0.55;
      this.agentTitle.material.opacity = t;
      this.agentSub.material.opacity = t * 0.85;
      this.agentUse.material.opacity = use;
      this.agent.scale.setScalar(lerp(0.8, 0.95, t));

      const head = (time * 0.34) % 1;
      this.stations.forEach((st, i) => {
        const at = i / STATIONS.length;
        let d = Math.abs(head - at);
        d = Math.min(d, 1 - d);
        const lit = Math.max(0, 1 - d * 7);
        st.dot.material.opacity = t * (0.45 + lit * 0.55);
        st.dot.scale.setScalar(0.9 + lit * 0.9);
        st.lb.material.opacity = t * (0.55 + lit * 0.45);
        const h = 0.28 * (1 + lit * 0.16);
        st.lb.scale.set(h * st.lb.userData.aspect, h, 1);
      });
      const ha = Math.PI / 2 - head * Math.PI * 2;
      this.agentPulse.position.set(Math.cos(ha) * LOOP_R, Math.sin(ha) * LOOP_R, 0.12);
      this.agentPulse.material.opacity = t;

      this.core.material.opacity = t * (0.35 + same * 0.6);
      this.core.rotation.y = time * 0.5;
      this.core.rotation.x = time * 0.3;
      this.core.scale.setScalar(1 + same * 0.25 + Math.sin(time * 2) * 0.04);

      this.shell.material.opacity = same * 0.55;
      this.shellTags.forEach((s, i) => (s.material.opacity = clamp(same * 2.2 - i * 0.3)));
    }

    // ── 「中身は同じモデル」の結線
    this.sameTag.material.opacity = same * (1 - use * 0.55);
    const lp = this.link.geometry.attributes.position;
    lp.setXYZ(0, -2.1, 0, 0.6);
    lp.setXYZ(1, 3.0, 0, 0.6);
    lp.needsUpdate = true;
    this.link.computeLineDistances();
    this.link.material.opacity = same * 0.7;

    this.criteria.material.opacity = use;

    this.camera.position.set(0, 0.15, lerp(8.6, 13.6, split));
    this.camera.lookAt(0, 0, 0);
  }
}
