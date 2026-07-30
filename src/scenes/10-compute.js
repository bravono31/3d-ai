import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const GRID = 16; // GPU コアの格子
const STREAM = 900; // 蒸留の粒子数

export default class ComputeScene extends BaseScene {
  build() {
    const rand = rng(2468);
    this.camera.position.set(0, 0.3, 11);

    // ══════ 0: CPU（逐次） vs GPU（並列）
    this.gPar = new THREE.Group();
    this.root.add(this.gPar);

    // CPU 側：1個の大きなコアに、タスクが順番に流れ込む
    const cpuCore = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.MeshBasicMaterial({ color: 0x6f7d95, transparent: true, opacity: 0.25 })
    );
    cpuCore.position.set(-3.6, 0, 0);
    this.gPar.add(cpuCore);
    this.cpuCore = cpuCore;
    this.cpuWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 1.5, 1.5)),
      new THREE.LineBasicMaterial({ color: 0x9fb0d0, transparent: true })
    );
    this.cpuWire.position.copy(cpuCore.position);
    this.gPar.add(this.cpuWire);

    this.queue = [];
    const qGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(
        qGeo,
        new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true })
      );
      this.gPar.add(m);
      this.queue.push(m);
    }

    const cpuTag = makeLabel('CPU\n少数のコアで順番に', {
      fontSize: 30,
      height: 0.5,
      color: '#9fb0d0',
      weight: 700,
      lineGap: 1.3,
    });
    cpuTag.position.set(-3.6, -1.5, 0);
    this.gPar.add(cpuTag);
    this.cpuTag = cpuTag;

    // GPU 側：格子状のコアが一斉に光る
    const cellGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    this.gpuCells = new THREE.InstancedMesh(
      cellGeo,
      new THREE.MeshBasicMaterial({ transparent: true }),
      GRID * GRID
    );
    this.gpuCells.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(GRID * GRID * 3),
      3
    );
    const mm = new THREE.Matrix4();
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        mm.makeTranslation((x - (GRID - 1) / 2) * 0.2, (y - (GRID - 1) / 2) * 0.2, 0);
        this.gpuCells.setMatrixAt(y * GRID + x, mm);
      }
    }
    this.gpuCells.instanceMatrix.needsUpdate = true;
    this.gpuCells.position.set(3.3, 0, 0);
    this.gPar.add(this.gpuCells);

    const gpuTag = makeLabel('GPU\n数万のコアで同時に', {
      fontSize: 30,
      height: 0.5,
      color: '#4ecdc4',
      weight: 700,
      lineGap: 1.3,
    });
    gpuTag.position.set(3.3, -2.2, 0);
    this.gPar.add(gpuTag);
    this.gpuTag = gpuTag;

    const parTitle = makeLabel('Transformer の計算は、ほぼ全部が行列のかけ算', {
      fontSize: 34,
      height: 0.3,
      color: '#eaf3ff',
      weight: 800,
    });
    parTitle.position.set(0, 2.9, 0);
    this.gPar.add(parTitle);
    this.parTitle = parTitle;

    // ══════ 1: CUDA という堀
    this.gMoat = new THREE.Group();
    this.gMoat.visible = false;
    this.root.add(this.gMoat);

    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.15, 2.6, 6),
      new THREE.MeshBasicMaterial({ color: 0x76b900, transparent: true, opacity: 0.25 })
    );
    this.gMoat.add(tower);
    this.tower = tower;
    this.towerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.95, 1.15, 2.6, 6)),
      new THREE.LineBasicMaterial({ color: 0x9ede3a, transparent: true })
    );
    this.gMoat.add(this.towerWire);

    const nv = makeLabel('NVIDIA', { fontSize: 44, height: 0.42, color: '#9ede3a', weight: 800 });
    nv.position.set(0, 1.85, 0);
    this.gMoat.add(nv);
    this.nvTag = nv;

    this.moat = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.14, 10, 72),
      new THREE.MeshBasicMaterial({ color: 0x76b900, transparent: true, opacity: 0.4 })
    );
    this.moat.rotation.x = Math.PI / 2;
    this.gMoat.add(this.moat);

    const cudaTag = makeLabel('CUDA — 20年積み上がった開発環境', {
      fontSize: 32,
      height: 0.28,
      color: '#9ede3a',
      weight: 800,
    });
    cudaTag.position.set(0, -1.9, 2.6);
    this.gMoat.add(cudaTag);
    this.cudaTag = cudaTag;

    const rivals = [
      { t: 'AMD MI400', s: 'HBM4 432GB\nメモリで勝負', c: 0xff6b6b, bridge: 0.72 },
      { t: 'Google TPU', s: '外販せず\nクラウド内で', c: 0x5b9dff, bridge: 0.45 },
      { t: 'AWS Trainium', s: '自社クラウド専用', c: 0xffd166, bridge: 0.42 },
      { t: 'Microsoft Maia', s: '自社クラウド専用', c: 0xa78bfa, bridge: 0.38 },
    ];
    this.rivals = rivals.map((r, i) => {
      const a = Math.PI / 4 + (i / rivals.length) * Math.PI * 2;
      const R = 3.75;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R * 0.42;
      const hex = '#' + new THREE.Color(r.c).getHexString();

      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.5, 1.1),
        new THREE.MeshBasicMaterial({ color: r.c, transparent: true, opacity: 0.2 })
      );
      g.add(box);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.1, 1.5, 1.1)),
        new THREE.LineBasicMaterial({ color: r.c, transparent: true })
      );
      g.add(wire);
      const lb = makeLabel(r.t, { fontSize: 30, height: 0.28, color: hex, weight: 800 });
      lb.position.set(0, 1.15, 0);
      g.add(lb);
      const sb = makeLabel(r.s, {
        fontSize: 22,
        height: r.s.includes('\n') ? 0.34 : 0.18,
        color: '#9fb0d0',
        weight: 600,
        lineGap: 1.25,
      });
      sb.position.set(0, -1.1, 0);
      g.add(sb);
      this.gMoat.add(g);

      // 中心へ向かう「橋」。途切れている＝乗り換えられない
      const from = new THREE.Vector3(x, 0, z);
      const to = new THREE.Vector3(0, 0, 0);
      const end = from.clone().lerp(to, r.bridge);
      const bg = new THREE.BufferGeometry().setFromPoints([from, end]);
      const bridge = new THREE.Line(
        bg,
        new THREE.LineDashedMaterial({
          color: r.c,
          transparent: true,
          opacity: 0,
          dashSize: 0.2,
          gapSize: 0.16,
        })
      );
      bridge.computeLineDistances();
      this.gMoat.add(bridge);

      return { g, box, wire, lb, sb, bridge };
    });

    // ══════ 2-3: 蒸留
    this.gDist = new THREE.Group();
    this.gDist.visible = false;
    this.root.add(this.gDist);

    this.teacher = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.35, 1),
      new THREE.MeshBasicMaterial({ color: 0x4ecdc4, transparent: true, wireframe: true })
    );
    this.teacher.position.set(-3.4, 0.2, 0);
    this.gDist.add(this.teacher);
    const tTag = makeLabel('教師モデル（大）', {
      fontSize: 32,
      height: 0.28,
      color: '#4ecdc4',
      weight: 800,
    });
    tTag.position.set(-3.4, -1.9, 0);
    this.gDist.add(tTag);
    this.tTag = tTag;

    this.student = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, wireframe: true })
    );
    this.student.position.set(3.2, 0.2, 0);
    this.gDist.add(this.student);
    const sTag = makeLabel('生徒モデル（小・安・速）', {
      fontSize: 32,
      height: 0.28,
      color: '#ffd166',
      weight: 800,
    });
    sTag.position.set(3.2, -1.9, 0);
    this.gDist.add(sTag);
    this.sTag = sTag;

    // 教師 → 生徒 の粒子の流れ
    const sp = new Float32Array(STREAM * 3);
    this.streamT = new Float32Array(STREAM);
    for (let i = 0; i < STREAM; i++) {
      this.streamT[i] = rand();
      sp[i * 3] = 0;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stream = new THREE.Points(
      sg,
      new THREE.PointsMaterial({
        color: 0xaef0e9,
        size: 0.06,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.gDist.add(this.stream);
    this.streamOffset = new Float32Array(STREAM * 2);
    for (let i = 0; i < STREAM; i++) {
      this.streamOffset[i * 2] = (rand() - 0.5) * 1.5;
      this.streamOffset[i * 2 + 1] = (rand() - 0.5) * 1.5;
    }

    const distTag = makeLabel('出力を教科書にして、小さなモデルを訓練する', {
      fontSize: 32,
      height: 0.28,
      color: '#eaf3ff',
      weight: 800,
    });
    distTag.position.set(0, 2.7, 0);
    this.gDist.add(distTag);
    this.distTag = distTag;

    // ── 係争（beat 3）
    this.dispute = new THREE.Group();
    this.dispute.position.set(2.9, 0.2, 0);
    this.gDist.add(this.dispute);
    this.accused = ['Moonshot', 'DeepSeek', 'MiniMax'].map((t, i) => {
      const g = new THREE.Group();
      const a = -0.5 + i * 0.5;
      g.position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.9 - 0.2, 0.4);
      const dot = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.3, 0),
        new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, wireframe: true })
      );
      g.add(dot);
      const lb = makeLabel(t, { fontSize: 26, height: 0.24, color: '#ff9aa5', weight: 700 });
      lb.position.set(0, 0.52, 0);
      g.add(lb);
      this.dispute.add(g);
      return { g, dot, lb };
    });

    this.disputeTag = makeLabel('2026-02  Anthropic「偽アカウント経由で蒸留された」', {
      fontSize: 28,
      height: 0.24,
      color: '#ff8fa3',
      weight: 800,
    });
    this.disputeTag.position.set(0, -2.7, 1.2);
    this.disputeTag.material.opacity = 0;
    this.gDist.add(this.disputeTag);

    this.counterTag = makeLabel('反論：「15日で2.8兆パラメータの蒸留は不可能」', {
      fontSize: 28,
      height: 0.24,
      color: '#9fb0d0',
      weight: 700,
    });
    this.counterTag.position.set(0, -3.1, 1.2);
    this.counterTag.material.opacity = 0;
    this.gDist.add(this.counterTag);
  }

  update(p, bf, dt, time) {
    const parOut = ease(seg(bf, 0.75, 1.0));
    const moatIn = ease(seg(bf, 0.6, 1.0));
    const moatOut = ease(seg(bf, 1.75, 2.0));
    const distIn = ease(seg(bf, 1.6, 2.0));
    const fight = ease(seg(bf, 2.6, 2.95));

    // ── 並列性
    this.gPar.visible = bf < 1.05;
    if (this.gPar.visible) {
      const a = 1 - parOut;
      this.cpuCore.material.opacity = a * 0.25;
      this.cpuWire.material.opacity = a * 0.8;
      this.cpuTag.material.opacity = a;
      this.gpuTag.material.opacity = a;
      this.parTitle.material.opacity = a;

      // CPU：1つずつ入って出ていく
      const t = (time * 0.55) % 1;
      this.queue.forEach((q, i) => {
        const local = (t + i / this.queue.length) % 1;
        q.position.set(-6.6 + local * 6.0, 0, 0);
        const near = Math.abs(q.position.x - this.cpuCore.position.x) < 0.8;
        q.material.opacity = a * (local > 0.96 ? 0 : 1);
        q.scale.setScalar(near ? 1.4 : 1);
      });
      const busy = 0.5 + Math.sin(time * 5) * 0.2;
      this.cpuCore.material.color.setHSL(0.6, 0.2, 0.25 + busy * 0.12);

      // GPU：全体が一斉に脈打つ
      const beat = 0.5 + Math.sin(time * 3.4) * 0.5;
      const c = new THREE.Color();
      for (let i = 0; i < GRID * GRID; i++) {
        const ph = ((i * 37) % 97) / 97;
        const lit = 0.25 + beat * 0.75 * (0.55 + ph * 0.45);
        c.setHSL(0.48, 0.7, 0.12 + lit * 0.45);
        this.gpuCells.setColorAt(i, c);
      }
      this.gpuCells.instanceColor.needsUpdate = true;
      this.gpuCells.material.opacity = a;
      this.gpuCells.rotation.y = Math.sin(time * 0.3) * 0.16;
    }

    // ── CUDA の堀
    this.gMoat.visible = bf > 0.8 && bf < 2.05;
    if (this.gMoat.visible) {
      const a = moatIn * (1 - moatOut);
      this.tower.material.opacity = a * 0.25;
      this.towerWire.material.opacity = a * 0.9;
      this.nvTag.material.opacity = a;
      this.cudaTag.material.opacity = a;
      this.moat.material.opacity = a * (0.3 + Math.sin(time * 1.5) * 0.12);
      this.moat.rotation.z = time * 0.12;
      this.rivals.forEach((r, i) => {
        const t = a * clamp(moatIn * 3 - i * 0.35);
        r.box.material.opacity = t * 0.2;
        r.wire.material.opacity = t * 0.8;
        r.lb.material.opacity = t;
        r.sb.material.opacity = t * 0.85;
        r.bridge.material.opacity = t * 0.75;
      });
      this.gMoat.rotation.y = Math.sin(time * 0.1) * 0.14;
      this.gMoat.rotation.x = 0.16;
    }

    // ── 蒸留
    this.gDist.visible = bf > 1.8;
    if (this.gDist.visible) {
      const a = distIn;
      this.teacher.material.opacity = a * 0.8;
      this.teacher.rotation.y = time * 0.3;
      this.teacher.rotation.x = time * 0.17;
      this.tTag.material.opacity = a;
      this.sTag.material.opacity = a * (1 - fight * 0.5);
      this.distTag.material.opacity = a * (1 - fight);

      // 生徒は流れを受け取って育つ
      const grow = 1 + a * 0.55 + Math.sin(time * 1.8) * 0.03;
      this.student.scale.setScalar(grow);
      this.student.material.opacity = a * 0.9;
      this.student.rotation.y = -time * 0.45;

      const pos = this.stream.geometry.attributes.position.array;
      const from = this.teacher.position;
      const to = this.student.position;
      for (let i = 0; i < STREAM; i++) {
        const t = (this.streamT[i] + time * 0.22) % 1;
        const bend = Math.sin(Math.PI * t);
        pos[i * 3] = lerp(from.x, to.x, t);
        pos[i * 3 + 1] = lerp(from.y, to.y, t) + this.streamOffset[i * 2] * bend;
        pos[i * 3 + 2] = this.streamOffset[i * 2 + 1] * bend;
      }
      this.stream.geometry.attributes.position.needsUpdate = true;
      this.stream.material.opacity = a * 0.8;

      // 係争パート
      this.accused.forEach((ac, i) => {
        const t = clamp(fight * 2.4 - i * 0.35);
        ac.dot.material.opacity = t * 0.9;
        ac.lb.material.opacity = t;
        ac.dot.rotation.y = time * 0.6;
        ac.g.scale.setScalar(0.6 + t * 0.4);
      });
      this.disputeTag.material.opacity = fight;
      this.counterTag.material.opacity = clamp(fight * 1.8 - 0.6);
    }

    this.camera.position.set(0, 0.3, lerp(11, 12.6, clamp(bf / 3)));
    this.camera.lookAt(0, 0.1, 0);
  }
}
