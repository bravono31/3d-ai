/** 第7章の積層プレート。index 0 が最下層。 */
export const layers = [
  {
    id: 'chip',
    name: '半導体・アクセラレータ',
    color: 0x5c6b8a,
    members: ['NVIDIA', 'TSMC', 'Google TPU', 'AWS Trainium', 'Cerebras', 'Groq'],
    value: '供給制約による価格決定力',
  },
  {
    id: 'cloud',
    name: 'クラウド / データセンター',
    color: 0x4c7fa8,
    members: ['AWS', 'Azure', 'Google Cloud', 'CoreWeave'],
    value: '資本集約と規模の経済',
  },
  {
    id: 'model',
    name: '基盤モデル ── 作る側',
    color: 0x4ecdc4,
    members: ['Anthropic', 'OpenAI', 'Google DeepMind', 'Meta', 'xAI', 'Mistral', 'DeepSeek', 'Alibaba', 'Moonshot'],
    value: '事前学習のノウハウと計算資源',
    accent: true,
  },
  {
    id: 'api',
    name: 'API・開発基盤',
    color: 0x8f9fd0,
    members: ['Claude API', 'OpenAI API', 'Amazon Bedrock', 'Azure AI Foundry', 'Vertex AI', 'MCP'],
    value: '接続と運用の標準化',
  },
  {
    id: 'app',
    name: '製品・アプリ ── 載せる側',
    color: 0xffd166,
    members: ['ChatGPT', 'Claude', 'Gemini', 'GitHub Copilot', 'Perplexity', 'Cursor', 'Notion AI'],
    value: 'ディストリビューションと文脈データ',
    accent: true,
  },
];

/** ビートごとに強調する層（null は全体） */
export const focusByBeat = [null, 'model', 'app', 'both'];

/** 上位層が生む価値（beat 2 で表示） */
export const appValue = [
  'コンテキストの調達',
  'モデルのルーティング',
  'UX / ワークフロー統合',
  '評価と後処理',
];
