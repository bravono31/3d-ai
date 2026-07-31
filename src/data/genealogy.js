/**
 * 第5章の系譜グラフ。
 * 座標は事前に決め打ち（実行時に力学計算をしないので毎回同じ絵になる）。
 * stage = 何ビート目で現れるか（0..3）
 */

export const groups = {
  google: { name: 'Google 系', color: 0x4ecdc4 },
  openai: { name: 'OpenAI 系', color: 0x7ee081 },
  spinout: { name: 'Transformer 著者の起業', color: 0xffd166 },
  open: { name: 'オープンウェイト（欧米）', color: 0xa78bfa },
  china: { name: '中国', color: 0xff6b6b },
  other: { name: '日本・その他', color: 0x8ab6ff },
};

export const nodes = [
  // --- 源流 ---
  { id: 'transformer', label: 'Transformer 論文', sub: '2017', pos: [-1.2, 4.2, 0], group: 'google', kind: 'paper', stage: 0 },
  { id: 'brain', label: 'Google Brain', sub: '2011', pos: [-4.4, 2.9, 0], group: 'google', kind: 'org', stage: 0 },
  { id: 'deepmind', label: 'DeepMind', sub: '2010 → 2014 Google', pos: [-6.6, 1.9, 0.4], group: 'google', kind: 'org', stage: 0 },
  { id: 'openai', label: 'OpenAI', sub: '2015', pos: [3.6, 3.0, 0], group: 'openai', kind: 'org', stage: 0 },
  { id: 'meta', label: 'Meta AI (FAIR)', sub: '2013', pos: [0.3, 2.7, 0], group: 'open', kind: 'org', stage: 0 },

  // --- 人が動いて生まれた組織 ---
  { id: 'gdm', label: 'Google DeepMind', sub: '2023 統合', pos: [-5.2, 0.5, 0], group: 'google', kind: 'org', stage: 1 },
  { id: 'anthropic', label: 'Anthropic', sub: '2021 · Amodei ら', pos: [6.4, 1.1, 0], group: 'openai', kind: 'org', stage: 1 },
  { id: 'xai', label: 'xAI', sub: '2023 · Musk', pos: [1.6, 0.9, -0.4], group: 'openai', kind: 'org', stage: 1 },
  { id: 'cohere', label: 'Cohere', sub: '2019 · 加', pos: [-2.4, 1.5, 2.4], group: 'spinout', kind: 'org', stage: 1 },
  { id: 'charai', label: 'Character.AI', sub: '2021', pos: [-3.9, 0.3, 2.6], group: 'spinout', kind: 'org', stage: 1 },
  { id: 'sakana', label: 'Sakana AI', sub: '2023 · 日', pos: [-1.6, -0.7, 2.8], group: 'spinout', kind: 'org', stage: 1 },
  { id: 'mistral', label: 'Mistral AI', sub: '2023 · 仏', pos: [-0.6, -1.1, 0.8], group: 'open', kind: 'org', stage: 1 },

  // --- オープンウェイトの波 ---
  { id: 'llama', label: 'Llama', sub: '重みを公開', pos: [0.4, 0.6, 0], group: 'open', kind: 'model', stage: 2 },
  { id: 'deepseek', label: 'DeepSeek', sub: 'V3.2 / R1', pos: [4.8, -0.5, -3.2], group: 'china', kind: 'org', stage: 2 },
  { id: 'qwen', label: 'Qwen', sub: 'Alibaba', pos: [2.6, -1.5, -3.4], group: 'china', kind: 'org', stage: 2 },
  { id: 'kimi', label: 'Kimi', sub: 'Moonshot · K3 2.8T', pos: [5.8, -2.5, -3.0], group: 'china', kind: 'org', stage: 2 },
  { id: 'glm', label: 'GLM', sub: 'Zhipu · 清華大', pos: [3.4, -3.3, -3.4], group: 'china', kind: 'org', stage: 2 },
  { id: 'doubao', label: 'Doubao', sub: 'ByteDance', pos: [1.3, -2.7, -3.2], group: 'china', kind: 'org', stage: 2 },
  { id: 'ernie', label: 'ERNIE', sub: 'Baidu', pos: [6.6, -1.3, -3.6], group: 'china', kind: 'org', stage: 2 },

  // --- 2026年の最前線 ---
  { id: 'gemini', label: 'Gemini 3.x', sub: '2026', pos: [-5.2, -1.7, 0], group: 'google', kind: 'model', stage: 3 },
  { id: 'gpt', label: 'GPT-5.6', sub: '2026', pos: [3.6, -1.7, 0], group: 'openai', kind: 'model', stage: 3 },
  { id: 'claude', label: 'Claude Opus 5', sub: '2026-07', pos: [6.4, -1.7, 0], group: 'openai', kind: 'model', stage: 3 },
  { id: 'llmjp', label: 'LLM-jp / NII', sub: '産学官 · 日', pos: [-3.4, -2.5, 2.4], group: 'other', kind: 'org', stage: 3 },
  { id: 'pfn', label: 'PFN (PLaMo)', sub: '日', pos: [-4.9, -2.1, 2.2], group: 'other', kind: 'org', stage: 3 },
];

/** type: derive=技術的な派生 / people=人の移動 / open=オープンウェイトの波及 */
export const edges = [
  { a: 'brain', b: 'transformer', type: 'derive' },
  { a: 'transformer', b: 'openai', type: 'derive' },
  { a: 'transformer', b: 'meta', type: 'derive' },
  { a: 'brain', b: 'gdm', type: 'derive' },
  { a: 'deepmind', b: 'gdm', type: 'derive' },
  { a: 'gdm', b: 'gemini', type: 'derive' },
  { a: 'openai', b: 'gpt', type: 'derive' },
  { a: 'anthropic', b: 'claude', type: 'derive' },
  { a: 'meta', b: 'llama', type: 'derive' },

  { a: 'openai', b: 'anthropic', type: 'people' },
  { a: 'openai', b: 'xai', type: 'people' },
  { a: 'brain', b: 'cohere', type: 'people' },
  { a: 'brain', b: 'charai', type: 'people' },
  { a: 'brain', b: 'sakana', type: 'people' },
  { a: 'meta', b: 'mistral', type: 'people' },
  { a: 'deepmind', b: 'mistral', type: 'people' },

  { a: 'llama', b: 'deepseek', type: 'open' },
  { a: 'llama', b: 'qwen', type: 'open' },
  { a: 'llama', b: 'glm', type: 'open' },
  { a: 'llama', b: 'doubao', type: 'open' },
  { a: 'llama', b: 'kimi', type: 'open' },
  { a: 'llama', b: 'ernie', type: 'open' },
  { a: 'llama', b: 'mistral', type: 'open' },
  { a: 'llama', b: 'llmjp', type: 'open' },
  { a: 'llama', b: 'pfn', type: 'open' },
];

export const edgeLegend = [
  { type: 'derive', label: '技術的な派生', color: 0x6f7d95 },
  { type: 'people', label: '人の移動・独立', color: 0xffb35c },
  { type: 'open', label: 'オープンウェイトの波及', color: 0x9d7dff },
];
