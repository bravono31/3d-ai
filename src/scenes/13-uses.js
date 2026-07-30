import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const HELIX_N = 180;
const LATTICE = 4;

export default class UsesScene extends BaseScene {
  build() {
    const rand = rng(1618);
    this.camera.position.set(0, 0.2, 11.6);

    // ══════ 中央：ひとつの能力
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.78, 2),
      new THREE.MeshBasicMaterial({ color: 0xeaf3ff, transparent: true, wireframe: true })
    );
    this.root.add(this.core);
    this.coreTag = makeLabel('ひとつの能力\n仮説を立て、計画し、実行を自動化する', {
      fontSize: 26,
      height: 0.44,
      color: '#eaf3ff',
      weight: 800,
      lineGap: 1.3,
    });
    this.coreTag.position.set(0, -1.5, 0);
    this.root.add(this.coreTag);

    // ══════ 左：科学
    this.gSci = new THREE.Group();
    this.gSci.position.set(-4.0, 0.4, 0);
    this.root.add(this.gSci);

    // 二重らせん
    const hp = new Float32Array(HELIX_N * 3);
    const hc = new Float32Array(HELIX_N * 3);
    const col = new THREE.Color();
    for (let i = 0; i < HELIX_N; i++) {
      const strand = i % 2;
      const t = Math.floor(i / 2) / (HELIX_N / 2 - 1);
      const a = t * Math.PI * 5 + strand * Math.PI;
      hp[i * 3] = Math.cos(a) * 0.62;
      hp[i * 3 + 1] = (t - 0.5) * 3.0;
      hp[i * 3 + 2] = Math.sin(a) * 0.62;
      col.setHSL(0.45 + strand * 0.08, 0.7, 0.55);
      hc[i * 3] = col.r;
      hc[i * 3 + 1] = col.g;
      hc[i * 3 + 2] = col.b;
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    hg.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    this.helix = new THREE.Points(
      hg,
      new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.helix.position.set(-1.0, 0, 0);
    this.gSci.add(this.helix);

    // 結晶格子
    const latGeo = new THREE.SphereGeometry(0.075, 8, 6);
    this.lattice = new THREE.InstancedMesh(
      latGeo,
      new THREE.MeshBasicMaterial({ color: 0x7ee081, transparent: true }),
      LATTICE ** 3
    );
    const m = new THREE.Matrix4();
    let k = 0;
    for (let x = 0; x < LATTICE; x++)
      for (let y = 0; y < LATTICE; y++)
        for (let z = 0; z < LATTICE; z++) {
          m.makeTranslation(
            (x - (LATTICE - 1) / 2) * 0.42,
            (y - (LATTICE - 1) / 2) * 0.42,
            (z - (LATTICE - 1) / 2) * 0.42
          );
          this.lattice.setMatrixAt(k++, m);
        }
    this.lattice.instanceMatrix.needsUpdate = true;
    this.lattice.position.set(1.05, 0.55, 0);
    this.gSci.add(this.lattice);

    // 格子の骨組み
    const lp = [];
    const at = (i) => (i - (LATTICE - 1) / 2) * 0.42;
    for (let x = 0; x < LATTICE; x++)
      for (let y = 0; y < LATTICE; y++)
        for (let z = 0; z < LATTICE; z++) {
          if (x < LATTICE - 1) lp.push(at(x), at(y), at(z), at(x + 1), at(y), at(z));
          if (y < LATTICE - 1) lp.push(at(x), at(y), at(z), at(x), at(y + 1), at(z));
          if (z < LATTICE - 1) lp.push(at(x), at(y), at(z), at(x), at(y), at(z + 1));
        }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.latticeWire = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({ color: 0x7ee081, transparent: true, opacity: 0 })
    );
    this.latticeWire.position.copy(this.lattice.position);
    this.gSci.add(this.latticeWire);

    this.sciTitle = makeLabel('科学', { fontSize: 54, height: 0.5, color: '#7ee081', weight: 800 });
    this.sciTitle.position.set(0, 2.35, 0);
    this.gSci.add(this.sciTitle);

    this.sciFacts = [
      'AlphaFold → 2024年 ノーベル化学賞',
      'GNoME：220万件の新結晶構造を予測',
      'AI Co-Scientist：10年の発見に48時間で到達',
      'ISM001-055：AI設計薬が第IIa相で良好',
    ].map((t, i) => {
      const s = makeLabel('· ' + t, { fontSize: 22, height: 0.19, color: '#c3d3ee', weight: 600 });
      s.center.set(0.5, 0.5);
      s.position.set(0, -1.85 - i * 0.32, 0);
      s.material.opacity = 0;
      this.gSci.add(s);
      return s;
    });

    // ══════ 右：軍事
    this.gMil = new THREE.Group();
    this.gMil.position.set(4.0, 0.4, 0);
    this.gMil.visible = false;
    this.root.add(this.gMil);

    this.reticles = [0.7, 1.15, 1.6].map((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.028, 8, 64),
        new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true })
      );
      this.gMil.add(ring);
      return { ring, r, i };
    });
    const cross = [];
    [
      [-2.1, 0, -1.05, 0],
      [1.05, 0, 2.1, 0],
      [0, -2.1, 0, -1.05],
      [0, 1.05, 0, 2.1],
    ].forEach(([x1, y1, x2, y2]) => cross.push(x1, y1, 0, x2, y2, 0));
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cross, 3));
    this.cross = new THREE.LineSegments(
      cg,
      new THREE.LineBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0 })
    );
    this.gMil.add(this.cross);

    this.milTitle = makeLabel('軍事', { fontSize: 54, height: 0.5, color: '#ff6b6b', weight: 800 });
    this.milTitle.position.set(0, 2.35, 0);
    this.gMil.add(this.milTitle);

    this.milFacts = [
      '2025-07 Anthropic × 国防総省：2年 2億ドル',
      '2026-02 「あらゆる合法な用途」条項で決裂',
      '2026-02-27 連邦機関に使用停止指示・調達排除',
      '同日中に OpenAI が機密網での提供に合意',
    ].map((t, i) => {
      const s = makeLabel('· ' + t, { fontSize: 22, height: 0.19, color: '#c3d3ee', weight: 600 });
      s.center.set(0.5, 0.5);
      s.position.set(0, -1.85 - i * 0.32, 0);
      s.material.opacity = 0;
      this.gMil.add(s);
      return s;
    });

    // ══════ 中央 → 両側 の結線
    const beamG = new THREE.BufferGeometry();
    beamG.setAttribute('position', new THREE.Float32BufferAttribute(new Array(4 * 3).fill(0), 3));
    this.beams = new THREE.LineSegments(
      beamG,
      new THREE.LineBasicMaterial({
        color: 0xeaf3ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.root.add(this.beams);

    this.dualTag = makeLabel('技術そのものに善悪は書き込めない。境界は制度と契約で引くしかない。', {
      fontSize: 29,
      height: 0.25,
      color: '#ffd166',
      weight: 800,
    });
    this.dualTag.position.set(0, -3.4, 1.5);
    this.dualTag.material.opacity = 0;
    this.root.add(this.dualTag);
  }

  update(p, bf, dt, time) {
    const sci = easeOut(this.enter(dt));
    const mil = ease(seg(bf, 0.6, 1.0));
    const dual = ease(seg(bf, 1.7, 2.0));

    // 中央のコア
    this.core.material.opacity = 0.35 + dual * 0.6;
    this.core.rotation.y = time * 0.35;
    this.core.rotation.x = time * 0.2;
    this.core.scale.setScalar(1 + dual * 0.35 + Math.sin(time * 2) * 0.04);
    this.coreTag.material.opacity = dual;

    // 科学
    this.helix.material.opacity = sci * 0.95;
    this.helix.rotation.y = time * 0.4;
    this.lattice.material.opacity = sci * 0.9;
    this.latticeWire.material.opacity = sci * 0.35;
    this.lattice.rotation.y = time * 0.22;
    this.lattice.rotation.x = time * 0.14;
    this.latticeWire.rotation.copy(this.lattice.rotation);
    this.sciTitle.material.opacity = sci;
    this.sciFacts.forEach((s, i) => (s.material.opacity = clamp(sci * 2.4 - i * 0.35)));
    this.gSci.position.x = lerp(-1.4, -4.0, Math.max(mil, dual));

    // 軍事
    this.gMil.visible = mil > 0.01;
    if (this.gMil.visible) {
      this.reticles.forEach((rt) => {
        const pulse = 0.45 + Math.sin(time * 1.7 - rt.i * 0.7) * 0.35;
        rt.ring.material.opacity = mil * (0.35 + pulse * 0.5);
        rt.ring.scale.setScalar(1 + Math.sin(time * 1.1 + rt.i) * 0.03);
        rt.ring.rotation.z = time * 0.1 * (rt.i % 2 ? -1 : 1);
      });
      this.cross.material.opacity = mil * 0.7;
      this.cross.rotation.z = time * 0.06;
      this.milTitle.material.opacity = mil;
      this.milFacts.forEach((s, i) => (s.material.opacity = clamp(mil * 2.4 - i * 0.35)));
    }

    // 結線
    const bp = this.beams.geometry.attributes.position;
    bp.setXYZ(0, -0.6, 0, 0);
    bp.setXYZ(1, this.gSci.position.x + 1.4, 0.4, 0);
    bp.setXYZ(2, 0.6, 0, 0);
    bp.setXYZ(3, 2.6, 0.4, 0);
    bp.needsUpdate = true;
    this.beams.material.opacity = dual * (0.4 + Math.sin(time * 2.6) * 0.25);
    this.dualTag.material.opacity = dual;

    this.root.rotation.y = Math.sin(time * 0.1) * 0.05;
    this.camera.position.set(0, 0.15, lerp(9.6, 12.4, Math.max(mil, dual)));
    this.camera.lookAt(0, 0.1, 0);
  }
}
