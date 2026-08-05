# AIは、どうやってことばを作るのか

LLMの仕組み・技術史・業界地図を、**スクロール連動の3Dアニメーション**で解説する1枚のWebページ。
Three.js + Vite。全14章、日本語音声ナレーション（ブラウザ内蔵TTS）と「かんたん／くわしい」の2モード付き。

## 章立て

| # | 章 | 内容 |
|---|---|---|
| 1 | ことばを数に変える | トークン化と埋め込み、意味空間 |
| 2 | 注意という発明 | Attention・Q/K/V・層の積み重ね・自己回帰生成 |
| 3 | ノイズから絵を彫り出す | 拡散モデル・潜在空間・条件付け・動画のDiT |
| 4 | 80年の助走と4年の疾走 | 技術史 1943 → 2026 |
| 5 | 誰がどこから来たのか | 主要LLMメーカーの系譜（技術の派生・人の移動・オープンウェイトの波及） |
| 6 | 計算という土台 | GPU / CUDAの堀 / NVIDIA vs AMD vs 自社チップ / 蒸留とその係争 |
| 7 | 作る側と、載せる側 | AI産業のレイヤー構造（Anthropic/OpenAI vs Copilot/Perplexity） |
| 8 | Claude / GPT / Gemini | 3つのモデルの性格と選び方 |
| 9 | 往復から、ループへ | チャット vs Claude Code / Codex |
| 10 | 開くか、閉じるか | クローズド／オープンウェイト／オープンソースの違いと2026年の論争 |
| 11 | 地図で見るAI | 米国・中国・EU・日本・その他（ソブリンAI） |
| 12 | 本を裁断し、法廷に立つ | Project Panama・NYT訴訟・輸出規制とサービス遮断 |
| 13 | 同じ能力の、両極 | 科学への活用と、軍事への活用 |
| 14 | フロンティアに、手綱はつくのか | Pacing the Frontier と、核（ラッセル＝アインシュタイン宣言／NPT）との比較 |

章立ての設計意図（仕組み → 歴史 → 産業の橋渡し → 活用 → 問題編）は
[`src/data/content.js`](src/data/content.js) の `chapters` 配列コメントを参照。

## 使い方

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/index.html（外部依存なしの単一HTML）
```

`vite-plugin-singlefile` により、ビルド成果物は JS/CSS をすべてインライン化した
**1ファイルのHTML**になります。そのままファイルを開くだけで動きます。

## 操作

- **スクロール** — 3Dシーンが進行します
- **右上「かんたん／くわしい」** — 解説文とナレーションを切替（比喩中心 ⇄ 数式・論文レベル）
- **右上「音声」** — Web Speech API による日本語読み上げ（ON時は字幕も表示）
- **音声の隣の「▾」** — 声・速さ・高さを選ぶ。OSに入っている日本語音声が一覧に出るので、
  試聴しながら好みのものを選べます（選択は localStorage に保存）
- **右端のドット** — 章へジャンプ

音声はブラウザ内蔵のTTSを使うため、**外部サーバーへの送信もAPI費用も発生しません**。
既定は落ち着いた読み上げになるよう、速さ 0.94・高さ 0.92 に設定し、
Reed / Otoya のような低めの声が入っていればそれを優先します。
日本語音声が見つからない環境では自動的に無効化され、字幕のみになります。

## 構成

```
src/
├ main.js               起動・スクロール監視・描画ループ
├ core/
│ ├ BaseScene.js        章シーンの基底（update(progress) だけで絵が決まる純関数的な作り）
│ ├ SceneManager.js     シーンの生成と切り替え
│ ├ scroll.js           章内進捗とビート位置の算出
│ ├ narration.js        Web Speech API ラッパ
│ ├ mode.js             かんたん／くわしいの切替
│ ├ ui.js               DOM組み立てとトグル配線
│ └ label.js            CanvasTexture による日本語スプライト
├ scenes/               章ごとの3Dシーン（01〜14）
├ data/                 本文・年表・系譜・地域・レイヤー・陸地マスク
└ styles/main.css

scripts/
├ make-land-mask.mjs    海岸線データ → 陸地マスクの変換（再生成が必要なときだけ）
├ make-protein.mjs      AlphaFold 予測構造 → 主鎖の点列の変換（同上）
└ make-crystal.mjs      GNoME 予測結晶の CIF → 原子座標と結合の変換（同上）
```

### 地球儀の陸地データ

第11章の地球儀は、実際の海岸線から起こした 0.5° 格子の陸地マスク
（`src/data/land-mask.js`）を引いて描いています。元データは
[Natural Earth](https://www.naturalearthdata.com/)（パブリックドメイン）で、
[world-atlas](https://github.com/topojson/world-atlas) の `land-110m` を
`scripts/make-land-mask.mjs` でビットマスクへ変換したものです。
実行時にポリゴンの内外判定を回すと重いので、あらかじめ焼いてあります。

### タンパク質の立体構造

第13章「科学」に出てくる分子は、それらしく作った図形ではなく
**AlphaFold が実際に予測した座標**（ヒト ヘモグロビンα鎖 / UniProt P69905）です。
[AlphaFold Protein Structure Database](https://alphafold.ebi.ac.uk/entry/P69905) の
`AF-P69905-F1`（CC-BY-4.0）から主鎖の Cα 142 残基を `scripts/make-protein.mjs` で抜き出し、
`src/data/protein.js` に焼いてあります。表示はその点列を通す主鎖チューブで、
色はN末端→C末端の位置を表します。

### 結晶構造

同じ第13章に並ぶ結晶も作り物の格子ではなく、DeepMind の
[GNoME](https://github.com/google-deepmind/materials_discovery) が予測した
**層状セレン化物 MgNb₈SnSe₁₆** の実際の原子座標です（CC-BY-4.0）。
公開データは 450MB の zip ですが、中身は先頭から順に並んだ小さな CIF なので、
`scripts/make-crystal.mjs` は先頭の数MBだけ Range 取得して目的の1件を取り出し、
単位格子を 2×2×1 に並べて `src/data/crystal.js` に書き出します。
色は元素、線は 3.05Å 以内の原子対（結合）です。

シーンは乱数をシード固定し、`update(progress)` だけで見た目が決まるように書いてあります。
スクロールを往復しても同じ絵に戻ります。

## 内容の鮮度について

モデルの世代・順位・訴訟の進行状況は数か月単位で変わります。
本ページの市況に関する記述は **2026-07-31 時点**で参照した情報にもとづいており、
出典はページ末尾の「参考文献・出典」に一覧しています。
数値の順位より、**誰が計算資源を持ち、誰が重みを配り、どの法域が何を問うか**という
構造の側を主軸に書いています。

## ライセンス

MIT
