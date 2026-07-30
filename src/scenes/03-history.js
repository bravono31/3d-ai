import * as THREE from 'three';
import { BaseScene, seg, ease, lerp, clamp, rng } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';
import { events, eraLabels } from '../data/timeline.js';

const GAP = 3.4;
const ERA_COLORS = [0x6f7d95, 0x4ecdc4, 0xffd166, 0xff8fa3];

export default class HistoryScene extends BaseScene {
  build() {
    const rand = rng(4242);
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();

    // 中央を貫く軸
    const spineLen = events.length * GAP + 12;
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, spineLen, 6),
      new THREE.MeshBasicMaterial({ color: 0x2c3d5c })
    );
    spine.rotation.x = Math.PI / 2;
    spine.position.z = -spineLen / 2 + 6;
    this.root.add(spine);

    // 奥行きの目印になる星屑
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rand() - 0.5) * 34;
      pos[i * 3 + 1] = (rand() - 0.5) * 20;
      pos[i * 3 + 2] = 8 - rand() * (events.length * GAP + 16);
    }
    const dustG = new THREE.BufferGeometry();
    dustG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.root.add(
      new THREE.Points(
        dustG,
        new THREE.PointsMaterial({
          color: 0x3a5680,
          size: 0.07,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        })
      )
    );

    // ── 出来事のノード
    const nodeGeo = new THREE.OctahedronGeometry(0.17);
    const bigGeo = new THREE.OctahedronGeometry(0.3);
    const ringGeo = new THREE.RingGeometry(0.44, 0.5, 32);

    this.items = events.map((e, i) => {
      const z = -i * GAP;
      const side = i % 2 === 0 ? 1 : -1;
      const y = side * (1.25 + (i % 3) * 0.42);
      const x = side * (1.5 + ((i * 7) % 5) * 0.32);
      const color = ERA_COLORS[e.era];
      const hex = '#' + new THREE.Color(color).getHexString();

      const g = new THREE.Group();
      g.position.set(x, y, z);

      const node = new THREE.Mesh(
        e.big ? bigGeo : nodeGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      g.add(node);

      let ring = null;
      if (e.big) {
        ring = new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        g.add(ring);
      }

      const year = makeLabel(String(e.y), {
        fontSize: 40,
        height: e.big ? 0.42 : 0.32,
        color: hex,
        weight: 800,
      });
      year.position.set(0, 0.58, 0);
      g.add(year);

      const title = makeLabel(e.t, {
        fontSize: 38,
        height: e.big ? 0.4 : 0.32,
        color: '#eaf3ff',
        weight: 700,
      });
      title.position.set(0, 0.16, 0.02);
      title.center.set(0.5, 0.5);
      g.add(title);

      const desc = makeLabel(e.d, { fontSize: 28, height: 0.22, color: '#9fb0d0', weight: 500 });
      desc.position.set(0, -0.22, 0.02);
      g.add(desc);

      // 軸へ落とす脚
      const legG = new THREE.BufferGeometry();
      legG.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([0, 0, 0, -x, -y, 0], 3)
      );
      const leg = new THREE.Line(
        legG,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 })
      );
      g.add(leg);

      this.root.add(g);
      return { g, node, ring, z, parts: [year, title, desc], leg, big: !!e.big };
    });

    // ── 時代の見出し。カメラが「その時代を見ている」瞬間に正面へ来るよう、
    //    時代の中心より少し奥へ置く。
    this.eras = eraLabels.map((el) => {
      const idxs = events.map((e, i) => (e.era === el.era ? i : -1)).filter((i) => i >= 0);
      const center = (idxs[0] + idxs[idxs.length - 1]) / 2;
      const z = -(center + 1.5) * GAP;
      const g = new THREE.Group();
      g.position.set(0, 3.6, z);
      const hex = '#' + new THREE.Color(ERA_COLORS[el.era]).getHexString();
      const name = makeLabel(el.name, { fontSize: 72, height: 0.95, color: hex, weight: 800 });
      g.add(name);
      const span = makeLabel(el.span, {
        fontSize: 34,
        height: 0.3,
        color: '#9fb0d0',
        weight: 600,
      });
      span.position.set(0, -0.72, 0);
      g.add(span);
      this.root.add(g);
      return { g, parts: [name, span], z };
    });

    // 各ビートでカメラが居るべき位置（時代のおおよそ中央）
    this.beatIdx = eraLabels.map((el) => {
      const idxs = events.map((e, i) => (e.era === el.era ? i : -1)).filter((i) => i >= 0);
      return (idxs[0] + idxs[idxs.length - 1]) / 2;
    });
  }

  update(p, bf, dt, time) {
    // ビート位置から「今どの出来事の前にいるか」を補間
    const b = clamp(bf, 0, this.beatIdx.length - 1);
    const i0 = Math.floor(b);
    const i1 = Math.min(i0 + 1, this.beatIdx.length - 1);
    const idx = lerp(this.beatIdx[i0], this.beatIdx[i1], b - i0);

    const camZ = -idx * GAP + 9.5;
    this.camera.position.set(Math.sin(time * 0.16) * 0.5, 0.35, camZ);
    this.camera.lookAt(0, 0.3, camZ - 12);

    // 手前と奥をフェードさせて「流れている」感じを出す。
    // d はカメラからの距離：小さいほど手前。近すぎるものは巨大に映るので必ず消す。
    const fade = (d) => clamp((d - 5.8) / 3.4) * clamp(1 - (d - 15) / 13);

    this.items.forEach((it) => {
      const d = camZ - it.z;
      const vis = fade(d);
      it.node.material.opacity = vis;
      it.leg.material.opacity = vis * 0.3;
      it.parts.forEach((s) => (s.material.opacity = vis));
      it.node.rotation.y = time * (it.big ? 0.5 : 0.25);
      it.node.rotation.x = time * 0.18;
      if (it.ring) {
        it.ring.material.opacity = vis * (0.3 + Math.sin(time * 1.6) * 0.15);
        it.ring.scale.setScalar(1 + Math.sin(time * 1.6) * 0.1);
        it.ring.lookAt(this.camera.position);
      }
    });

    this.eras.forEach((e) => {
      const vis = fade(camZ - e.z) * 0.9;
      e.parts.forEach((s) => (s.material.opacity = vis));
    });
  }
}
