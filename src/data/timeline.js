/** 第3章の3Dタイムライン。era は 0..3 で beat に対応。 */
export const events = [
  { y: 1943, era: 0, t: '形式ニューロン', d: 'McCulloch & Pitts' },
  { y: 1958, era: 0, t: 'パーセプトロン', d: 'Rosenblatt' },
  { y: 1986, era: 0, t: '誤差逆伝播の普及', d: 'Rumelhart, Hinton, Williams' },
  { y: 1997, era: 0, t: 'LSTM', d: 'Hochreiter & Schmidhuber' },
  { y: 2012, era: 0, t: 'AlexNet', d: '深層学習ブームの起点', big: true },
  { y: 2013, era: 0, t: 'word2vec', d: 'ことばをベクトルに' },
  { y: 2014, era: 0, t: 'seq2seq / GAN', d: '生成モデルの萌芽' },
  { y: 2015, era: 0, t: '注意機構', d: 'Bahdanau et al. / OpenAI 設立' },

  { y: 2017, era: 1, t: 'Transformer', d: 'Attention Is All You Need', big: true },
  { y: 2018, era: 1, t: 'GPT-1 / BERT', d: '事前学習+微調整の確立' },
  { y: 2019, era: 1, t: 'GPT-2', d: '生成品質の飛躍' },
  { y: 2020, era: 1, t: 'GPT-3 / Scaling Laws', d: '大きさが質を変える', big: true },
  { y: 2020, era: 1, t: 'DDPM', d: '拡散モデルの実用化' },
  { y: 2021, era: 1, t: 'Anthropic 設立', d: 'OpenAI から独立 / CLIP / Codex' },

  { y: 2022, era: 2, t: 'Chinchilla', d: '最適なデータ量の再定義' },
  { y: 2022, era: 2, t: 'InstructGPT', d: 'RLHF で指示に従う' },
  { y: 2022, era: 2, t: 'Stable Diffusion', d: '画像生成が誰の手にも' },
  { y: 2022, era: 2, t: 'ChatGPT', d: '生成AIが一般の話題に', big: true },
  { y: 2023, era: 2, t: 'GPT-4 / Claude / Llama 2', d: 'Gemini / Mistral 設立' },
  { y: 2024, era: 2, t: 'Claude 3 / GPT-4o', d: 'マルチモーダルの標準化' },
  { y: 2024, era: 2, t: '推論モデル / MCP', d: '答える前に考える', big: true },

  { y: 2025, era: 3, t: 'DeepSeek-R1', d: 'オープンウェイトの推論モデル', big: true },
  { y: 2025, era: 3, t: 'エージェント型コーディング', d: 'Claude Code / Codex' },
  { y: 2026, era: 3, t: 'Kimi K3 (2.8T)', d: '世界最大級のオープンウェイト' },
  { y: 2026, era: 3, t: 'Claude Opus 5 / GPT-5.6 / Gemini 3.6', d: '100万トークン級が標準', big: true },
];

export const eraLabels = [
  { era: 0, name: '助走期', span: '1943 – 2016' },
  { era: 1, name: '転換期', span: '2017 – 2021' },
  { era: 2, name: '一般化', span: '2022 – 2024' },
  { era: 3, name: 'エージェント期', span: '2025 – 2026' },
];
