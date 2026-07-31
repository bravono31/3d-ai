import { chapters, references, interludes } from '../data/content.js';
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

  // ── 各章（話題が変わるところには区切りページを先に挟む）
  const beatRefs = [];
  const chapterEls = [];
  const interludeEls = [];

  chapters.forEach((ch, ci) => {
    const il = interludes.find((x) => x.before === ch.id);
    if (il) {
      const sec = document.createElement('section');
      sec.className = 'interlude';
      sec.innerHTML = `
        <div class="interlude-inner">
          <p class="il-eyebrow">${il.eyebrow}</p>
          <h2 class="il-title">${il.lines.join('<br>')}</h2>
          <p class="il-lede">${il.lede}</p>
        </div>`;
      doc.appendChild(sec);
      interludeEls.push(sec);
    }

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
    nav.appendChild(a);
  });

  renderTexts(beatRefs);
  onModeChange(() => renderTexts(beatRefs));

  const toc = buildTOC(beatRefs);

  // 章ドットも目次と同じく、ビートの中心へ寄せて止める
  nav.querySelectorAll('.navdot').forEach((a, ci) => {
    a.addEventListener('click', () => scrollToBeat(beatRefs, ci, 0));
  });

  return {
    doc,
    hero,
    refs,
    chapterEls,
    beatRefs,
    interludeEls,
    navDots: [...nav.children],
    markToc: toc.mark,
  };
}

/** そのビートの中心が「読ませる位置」に来るところまでスクロールする */
function scrollToBeat(beatRefs, ci, bi) {
  const ref = beatRefs.find((b) => b.ci === ci && b.bi === bi);
  if (!ref) return;
  const r = ref.el.getBoundingClientRect();
  const top = r.top + window.scrollY + ref.el.offsetHeight / 2 - window.innerHeight * 0.48;
  window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: 'smooth' });
}

/** 全体像がひと目で見えて、どこへでも飛べる目次 */
function buildTOC(beatRefs) {
  const wrap = document.getElementById('toc');
  const grid = wrap.querySelector('.toc-grid');
  const btn = document.getElementById('btn-toc');
  const closeBtn = document.getElementById('toc-close');
  const chItems = [];
  const beatItems = [];

  chapters.forEach((ch, ci) => {
    const sec = document.createElement('section');
    sec.className = 'toc-ch';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'toc-ch-head';
    head.innerHTML = `<span class="n">${pad2(ch.no)}</span><span class="t">${ch.title}</span><span class="s">${ch.subtitle}</span>`;
    head.addEventListener('click', () => {
      scrollToBeat(beatRefs, ci, 0);
      open(false);
    });
    sec.appendChild(head);
    chItems.push(head);

    const ol = document.createElement('ol');
    ol.className = 'toc-beats';
    ch.beats.forEach((b, bi) => {
      const li = document.createElement('li');
      const a = document.createElement('button');
      a.type = 'button';
      a.textContent = b.h;
      a.addEventListener('click', () => {
        scrollToBeat(beatRefs, ci, bi);
        open(false);
      });
      li.appendChild(a);
      ol.appendChild(li);
      beatItems.push({ ci, bi, el: a });
    });
    sec.appendChild(ol);
    grid.appendChild(sec);
  });

  let isOpen = false;
  function open(on) {
    isOpen = on;
    wrap.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    btn.dataset.state = on ? 'on' : '';
    document.body.style.overflow = on ? 'hidden' : '';
    if (on) closeBtn.focus();
  }

  btn.addEventListener('click', () => open(!isOpen));
  closeBtn.addEventListener('click', () => open(false));
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) open(false); // 背景をクリックしたら閉じる
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) open(false);
  });

  return {
    mark(ci, bi) {
      chItems.forEach((el, i) => el.classList.toggle('is-here', i === ci));
      beatItems.forEach((it) => it.el.classList.toggle('is-here', it.ci === ci && it.bi === bi));
    },
  };
}

/** 現在のモードに応じて全カードの本文を差し替える */
function renderTexts(beatRefs) {
  const m = getMode();
  beatRefs.forEach((r) => {
    r.headEl.textContent = r.data.h;
    r.bodyEl.innerHTML = r.data[m].body;
  });
}

/** 声・速さ・高さのパネルを配線する */
function setupVoicePanel(narrator) {
  const toggle = document.getElementById('btn-voice');
  const panel = document.getElementById('voice-panel');
  const select = document.getElementById('voice-select');
  const rate = document.getElementById('voice-rate');
  const pitch = document.getElementById('voice-pitch');
  const rateOut = document.getElementById('voice-rate-out');
  const pitchOut = document.getElementById('voice-pitch-out');
  const preview = document.getElementById('voice-preview');
  const reset = document.getElementById('voice-reset');

  const fmt = (v) => Number(v).toFixed(2);
  const syncSliders = () => {
    rate.value = narrator.rate;
    pitch.value = narrator.pitch;
    rateOut.textContent = fmt(narrator.rate);
    pitchOut.textContent = fmt(narrator.pitch);
  };

  const fillVoices = (voices, current) => {
    select.innerHTML = '';
    voices.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.name;
      // 「Eddy (日本語（日本）)」のような冗長な括弧を落として読みやすくする
      o.textContent = v.name.replace(/\s*[(（].*$/, '');
      select.appendChild(o);
    });
    if (current) select.value = current.name;
    toggle.disabled = voices.length < 1;
  };

  if (narrator.ready) fillVoices(narrator.voices, narrator.voice);
  narrator.onReady = (voices, current) => fillVoices(voices, current);
  syncSliders();

  const open = (on) => {
    panel.hidden = !on;
    toggle.setAttribute('aria-expanded', String(on));
    toggle.dataset.state = on ? 'open' : '';
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    open(panel.hidden);
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => open(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') open(false);
  });

  select.addEventListener('change', () => {
    narrator.setVoice(select.value);
    narrator.preview();
  });
  rate.addEventListener('input', () => {
    narrator.setRate(rate.value);
    rateOut.textContent = fmt(narrator.rate);
  });
  rate.addEventListener('change', () => narrator.preview('この速さで読み上げます。'));
  pitch.addEventListener('input', () => {
    narrator.setPitch(pitch.value);
    pitchOut.textContent = fmt(narrator.pitch);
  });
  pitch.addEventListener('change', () => narrator.preview('この高さで読み上げます。'));
  preview.addEventListener('click', () => narrator.preview());
  reset.addEventListener('click', () => {
    narrator.setRate(0.94);
    narrator.setPitch(0.92);
    syncSliders();
    narrator.preview();
  });

  return { markUnavailable: () => (toggle.disabled = true) };
}

/** 右上のトグル群を配線する */
export function setupControls({ narrator, onAudioChange }) {
  const audioBtn = document.getElementById('btn-audio');
  const modeBtn = document.getElementById('btn-mode');
  const audioLabel = audioBtn.querySelector('.lbl');
  const voicePanel = setupVoicePanel(narrator);

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
    voicePanel.markUnavailable();
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
