const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

/** 3Dの追従の速さ。大きいほど機敏、小さいほどなめらか。 */
const DAMP = 11;
/** これ以上離れていたら補間せず飛ぶ（章ナビでのジャンプなど） */
const SNAP_GAP = 1.3;

// ── 解説カードの動き（単位はすべて画面高さ）
const READ = 0.48; // 読ませる位置（画面の上寄り）
const APPEAR = 0.85; // ここから濃くなり始める
const ENTER = 0.55; // ここから減速して定位置へ寄せる
const HOLD_IN = 0.1; // ここから静止
const HOLD_OUT = 0.16; // ここまで静止
const EXIT = 0.85; // ここまでで消えきる
const EXIT_RISE = 0.62; // 抜けるときに上がる量

/**
 * カードの位置と濃さ。t は「読んでいる位置」から見た相対位置（画面高さ単位）。
 * t < 0 … まだ下にいる / t > 0 … 通り過ぎた
 *
 * 大事なのは、カードは何もしなくてもスクロールと一緒に画面を上がっていくこと。
 * 「止める」には、その分を transform で打ち消して画面上の位置を固定する必要がある。
 * そこで扱う値を「画面上のどこに見せたいか（screen）」に統一し、
 * 自然位置との差を translateY として出す。
 *
 *   下から上がる → 減速して定位置へ → 画面に固定して静止 → ふわっと上へ抜ける
 */
function cardState(t, vh) {
  if (t < -APPEAR || t > EXIT) return null; // 画面外

  const natural = READ - t; // 何もしなければ居る位置
  let screen;
  let scale;

  if (t < -ENTER) {
    screen = natural; // まだ普通に流れてくる
    scale = 0.985;
  } else if (t < -HOLD_IN) {
    const u = (t + ENTER) / (ENTER - HOLD_IN); // 0→1
    const w = easeOut(u); // 減速しながら
    screen = natural + (READ - natural) * w;
    scale = 0.985 + 0.015 * w;
  } else if (t <= HOLD_OUT) {
    screen = READ; // 画面上で完全に静止
    scale = 1;
  } else {
    const v = (t - HOLD_OUT) / (EXIT - HOLD_OUT); // 0→1
    screen = READ - EXIT_RISE * easeIn(v); // ゆっくり離れ、加速して上へ
    scale = 1 + 0.02 * easeIn(v);
  }

  const fadeIn = ease(clamp((t + APPEAR) / 0.4));
  const fadeOut = t <= HOLD_OUT ? 0 : ease(clamp((t - HOLD_OUT) / (EXIT - HOLD_OUT) / 0.9));

  return { y: (screen - natural) * vh, o: fadeIn * (1 - fadeOut), s: scale };
}

/**
 * スクロール位置から「今どの章のどこにいるか」を算出する。
 *
 * 毎フレーム getBoundingClientRect() を呼ぶとレイアウトが強制され、
 * ホイール操作が引っかかる。そこで各要素の位置は一度だけ測って持ち、
 * 以降は window.scrollY だけで計算する（refresh() で測り直す）。
 *
 * 3Dはホイールの離散的な移動をそのまま渡すとカクつくので減衰させるが、
 * カードは本文なので生のスクロール位置に直結させ、遅れを感じさせない。
 */
export class ScrollTracker {
  constructor({ chapterEls, beatRefs }) {
    this.chapterEls = chapterEls;
    this.byChapter = chapterEls.map((_, ci) => beatRefs.filter((b) => b.ci === ci));
    this.layout = [];
    this.smooth = 0;
    this.smoothChapter = -1;
    this.state = { chapter: 0, beat: 0, beatFloat: 0, p: 0, docProgress: 0 };
    this.refresh();

    // 章やカードの高さが変わったら測り直す（リサイズ・モード切替・フォント読み込み）
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.refresh());
      chapterEls.forEach((el) => this._ro.observe(el));
    }
    window.addEventListener('resize', () => this.refresh());
  }

  /** 要素の位置をドキュメント座標で測り直す */
  refresh() {
    const sy = window.scrollY;
    this.layout = this.chapterEls.map((el, ci) => {
      const r = el.getBoundingClientRect();
      const beats = this.byChapter[ci].map((b) => {
        const br = b.el.getBoundingClientRect();
        return { center: br.top + sy + br.height / 2, ref: b };
      });
      return { top: r.top + sy, bottom: r.bottom + sy, beats };
    });
    this.docHeight = document.documentElement.scrollHeight - window.innerHeight;
  }

  /** 前後の章ぶんだけカードを更新する（章をまたぐ瞬間にカードが飛び出さないように） */
  _paintCards(ci, focus, vh) {
    for (let c = Math.max(0, ci - 1); c <= Math.min(this.layout.length - 1, ci + 1); c++) {
      for (const b of this.layout[c].beats) {
        const t = (focus - b.center) / vh;
        const st = cardState(t, vh);
        const ref = b.ref;

        if (!st) {
          if (ref._on !== false) {
            ref._on = false;
            ref.card.style.setProperty('--card-o', '0');
            ref.card.classList.remove('is-active');
          }
          continue;
        }

        ref._on = true;
        // ほとんど変わらないときは触らない（毎フレームのスタイル再計算を避ける）
        if (Math.abs((ref._o ?? -1) - st.o) > 0.004 || Math.abs((ref._y ?? 1e9) - st.y) > 0.3) {
          ref._o = st.o;
          ref._y = st.y;
          const s = ref.card.style;
          s.setProperty('--card-o', st.o.toFixed(3));
          s.setProperty('--card-y', st.y.toFixed(1) + 'px');
          s.setProperty('--card-s', st.s.toFixed(4));
        }
        const active = t > -0.25 && t < 0.3;
        if (active !== ref._active) {
          ref._active = active;
          ref.card.classList.toggle('is-active', active);
        }
      }
    }
  }

  measure(dt) {
    const vh = window.innerHeight;
    const focus = window.scrollY + vh * 0.48; // 画面のやや上を「読んでいる位置」とみなす

    // フォーカス線を含む章。どこにも当たらなければ最も近い章。
    let ci = this.layout.findIndex((L) => L.top <= focus && L.bottom >= focus);
    if (ci === -1) {
      let best = Infinity;
      this.layout.forEach((L, i) => {
        const d = L.top > focus ? L.top - focus : focus - L.bottom;
        if (d < best) {
          best = d;
          ci = i;
        }
      });
    }

    // ビート位置を、各ビートカードの中心の並びから線形補間する
    const centers = this.layout[ci].beats.map((b) => b.center);
    let raw = 0;
    if (centers.length > 1) {
      if (focus <= centers[0]) raw = 0;
      else if (focus >= centers[centers.length - 1]) raw = centers.length - 1;
      else {
        for (let i = 0; i < centers.length - 1; i++) {
          if (focus >= centers[i] && focus <= centers[i + 1]) {
            raw = i + (focus - centers[i]) / (centers[i + 1] - centers[i] || 1);
            break;
          }
        }
      }
    }

    // 3Dは減衰つきで追従。章をまたいだ瞬間と、大きく離れたときは即座に合わせる。
    if (ci !== this.smoothChapter || Math.abs(raw - this.smooth) > SNAP_GAP) {
      this.smooth = raw;
      this.smoothChapter = ci;
    } else {
      this.smooth += (raw - this.smooth) * (1 - Math.exp(-dt * DAMP));
    }

    this._paintCards(ci, focus, vh);

    this.state = {
      chapter: ci,
      beat: Math.max(0, Math.min(centers.length - 1, Math.round(this.smooth))),
      beatFloat: this.smooth,
      p: centers.length > 1 ? clamp(this.smooth / (centers.length - 1)) : 0,
      docProgress: clamp(window.scrollY / Math.max(this.docHeight, 1)),
    };
    return this.state;
  }
}
