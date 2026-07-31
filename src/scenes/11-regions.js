import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';
import { regions } from '../data/regions.js';
import { landPoints } from '../data/world.js';

const R = 2.25;
const DEG = Math.PI / 180;
const GLOBE_X = -1.45;
const PANEL_X = 1.35;

function toXYZ(lat, lon, r = R) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

export default class RegionsScene extends BaseScene {
  build() {
    this.camera.position.set(0, 0, 10.6);

    this.globe = new THREE.Group();
    this.globe.position.x = GLOBE_X;
    this.root.add(this.globe);

    // 海（半透明の球）と経緯線
    this.globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.985, 48, 32),
        new THREE.MeshBasicMaterial({ color: 0x0d1a33, transparent: true, opacity: 0.92 })
      )
    );
    this.globe.add(
      new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.SphereGeometry(R * 0.99, 24, 16)),
        new THREE.LineBasicMaterial({ color: 0x24406b, transparent: true, opacity: 0.32 })
      )
    );

    // 陸地の点群
    const pts = landPoints(1.4);
    const pos = new Float32Array(pts.length * 3);
    pts.forEach(([lon, lat], i) => {
      const v = toXYZ(lat, lon, R * 1.004);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.land = new THREE.Points(
      lg,
      new THREE.PointsMaterial({ color: 0x6d9fd8, size: 0.038, transparent: true, opacity: 0.95 })
    );
    this.globe.add(this.land);

    // 大気のふちどり
    this.globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.06, 40, 26),
        new THREE.MeshBasicMaterial({
          color: 0x3b7fd4,
          transparent: true,
          opacity: 0.07,
          side: THREE.BackSide,
        })
      )
    );

    // ── 地域マーカー
    this.markers = regions.map((rg) => {
      const grp = new THREE.Group();
      const spots = [rg.center, ...(rg.extraMarkers || [])];
      const dots = spots.map(([lat, lon]) => {
        const v = toXYZ(lat, lon, R * 1.02);
        const d = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 12, 10),
          new THREE.MeshBasicMaterial({ color: rg.color, transparent: true })
        );
        d.position.copy(v);
        grp.add(d);

        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.75, 6),
          new THREE.MeshBasicMaterial({ color: rg.color, transparent: true, opacity: 0.6 })
        );
        beam.position.copy(v.clone().multiplyScalar(1.12));
        beam.lookAt(0, 0, 0);
        beam.rotateX(Math.PI / 2);
        grp.add(beam);

        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.13, 0.2, 24),
          new THREE.MeshBasicMaterial({
            color: rg.color,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        halo.position.copy(v.clone().multiplyScalar(1.01));
        halo.lookAt(v.clone().multiplyScalar(2));
        grp.add(halo);

        return { d, beam, halo };
      });
      this.globe.add(grp);
      return { grp, dots, rg };
    });

    // ── 右のパネル（地域ごとに1枚ずつ用意して切り替える）
    this.panels = regions.map((rg) => {
      const g = new THREE.Group();
      g.position.set(PANEL_X, 0.2, 0);
      const hex = '#' + new THREE.Color(rg.color).getHexString();

      const title = makeLabel(rg.name, { fontSize: 52, height: 0.5, color: hex, weight: 800 });
      title.center.set(0, 0.5);
      title.position.set(-0.05, 2.5, 0);
      g.add(title);

      const tag = makeLabel(rg.tagline, {
        fontSize: 30,
        height: 0.26,
        color: '#cfe0f7',
        weight: 700,
      });
      tag.center.set(0, 0.5);
      tag.position.set(0, 2.0, 0);
      g.add(tag);

      // 指標のバー。
      // パネルは全地域が同じ位置に重なるので、板の深度を書かせると
      // 切り替え中に同一平面どうしが取り合いになってチラつく。
      // 深度は書かず、描画順だけで前後を決める。
      const bars = rg.metrics.map((m, i) => {
        const y = 1.35 - i * 0.62;
        const track = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 0.11),
          new THREE.MeshBasicMaterial({
            color: 0x24344f,
            transparent: true,
            depthWrite: false,
            depthTest: false,
          })
        );
        track.position.set(1.3, y - 0.2, 0);
        track.renderOrder = 20;
        g.add(track);
        const fill = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 0.11),
          new THREE.MeshBasicMaterial({
            color: rg.color,
            transparent: true,
            depthWrite: false,
            depthTest: false,
          })
        );
        fill.position.set(0, y - 0.2, 0.01);
        fill.renderOrder = 21;
        g.add(fill);
        const lb = makeLabel(m.k, { fontSize: 26, height: 0.22, color: '#9fb0d0', weight: 600 });
        lb.center.set(0, 0.5);
        lb.position.set(0, y + 0.08, 0);
        g.add(lb);
        return { fill, track, lb, v: m.v };
      });

      const players = makeLabel(rg.players.join("\n"), {
        fontSize: 22,
        height: 0.21 * rg.players.length,
        color: '#c3d3ee',
        weight: 600,
        lineGap: 1.35,
      });
      players.center.set(0, 1);
      players.position.set(0, -0.75, 0);
      g.add(players);

      let note = null;
      if (rg.note) {
        note = makeLabel(rg.note, { fontSize: 24, height: 0.2, color: hex, weight: 700 });
        note.center.set(0, 0.5);
        note.position.set(0, -0.75 - 0.21 * rg.players.length - 0.35, 0);
        g.add(note);
      }

      g.visible = false;
      this.root.add(g);
      return { g, title, tag, bars, players, note };
    });

    this.active = 0;
  }

  update(p, bf, dt, time) {
    const n = regions.length;
    const i0 = clamp(Math.floor(bf), 0, n - 1);
    const i1 = clamp(i0 + 1, 0, n - 1);
    const f = clamp(bf - i0);

    // 地球儀を回して対象地域を正面に持ってくる
    const a = regions[i0].camera;
    const b = regions[i1].camera;
    const lat = lerp(a[0], b[0], ease(f));
    // 経度は近い方向に回る
    let d = b[1] - a[1];
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    const lon = a[1] + d * ease(f);

    this.globe.rotation.set(lat * DEG, (-90 - lon) * DEG, 0);
    this.globe.rotation.y += Math.sin(time * 0.09) * 0.03;

    // 切り替えは移動の全域を使わず、前半で退いて後半で入る。
    // 全域でクロスフェードすると二重像が長く残り、色が混ざって見える。
    const outA = ease(clamp((f - 0.12) / 0.33)); // 0.12→0.45 で前の地域が退く
    const inB = ease(clamp((f - 0.4) / 0.32)); // 0.40→0.72 で次の地域に入れ替わる
    const onOf = (i) => (i === i0 ? 1 - outA : i === i1 && i1 !== i0 ? inB : 0);

    // マーカーの強調
    this.markers.forEach((mk, i) => {
      const on = onOf(i);
      const pulse = 0.55 + Math.sin(time * 2.2) * 0.25;
      mk.dots.forEach((o) => {
        o.d.material.opacity = 0.35 + on * 0.65;
        o.d.scale.setScalar(0.8 + on * (0.7 + pulse * 0.35));
        o.beam.material.opacity = on * 0.7;
        o.beam.scale.y = 0.3 + on * 0.9;
        o.halo.material.opacity = on * (0.55 - pulse * 0.22);
        o.halo.scale.setScalar(1 + on * pulse * 1.5);
      });
    });

    // パネルの切り替え
    this.panels.forEach((pn, i) => {
      const e = onOf(i);
      pn.g.visible = e > 0.004;
      if (!pn.g.visible) return;
      // 入ってくる側だけを滑り込ませる。退く側も動かすと二重に流れて読みにくい。
      const entering = i === i1 && i1 !== i0;
      pn.title.material.opacity = e;
      pn.tag.material.opacity = e;
      pn.players.material.opacity = e * 0.95;
      if (pn.note) pn.note.material.opacity = e;
      pn.g.position.x = PANEL_X + (entering ? (1 - e) * 0.45 : 0);
      pn.bars.forEach((br, k) => {
        const grow = clamp(e * 2.2 - k * 0.25);
        br.track.material.opacity = e * 0.7;
        br.fill.material.opacity = e;
        br.lb.material.opacity = e;
        const w = 2.6 * br.v * easeOut(grow);
        br.fill.scale.x = Math.max(0.001, w);
        br.fill.position.x = w / 2;
      });
    });

    this.camera.position.set(0, 0.1, 10.6);
    this.camera.lookAt(0.6, 0.15, 0);
  }
}
