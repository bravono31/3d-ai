import * as THREE from 'three';
import './styles/main.css';

import { chapters } from './data/content.js';
import { buildDOM, setupControls } from './core/ui.js';
import { ScrollTracker } from './core/scroll.js';
import { SceneManager } from './core/SceneManager.js';
import { Narrator } from './core/narration.js';
import { getMode, onModeChange } from './core/mode.js';

import TokensScene from './scenes/01-tokens.js';
import AttentionScene from './scenes/02-attention.js';
import DiffusionScene from './scenes/03-diffusion.js';
import HistoryScene from './scenes/04-history.js';
import GenealogyScene from './scenes/05-genealogy.js';
import ComputeScene from './scenes/06-compute.js';
import LayersScene from './scenes/07-layers.js';
import CompareScene from './scenes/08-compare.js';
import AgentsScene from './scenes/09-agents.js';
import OpennessScene from './scenes/10-openness.js';
import RegionsScene from './scenes/11-regions.js';
import ConflictsScene from './scenes/12-conflicts.js';
import UsesScene from './scenes/13-uses.js';
import FrontierScene from './scenes/14-frontier.js';

const SCENES = {
  tokens: TokensScene,
  attention: AttentionScene,
  diffusion: DiffusionScene,
  history: HistoryScene,
  genealogy: GenealogyScene,
  compute: ComputeScene,
  layers: LayersScene,
  compare: CompareScene,
  agents: AgentsScene,
  openness: OpennessScene,
  regions: RegionsScene,
  conflicts: ConflictsScene,
  uses: UsesScene,
  frontier: FrontierScene,
};

// ── DOM 構築
const { chapterEls, beatRefs, navDots, markToc } = buildDOM();
const canvas = document.getElementById('stage');
const fadeEl = document.getElementById('fade');
const progressEl = document.querySelector('#progress i');
const subtitleEl = document.getElementById('subtitle');
const subtitleP = subtitleEl.querySelector('p');

// ── レンダラ
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setClearColor(0x070a14, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function computeShift() {
  const wide = window.innerWidth >= 900;
  return wide ? { x: 0.16, y: 0 } : { x: 0, y: 0.16 };
}

const ctx = {
  width: window.innerWidth,
  height: window.innerHeight,
  shift: computeShift(),
  reducedMotion,
};

const manager = new SceneManager(
  ctx,
  chapters.map((ch) => ({
    id: ch.id,
    create: (c) => new SCENES[ch.id](c),
  }))
);

const tracker = new ScrollTracker({ chapterEls, beatRefs });

// ── ナレーション
const narrator = new Narrator();
setupControls({
  narrator,
  onAudioChange: (on) => {
    subtitleEl.classList.toggle('is-on', on);
    if (on) speakCurrent();
  },
});

let lastChapter = -1;
let lastBeat = -1;

function currentBeatData() {
  const ch = chapters[Math.max(0, lastChapter)];
  if (!ch) return null;
  return ch.beats[Math.min(lastBeat, ch.beats.length - 1)] ?? null;
}

function speakCurrent() {
  const b = currentBeatData();
  if (!b) return;
  const text = b[getMode()].speech;
  subtitleP.textContent = text;
  narrator.speak(text);
}

onModeChange(() => {
  if (narrator.enabled) speakCurrent();
  else {
    const b = currentBeatData();
    if (b) subtitleP.textContent = b[getMode()].speech;
  }
});

// ── リサイズ
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  manager.resize(w, h, computeShift());
}
window.addEventListener('resize', resize);

// ── 章の切り替え（軽いフラッシュでカットをつける）
function flash() {
  if (reducedMotion) return;
  fadeEl.classList.remove('flash');
  void fadeEl.offsetWidth; // reflow でアニメーションを再開させる
  fadeEl.classList.add('flash');
}

// ── メインループ
let time = 0;
let last = performance.now();
let lastOpacity = -1;
let lastPct = -1;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;

  const s = tracker.measure(dt);

  // ヒーローを読んでいるあいだは3Dを引っ込めて、見出しを邪魔しない。
  // 毎フレーム style を書くと合成が走るので、変化したときだけ触る。
  const heroFade = clamp01(window.scrollY / (window.innerHeight * 0.62));
  const op = 0.12 + heroFade * 0.88;
  if (Math.abs(op - lastOpacity) > 0.004) {
    lastOpacity = op;
    canvas.style.opacity = op.toFixed(3);
  }

  if (s.chapter !== lastChapter) {
    manager.setActive(s.chapter);
    navDots.forEach((d, i) => d.classList.toggle('is-active', i === s.chapter));
    if (lastChapter !== -1) flash();
    lastChapter = s.chapter;
    lastBeat = -1;
  }

  if (s.beat !== lastBeat) {
    lastBeat = s.beat;
    speakCurrent();
    markToc(s.chapter, s.beat);
  }

  const pct = s.docProgress * 100;
  if (Math.abs(pct - lastPct) > 0.05) {
    lastPct = pct;
    progressEl.style.width = pct.toFixed(2) + '%';
  }

  manager.update(s.p, s.beatFloat, dt, time);
  manager.render(renderer);

  requestAnimationFrame(frame);
}

resize();
manager.setActive(0);
lastChapter = 0;
last = performance.now();
requestAnimationFrame(frame);

// シーンの初回組み立ては数十msかかる。スクロール中にそれが起きると引っかかるので、
// 読み始めの空き時間のうちに全章ぶんを先に用意しておく。
manager.prebuildAll();
