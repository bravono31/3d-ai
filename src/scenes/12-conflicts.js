import * as THREE from 'three';
import { BaseScene, seg, ease, easeOut, lerp, clamp, rng, inAt, outAt } from '../core/BaseScene.js';
import { makeLabel } from '../core/label.js';

const BOOKS = 64;
const DATA_PTS = 2600;

export default class ConflictsScene extends BaseScene {
  build() {
    const rand = rng(31415);
    this.camera.position.set(0, 0.3, 11.4);

    // ══════ 0: プロジェクト・パナマ（本 → 裁断 → データ）
    this.gScan = new THREE.Group();
    this.root.add(this.gScan);

    const bookGeo = new THREE.BoxGeometry(0.07, 0.92, 0.64);
    this.books = new THREE.InstancedMesh(
      bookGeo,
      new THREE.MeshBasicMaterial({ transparent: true }),
      BOOKS
    );
    this.books.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BOOKS * 3), 3);
    const c = new THREE.Color();
    this.bookSeed = [];
    for (let i = 0; i < BOOKS; i++) {
      c.setHSL(0.06 + rand() * 0.12, 0.35 + rand() * 0.3, 0.32 + rand() * 0.22);
      this.books.setColorAt(i, c);
      this.bookSeed.push({
        t: rand(),
        y: (rand() - 0.5) * 1.5,
        z: (rand() - 0.5) * 1.2,
        rz: (rand() - 0.5) * 0.25,
      });
    }
    this.books.instanceColor.needsUpdate = true;
    this.gScan.add(this.books);

    // 裁断・スキャン面
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 3.2),
      new THREE.MeshBasicMaterial({
        color: 0xff6b6b,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    blade.position.set(0, 0, 0);
    this.gScan.add(blade);
    this.blade = blade;
    const bladeGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 3.4),
      new THREE.MeshBasicMaterial({
        color: 0xff6b6b,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.gScan.add(bladeGlow);
    this.bladeGlow = bladeGlow;

    // 電子化されたデータ
    const dp = new Float32Array(DATA_PTS * 3);
    this.dataSeed = [];
    for (let i = 0; i < DATA_PTS; i++) {
      const x = 0.3 + rand() * 4.6;
      const y = (rand() - 0.5) * 2.9;
      const z = (rand() - 0.5) * 2.2;
      dp[i * 3] = x;
      dp[i * 3 + 1] = y;
      dp[i * 3 + 2] = z;
      this.dataSeed.push(rand());
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.data = new THREE.Points(
      dg,
      new THREE.PointsMaterial({
        color: 0x7fe3d8,
        size: 0.045,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.gScan.add(this.data);

    this.scanTags = [
      { t: '購入した本', x: -3.9, y: -2.1, c: '#d8b48a' },
      { t: '裁断・高速スキャン', x: 0, y: -2.1, c: '#ff8fa3' },
      { t: '学習データ', x: 2.9, y: -2.1, c: '#7fe3d8' },
    ].map((d) => {
      const s = makeLabel(d.t, { fontSize: 28, height: 0.25, color: d.c, weight: 800 });
      s.position.set(d.x, d.y, 0);
      this.gScan.add(s);
      return s;
    });
    this.scanTitle = makeLabel('Project Panama（2024）　50万〜200万冊、原本は残さない', {
      fontSize: 30,
      height: 0.26,
      color: '#eaf3ff',
      weight: 800,
    });
    this.scanTitle.position.set(0, 2.7, 0);
    this.gScan.add(this.scanTitle);

    this.scanNote = makeLabel('2025：海賊版データを巡り約15億ドルで和解（責任は認めず）', {
      fontSize: 25,
      height: 0.22,
      color: '#ffd166',
      weight: 700,
    });
    this.scanNote.position.set(0, -2.75, 0);
    this.scanNote.material.opacity = 0;
    this.gScan.add(this.scanNote);

    // ══════ 1: 訴訟（天秤）
    this.gSuit = new THREE.Group();
    this.gSuit.visible = false;
    this.root.add(this.gSuit);

    this.suitBeam = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.1, 0.26),
      new THREE.MeshBasicMaterial({ color: 0xcfe0f7, transparent: true })
    );
    this.gSuit.add(this.suitBeam);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.16, 2.4, 8),
      new THREE.MeshBasicMaterial({ color: 0x51617f, transparent: true })
    );
    post.position.y = -1.2;
    this.gSuit.add(post);
    this.suitPost = post;

    const mkSide = (title, lines, color, sign) => {
      const g = new THREE.Group();
      const hex = '#' + new THREE.Color(color).getHexString();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(2.9, 1.35, 1.0),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 })
      );
      g.add(box);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(2.9, 1.35, 1.0)),
        new THREE.LineBasicMaterial({ color, transparent: true })
      );
      g.add(wire);
      const lb = makeLabel(title, { fontSize: 32, height: 0.3, color: hex, weight: 800 });
      lb.position.set(0, 0.35, 0.55);
      g.add(lb);
      const sb = makeLabel(lines, {
        fontSize: 21,
        height: 0.34,
        color: '#c3d3ee',
        weight: 600,
        lineGap: 1.28,
      });
      sb.position.set(0, -0.25, 0.55);
      g.add(sb);
      g.userData = { box, wire, lb, sb, sign };
      this.gSuit.add(g);
      return g;
    };
    this.sideL = mkSide('報道機関', 'NYT ほか出版社\n記事を無断で学習された', 0x8ab6ff, -1);
    this.sideR = mkSide('AI企業', 'OpenAI / Microsoft\n変容的利用だと主張', 0x7ee081, 1);

    this.suitTitle = makeLabel('NYT v. OpenAI・Microsoft（2023-12 提訴、2026-07 未決着）', {
      fontSize: 29,
      height: 0.25,
      color: '#eaf3ff',
      weight: 800,
    });
    this.suitTitle.position.set(0, 2.6, 0);
    this.gSuit.add(this.suitTitle);

    this.suitNote = makeLabel(
      '2026-07-09：出版社側が制裁を申立て（証拠開示の不誠実・ログ削除）\n' +
        '2025-11：英国 Getty v. Stability は Stability 勝訴 — 国と論点で結論が割れる',
      { fontSize: 24, height: 0.42, color: '#ffd166', weight: 700, lineGap: 1.3 }
    );
    this.suitNote.position.set(0, -2.65, 0);
    this.gSuit.add(this.suitNote);

    // ══════ 2: 国家の線（輸出規制・サービス遮断）
    this.gState = new THREE.Group();
    this.gState.visible = false;
    this.root.add(this.gState);

    const wallGeo = new THREE.BoxGeometry(0.22, 2.6, 1.4);
    this.wall = new THREE.Mesh(
      wallGeo,
      new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.22 })
    );
    this.wall.position.set(0, 0.6, 0);
    this.gState.add(this.wall);
    this.wallWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(wallGeo),
      new THREE.LineBasicMaterial({ color: 0xff6b6b, transparent: true })
    );
    this.wallWire.position.copy(this.wall.position);
    this.gState.add(this.wallWire);

    const chipGeo = new THREE.BoxGeometry(0.3, 0.3, 0.06);
    this.chips = new THREE.InstancedMesh(
      chipGeo,
      new THREE.MeshBasicMaterial({ color: 0x9ede3a, transparent: true }),
      26
    );
    this.chipSeed = [];
    for (let i = 0; i < 26; i++) {
      this.chipSeed.push({ t: i / 26, leak: i % 5 === 0, y: (i % 7) * 0.32 - 0.9 });
    }
    this.gState.add(this.chips);

    this.stateTags = [
      { t: '米国：先端チップの輸出規制', x: -3.6, y: 2.35, c: '#9ede3a' },
      { t: '中国：迂回・密輸で一部が流入', x: 3.6, y: 2.35, c: '#ff9aa5' },
      { t: '2026-03  Chip Security Act：チップに追跡技術を埋め込む', x: 0, y: -1.55, c: '#ffd166' },
      { t: '逆方向：伊・独などが DeepSeek を個人データ保護で遮断', x: 0, y: -2.05, c: '#8ab6ff' },
    ].map((d) => {
      const s = makeLabel(d.t, { fontSize: 26, height: 0.23, color: d.c, weight: 700 });
      s.position.set(d.x, d.y, 0.9);
      this.gState.add(s);
      return s;
    });

    // ══════ 3: 3つの層に、3つの法
    this.gLaw = new THREE.Group();
    this.gLaw.visible = false;
    this.root.add(this.gLaw);

    const laws = [
      { t: '取得', d: 'データをどう集めたか', l: '著作権法', c: 0xff6b6b },
      { t: '利用', d: '何に使ってよいか', l: 'データ保護法・AI規制', c: 0xffd166 },
      { t: '流通', d: 'どこへ出してよいか', l: '輸出管理', c: 0x8ab6ff },
    ];
    this.laws = laws.map((L, i) => {
      const g = new THREE.Group();
      g.position.set(0, 1.6 - i * 1.6, 0);
      const hex = '#' + new THREE.Color(L.c).getHexString();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.4 - i * 0.05, 0.055, 8, 64),
        new THREE.MeshBasicMaterial({ color: L.c, transparent: true })
      );
      ring.rotation.x = Math.PI / 2.1;
      g.add(ring);
      const t = makeLabel(L.t, { fontSize: 44, height: 0.42, color: hex, weight: 800 });
      t.position.set(-2.9, 0.1, 0);
      g.add(t);
      const d = makeLabel(L.d, { fontSize: 24, height: 0.21, color: '#c3d3ee', weight: 600 });
      d.position.set(0, 0.22, 0);
      g.add(d);
      const l = makeLabel('→ ' + L.l, { fontSize: 26, height: 0.23, color: hex, weight: 800 });
      l.position.set(0, -0.2, 0);
      g.add(l);
      this.gLaw.add(g);
      return { g, ring, t, d, l };
    });

    this.lawNote = makeLabel('担当する法律が違い、しかも国ごとに答えが違う', {
      fontSize: 30,
      height: 0.26,
      color: '#eaf3ff',
      weight: 800,
    });
    this.lawNote.position.set(0, 3.3, 0);
    this.gLaw.add(this.lawNote);
  }

  update(p, bf, dt, time) {
    const scan = easeOut(this.enter(dt));
    const scanOut = outAt(bf, 1);
    const suit = inAt(bf, 1) * (1 - outAt(bf, 2));
    const state = inAt(bf, 2) * (1 - outAt(bf, 3));
    const law = inAt(bf, 3);

    // ── スキャン
    this.gScan.visible = bf < 1.05;
    if (this.gScan.visible) {
      const a = scan * (1 - scanOut);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const v = new THREE.Vector3();
      const s = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < BOOKS; i++) {
        const sd = this.bookSeed[i];
        const t = (sd.t + time * 0.09) % 1;
        // 0→0.55 で刃へ向かい、そこから先は消える
        const x = lerp(-5.4, 0, Math.min(1, t / 0.55));
        const cut = clamp((t - 0.55) / 0.12);
        v.set(x, sd.y, sd.z);
        q.setFromEuler(new THREE.Euler(0, 0, sd.rz + cut * 0.5));
        s.set(1, 1 - cut, 1 - cut * 0.6);
        m.compose(v, q, s);
        this.books.setMatrixAt(i, m);
      }
      this.books.instanceMatrix.needsUpdate = true;
      this.books.material.opacity = a;

      const flash = 0.55 + Math.sin(time * 9) * 0.45;
      this.blade.material.opacity = a * (0.5 + flash * 0.5);
      this.bladeGlow.material.opacity = a * 0.12 * flash;

      this.data.material.opacity = a * 0.85;
      this.scanTags.forEach((t2) => (t2.material.opacity = a));
      this.scanTitle.material.opacity = a;
      this.scanNote.material.opacity = clamp(scan * 2 - 1.1) * (1 - scanOut);
      this.gScan.rotation.y = Math.sin(time * 0.1) * 0.06;
    }

    // ── 訴訟
    this.gSuit.visible = suit > 0.01;
    if (this.gSuit.visible) {
      const tilt = Math.sin(time * 0.7) * 0.1;
      this.suitBeam.rotation.z = tilt;
      this.suitBeam.material.opacity = suit * 0.9;
      this.suitPost.material.opacity = suit * 0.8;
      [this.sideL, this.sideR].forEach((sd) => {
        const sg = sd.userData.sign;
        sd.position.set(sg * 2.9, Math.sin(tilt) * 2.9 * sg - 1.15, 0);
        sd.userData.box.material.opacity = suit * 0.16;
        sd.userData.wire.material.opacity = suit * 0.85;
        sd.userData.lb.material.opacity = suit;
        sd.userData.sb.material.opacity = suit * 0.9;
      });
      this.suitTitle.material.opacity = suit;
      this.suitNote.material.opacity = clamp(suit * 1.7 - 0.5);
      this.gSuit.position.y = 0.5;
    }

    // ── 国家の線
    this.gState.visible = state > 0.01;
    if (this.gState.visible) {
      this.wall.material.opacity = state * 0.22;
      this.wallWire.material.opacity = state * 0.9;
      const m = new THREE.Matrix4();
      for (let i = 0; i < 26; i++) {
        const sd = this.chipSeed[i];
        let t = (sd.t + time * 0.11) % 1;
        // 大半は壁で止まり、一部（密輸）だけ迂回して抜ける
        let x, y, z;
        if (sd.leak) {
          x = lerp(-5.2, 5.2, t);
          y = sd.y + Math.sin(t * Math.PI) * 2.1;
          z = Math.sin(t * Math.PI) * 1.6;
        } else {
          const stop = Math.min(t, 0.47);
          x = lerp(-5.2, 5.2, stop);
          y = sd.y + Math.sin(stop * 6) * 0.06;
          z = 0;
        }
        m.makeTranslation(x, y, z);
        this.chips.setMatrixAt(i, m);
      }
      this.chips.instanceMatrix.needsUpdate = true;
      this.chips.material.opacity = state * 0.95;
      this.stateTags.forEach((t2, i) => (t2.material.opacity = clamp(state * 2 - i * 0.22)));
      this.gState.rotation.y = Math.sin(time * 0.12) * 0.07;
    }

    // ── 3層3法
    this.gLaw.visible = law > 0.01;
    if (this.gLaw.visible) {
      this.laws.forEach((L, i) => {
        const t = easeOut(clamp(law * 2.6 - i * 0.42));
        L.ring.material.opacity = t * 0.85;
        L.t.material.opacity = t;
        L.d.material.opacity = t * 0.9;
        L.l.material.opacity = t;
        L.ring.rotation.z = time * (0.1 + i * 0.05) * (i % 2 ? -1 : 1);
        L.g.position.z = Math.sin(time * 0.6 + i) * 0.12;
      });
      this.lawNote.material.opacity = clamp(law * 2 - 0.9);
      this.gLaw.rotation.x = 0.08;
    }

    this.camera.position.set(0, 0.25, lerp(11.4, 12.4, clamp(bf / 3)));
    this.camera.lookAt(0, 0.15, 0);
  }
}
