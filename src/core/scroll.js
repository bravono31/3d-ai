const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

/** 3Dの追従の速さ。大きいほど機敏、小さいほどなめらか。 */
const DAMP = 11;
/** これ以上離れていたら補間せず飛ぶ（章ナビでのジャンプなど） */
const SNAP_GAP = 1.3;

// ── 解説カードの動き（位置の単位は画面高さ、1.0 = 画面の高さ）
const READ_WIDE = 0.38; // 止める位置。上端に消える少し手前
const READ_NARROW = 0.6; // 画面が狭いときは下寄りにして3Dの邪魔をしない
const APPEAR = 0.85; // ここから濃くなり始める
const ENTER = 0.55; // ここから減速して定位置へ寄せる
const HOLD_IN = 0.1; // ここから静止
const HOLD_OUT = 0.16; // ここまで静止
const EXIT = 0.85; // ここまでで消えきる
const EXIT_RISE = 0.78; // 抜けるときに上がる量（上端を完全に抜ける）

/**
 * カードの「画面上での中心Y」と濃さ。
 * t は読ませる位置から見た相対位置（画面高さ単位）。t<0 … まだ下 / t>0 … 通り過ぎた
 *
 * カードは position:fixed にしてあり、ブラウザのスクロールでは一切動かない。
 * 位置はすべてここで決める。こうしないと「静止」を作れない——
 * 通常フローのままスクロール量を transform で打ち消す方式だと、
 * 土台をコンポジタが動かし打ち消し量をJSが書くため両者がずれ、
 * 勢いをつけたときに毎フレーム震える。
 *
 *   下から上がる → 減速して定位置へ → 完全に静止 → 上へ抜けながら薄れる
 */
function cardState(t, read) {
  if (t < -APPEAR || t > EXIT) return null; // 画面外

  const flowing = read - t; // 普通に流れていたら居る位置
  let center;
  let scale;

  if (t < -ENTER) {
    center = flowing; // まだ普通に流れてくる
    scale = 0.985;
  } else if (t < -HOLD_IN) {
    const u = (t + ENTER) / (ENTER - HOLD_IN); // 0→1
    const w = easeOut(u); // 減速しながら
    center = flowing + (read - flowing) * w;
    scale = 0.985 + 0.015 * w;
  } else if (t <= HOLD_OUT) {
    center = read; // 完全に静止
    scale = 1;
  } else {
    const v = (t - HOLD_OUT) / (EXIT - HOLD_OUT); // 0→1
    center = read - EXIT_RISE * ease(v); // 動き出してから上へ抜ける
    scale = 1 + 0.03 * ease(v);
  }

  const fadeIn = ease(clamp((t + APPEAR) / 0.42));
  // 消えるのは動きより後ろ。先に薄くなると「その場で消えた」ように見える
  const v = t <= HOLD_OUT ? 0 : (t - HOLD_OUT) / (EXIT - HOLD_OUT);
  const fadeOut = ease(clamp((v - 0.3) / 0.62));

  return { center, o: fadeIn * (1 - fadeOut), s: scale };
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
  constructor({ chapterEls, beatRefs, interludeEls = [] }) {
    this.chapterEls = chapterEls;
    this.interludeEls = interludeEls;
    this.byChapter = chapterEls.map((_, ci) => beatRefs.filter((b) => b.ci === ci));
    this.layout = [];
    this.ilLayout = [];
    this.smooth = 0;
    this.smoothChapter = -1;
    this.state = { chapter: 0, beat: 0, beatFloat: 0, p: 0, docProgress: 0 };
    this.refresh();

    // 章やカードの高さが変わったら測り直す（リサイズ・モード切替・フォント読み込み）
    // カードは fixed で章の高さに影響しないため、カード自身も見張る
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.refresh());
      chapterEls.forEach((el) => this._ro.observe(el));
      beatRefs.forEach((b) => this._ro.observe(b.card));
    }
    window.addEventListener('resize', () => this.refresh());
  }

  /** 要素の位置をドキュメント座標で測り直す */
  refresh() {
    const sy = window.scrollY;
    this.layout = this.chapterEls.map((el, ci) => {
      const r = el.getBoundingClientRect();
      const beats = this.byChapter[ci].map((b) => ({
        center: b.el.getBoundingClientRect().top + sy + b.el.offsetHeight / 2,
        // カードは fixed なので、自分の高さから中心合わせの分を引く必要がある
        h: b.card.offsetHeight,
        ref: b,
      }));
      return { top: r.top + sy, bottom: r.bottom + sy, beats };
    });
    this.ilLayout = this.interludeEls.map((el) => {
      const r = el.getBoundingClientRect();
      return { center: r.top + sy + el.offsetHeight / 2, h: el.offsetHeight, el };
    });
    this.docHeight = document.documentElement.scrollHeight - window.innerHeight;
    this.read = window.innerWidth >= 900 ? READ_WIDE : READ_NARROW;
  }

  /**
   * 区切りページの見え方。画面の中央に近いほど 1。
   * 戻り値は「いま区切りがどれだけ画面を占めているか」で、3Dを引っ込める量に使う。
   */
  _paintInterludes(focus, vh) {
    let cover = 0;
    for (const il of this.ilLayout) {
      const d = Math.abs(focus - il.center) / (vh * 0.62);
      const v = ease(clamp(1 - d));
      if (v > cover) cover = v;
      if (Math.abs((il._v ?? -1) - v) > 0.004) {
        il._v = v;
        const s = il.el.style;
        s.setProperty('--il', v.toFixed(3));
        s.setProperty('--il-y', ((1 - v) * 34).toFixed(1) + 'px');
      }
    }
    return cover;
  }

  /**
   * 全ビートのカードを更新する。
   *
   * 「近くの章だけ」に絞ると、目次で遠くへ飛んだときに飛ぶ前の章のカードが
   * 更新されないまま残る——カードは fixed なので、消す指示が来ない限り
   * 画面に貼りついたままになり、飛んだ先のカードと重なって見える。
   * 画面外のカードは cardState が即 null を返し、_on を見て抜けるので全部回しても軽い。
   */
  _paintCards(focus, vh) {
    for (const L of this.layout) {
      for (const b of L.beats) {
        const t = (focus - b.center) / vh;
        const st = cardState(t, this.read);
        const ref = b.ref;

        if (!st) {
          if (ref._on !== false) {
            ref._on = false;
            ref.card.style.setProperty('--card-o', '0');
            ref.card.classList.remove('is-active');
            ref._active = false;
            // 消したことを控えておく。ここを忘れると、目次で同じビートへ飛び直したとき
            // 「前回と同じ濃さ・同じ位置」と判断されてスタイルが書かれず、カードが出てこない。
            ref._o = 0;
            ref._y = null;
          }
          continue;
        }

        ref._on = true;
        const y = st.center * vh - b.h / 2;
        // ほとんど変わらないときは触らない（毎フレームのスタイル再計算を避ける）
        if (Math.abs((ref._o ?? -1) - st.o) > 0.004 || Math.abs((ref._y ?? 1e9) - y) > 0.25) {
          ref._o = st.o;
          ref._y = y;
          const s = ref.card.style;
          s.setProperty('--card-o', st.o.toFixed(3));
          s.setProperty('--card-y', y.toFixed(1) + 'px');
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

    this._paintCards(focus, vh);
    const interlude = this._paintInterludes(focus, vh);

    this.state = {
      interlude,
      chapter: ci,
      beat: Math.max(0, Math.min(centers.length - 1, Math.round(this.smooth))),
      beatFloat: this.smooth,
      p: centers.length > 1 ? clamp(this.smooth / (centers.length - 1)) : 0,
      docProgress: clamp(window.scrollY / Math.max(this.docHeight, 1)),
    };
    return this.state;
  }
}
