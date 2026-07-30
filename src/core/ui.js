import { chapters, references } from '../data/content.js';
import { getMode, setMode, onModeChange } from './mode.js';

const pad2 = (n) => String(n).padStart(2, '0');

/** #doc の中身と右側のナビを組み立て、あとから参照する要素を返す */
export function buildDOM() {
  const doc = document.getElementById('doc');
  const nav = document.getElementById('chapnav');

  // ── ヒーロー
  const hero = document.createElement('section');
  hero.id = 'hero';
  hero.innerHTML = `
    <div class="hero-inner">
      <p class="eyebrow">3D VISUAL EXPLAINER · 2026</p>
      <h1>AIは、<br>どうやって<br><em>ことば</em>を作るのか</h1>
      <p class="lede">
        LLMの仕組みから、画像・動画生成の原理、主要メーカーの系譜、
        地域ごとの戦略、そしてチャットとエージェントの違いまで。
        スクロールすると3Dの解説が進みます。
      </p>
      <div class="hero-hints">
        <span class="hint">↓ スクロールで進む</span>
        <span class="hint">右上で「音声」と「くわしさ」を切替</span>
      </div>
    </div>`;
  doc.appendChild(hero);

  // ── 各章
  const beatRefs = [];
  const chapterEls = [];

  chapters.forEach((ch, ci) => {
    const sec = document.createElement('section');
    sec.className = 'chapter';
    sec.dataset.id = ch.id;
    sec.dataset.index = String(ci);

    ch.beats.forEach((b, bi) => {
      const beat = document.createElement('div');
      beat.className = 'beat';
      beat.dataset.beat = String(bi);

      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-meta">
          <span class="ch-no">${pad2(ch.no)}</span>
          <span class="ch-ttl">${ch.title}</span>
          <span class="ch-sub">${ch.subtitle}</span>
        </div>
        <h2 class="beat-h"></h2>
        <div class="beat-body"></div>`;

      beat.appendChild(card);
      sec.appendChild(beat);

      beatRefs.push({
        ci,
        bi,
        el: beat,
        card,
        headEl: card.querySelector('.beat-h'),
        bodyEl: card.querySelector('.beat-body'),
        data: b,
      });
    });

    doc.appendChild(sec);
    chapterEls.push(sec);
  });

  // ── 参考文献
  const refs = document.createElement('section');
  refs.id = 'refs';
  refs.innerHTML = `
    <div class="refs-inner">
      <h2>参考文献・出典</h2>
      <p class="refs-note">
        モデルの世代や順位は数か月単位で入れ替わります。本ページの市況に関する記述は
        <strong>${references.fetchedAt}</strong> 時点で参照した情報にもとづきます。
      </p>
      ${references.groups
        .map(
          (g) => `
        <div class="ref-group">
          <h3>${g.label}</h3>
          <ul>${g.items
            .map((i) => `<li><a href="${i.u}" target="_blank" rel="noopener">${i.t}</a></li>`)
            .join('')}</ul>
        </div>`
        )
        .join('')}
      <p class="refs-foot">
        音声はブラウザ内蔵の Web Speech API による読み上げです。外部サーバーへの送信はありません。
      </p>
    </div>`;
  doc.appendChild(refs);

  // ── 章ナビ
  chapters.forEach((ch, ci) => {
    const a = document.createElement('button');
    a.className = 'navdot';
    a.dataset.index = String(ci);
    a.innerHTML = `<i></i><span>${pad2(ch.no)} ${ch.title}</span>`;
    a.addEventListener('click', () => {
      chapterEls[ci].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(a);
  });

  renderTexts(beatRefs);
  onModeChange(() => renderTexts(beatRefs));

  return { doc, hero, refs, chapterEls, beatRefs, navDots: [...nav.children] };
}

/** 現在のモードに応じて全カードの本文を差し替える */
function renderTexts(beatRefs) {
  const m = getMode();
  beatRefs.forEach((r) => {
    r.headEl.textContent = r.data.h;
    r.bodyEl.innerHTML = r.data[m].body;
  });
}

/** 右上のトグル群を配線する */
export function setupControls({ narrator, onAudioChange }) {
  const audioBtn = document.getElementById('btn-audio');
  const modeBtn = document.getElementById('btn-mode');
  const audioLabel = audioBtn.querySelector('.lbl');

  const syncMode = () => {
    const m = getMode();
    modeBtn.dataset.state = m;
    modeBtn.querySelector('.lbl').textContent = m === 'simple' ? 'かんたん' : 'くわしい';
    modeBtn.setAttribute('aria-label', `解説の詳しさ：${m === 'simple' ? 'かんたん' : 'くわしい'}`);
  };
  syncMode();
  modeBtn.addEventListener('click', () => setMode(getMode() === 'simple' ? 'deep' : 'simple'));
  onModeChange(syncMode);

  const syncAudio = () => {
    audioBtn.dataset.state = narrator.enabled ? 'on' : 'off';
    audioLabel.textContent = narrator.enabled ? '音声 ON' : '音声 OFF';
  };

  const markUnavailable = () => {
    audioBtn.disabled = true;
    audioBtn.dataset.state = 'na';
    audioLabel.textContent = '音声：非対応';
    audioBtn.title = 'このブラウザ／OSに日本語の読み上げ音声が見つかりませんでした。字幕のみ表示します。';
  };

  if (!narrator.supported) {
    markUnavailable();
  } else {
    // 音声リストの読み込みは非同期。少し待って日本語音声が無ければ無効化する。
    setTimeout(() => {
      if (!narrator.available) markUnavailable();
    }, 1600);
  }

  syncAudio();
  audioBtn.addEventListener('click', () => {
    narrator.setEnabled(!narrator.enabled);
    syncAudio();
    onAudioChange?.(narrator.enabled);
  });

  return { syncAudio };
}
