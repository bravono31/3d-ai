/** 第7章。beat 0..4 が下の5地域に対応する。metrics は 0..1。 */
export const regions = [
  {
    id: 'us',
    name: 'アメリカ',
    en: 'United States',
    color: 0x5b9dff,
    center: [39, -98],       // [lat, lon]
    camera: [20, -95],       // カメラが向く緯度経度
    tagline: '資本・計算資源・クローズド',
    players: ['OpenAI', 'Anthropic', 'Google DeepMind', 'Meta', 'xAI', 'NVIDIA'],
    metrics: [
      { k: 'フロンティア開発力', v: 0.95 },
      { k: 'オープンウェイト志向', v: 0.35 },
      { k: '事前規制の強さ', v: 0.3 },
    ],
  },
  {
    id: 'cn',
    name: '中国',
    en: 'China',
    color: 0xff6b6b,
    center: [35, 104],
    camera: [25, 105],
    tagline: 'オープンウェイトと効率',
    players: ['DeepSeek', 'Alibaba Qwen', 'Moonshot Kimi', 'Zhipu GLM', 'ByteDance Doubao', 'Baidu ERNIE'],
    metrics: [
      { k: 'フロンティア開発力', v: 0.8 },
      { k: 'オープンウェイト志向', v: 0.95 },
      { k: '事前規制の強さ', v: 0.65 },
    ],
  },
  {
    id: 'eu',
    name: 'EU',
    en: 'European Union',
    color: 0xffd166,
    center: [50, 10],
    camera: [45, 12],
    tagline: 'ルールとソブリンAI',
    players: ['Mistral AI', 'Aleph Alpha', 'Stability AI (英)', 'EU AI Office'],
    metrics: [
      { k: 'フロンティア開発力', v: 0.35 },
      { k: 'オープンウェイト志向', v: 0.6 },
      { k: '事前規制の強さ', v: 0.95 },
    ],
    note: 'AI Act：GPAI規則 2025-08 適用開始 / 制裁を含む執行権限 2026-08-02 発動',
  },
  {
    id: 'jp',
    name: '日本',
    en: 'Japan',
    color: 0x7ee081,
    center: [36, 138],
    camera: [33, 137],
    tagline: '学習に寛容な法と実世界データ',
    players: ['Sakana AI', 'Preferred Networks (PLaMo)', 'LLM-jp / NII', 'ABCI / 産総研', 'Swallow'],
    metrics: [
      { k: 'フロンティア開発力', v: 0.3 },
      { k: 'オープンウェイト志向', v: 0.7 },
      { k: '事前規制の強さ', v: 0.35 },
    ],
    note: '著作権法30条の4：情報解析目的の利用を幅広く許容',
  },
  {
    id: 'etc',
    name: 'その他',
    en: 'Sovereign AI',
    color: 0xc38bff,
    center: [15, 45],
    camera: [15, 50],
    tagline: '広がるソブリンAI',
    players: ['Cohere (加)', 'LG EXAONE / Naver (韓)', 'BharatGen (印)', 'Falcon / G42 (UAE)', 'HUMAIN (サウジ)'],
    metrics: [
      { k: 'フロンティア開発力', v: 0.25 },
      { k: 'オープンウェイト志向', v: 0.75 },
      { k: '事前規制の強さ', v: 0.4 },
    ],
    // 複数拠点をハイライトする
    extraMarkers: [[56, -106], [37, 127], [22, 78], [24, 54], [24, 45]],
  },
];
