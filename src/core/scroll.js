const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * スクロール位置から「今どの章のどこにいるか」を毎フレーム算出する。
 * 章の進捗 p はビートカードの中心位置から補間するので、
 * 章の前後に余白があっても正しい値になる。
 */
export class ScrollTracker {
  constructor({ chapterEls, beatRefs }) {
    this.chapterEls = chapterEls;
    // 章ごとにビート要素をまとめておく
    this.byChapter = chapterEls.map((_, ci) => beatRefs.filter((b) => b.ci === ci));
    this.state = {
      chapter: -1,
      beat: 0,
      beatFloat: 0,
      p: 0,
      inChapters: false,
      docProgress: 0,
    };
  }

  measure() {
    const vh = window.innerHeight;
    const focus = vh * 0.48; // 画面のやや上を「読んでいる位置」とみなす
    const rects = this.chapterEls.map((el) => el.getBoundingClientRect());

    // アクティブな章＝フォーカス線を含む章。どこにも当たらなければ最も近い章。
    let ci = rects.findIndex((r) => r.top <= focus && r.bottom >= focus);
    const inChapters = ci !== -1;
    if (!inChapters) {
      let best = Infinity;
      rects.forEach((r, i) => {
        const d = r.top > focus ? r.top - focus : focus - r.bottom;
        if (d < best) {
          best = d;
          ci = i;
        }
      });
    }

    // ビート位置を、各ビートカードの中心の並びから線形補間する
    const beats = this.byChapter[ci];
    const centers = beats.map((b) => {
      const r = b.el.getBoundingClientRect();
      return r.top + r.height / 2;
    });

    let beatFloat = 0;
    if (centers.length === 1) {
      beatFloat = 0;
    } else if (focus <= centers[0]) {
      beatFloat = 0;
    } else if (focus >= centers[centers.length - 1]) {
      beatFloat = centers.length - 1;
    } else {
      for (let i = 0; i < centers.length - 1; i++) {
        if (focus >= centers[i] && focus <= centers[i + 1]) {
          const span = centers[i + 1] - centers[i] || 1;
          beatFloat = i + (focus - centers[i]) / span;
          break;
        }
      }
    }

    const p = centers.length > 1 ? beatFloat / (centers.length - 1) : clamp((focus - rects[ci].top) / Math.max(rects[ci].height, 1));

    // カードの見え方（中心に近いほど濃い）
    beats.forEach((b, i) => {
      const d = Math.abs(beatFloat - i);
      const vis = clamp(1 - d * 1.15);
      b.card.style.setProperty('--vis', vis.toFixed(3));
      b.card.style.setProperty('--shift', ((beatFloat - i) * 26).toFixed(1) + 'px');
      b.card.classList.toggle('is-active', d < 0.5);
    });

    const docH = document.documentElement.scrollHeight - vh;
    this.state = {
      chapter: ci,
      beat: Math.max(0, Math.min(beats.length - 1, Math.round(beatFloat))),
      beatFloat,
      p: clamp(p),
      inChapters,
      docProgress: clamp(window.scrollY / Math.max(docH, 1)),
    };
    return this.state;
  }
}
