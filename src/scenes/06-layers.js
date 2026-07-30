import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';
import { layers, appValue } from '../data/layers.js';

const PW = 7.4;
const PD = 3.6;
const PH = 0.42;
const STEP = 1.32;

function makeArrow(color, len, up) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), mat);
  shaft.position.y = len / 2;
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 12), mat);
  head.position.y = len + 0.19;
  g.add(head);
  if (!up) g.rotation.z = Math.PI;
  g.userData.mat = mat;
  return g;
}

export default class LayersScene extends BaseScene {
  build() {
    this.camera.position.set(0, 1.6, 12.5);

    this.plates = layers.map((L, i) => {
      const y = (i - (layers.length - 1) / 2) * STEP;
      const g = new THREE.Group();
      g.position.set(0, y, 0);

      const box = new THREE.BoxGeometry(PW, PH, PD);
      const mesh = new THREE.Mesh(
        box,
        new THREE.MeshBasicMaterial({ color: L.color, transparent: true, opacity: 0.2 })
      );
      g.add(mesh);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(box),
        new THREE.LineBasicMaterial({ color: L.color, transparent: true, opacity: 0.7 })
      );
      g.add(wire);

      const hex = '#' + new THREE.Color(L.color).getHexString();
      const name = makeLabel(L.name, { fontSize: 38, height: 0.36, color: hex, weight: 800 });
      name.center.set(0, 0.5);
      name.position.set(-PW / 2 + 0.25, 0.42, PD / 2 + 0.05);
      g.add(name);

      // メンバーは2行に折って読めるようにする
      const half = Math.ceil(L.members.length / 2);
      const txt =
        L.members.length > 4
          ? L.members.slice(0, half).join(' · ') + '\n' + L.members.slice(half).join(' · ')
          : L.members.join(' · ');
      const mem = makeLabel(txt, {
        fontSize: 28,
        height: L.members.length > 4 ? 0.44 : 0.24,
        color: '#c3d3ee',
        weight: 600,
        lineGap: 1.2,
      });
      mem.center.set(0, 0.5);
      mem.position.set(-PW / 2 + 0.25, -0.5, PD / 2 + 0.05);
      g.add(mem);

      const val = makeLabel('▸ ' + L.value, {
        fontSize: 28,
        height: 0.24,
        color: '#ffffff',
        weight: 700,
      });
      val.center.set(1, 0.5);
      val.position.set(PW / 2 - 0.2, 0.42, PD / 2 + 0.05);
      val.material.opacity = 0;
      g.add(val);

      this.root.add(g);
      return { g, mesh, wire, name, mem, val, y, L };
    });

    // 上位層の価値（beat 2）
    this.valueTags = appValue.map((t, i) => {
      const s = makeLabel(t, {
        fontSize: 30,
        height: 0.3,
        color: '#1a1405',
        bg: '#ffd166',
        border: '#ffd166',
        weight: 800,
      });
      s.userData.aspect = s.scale.x / s.scale.y;
      s.position.set(-3.6 + i * 2.45, (layers.length - 1) / 2 * STEP + 1.55, 1.2);
      s.material.opacity = 0;
      this.root.add(s);
      return s;
    });

    // 境界をめぐる押し合い（beat 3）
    const modelY = (2 - (layers.length - 1) / 2) * STEP;
    const appY = (4 - (layers.length - 1) / 2) * STEP;
    this.upArrow = makeArrow(0x4ecdc4, 1.5, true);
    this.upArrow.position.set(2.6, modelY + 0.3, PD / 2 + 0.4);
    this.root.add(this.upArrow);
    this.downArrow = makeArrow(0xffd166, 1.5, false);
    this.downArrow.position.set(-2.6, appY - 0.3, PD / 2 + 0.4);
    this.root.add(this.downArrow);

    this.upTag = makeLabel('自社製品へ前進', {
      fontSize: 26,
      height: 0.23,
      color: '#4ecdc4',
      weight: 700,
    });
    this.upTag.position.set(3.9, (modelY + appY) / 2, PD / 2 + 0.4);
    this.upTag.material.opacity = 0;
    this.root.add(this.upTag);
    this.downTag = makeLabel('小型モデルを自前で', {
      fontSize: 26,
      height: 0.23,
      color: '#ffd166',
      weight: 700,
    });
    this.downTag.position.set(-3.9, (modelY + appY) / 2, PD / 2 + 0.4);
    this.downTag.material.opacity = 0;
    this.root.add(this.downTag);

    // 依存の線（製品 → 基盤モデル）
    const dep = [];
    for (let k = -1; k <= 1; k++) {
      dep.push(k * 2.2, appY - PH / 2, 0.6, k * 2.2, modelY + PH / 2, 0.6);
    }
    const depG = new THREE.BufferGeometry();
    depG.setAttribute('position', new THREE.Float32BufferAttribute(dep, 3));
    this.depLines = new THREE.LineSegments(
      depG,
      new THREE.LineBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.root.add(this.depLines);
  }

  update(p, bf, dt, time) {
    const assemble = easeOut(this.enter(dt));
    const fModel = ease(seg(bf, 0.6, 1.0)) * (1 - ease(seg(bf, 1.75, 2.1)));
    const fApp = ease(seg(bf, 1.6, 2.0)) * (1 - ease(seg(bf, 2.7, 2.95)));
    const fBoth = ease(seg(bf, 2.65, 3.0));

    this.plates.forEach((pl, i) => {
      const t = clamp(assemble * (layers.length + 1.5) - i * 1.1);
      const e = easeOut(t);
      pl.g.position.y = lerp(pl.y - 4.5, pl.y, e);
      pl.g.position.z = lerp(-3, 0, e);

      const isModel = i === 2;
      const isApp = i === 4;
      // 強調されている層だけを前に出す
      const hi =
        (isModel ? Math.max(fModel, fBoth) : 0) + (isApp ? Math.max(fApp, fBoth) : 0);
      const dim = Math.max(fModel, fApp, fBoth) * (hi > 0 ? 0 : 1);

      const a = e * (1 - dim * 0.72);
      pl.mesh.material.opacity = a * (0.16 + hi * 0.32);
      pl.wire.material.opacity = a * (0.55 + hi * 0.45);
      pl.name.material.opacity = a;
      pl.mem.material.opacity = a * (0.75 + hi * 0.25);
      pl.val.material.opacity = e * hi;
      pl.g.position.z += hi * 0.5;
      pl.g.scale.setScalar(1 + hi * 0.035);
    });

    this.valueTags.forEach((s, i) => {
      const t = clamp(fApp * 3 - i * 0.5);
      s.material.opacity = t;
      const h = 0.3 * (0.7 + 0.3 * t);
      s.scale.set(h * s.userData.aspect, h, 1);
      s.position.y =
        ((layers.length - 1) / 2) * STEP + 1.55 + Math.sin(time * 1.2 + i) * 0.06;
    });
    this.depLines.material.opacity = fApp * (0.3 + Math.sin(time * 2.4) * 0.15);

    const arrowT = fBoth;
    this.upArrow.userData.mat.opacity = arrowT;
    this.downArrow.userData.mat.opacity = arrowT;
    this.upTag.material.opacity = arrowT;
    this.downTag.material.opacity = arrowT;
    this.upArrow.position.y =
      (2 - (layers.length - 1) / 2) * STEP + 0.3 + Math.sin(time * 1.6) * 0.09 * arrowT;
    this.downArrow.position.y =
      (4 - (layers.length - 1) / 2) * STEP - 0.3 - Math.sin(time * 1.6) * 0.09 * arrowT;

    this.root.rotation.y = -0.28 + Math.sin(time * 0.13) * 0.12;
    this.root.rotation.x = 0.06;
    this.camera.position.set(0, 1.2, lerp(13.5, 12.2, assemble));
    this.camera.lookAt(0, 0.1, 0);
  }
}
