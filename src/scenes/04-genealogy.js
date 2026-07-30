import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';
import { nodes, edges, groups, edgeLegend } from '../data/genealogy.js';

const EDGE_COLOR = Object.fromEntries(edgeLegend.map((e) => [e.type, e.color]));

export default class GenealogyScene extends BaseScene {
  build() {
    this.camera.position.set(0, 0, 15);
    this.byId = new Map();

    // ── ノード
    this.nodeObjs = nodes.map((n) => {
      const g = groups[n.group];
      const hex = '#' + new THREE.Color(g.color).getHexString();
      const isModel = n.kind === 'model';
      const isPaper = n.kind === 'paper';

      const grp = new THREE.Group();
      grp.position.set(...n.pos);

      const chip = makeLabel(n.label, {
        fontSize: isPaper ? 40 : 38,
        height: isPaper ? 0.46 : 0.42,
        color: isModel ? '#0a1018' : hex,
        weight: 800,
        bg: isModel ? hex : 'rgba(10,15,28,0.94)',
        border: hex,
      });
      grp.add(chip);

      const sub = makeLabel(n.sub, { fontSize: 26, height: 0.2, color: '#8fa2c2', weight: 600 });
      sub.position.set(0, -0.4, 0);
      grp.add(sub);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 10),
        new THREE.MeshBasicMaterial({ color: g.color, transparent: true })
      );
      dot.position.set(0, 0.42, 0);
      grp.add(dot);

      this.root.add(grp);
      const obj = { grp, chip, sub, dot, data: n, aspect: chip.scale.x / chip.scale.y };
      this.byId.set(n.id, obj);
      return obj;
    });

    // ── エッジ（1本ずつ Line にして個別に濃さを変える）
    this.edgeObjs = edges
      .map((e) => {
        const a = this.byId.get(e.a);
        const b = this.byId.get(e.b);
        if (!a || !b) return null;
        const pa = new THREE.Vector3(...a.data.pos);
        const pb = new THREE.Vector3(...b.data.pos);
        // 少したわませて重なりを避ける
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        mid.z += (e.type === 'open' ? 1.2 : 0.5) * (pa.distanceTo(pb) > 6 ? 1.5 : 1);
        const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(26));
        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({
            color: EDGE_COLOR[e.type],
            transparent: true,
            opacity: 0,
            depthWrite: false,
          })
        );
        this.root.add(line);
        return { line, stage: Math.max(a.data.stage, b.data.stage), type: e.type };
      })
      .filter(Boolean);

    // ── 凡例
    this.legend = new THREE.Group();
    this.legend.position.set(-7.2, -3.4, 3.2);
    edgeLegend.forEach((l, i) => {
      const hex = '#' + new THREE.Color(l.color).getHexString();
      const s = makeLabel('—— ' + l.label, {
        fontSize: 28,
        height: 0.24,
        color: hex,
        weight: 700,
      });
      s.position.set(0, -i * 0.34, 0);
      s.center.set(0, 0.5);
      this.legend.add(s);
    });
    this.root.add(this.legend);
  }

  update(p, bf, dt, time) {
    // ノードは stage に達したら現れる
    this.nodeObjs.forEach((o) => {
      const t = easeOut(clamp((bf - (o.data.stage - 0.55)) / 0.6));
      o.chip.material.opacity = t;
      o.sub.material.opacity = t * 0.9;
      o.dot.material.opacity = t;
      const h = 0.42 * (0.55 + 0.45 * t);
      o.chip.scale.set(h * o.aspect, h, 1);
      o.dot.scale.setScalar(0.7 + Math.sin(time * 1.4 + o.data.pos[0]) * 0.18 * t);
      o.grp.position.z = o.data.pos[2] + Math.sin(time * 0.5 + o.data.pos[1]) * 0.08;
    });

    this.edgeObjs.forEach((e) => {
      const t = clamp((bf - (e.stage - 0.35)) / 0.7);
      const base = e.type === 'derive' ? 0.4 : e.type === 'people' ? 0.85 : 0.6;
      e.line.material.opacity = t * base;
    });

    this.legend.children.forEach((s, i) => {
      s.material.opacity = clamp(bf - 0.6) * clamp(bf * 2 - i * 0.3);
    });

    // 全体をゆっくり振る（軸を見せるが酔わない程度に）
    this.root.rotation.y = Math.sin(time * 0.1) * 0.16 + bf * 0.03;
    this.root.rotation.x = -0.05 + Math.sin(time * 0.07) * 0.03;

    // 図が増えるにつれて引く
    this.camera.position.z = lerp(12.5, 16.5, clamp(bf / 3));
    this.camera.position.y = lerp(0.6, -0.2, clamp(bf / 3));
    this.camera.lookAt(0, 0.2, 0);
  }
}
