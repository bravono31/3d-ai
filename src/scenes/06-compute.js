import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng, inAt, outAt } from '../core/BaseScene.js';
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

    /*
     * ══════ 1: CUDA という堀
     *
     * 中央の島に NVIDIA が立ち、その周りを深い溝が囲む。
     * 溝はいま CUDA で埋まっていて、競合はその上に立ち、島とつながっている。
     * ——という状態を見せたうえで、CUDA を引き抜く。
     * 土台を失った四角は溝へ落ちる。堀の正体はチップではなくソフトだ、という話を
     * 「抜いたらどうなるか」で見せる。
     */
    this.gMoat = new THREE.Group();
    this.gMoat.visible = false;
    this.gMoat.position.set(0.25, 0.15, 0);
    this.root.add(this.gMoat);

    const R_ISLE = 1.2; //  島のふち
    const R_OUT = 3.2; //   溝の外のふち
    const R_BANK = 3.95; // 外の岸のはずれ
    const R_RIVAL = 2.3; // 競合が立っている位置（溝の中）
    const GY = -1.05; //    地面の高さ
    const DEPTH = 1.3; //   溝の深さ

    /** 水平な輪郭線。溝のふちや底の形を示す。 */
    const ring = (r, y, color, opacity, parent) => {
      const pts = [];
      for (let i = 0; i <= 84; i++) {
        const a = (i / 84) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      const l = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity })
      );
      (parent ?? this.gMoat).add(l);
      return l;
    };
    /** 面。地面・島の上面・CUDAの水面に使う。 */
    const disc = (inner, outer, y, color, opacity, parent) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 84),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      (parent ?? this.gMoat).add(m);
      return m;
    };

    this.moatParts = [];
    const part = (obj, base) => {
      this.moatParts.push({ obj, base });
      obj.material.opacity = 0;
      return obj;
    };

    /** 溝の壁。内側から見える面だけ描くと、切り込んだ穴に見える。 */
    const wall = (r, color, opacity, side) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, DEPTH, 60, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side, depthWrite: false })
      );
      m.position.y = GY - DEPTH / 2;
      this.gMoat.add(m);
      return m;
    };

    /** 崖の縦線。これが無いと、上から見た輪と見分けがつかない。 */
    const cliff = (r, color, opacity) => {
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, GY, Math.sin(a) * r));
        pts.push(new THREE.Vector3(Math.cos(a) * r, GY - DEPTH, Math.sin(a) * r));
      }
      const l = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity })
      );
      this.gMoat.add(l);
      return l;
    };

    // 外の岸と、溝の底・壁
    part(disc(R_OUT, R_BANK, GY, 0x243252, 0.6), 0.6);
    part(disc(0, R_OUT, GY - DEPTH, 0x02040a, 0.98), 0.98);
    part(wall(R_OUT, 0x070c16, 0.95, THREE.BackSide), 0.95); // 外側の崖（内から見た面）
    part(wall(R_ISLE, 0x162209, 0.98, THREE.FrontSide), 0.98); // 島の崖
    part(cliff(R_OUT, 0x53627e, 0.5), 0.5);
    part(cliff(R_ISLE, 0x4c7a12, 0.55), 0.55);
    part(ring(R_OUT, GY, 0x9fb0d0, 0.85), 0.85);
    part(ring(R_ISLE, GY, 0x9ede3a, 0.9), 0.9);
    part(ring(R_ISLE, GY - DEPTH, 0x4c7a12, 0.45), 0.45);

    /*
     * 溝を埋めている CUDA。まとめて上下できるよう、ひとつの群にして持つ。
     * 引くときはこの群ごと沈めて薄くする。
     */
    this.gCuda = new THREE.Group();
    this.gCuda.position.y = GY;
    this.gMoat.add(this.gCuda);
    this.cudaParts = [];
    const cudaPart = (obj, base) => {
      this.cudaParts.push({ obj, base });
      return obj;
    };
    cudaPart(disc(R_ISLE + 0.02, R_OUT - 0.02, 0, 0x76b900, 0.34, this.gCuda), 0.34);
    for (let k = 0; k < 5; k++) {
      const r = lerp(R_ISLE + 0.18, R_OUT - 0.18, k / 4);
      cudaPart(ring(r, 0.01, 0x9ede3a, 0.3, this.gCuda), 0.3);
    }
    this.cudaTag = makeLabel('CUDA が溝を埋めている', {
      fontSize: 26,
      height: 0.23,
      color: '#9ede3a',
      weight: 800,
    });
    this.cudaTag.position.set(0, 0.3, -(R_OUT - 0.32));
    this.gCuda.add(this.cudaTag);

    // NVIDIA の島
    part(disc(0, R_ISLE, GY, 0x16240a, 0.85), 0.85);
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.66, 1.6, 6),
      new THREE.MeshBasicMaterial({ color: 0x76b900, transparent: true, opacity: 0.25 })
    );
    tower.position.y = GY + 0.8;
    this.gMoat.add(tower);
    this.tower = tower;
    this.towerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.52, 0.66, 1.6, 6)),
      new THREE.LineBasicMaterial({ color: 0x9ede3a, transparent: true })
    );
    this.towerWire.position.copy(tower.position);
    this.gMoat.add(this.towerWire);

    const nv = makeLabel('NVIDIA', { fontSize: 42, height: 0.4, color: '#9ede3a', weight: 800 });
    nv.position.set(0, GY + 1.95, 0);
    this.gMoat.add(nv);
    this.nvTag = nv;

    // 島の上で回っている「世界中のAIコード」。すでに全部が内側にある。
    this.codeChips = ['PyTorch', 'JAX', 'vLLM', 'cuDNN'].map((t, i) => {
      const s = makeLabel(t, {
        fontSize: 21,
        height: 0.19,
        color: '#0d1505',
        bg: '#9ede3a',
        border: '#9ede3a',
        weight: 800,
      });
      s.userData.a = (i / 4) * Math.PI * 2;
      this.gMoat.add(s);
      return s;
    });

    // 競合は溝の中、CUDA の上に立っている。板でつながっているのも CUDA があるから。
    const rivals = [
      { t: 'AMD MI400', s: 'HBM4 432GB / ROCm', c: 0xff6b6b, a: 0.42 },
      { t: 'Google TPU', s: '外販せず自社クラウド内で', c: 0x5b9dff, a: 1.16 },
      { t: 'AWS Trainium', s: '自社クラウド専用', c: 0xffd166, a: 1.98 },
      { t: 'Microsoft Maia', s: '自社クラウド専用', c: 0xa78bfa, a: 2.72 },
    ];
    this.rivals = rivals.map((r) => {
      const x = Math.cos(r.a) * R_RIVAL;
      const z = Math.sin(r.a) * R_RIVAL;
      const hex = '#' + new THREE.Color(r.c).getHexString();

      const g = new THREE.Group();
      g.position.set(x, GY, z);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.72, 0.66),
        new THREE.MeshBasicMaterial({ color: r.c, transparent: true, opacity: 0.2 })
      );
      box.position.y = 0.36;
      g.add(box);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(0.66, 0.72, 0.66)),
        new THREE.LineBasicMaterial({ color: r.c, transparent: true })
      );
      wire.position.copy(box.position);
      g.add(wire);
      const lb = makeLabel(r.t, { fontSize: 26, height: 0.24, color: hex, weight: 800 });
      lb.position.set(0, 1.24, 0);
      g.add(lb);
      const sb = makeLabel(r.s, { fontSize: 19, height: 0.16, color: '#9fb0d0', weight: 600 });
      sb.position.set(0, 0.99, 0);
      g.add(sb);
      this.gMoat.add(g);

      // CUDA の上に架かった板。島とつながっているのはこれのおかげ。
      const span = R_RIVAL - R_ISLE;
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(span, 0.05, 0.3),
        new THREE.MeshBasicMaterial({ color: r.c, transparent: true, opacity: 0 })
      );
      const mid = R_ISLE + span / 2;
      deck.position.set(Math.cos(r.a) * mid, GY + 0.07, Math.sin(r.a) * mid);
      deck.rotation.y = -r.a;
      this.gMoat.add(deck);

      return { g, box, wire, lb, sb, deck, a: r.a, x, z };
    });

    this.moatCaptions = [
      { t: 'いまは CUDA の上に全員が乗っている', c: '#9ede3a' },
      { t: 'CUDA が無ければ、立つ土台も橋も残らない', c: '#ff8fa3' },
    ].map((d) => {
      const s = makeLabel(d.t, { fontSize: 30, height: 0.26, color: d.c, weight: 800 });
      s.position.set(0, GY + 2.6, 0);
      s.material.opacity = 0;
      this.gMoat.add(s);
      return s;
    });
    this.MOAT = { R_ISLE, R_OUT, R_RIVAL, GY, DEPTH };

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
    const parOut = outAt(bf, 1);
    const moatIn = inAt(bf, 1);
    const moatOut = outAt(bf, 2);
    const distIn = inAt(bf, 2);
    const fight = inAt(bf, 3);

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
      const { GY, DEPTH } = this.MOAT;

      /*
       * CUDA を抜くところまでを一巡させる。
       *   満ちている → CUDA が引く → 土台を失って落ちる → 暗転して元に戻る
       * スクロールを止めていても回るよう、進行はスクロールではなく時間で決める。
       */
      const T = ((time + 2.0) % 10) / 10;
      let drain = 0; // CUDA が引いた量
      let fall = 0; //  競合が落ちた量
      let vis = 1; //   競合の見え方（落ちきったら消して、元の位置で戻す）
      if (T < 0.44) {
        // 満ちている。まず「つながっている」状態を長めに見せる。
      } else if (T < 0.6) {
        drain = ease((T - 0.44) / 0.16);
      } else if (T < 0.84) {
        drain = 1;
        fall = ease((T - 0.6) / 0.24);
      } else if (T < 0.9) {
        drain = 1;
        fall = 1;
        vis = 1 - (T - 0.84) / 0.06;
      } else {
        // CUDA が戻り、競合も元の位置に戻る（地形と島は消さない）
        drain = 1 - ease((T - 0.9) / 0.1);
        vis = (T - 0.9) / 0.1;
      }
      const live = a;

      this.tower.material.opacity = live * 0.25;
      this.towerWire.material.opacity = live * 0.9;
      this.nvTag.material.opacity = live;
      this.moatParts.forEach((m) => (m.obj.material.opacity = live * m.base));

      // CUDA は群ごと沈めて薄くする
      this.gCuda.position.y = GY - drain * (DEPTH - 0.06);
      this.cudaParts.forEach((m) => (m.obj.material.opacity = live * m.base * (1 - drain)));
      this.cudaTag.material.opacity = live * (1 - drain);

      // 島の上を回るAIコード。すでに内側で動いているものたち。
      this.codeChips.forEach((s, i) => {
        const ang = s.userData.a + time * 0.35;
        s.position.set(
          Math.cos(ang) * 0.82,
          GY + 0.4 + Math.sin(time * 1.1 + i) * 0.05,
          Math.sin(ang) * 0.82
        );
        s.material.opacity = live * 0.95;
      });

      this.rivals.forEach((r, i) => {
        // 落ちる速さは少しずつずらす。同時に落ちると板が消えただけに見える。
        const f = clamp(fall * 1.5 - i * 0.12);
        const drop = f * f * (DEPTH + 0.45);
        r.g.position.set(r.x, GY - drop, r.z);
        r.g.rotation.set(f * 0.5, 0, f * 0.75);

        const t = live * vis * clamp(moatIn * 3 - i * 0.35);
        const sunk = 1 - f * 0.55; // 溝の底は暗い
        r.box.material.opacity = t * 0.2 * sunk;
        r.wire.material.opacity = t * 0.8 * sunk;
        r.lb.material.opacity = t * sunk;
        r.sb.material.opacity = t * (1 - f) * 0.85;
        // 板は CUDA の上に載っているので、CUDA が引くと一緒に落ちて消える
        r.deck.position.y = GY + 0.07 - drain * (DEPTH * 0.55);
        r.deck.material.opacity = t * 0.85 * (1 - drain);
      });

      this.moatCaptions[0].material.opacity = live * clamp(1 - drain * 2.4);
      this.moatCaptions[1].material.opacity = live * clamp(drain * 2.4 - 1.4);

      // 少しだけ回して立体だと分かるようにする。上から見下ろす角度は固定。
      this.gMoat.rotation.y = Math.sin(time * 0.08) * 0.1;
      this.gMoat.rotation.x = 0.5;
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
