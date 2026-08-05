import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, inAt, outAt } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';
import { PROTEIN, CA } from '../data/protein.js';
import { CRYSTAL, ATOMS, BONDS } from '../data/crystal.js';

/** 表示サイズ（どちらのデータも半径1に正規化してある） */
const PROT_R = 1.2;
const CRYSTAL_R = 1.05;

export default class UsesScene extends BaseScene {
  build() {
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

    // ── タンパク質の立体構造
    // 形はそれらしく作ったものではなく、AlphaFold が実際に予測した Cα の座標そのもの。
    // 折りたたみの経路が読めるよう、N末端→C末端で色を変えた主鎖チューブにする。
    const pts = [];
    for (let i = 0; i < CA.length; i += 3) {
      pts.push(new THREE.Vector3(CA[i], CA[i + 1], CA[i + 2]).multiplyScalar(PROT_R));
    }
    const RINGS = pts.length * 6;
    const RADIAL = 8;
    const protGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts),
      RINGS,
      0.072,
      RADIAL,
      false
    );
    // 頂点はチューブの輪ごとに並ぶので、輪の番号から鎖に沿った位置が出る
    const pc = new Float32Array(protGeo.attributes.position.count * 3);
    const col = new THREE.Color();
    for (let v = 0; v < pc.length / 3; v++) {
      col.setHSL(0.63 - 0.63 * (Math.floor(v / (RADIAL + 1)) / RINGS), 0.72, 0.58);
      pc[v * 3] = col.r;
      pc[v * 3 + 1] = col.g;
      pc[v * 3 + 2] = col.b;
    }
    protGeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));

    // 立体感を出すためここだけ陰影をつける（他は MeshBasicMaterial なので影響しない）
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 3, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb4ff, 0.6);
    fill.position.set(-3, -1, -2);
    this.scene.add(fill);

    this.protein = new THREE.Mesh(
      protGeo,
      new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0 })
    );
    this.protein.position.set(-1.25, 0.15, 0);
    this.protein.rotation.x = -0.28;
    this.gSci.add(this.protein);
    this.protIndex = protGeo.index.count;

    this.protTag = makeLabel(
      `ヒト ヘモグロビンα鎖（${PROTEIN.id}・${PROTEIN.residues}残基）\nAlphaFold 予測構造 ${PROTEIN.model} ／ pLDDT ${PROTEIN.plddt}`,
      { fontSize: 20, height: 0.29, color: '#9fb6dd', weight: 600, lineGap: 1.35 }
    );
    this.protTag.position.set(-1.25, -1.42, 0);
    this.protTag.material.opacity = 0;
    this.gSci.add(this.protTag);

    /*
     * ── 結晶構造
     * こちらも作り物の格子ではなく、GNoME が予測した実際の結晶
     * （層状セレン化物 MgNb8SnSe16）の原子座標。
     * 単なる立方格子と違い、層になって重なっているのが見える。
     */
    const elStyle = {
      Se: { c: 0xffb454, r: 0.062 }, // セレン
      Nb: { c: 0x7ee081, r: 0.075 }, // ニオブ
      Sn: { c: 0xc9d6ee, r: 0.082 }, // スズ
      Mg: { c: 0x6fd3ff, r: 0.07 }, //  マグネシウム
    };
    this.crystal = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true }),
      ATOMS.length
    );
    this.crystal.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(ATOMS.length * 3),
      3
    );
    const m = new THREE.Matrix4();
    ATOMS.forEach(([el, x, y, z], i) => {
      const st = elStyle[el] ?? { c: 0x9fb0d0, r: 0.07 };
      m.makeTranslation(x * CRYSTAL_R, y * CRYSTAL_R, z * CRYSTAL_R);
      m.scale(new THREE.Vector3(st.r, st.r, st.r));
      this.crystal.setMatrixAt(i, m);
      this.crystal.setColorAt(i, col.setHex(st.c));
    });
    this.crystal.instanceMatrix.needsUpdate = true;
    this.crystal.instanceColor.needsUpdate = true;
    /*
     * データの z 軸が c 軸（層に垂直）。そのままだと層をま横から見ることになり、
     * ただの点の列にしか見えないので、c を上に向けてから回す。
     * 回す軸を上向きに保つため、傾ける群と中身を分けている。
     */
    this.crystal.rotation.x = -Math.PI / 2;
    this.gCrystal = new THREE.Group();
    this.gCrystal.position.set(1.5, 1.08, 0);
    this.gCrystal.add(this.crystal);
    this.gSci.add(this.gCrystal);

    // 結合。層のつながりはこれが無いと見えない。
    const bp = [];
    for (let i = 0; i < BONDS.length; i += 2) {
      for (const k of [BONDS[i], BONDS[i + 1]]) {
        bp.push(ATOMS[k][1] * CRYSTAL_R, ATOMS[k][2] * CRYSTAL_R, ATOMS[k][3] * CRYSTAL_R);
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    this.crystalWire = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({ color: 0xbfe9a8, transparent: true, opacity: 0 })
    );
    this.crystalWire.rotation.x = -Math.PI / 2;
    this.gCrystal.add(this.crystalWire);

    this.crystalTag = makeLabel(
      `GNoME 予測 ${CRYSTAL.name}\n層状セレン化物・${CRYSTAL.sitesPerCell}原子/単位格子`,
      { fontSize: 19, height: 0.27, color: '#9fb6dd', weight: 600, lineGap: 1.35 }
    );
    // 説明はタンパク質側と同じ高さに揃える（結晶の真下は原子で埋まっている）
    this.crystalTag.position.set(2.05, -1.42, 0);
    this.crystalTag.material.opacity = 0;
    this.gSci.add(this.crystalTag);

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
    const mil = inAt(bf, 1);
    const dual = inAt(bf, 2);

    // 中央のコア
    this.core.material.opacity = 0.35 + dual * 0.6;
    this.core.rotation.y = time * 0.35;
    this.core.rotation.x = time * 0.2;
    this.core.scale.setScalar(1 + dual * 0.35 + Math.sin(time * 2) * 0.04);
    this.coreTag.material.opacity = dual;

    // 科学。折りたたみが N末端から伸びていくように、鎖の順に描き足す
    this.protein.material.opacity = sci;
    this.protein.geometry.setDrawRange(0, Math.ceil(this.protIndex * sci));
    this.protein.rotation.y = time * 0.32;
    this.protTag.material.opacity = sci * 0.9;
    this.crystal.material.opacity = sci * 0.95;
    this.crystalWire.material.opacity = sci * 0.6;
    // 層が重なって見えるよう、少し上から覗き込む角度で回す
    this.gCrystal.rotation.set(0.34, time * 0.24, 0);
    this.crystalTag.material.opacity = sci * 0.9;
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
