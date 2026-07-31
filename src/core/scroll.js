const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** 追従の速さ。大きいほど機敏、小さいほどなめらか。 */
const DAMP = 11;
/** これ以上離れていたら補間せず飛ぶ（章ナビでのジャンプなど） */
const SNAP_GAP = 1.3;

/**
 * スクロール位置から「今どの章のどこにいるか」を算出する。
 *
 * 毎フレーム getBoundingClientRect() を呼ぶとレイアウトが強制され、
 * ホイール操作が引っかかる。そこで各要素の位置は一度だけ測って持ち、
 * 以降は window.scrollY だけで計算する（refresh() で測り直す）。
 *
 * さらにホイールは1ノッチごとに離散的に飛ぶため、生の値をそのまま3Dに渡すと
 * カクつく。時間ベースの減衰で追従させ、コマ落ちしても速度が変わらないようにする。
 */
export class ScrollTracker {
  constructor({ chapterEls, beatRefs }) {
    this.chapterEls = chapterEls;
    this.byChapter = chapterEls.map((_, ci) => beatRefs.filter((b) => b.ci === ci));
    this.layout = [];
    this.smooth = 0;
    this.smoothChapter = -1;
    this.state = {
      chapter: 0,
      beat: 0,
      beatFloat: 0,
      p: 0,
      docProgress: 0,
    };
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

    // 減衰つきで追従。章をまたいだ瞬間と、大きく離れたときは即座に合わせる。
    if (ci !== this.smoothChapter || Math.abs(raw - this.smooth) > SNAP_GAP) {
      this.smooth = raw;
      this.smoothChapter = ci;
    } else {
      this.smooth += (raw - this.smooth) * (1 - Math.exp(-dt * DAMP));
    }
    const beatFloat = this.smooth;

    // カードの見え方（中心に近いほど濃い）。近くのカードだけ書き換える。
    this.layout[ci].beats.forEach((b, i) => {
      const d = Math.abs(beatFloat - i);
      const vis = d > 2 ? 0 : clamp(1 - d * 1.15);
      const st = b.ref.card.style;
      // 値がほぼ変わらないときは触らない（毎フレームのスタイル再計算を避ける）
      if (Math.abs((b.ref._vis ?? -1) - vis) > 0.004) {
        b.ref._vis = vis;
        st.setProperty('--vis', vis.toFixed(3));
        st.setProperty('--shift', ((beatFloat - i) * 26).toFixed(1) + 'px');
        b.ref.card.classList.toggle('is-active', d < 0.5);
      }
    });

    this.state = {
      chapter: ci,
      beat: Math.max(0, Math.min(centers.length - 1, Math.round(beatFloat))),
      beatFloat,
      p: centers.length > 1 ? clamp(beatFloat / (centers.length - 1)) : 0,
      docProgress: clamp(window.scrollY / Math.max(this.docHeight, 1)),
    };
    return this.state;
  }
}
