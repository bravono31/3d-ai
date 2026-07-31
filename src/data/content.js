/**
 * 全章の本文データ。
 * 3Dシーンはモード共通、テキストとナレーションだけが simple / deep で切り替わる。
 * body は簡易HTML可。speech は読み上げ専用の平文（記号・数式を避ける）。
 */

import { compute, openness, conflicts, uses, frontier } from './content-extra.js';

const base = [
  // ────────────────────────────────────────────── 1
  {
    id: 'tokens',
    title: 'ことばを数に変える',
    subtitle: 'トークン化と埋め込み',
    beats: [
      {
        h: '文章はまず「トークン」に切られる',
        simple: {
          body: `LLMは文字をそのまま読んでいるわけではありません。まず文章を<strong>トークン</strong>という小さなかたまりに切り分けます。英語なら単語や単語の一部、日本語なら1〜2文字くらいが1トークン。これがモデルにとっての最小単位です。`,
          speech: 'エルエルエムは文字をそのまま読んでいるわけではありません。まず文章をトークンという小さなかたまりに切り分けます。これがモデルにとっての最小単位です。',
        },
        deep: {
          body: `入力テキストはサブワード分割（BPE / Byte-level BPE / SentencePiece Unigram）によって語彙表 <code>V</code> の要素列へ写像されます。未知語を原理的に消せる一方、分割はコーパスの統計に依存するため、<strong>日本語や少数言語は同じ内容でも英語よりトークン数が多くなりやすい</strong>。これが多言語での料金差と実効コンテキスト長の差を生みます。`,
          speech: '入力テキストはサブワード分割によって語彙表の要素列へ写像されます。分割は学習コーパスの統計に依存するため、日本語は英語よりトークン数が多くなりやすく、これが料金と実効コンテキスト長の差を生みます。',
        },
      },
      {
        h: 'トークンはベクトルになる',
        simple: {
          body: `それぞれのトークンには、数百から数千個の数字の並び（<strong>ベクトル</strong>）が割り当てられます。この数字の並びが「意味」を表す座標です。学習を通じて、似た意味のことばが近い場所に置かれるようになります。`,
          speech: 'それぞれのトークンには、数百から数千個の数字の並び、ベクトルが割り当てられます。この数字の並びが意味をあらわす座標です。学習を通じて、似た意味のことばが近い場所に置かれるようになります。',
        },
        deep: {
          body: `埋め込み行列 <code>E ∈ R^(|V|×d)</code> がトークンIDを <code>d</code> 次元の稠密ベクトルへ写像します。<code>d</code> は現代のモデルで数千規模。学習の結果、意味的・統語的な関係が<strong>方向ベクトル</strong>として現れることが知られています（king − man + woman ≈ queen の類の線形構造）。`,
          speech: '埋め込み行列がトークン番号を数千次元の稠密ベクトルへ写像します。学習の結果、意味的な関係が方向ベクトルとして現れることが知られています。',
        },
      },
      {
        h: '意味の空間を旅する',
        simple: {
          body: `「犬」「猫」「動物」は近くに、「銀行」「金利」は別の場所に集まります。モデルはこの空間の中で、ことばの関係を<strong>距離と方向</strong>として扱っています。人が辞書を引くのとは違い、すべてが幾何学の問題になっているわけです。`,
          speech: '犬、猫、動物は近くに、銀行、金利は別の場所に集まります。モデルはこの空間の中で、ことばの関係を距離と方向として扱っています。すべてが幾何学の問題になっているわけです。',
        },
        deep: {
          body: `近さは通常コサイン類似度で測ります。ただし静的な埋め込みと違い、Transformerの各層を通過した表現は<strong>文脈依存</strong>になり、「bank（土手／銀行）」のような多義語は文脈によって異なる位置へ移動します。語順の情報は埋め込みには含まれないため、位置エンコーディングで別途注入します（現在は <code>RoPE</code> が主流）。`,
          speech: '近さは通常コサイン類似度で測ります。ただしトランスフォーマーの各層を通過した表現は文脈依存になり、多義語は文脈によって異なる位置へ移動します。語順の情報は位置エンコーディングで別途注入します。',
        },
      },
    ],
  },

  // ────────────────────────────────────────────── 2
  {
    id: 'attention',
    title: '注意という発明',
    subtitle: 'Attention と Transformer',
    beats: [
      {
        h: '2017年、すべてが変わった',
        simple: {
          body: `それまでのAIは、文章を最初から順番にしか読めませんでした。2017年の論文<strong>「Attention Is All You Need」</strong>は、文章のすべての単語を一度に見渡して、どこに注目すべきかをモデル自身が決める仕組みを提案します。これが <strong>Transformer</strong> です。`,
          speech: 'それまでのエーアイは、文章を最初から順番にしか読めませんでした。2017年の論文、アテンション・イズ・オール・ユー・ニードは、文章のすべての単語を一度に見渡して、どこに注目すべきかをモデル自身が決める仕組みを提案します。これがトランスフォーマーです。',
        },
        deep: {
          body: `Vaswani et al. (2017) は再帰型ネットワークの逐次依存を捨て、自己注意のみで系列を処理する構成を提案しました。決定的だったのは精度よりも<strong>並列化</strong>です。系列長方向を同時に計算できるようになり、GPU上の学習スループットが桁で改善しました。後の大規模スケーリングを物理的に可能にした転換点です。`,
          speech: 'ヴァスワニらは再帰型ネットワークの逐次依存を捨て、自己注意のみで系列を処理する構成を提案しました。決定的だったのは精度よりも並列化です。これが後の大規模スケーリングを物理的に可能にしました。',
        },
      },
      {
        h: 'Q・K・V — 質問と見出しと中身',
        simple: {
          body: `各トークンは3つの役を持ちます。<strong>Q</strong>（いま何を探しているか）、<strong>K</strong>（自分は何者か、という見出し）、<strong>V</strong>（自分が渡せる中身）。QとKを照らし合わせて「どれくらい注目するか」を決め、その重みでVを混ぜ合わせる。図書館で目次を見て必要な本だけ開くのに似ています。<br>右の例では、<strong>いま処理しているトークン（Q）から、最も強く見ている相手（K）へ太い光が伸び</strong>、その中身（V）が流れ込んできます。`,
          speech: '各トークンは3つの役を持ちます。キューは、いま何を探しているか。ケーは、自分は何者かという見出し。ブイは、自分が渡せる中身。キューとケーを照らし合わせて、どれくらい注目するかを決め、その重みでブイを混ぜ合わせます。',
        },
        deep: {
          body: `<code>Attention(Q,K,V) = softmax(QKᵀ / √d_k) V</code>、ただし <code>Q=XW_Q, K=XW_K, V=XW_V</code>。<code>√d_k</code> によるスケーリングは内積の分散増大でsoftmaxが飽和するのを防ぎます。ヘッドを複数並べる<strong>多頭注意</strong>で、係り受けや照応といった異なる関係を分業させる。計算量は系列長 <code>n</code> に対し <code>O(n²d)</code> で、<strong>これが長文コンテキストの主要コスト要因</strong>です。<br>右の帯の太さが <code>softmax</code> 後の重みにあたります（図の値は説明用に構成したもので、実モデルの出力ではありません）。`,
          speech: 'アテンションは、キューとケーの転置の内積をルートディーケーで割り、ソフトマックスを取ってブイに掛けたものです。ヘッドを複数並べる多頭注意で、係り受けや照応といった異なる関係を分業させます。計算量は系列長の二乗に比例し、これが長文コンテキストの主要なコスト要因です。',
        },
      },
      {
        h: '層を重ねて抽象度を上げる',
        simple: {
          body: `「注目して混ぜる」処理と、各トークンを個別に加工する処理をセットにして、何十層も積み重ねます。層が上がるにつれて、単語 → 句 → 文の意味 → 話の流れ、と<strong>扱う抽象度が上がっていく</strong>ことが観測されています。`,
          speech: '注目して混ぜる処理と、各トークンを個別に加工する処理をセットにして、何十層も積み重ねます。層が上がるにつれて、単語から句、文の意味、話の流れへと、扱う抽象度が上がっていきます。',
        },
        deep: {
          body: `各ブロックは 多頭注意 → FFN（現在は SwiGLU 系）を、残差接続と正規化（Pre-LN が主流、RMSNorm も広く使用）で挟む構成です。近年は FFN を <strong>Mixture-of-Experts</strong> に置き換え、総パラメータを増やしつつ推論時の活性パラメータを抑える設計が主流化しました（DeepSeek, Qwen, Kimi, Mixtral など）。「巨大だが1トークンあたりは軽い」を成立させる仕掛けです。`,
          speech: '各ブロックは多頭注意とフィードフォワード層を、残差接続と正規化で挟む構成です。近年はフィードフォワード層をミクスチャー・オブ・エキスパーツに置き換え、総パラメータを増やしつつ推論時の活性パラメータを抑える設計が主流になりました。',
        },
      },
      {
        h: '1トークンずつ、書き足していく',
        simple: {
          body: `LLMは結局のところ<strong>「次に来るトークンは何か」を予測するだけ</strong>の機械です。予測した1個を文の末尾に足し、それをまた入力に戻して次を予測する。この繰り返しで文章ができあがります。一見単純ですが、これを巨大な規模で行うと翻訳も要約もプログラミングも創発します。`,
          speech: 'エルエルエムは結局のところ、次に来るトークンは何かを予測するだけの機械です。予測した1個を文の末尾に足し、それをまた入力に戻して次を予測する。この繰り返しで文章ができあがります。',
        },
        deep: {
          body: `自己回帰生成。出力層は語彙全体の logits を出し、温度や top-p でサンプリングします。訓練は <strong>①事前学習</strong>（次トークン予測の交差エントロピー最小化）→ <strong>②指示追従のSFT</strong> → <strong>③選好にもとづく強化学習</strong>（RLHF / DPO / Constitutional AI・RLAIF）という段階を踏みます。さらに<strong>推論モデル</strong>は、答える前に長い思考トークン列を生成するよう強化学習で訓練されたものです。`,
          speech: '自己回帰生成です。訓練は、事前学習、指示追従のエスエフティー、そして選好にもとづく強化学習という段階を踏みます。さらに推論モデルは、答える前に長い思考トークン列を生成するよう強化学習で訓練されたものです。',
        },
      },
    ],
  },

  // ────────────────────────────────────────────── 3
  {
    id: 'history',
    title: '80年の助走と4年の疾走',
    subtitle: '技術史 1943 → 2026',
    beats: [
      {
        h: '助走期 — 1943〜2016',
        simple: {
          body: `ニューラルネットワークの発想自体は1943年からあります。ただし長いあいだ、計算資源とデータが足りませんでした。2012年の <strong>AlexNet</strong> が画像認識で圧勝して深層学習ブームが始まり、2013年の <strong>word2vec</strong> が「ことばをベクトルにする」考え方を広めます。`,
          speech: 'ニューラルネットワークの発想自体は1943年からあります。ただし長いあいだ、計算資源とデータが足りませんでした。2012年のアレックスネットが画像認識で圧勝して深層学習ブームが始まります。',
        },
        deep: {
          body: `形式ニューロン(1943) → パーセプトロン(1958) → 誤差逆伝播の普及(1986) → <strong>LSTM(1997)</strong> による長期依存の緩和 → AlexNet(2012) → word2vec(2013) → seq2seq(2014) → <strong>Bahdanau注意(2015)</strong>。注意機構は元々RNNの補助として提案されたもので、2017年に「補助を本体に据える」逆転が起きました。`,
          speech: '形式ニューロンからパーセプトロン、誤差逆伝播の普及、エルエスティーエムによる長期依存の緩和、そしてバーダナウ注意へ。注意機構は元々アールエヌエヌの補助として提案されたもので、2017年に補助を本体に据える逆転が起きました。',
        },
      },
      {
        h: '転換期 — 2017〜2021',
        simple: {
          body: `Transformer(2017)、GPT-1とBERT(2018)、GPT-2(2019)、そして <strong>GPT-3(2020)</strong>。GPT-3で「モデルを大きくすると質的に新しいことができる」ことが広く知られました。同じ2020年、拡散モデルの <strong>DDPM</strong> が画像生成の道を開きます。2021年にはOpenAI出身のメンバーが <strong>Anthropic</strong> を設立。`,
          speech: 'トランスフォーマー、ジーピーティーワンとバート、ジーピーティーツー、そしてジーピーティースリー。ジーピーティースリーで、モデルを大きくすると質的に新しいことができることが広く知られました。2021年にはオープンエーアイ出身のメンバーがアンソロピックを設立します。',
        },
        deep: {
          body: `<strong>Scaling Laws</strong>(Kaplan et al. 2020) がパラメータ数・データ量・計算量と損失のべき乗則を示し、投資判断が「勘」から「外挿」に変わりました。2022年の <strong>Chinchilla</strong>(Hoffmann et al.) が「当時のモデルは過小データで訓練されている」と指摘し、最適配分の理解を修正します。この2本が現在まで業界の設備投資を規定しています。`,
          speech: 'スケーリング則が、パラメータ数、データ量、計算量と損失のべき乗則を示し、投資判断が勘から外挿に変わりました。2022年のチンチラが、当時のモデルは過小データで訓練されていると指摘し、最適配分の理解を修正します。',
        },
      },
      {
        h: '一般化 — 2022〜2024',
        simple: {
          body: `2022年8月に <strong>Stable Diffusion</strong>、11月に <strong>ChatGPT</strong>。この3か月で生成AIは研究の話から一般の話になりました。2023年に GPT-4・Claude・Llama 2・Gemini、2024年に Claude 3・GPT-4o、そして<strong>「答える前に考える」推論モデル</strong>が登場します。`,
          speech: '2022年8月にステーブル・ディフュージョン、11月にチャットジーピーティー。この3か月で生成エーアイは研究の話から一般の話になりました。2024年には、答える前に考える推論モデルが登場します。',
        },
        deep: {
          body: `技術的な鍵は <strong>InstructGPT (2022)</strong> の RLHF でした。素の事前学習モデルは「続きを書く」だけで指示に従いません。人間の選好で整列させたことで初めて製品になった。2024年後半の推論モデルは、<strong>学習時計算だけでなく推論時計算(test-time compute)を増やすと性能が伸びる</strong>という第二の軸を開きました。2024年11月には Anthropic が <strong>MCP</strong> を公開し、外部ツール接続の標準化が始まります。`,
          speech: '技術的な鍵はインストラクトジーピーティーのアールエルエイチエフでした。素の事前学習モデルは続きを書くだけで指示に従いません。人間の選好で整列させたことで初めて製品になりました。推論モデルは、推論時の計算を増やすと性能が伸びるという第二の軸を開きました。',
        },
      },
      {
        h: 'エージェント期 — 2025〜2026',
        simple: {
          body: `2025年1月、中国の <strong>DeepSeek-R1</strong> がオープンウェイトで推論モデルを公開し、価格競争が一気に進みます。そして2026年現在、AIは「質問に答えるもの」から<strong>「作業をやり切るもの」</strong>へ移りました。2026年7月時点の最前線は Claude Opus 5、GPT-5.6、Gemini 3系。100万トークン級のコンテキストが標準になっています。`,
          speech: '2025年1月、中国のディープシーク・アールワンがオープンウェイトで推論モデルを公開し、価格競争が一気に進みます。そして2026年現在、エーアイは質問に答えるものから、作業をやり切るものへ移りました。',
        },
        deep: {
          body: `2026年7月時点：<strong>Claude Opus 5</strong>（7月24日）、<strong>GPT-5.6</strong>（Sol / Terra / Luna の3構成）、<strong>Gemini 3.6 Flash</strong>・3.2 Pro（2Mコンテキスト）。中国勢では <strong>Kimi K3</strong>（7月17日、2.8兆パラメータのオープンウェイト）、Qwen3-Max、GLM-5.2、DeepSeek-V3.2。共通の潮流は ①100万トークン級コンテキストの標準化 ②推論時計算のスケール ③マルチモーダルの標準装備 ④同性能あたりコストの継続的下落 の4点です。`,
          speech: '2026年7月時点の最前線は、クロード・オーパス5、ジーピーティー5.6、ジェミニ3系。中国勢ではキミK3、クウェン3マックス、ジーエルエム5.2、ディープシークV3.2。共通の潮流は、百万トークン級コンテキストの標準化、推論時計算のスケール、マルチモーダルの標準装備、そして同性能あたりコストの継続的な下落です。',
        },
      },
    ],
  },

  // ────────────────────────────────────────────── 4
  {
    id: 'genealogy',
    title: '誰がどこから来たのか',
    subtitle: '主要LLMメーカーの系譜',
    beats: [
      {
        h: '2つの源流',
        simple: {
          body: `現在のLLM業界には大きく2つの源流があります。ひとつは <strong>Google</strong>（Google Brain と DeepMind）。Transformerを生み、TPUという自前のチップを持つ研究の総本山。もうひとつは2015年設立の <strong>OpenAI</strong>。GPTシリーズでスケーリングを突き詰め、ChatGPTで世界を変えました。`,
          speech: '現在のエルエルエム業界には大きく2つの源流があります。ひとつはグーグル。トランスフォーマーを生み、ティーピーユーという自前のチップを持つ研究の総本山です。もうひとつは2015年設立のオープンエーアイです。',
        },
        deep: {
          body: `Google Brain（2011）と DeepMind（2010、2014にGoogleが買収）は2023年に <strong>Google DeepMind</strong> として統合。Transformer論文の著者8名は<strong>全員がGoogleを離れ</strong>、Cohere（Aidan Gomez）、Character.AI（Noam Shazeer、後にGoogleへ復帰）、Sakana AI（Llion Jones）、Inceptive、NEAR などを創業しました。1本の論文が業界地図そのものを描いた稀有な例です。`,
          speech: 'グーグルブレインとディープマインドは2023年にグーグル・ディープマインドとして統合されました。トランスフォーマー論文の著者8名は全員がグーグルを離れ、コヒア、キャラクターエーアイ、サカナエーアイなどを創業しています。1本の論文が業界地図そのものを描いた稀有な例です。',
        },
      },
      {
        h: '人が動くと、会社が生まれる',
        simple: {
          body: `2021年、OpenAIでGPT-3の開発を率いていた Dario Amodei と Daniela Amodei らが独立して <strong>Anthropic</strong> を設立。安全性を中心に据えた研究所です。2023年には、OpenAIの共同創業者だった Elon Musk が <strong>xAI</strong> を、Meta と DeepMind の出身者がフランスで <strong>Mistral AI</strong> を立ち上げました。`,
          speech: '2021年、オープンエーアイでジーピーティースリーの開発を率いていたダリオ・アモデイとダニエラ・アモデイらが独立してアンソロピックを設立しました。安全性を中心に据えた研究所です。2023年にはイーロン・マスクがエックスエーアイを、メタとディープマインドの出身者がフランスでミストラルエーアイを立ち上げました。',
        },
        deep: {
          body: `この業界の系譜図で特徴的なのは、<strong>技術ではなく人が分岐点になる</strong>ことです。事前学習のノウハウは論文になりにくい暗黙知の塊で、それを持つ数十人規模のチームが動くと新しい組織が一夜で最前線に立てる。だから各社の研究者獲得競争が異常な水準になり、同時に「どの組織がどの思想を継いでいるか」が製品の性格に強く出ます。`,
          speech: 'この業界の系譜図で特徴的なのは、技術ではなく人が分岐点になることです。事前学習のノウハウは論文になりにくい暗黙知の塊で、それを持つチームが動くと新しい組織が一夜で最前線に立てます。',
        },
      },
      {
        h: 'オープンウェイトという別ルート',
        simple: {
          body: `Meta の <strong>Llama</strong> シリーズは、モデルの重みを公開する道を切り開きました。誰でもダウンロードして自分のサーバーで動かせる。この流れを最も強く受け継いだのが中国勢で、<strong>DeepSeek・Qwen・Kimi・GLM</strong> が次々と高性能なオープンウェイトモデルを出しています。`,
          speech: 'メタのラマ・シリーズは、モデルの重みを公開する道を切り開きました。誰でもダウンロードして自分のサーバーで動かせます。この流れを最も強く受け継いだのが中国勢で、ディープシーク、クウェン、キミ、ジーエルエムが次々と高性能なオープンウェイトモデルを出しています。',
        },
        deep: {
          body: `「オープンソース」と呼ばれがちですが、多くは<strong>重みが公開されているだけ</strong>（学習データやコードは非公開、ライセンスにも制限がある）ため <strong>オープンウェイト</strong> と呼ぶのが正確です。戦略的な意味は明確で、①エコシステムの標準を取る ②自社ホスティング需要を掴む ③クローズド勢の価格に圧力をかける、の3点。2026年時点で、この圧力は実際に推論単価を押し下げ続けています。`,
          speech: 'オープンソースと呼ばれがちですが、多くは重みが公開されているだけで、学習データやコードは非公開です。そのためオープンウェイトと呼ぶのが正確です。戦略的な意味は、エコシステムの標準を取ること、自社ホスティング需要を掴むこと、そしてクローズド勢の価格に圧力をかけることの3点です。',
        },
      },
      {
        h: '2026年の勢力図',
        simple: {
          body: `最前線を走るのは <strong>Anthropic・OpenAI・Google DeepMind</strong> の3社。<strong>Meta・xAI・Mistral</strong> がそれを追い、<strong>DeepSeek・Alibaba(Qwen)・Moonshot(Kimi)・Zhipu(GLM)・ByteDance(Doubao)</strong> がオープンウェイトとコストで別軸から攻める。日本の <strong>Sakana AI</strong>、カナダの <strong>Cohere</strong> のように、独自路線を狙う組織もあります。`,
          speech: '最前線を走るのはアンソロピック、オープンエーアイ、グーグル・ディープマインドの3社。メタ、エックスエーアイ、ミストラルがそれを追い、ディープシーク、アリババ、ムーンショット、チープーがオープンウェイトとコストで別軸から攻めています。',
        },
        deep: {
          body: `注意すべきは、この図が<strong>数か月単位で書き換わる</strong>ことです。2026年7月だけでも Claude Opus 5（7/24）と Kimi K3（7/17）が出ています。したがって「今どこが一番か」を追うより、<strong>①誰が自前で事前学習できるか ②重みを公開するか ③どの計算資源にアクセスできるか</strong> という構造的な軸で見るほうが、判断が長持ちします。`,
          speech: '注意すべきは、この図が数か月単位で書き換わることです。今どこが一番かを追うより、誰が自前で事前学習できるか、重みを公開するか、どの計算資源にアクセスできるか、という構造的な軸で見るほうが判断が長持ちします。',
        },
      },
    ],
  },

  // ────────────────────────────────────────────── 5
  {
    id: 'diffusion',
    title: 'ノイズから絵を彫り出す',
    subtitle: '画像・動画の生成',
    beats: [
      {
        h: '砂嵐から始める（拡散モデル）',
        simple: {
          body: `画像生成AIは、まっさらな<strong>ノイズ（砂嵐）</strong>から始めます。「このノイズをほんの少しだけきれいにする」処理を何十回も繰り返して、だんだん絵を浮かび上がらせる。<br>大事なのは、<strong>画像の大きさも画素の並びも最初から最後まで変わらない</strong>こと。散らばった粒を集めて並べ替えるのではなく、<strong>決まった枠の中で「値」だけが変わっていきます</strong>。テレビの砂嵐が少しずつ映像になっていく様子に近いものです。`,
          speech: '画像生成エーアイは、まっさらなノイズから始めます。このノイズをほんの少しだけきれいにする処理を何十回も繰り返して、だんだん絵を浮かび上がらせます。大事なのは、画像の大きさも画素の並びも最初から最後まで変わらないこと。散らばった粒を集めて並べ替えるのではなく、決まった枠の中で値だけが変わっていきます。',
        },
        deep: {
          body: `拡散モデルは前方過程でデータに段階的なガウスノイズを加え、その<strong>逆過程</strong>をニューラルネットに学習させます（DDPM, Ho et al. 2020）。実装上はノイズ <code>ε</code> あるいは速度場を予測し、反復的にデノイズする。近年は <strong>flow matching / rectified flow</strong> により、より少ないステップ数で高品質化する方向へ進みました。`,
          speech: '拡散モデルは前方過程でデータに段階的なガウスノイズを加え、その逆過程をニューラルネットに学習させます。近年はフローマッチングにより、より少ないステップ数で高品質化する方向へ進みました。',
        },
      },
      {
        h: '潜在空間で計算する',
        simple: {
          body: `1024×1024の画像をそのまま何十回も処理すると計算が重すぎます。そこで画像をいったん<strong>小さく圧縮した形</strong>に変換し、その中でノイズ除去をしてから、最後に画像へ戻す。Stable Diffusion が広めたこの工夫で、家庭用のGPUでも画像生成ができるようになりました。`,
          speech: '大きな画像をそのまま何十回も処理すると計算が重すぎます。そこで画像をいったん小さく圧縮した形に変換し、その中でノイズ除去をしてから、最後に画像へ戻します。この工夫で、家庭用のジーピーユーでも画像生成ができるようになりました。',
        },
        deep: {
          body: `<strong>Latent Diffusion</strong>（Rombach et al. 2022）。VAEエンコーダで画像を空間方向に約1/8へ圧縮した潜在表現の上で拡散過程を回し、デコーダで画素へ復元します。ピクセル空間比で計算量が2桁近く削減され、コンシューマGPUでの生成が現実的になりました。現在の主要な画像・動画モデルはほぼすべてこの潜在空間方式です。`,
          speech: 'レイテント・ディフュージョンです。ブイエーイーエンコーダで画像を空間方向に約8分の1へ圧縮した潜在表現の上で拡散過程を回し、デコーダで画素へ復元します。計算量が2桁近く削減されました。',
        },
      },
      {
        h: 'プロンプトはどう効くのか',
        simple: {
          body: `プロンプトの文章もベクトルに変換され、ノイズを取り除く<strong>全ステップを通して参照され続けます</strong>。「赤い車」と書けば、赤くて車らしい方向へノイズ除去が誘導される。だからプロンプトは「命令」というより、彫刻の途中でずっと見せ続ける<strong>設計図</strong>に近いものです。`,
          speech: 'プロンプトの文章もベクトルに変換され、ノイズを取り除く全ステップを通して参照され続けます。赤い車と書けば、赤くて車らしい方向へノイズ除去が誘導されます。プロンプトは命令というより、彫刻の途中でずっと見せ続ける設計図に近いものです。',
        },
        deep: {
          body: `テキストエンコーダ（CLIP / T5 など）の埋め込みを<strong>クロスアテンション</strong>で各デノイズ層に注入します。加えて <strong>classifier-free guidance</strong> により条件付き予測と無条件予測を外挿し、プロンプト追従を強める。ただしガイダンスを強くしすぎると多様性と自然さを損なうトレードオフがあり、これが「呪文」の効き方が直感に反する一因です。`,
          speech: 'テキストエンコーダの埋め込みをクロスアテンションで各デノイズ層に注入します。加えてクラシファイア・フリー・ガイダンスにより、プロンプト追従を強めます。ただし強くしすぎると多様性と自然さを損なうトレードオフがあります。',
        },
      },
      {
        h: '動画は「時空間のパッチ」',
        simple: {
          body: `動画は<strong>時間軸を持った画像</strong>です。タテ・ヨコ・時間の3方向に細かく切ったブロックにして、それを<strong>文章生成と同じTransformer</strong>で扱う。だから「1秒後にこの物体はどこにあるべきか」まで一貫させられます。LLMと画像生成の技術が、ここで合流しました。`,
          speech: '動画は時間軸を持った画像です。タテ、ヨコ、時間の3方向に細かく切ったブロックにして、それを文章生成と同じトランスフォーマーで扱います。だから1秒後にこの物体はどこにあるべきかまで一貫させられます。',
        },
        deep: {
          body: `3D VAE で動画を時空間潜在グリッドへ圧縮し、パッチ化して Transformer でデノイズする <strong>DiT（Diffusion Transformer, Peebles & Xie 2023）</strong> が2026年の主流です。Sora 2 / Veo 3 / Kling / Hunyuan Video / WAN などが同系統で、Veo 系は映像と音声の同時生成に対応。共通の弱点は<strong>長時間の時間的一貫性</strong>と、注意の二次コストによる長尺生成の高コストです。`,
          speech: 'スリーディーブイエーイーで動画を時空間潜在グリッドへ圧縮し、パッチ化してトランスフォーマーでデノイズするディーアイティーが2026年の主流です。ソラ、ヴェオ、クリングなどが同系統です。共通の弱点は長時間の時間的一貫性と、長尺生成の高コストです。',
        },
      },
    ],
  },

  // ────────────────────────────────────────────── 6
  {
    id: 'layers',
    title: '作る側と、載せる側',
    subtitle: 'AI産業のレイヤー構造',
    beats: [
      {
        h: 'AI産業は積み木でできている',
        simple: {
          body: `AI業界の会社を一列に並べて比べても意味がありません。<strong>層が違う</strong>からです。下から順に、半導体 → クラウド → 基盤モデル → API・開発基盤 → 製品。NVIDIAとAnthropicとPerplexityは、競合ではなく<strong>積み重なる関係</strong>にあります。`,
          speech: 'エーアイ業界の会社を一列に並べて比べても意味がありません。層が違うからです。下から順に、半導体、クラウド、基盤モデル、エーピーアイ、製品。エヌビディアとアンソロピックとパープレキシティは、競合ではなく積み重なる関係にあります。',
        },
        deep: {
          body: `各層で利益の source が異なります。半導体層は供給制約による価格決定力、クラウド層は資本集約と規模の経済、基盤モデル層は事前学習のノウハウと計算資源へのアクセス、製品層はディストリビューションとユーザーの文脈データ。<strong>層をまたぐ垂直統合</strong>（Googleの TPU〜検索、AmazonのTrainium〜Bedrock）が競争優位の一形態になっています。`,
          speech: '各層で利益の源泉が異なります。半導体層は供給制約による価格決定力、クラウド層は資本集約と規模の経済、基盤モデル層は事前学習のノウハウ、製品層はディストリビューションと文脈データ。層をまたぐ垂直統合が競争優位の一形態になっています。',
        },
      },
      {
        h: 'Anthropic / OpenAI —「モデルを作る側」',
        simple: {
          body: `Anthropic、OpenAI、Google DeepMind は<strong>自分でモデルを一から学習させます</strong>。数千から数万のGPUを何か月も回し、研究者と安全性チームを抱える。売り物は<strong>モデルそのもの</strong>（API経由）と、Claude・ChatGPT・Gemini といった自社製品です。参入には巨額の資本と、論文にならない暗黙知が要ります。`,
          speech: 'アンソロピック、オープンエーアイ、グーグル・ディープマインドは自分でモデルを一から学習させます。数千から数万のジーピーユーを何か月も回し、研究者と安全性チームを抱える。売り物はモデルそのものと、自社製品です。',
        },
        deep: {
          body: `事前学習を自前で回せる組織は世界で十数社程度です。必要なのは資本（1回の学習で数千万〜数億ドル規模）、大規模分散学習の実務知（並列化・障害復旧・データ配合）、そしてデータのパイプライン。この参入障壁があるため、上の層がいくら増えても<strong>基盤モデル層は寡占が続く</strong>構造になっています。`,
          speech: '事前学習を自前で回せる組織は世界で十数社程度です。必要なのは資本、大規模分散学習の実務知、そしてデータのパイプライン。この参入障壁があるため、基盤モデル層は寡占が続く構造になっています。',
        },
      },
      {
        h: 'Copilot / Perplexity —「モデルを載せる側」',
        simple: {
          body: `GitHub Copilot、Perplexity、Cursor、Notion AI は<strong>自分ではモデルを学習しません</strong>。他社の基盤モデルをAPIで呼び、その上に独自の価値を載せます。Copilot はIDEへの統合とコードの文脈、Perplexity は<strong>Web検索と出典つきの回答</strong>、Cursor はコードベース全体の理解とエディタ体験。`,
          speech: 'ギットハブ・コパイロット、パープレキシティ、カーソル、ノーションエーアイは自分ではモデルを学習しません。他社の基盤モデルをエーピーアイで呼び、その上に独自の価値を載せます。コパイロットはアイディーイーへの統合、パープレキシティはウェブ検索と出典つきの回答が価値です。',
        },
        deep: {
          body: `上位層の価値は4つに整理できます。<strong>①コンテキストの調達</strong>（あなたのコード・社内文書・検索結果をモデルに渡す）<strong>②ルーティング</strong>（タスクごとに最適なモデルを選ぶ）<strong>③UXとワークフロー統合</strong> <strong>④評価と後処理</strong>。弱点は供給元への依存で、対策として複数モデル対応が進みました。Perplexity も Copilot も、Anthropic / OpenAI / Google のモデルを切り替えて使える構成です。`,
          speech: '上位層の価値は4つに整理できます。コンテキストの調達、ルーティング、ユーエックスとワークフロー統合、そして評価と後処理。弱点は供給元への依存で、対策として複数モデル対応が進みました。',
        },
      },
      {
        h: '境界は動く',
        simple: {
          body: `ただしこの区別は固定ではありません。作る側は自社製品を強化して上へ伸び（Claude Code、ChatGPT のアプリ群）、載せる側は自前の小型モデルを持って下へ伸びる。<strong>層の境界をめぐる押し合い</strong>が、いま最も激しい競争の場所です。`,
          speech: 'ただしこの区別は固定ではありません。作る側は自社製品を強化して上へ伸び、載せる側は自前の小型モデルを持って下へ伸びる。層の境界をめぐる押し合いが、いま最も激しい競争の場所です。',
        },
        deep: {
          body: `基盤モデル側から見ると、API単体は<strong>コモディティ化圧力</strong>にさらされます（オープンウェイトが下から価格を叩く）。ゆえに差別化のためエージェント製品・開発ツール・エンタープライズ統合へ前進する。逆に上位層は、粗利を守るためにルーティングで安いモデルへ逃がし、頻出タスクは自社の小型モデルへ移す。<strong>両方向の侵食が同時に進行している</strong>のが2026年の構図です。`,
          speech: '基盤モデル側から見ると、エーピーアイ単体はコモディティ化圧力にさらされます。ゆえに差別化のためエージェント製品や開発ツールへ前進する。逆に上位層は、粗利を守るためにルーティングで安いモデルへ逃がします。両方向の侵食が同時に進行しているのが2026年の構図です。',
        },
      },
    ],
  },

  // ────────────────────────────────────────────── 7
  {
    id: 'regions',
    title: '地図で見るAI',
    subtitle: '米国・中国・EU・日本・その他',
    beats: [
      {
        h: 'アメリカ — 資本と計算資源',
        simple: {
          body: `フロンティアモデルの大半はアメリカから出ています。理由は単純で、<strong>資本と計算資源とチップへのアクセス</strong>が集中しているから。基本戦略は重みを公開しない<strong>クローズド</strong>路線で、APIとして売る。同時に、先端半導体の対中輸出規制という形で技術の流れ自体を管理しています。`,
          speech: 'フロンティアモデルの大半はアメリカから出ています。理由は資本と計算資源とチップへのアクセスが集中しているからです。基本戦略は重みを公開しないクローズド路線で、エーピーアイとして売ることです。',
        },
        deep: {
          body: `連邦レベルの包括的なAI法は存在せず、大統領令・各省庁の指針・州法（カリフォルニア等）が組み合わさる形です。EUと対照的に<strong>事前規制より事後対応</strong>を志向する。産業構造の特徴は垂直統合の深さで、クラウド事業者が基盤モデル企業へ出資しつつ計算資源を供給する相互依存関係が広く見られます。`,
          speech: '連邦レベルの包括的なエーアイ法は存在せず、大統領令、各省庁の指針、州法が組み合わさる形です。イーユーと対照的に、事前規制より事後対応を志向します。',
        },
      },
      {
        h: '中国 — オープンウェイトと効率',
        simple: {
          body: `中国勢は<strong>重みを公開する</strong>戦略で世界のシェアを取りにいきました。DeepSeek、Alibaba の Qwen、Moonshot の Kimi、Zhipu の GLM、ByteDance の Doubao、Baidu の ERNIE。先端GPUの入手制約を、<strong>学習と推論の効率化</strong>（MoE、低精度学習、蒸留）で補うのが共通の戦い方です。価格は欧米勢より一桁安いことも珍しくありません。`,
          speech: '中国勢は重みを公開する戦略で世界のシェアを取りにいきました。ディープシーク、クウェン、キミ、ジーエルエム、ドウバオ、アーニー。先端ジーピーユーの入手制約を、学習と推論の効率化で補うのが共通の戦い方です。',
        },
        deep: {
          body: `2026年7月時点で <strong>Kimi K3</strong>（2.8兆パラメータ、オープンウェイトとして世界最大級）、<strong>Qwen3-Max</strong>、<strong>GLM-5.2</strong>（長時間のソフトウェア工学タスク向け）、<strong>DeepSeek-V3.2</strong>（100万トークンあたり数十セント台）が並びます。国内では生成AIサービスへの届出・審査制度があり、<strong>国内向けは規制下・国外向けはオープンウェイトで影響力拡大</strong>という二面戦略が観察されます。`,
          speech: '2026年7月時点でキミK3、クウェン3マックス、ジーエルエム5.2、ディープシークV3.2が並びます。国内向けは規制下、国外向けはオープンウェイトで影響力拡大、という二面戦略が観察されます。',
        },
      },
      {
        h: 'EU — ルールで世界を動かす',
        simple: {
          body: `EUの武器はモデルではなく<strong>ルール</strong>です。<strong>AI Act</strong> は用途をリスクの高さで分類し、高リスクほど義務を重くする方式。汎用AI向けの規則は2025年8月に適用が始まり、<strong>制裁金を含むAI Officeの執行権限は2026年8月2日に発動</strong>します。企業としては <strong>Mistral AI</strong>（フランス）が代表格です。`,
          speech: 'イーユーの武器はモデルではなくルールです。エーアイ・アクトは用途をリスクの高さで分類し、高リスクほど義務を重くする方式です。汎用エーアイ向けの規則は2025年8月に適用が始まり、制裁金を含む執行権限は2026年8月2日に発動します。',
        },
        deep: {
          body: `AI Act は 禁止 / 高リスク / 限定リスク / 最小リスク の階層と、汎用AI（GPAI）向けの横断義務（技術文書、学習データの概要公開、著作権方針、一定の計算量を超える場合の追加評価）から成ります。域外適用があるため<strong>EU域内にサービスを出すなら国外企業も対象</strong>。政策の軸は「ソブリンAI」で、データと計算資源を域内に置くことが競争政策・安全保障の両面から推進されています。一方で、規制コストが域内スタートアップの負担になるという批判も継続しています。`,
          speech: 'エーアイ・アクトは、禁止、高リスク、限定リスク、最小リスクの階層と、汎用エーアイ向けの横断義務から成ります。域外適用があるため、イーユー域内にサービスを出すなら国外企業も対象です。政策の軸はソブリンエーアイです。',
        },
      },
      {
        h: '日本 — 学習に寛容な法と、実世界',
        simple: {
          body: `日本の特徴は<strong>著作権法30条の4</strong>。情報解析のための著作物利用を幅広く認めており、学習データの扱いが国際的に見て寛容です。国産LLMは産学官で進み（NIIの <strong>LLM-jp</strong>、産総研の <strong>ABCI</strong>、<strong>Swallow</strong>）、企業では <strong>Sakana AI</strong>、<strong>Preferred Networks（PLaMo）</strong>。強みは製造業やロボティクスなど<strong>実世界のデータ</strong>との接続です。`,
          speech: '日本の特徴は著作権法30条の4です。情報解析のための著作物利用を幅広く認めており、学習データの扱いが国際的に見て寛容です。国産エルエルエムは産学官で進み、企業ではサカナエーアイ、プリファードネットワークスがあります。',
        },
        deep: {
          body: `30条の4は「享受を目的としない利用」を権利制限の対象とする条文で、学習段階には広く及ぶ一方、生成物が既存著作物に類似する場合の侵害判断は別問題として残ります。計算資源は <strong>ABCI</strong>（産総研）を中心に整備。<strong>Sakana AI</strong> は Transformer論文著者の Llion Jones と元Google Brain の David Ha が2023年に東京で創業し、巨大化とは別方向の（進化的なモデル統合など）研究路線を取っています。`,
          speech: '30条の4は、享受を目的としない利用を権利制限の対象とする条文で、学習段階には広く及びます。ただし生成物が既存著作物に類似する場合の侵害判断は別問題として残ります。サカナエーアイはトランスフォーマー論文著者らが2023年に東京で創業しました。',
        },
      },
      {
        h: 'その他の地域 — ソブリンAIの広がり',
        simple: {
          body: `カナダの <strong>Cohere</strong>（企業向け特化）、韓国の <strong>LG EXAONE</strong>・<strong>Naver HyperCLOVA X</strong>、インドの <strong>BharatGen</strong>、UAEの <strong>Falcon / G42</strong>、サウジの <strong>HUMAIN</strong>。「自国語・自国データ・自国の計算資源でモデルを持つ」という<strong>ソブリンAI</strong>の動きが世界中に広がっています。`,
          speech: 'カナダのコヒア、韓国のエルジー・エクサワンとネイバーのハイパークローバエックス、インドのバーラトジェン、ユーエーイーのファルコン、サウジのヒューメイン。自国語、自国データ、自国の計算資源でモデルを持つという、ソブリンエーアイの動きが世界中に広がっています。',
        },
        deep: {
          body: `動機は3つです。<strong>①言語と文化</strong>（英語中心のモデルは自国語の性能とニュアンスで劣る）<strong>②データ主権</strong>（機微データを国外のAPIへ出したくない）<strong>③産業政策</strong>（計算資源そのものをインフラとみなす）。多くはゼロからの事前学習ではなく、オープンウェイトモデルの継続事前学習・ファインチューニングを選びます。オープンウェイトの存在が、この世界的な分散を実際に可能にしている点は見落とされがちです。`,
          speech: '動機は3つです。言語と文化、データ主権、そして産業政策。多くはゼロからの事前学習ではなく、オープンウェイトモデルの継続事前学習やファインチューニングを選びます。オープンウェイトの存在が、この世界的な分散を可能にしています。',
        },
      },
    ],
  },

  // ────────────────────────────────────────────── 8
  {
    id: 'compare',
    title: 'Claude / GPT / Gemini',
    subtitle: '3つのモデルの性格',
    beats: [
      {
        h: '出自が性格を決める',
        simple: {
          body: `<strong>Claude</strong>（Anthropic）は安全性研究から出発した研究所の製品。<strong>GPT</strong>（OpenAI）は ChatGPT という巨大な入口を持つ消費者プラットフォーム。<strong>Gemini</strong>（Google DeepMind）は検索・Workspace・Android という自社製品群への統合が前提。<strong>どこから来たかが、そのまま得意分野になっています。</strong>`,
          speech: 'クロードは安全性研究から出発した研究所の製品。ジーピーティーはチャットジーピーティーという巨大な入口を持つ消費者プラットフォーム。ジェミニは検索やワークスペースという自社製品群への統合が前提。どこから来たかが、そのまま得意分野になっています。',
        },
        deep: {
          body: `<strong>Claude</strong>: Constitutional AI（原則の集合に照らしてモデル自身が出力を批評・修正する訓練法）と RLAIF を採用。長文読解と、道具を使って長時間作業を続けるエージェント用途に注力。2024年に <strong>MCP</strong> を公開し外部ツール接続を標準化した。<br><strong>GPT</strong>: 消費者リーチが最大で、画像・音声・動画を含む最も広いモダリティとエコシステムを持つ。<br><strong>Gemini</strong>: 自社設計の <strong>TPU</strong> で学習から推論まで垂直統合し、超長文コンテキストと大量処理のコスト効率に強みがある。`,
          speech: 'クロードはコンスティテューショナル・エーアイを採用し、長文読解とエージェント用途に注力しています。ジーピーティーは消費者リーチが最大で、最も広いモダリティとエコシステムを持ちます。ジェミニは自社設計のティーピーユーで垂直統合し、超長文と大量処理のコスト効率に強みがあります。',
        },
      },
      {
        h: '順位の比較は賞味期限が短い',
        simple: {
          body: `ベンチマークの順位は<strong>数か月で入れ替わります</strong>。2026年7月だけでも Claude Opus 5、GPT-5.6、Gemini 3.6 が相次いで出ました。「今どれが一番賢いか」を追いかけるのは、ほとんどの人にとって効率が悪い。<strong>どういう作業に向くか</strong>で選ぶほうが実用的です。`,
          speech: 'ベンチマークの順位は数か月で入れ替わります。今どれが一番賢いかを追いかけるのは、ほとんどの人にとって効率が悪い。どういう作業に向くかで選ぶほうが実用的です。',
        },
        deep: {
          body: `ベンチマークには構造的な問題があります。<strong>①汚染</strong>（テスト問題が学習データに混入する）<strong>②過適合</strong>（ベンチマークに向けた最適化）<strong>③外的妥当性</strong>（試験の点数と実務の成果は別物）。実務では、<strong>自分のタスクで小さな評価セットを作って測る</strong>のが最も信頼できます。公開ベンチは候補を絞り込むフィルタとして使うのが適切な用法です。`,
          speech: 'ベンチマークには構造的な問題があります。学習データへの汚染、ベンチマークへの過適合、そして試験の点数と実務の成果は別物だという外的妥当性の問題。実務では、自分のタスクで小さな評価セットを作って測るのが最も信頼できます。',
        },
      },
      {
        h: '選び方の指針',
        simple: {
          body: `<strong>長い文書やコードベースを扱う／長時間の自律作業</strong> → Claude<br><strong>幅広い用途の汎用アシスタント／画像・音声も含めて</strong> → GPT<br><strong>Google製品との統合／大量処理のコスト効率</strong> → Gemini<br><strong>コスト最優先／自社サーバーで動かしたい</strong> → オープンウェイト（DeepSeek, Qwen, Kimi, GLM, Llama）`,
          speech: '長い文書やコードベースを扱う、長時間の自律作業ならクロード。幅広い用途の汎用アシスタントならジーピーティー。グーグル製品との統合や大量処理のコスト効率ならジェミニ。コスト最優先で自社サーバーで動かしたいならオープンウェイトです。',
        },
        deep: {
          body: `実務的には<strong>1社に固定しない</strong>設計が有利です。①抽象化レイヤ（またはOpenAI互換API）を挟んで差し替え可能にする ②タスク種別ごとにモデルを割り当てる（分類は小型・安価、設計は最上位）③プロンプトとツール定義をモデル非依存に保つ。乗り換えコストを低く保つこと自体が、この変化速度への最善の対処になります。`,
          speech: '実務的には1社に固定しない設計が有利です。抽象化レイヤを挟んで差し替え可能にする。タスク種別ごとにモデルを割り当てる。プロンプトとツール定義をモデル非依存に保つ。乗り換えコストを低く保つこと自体が、この変化速度への最善の対処になります。',
        },
      },
    ],
  },

  // ────────────────────────────────────────────── 9
  {
    id: 'agents',
    title: '往復から、ループへ',
    subtitle: 'Claude Code / Codex とチャットの違い',
    beats: [
      {
        h: 'チャットは「1往復」',
        simple: {
          body: `Claude や ChatGPT の画面では、あなたが<strong>文脈を集めてきて貼り付け</strong>、モデルが答えを返し、<strong>あなたが実行して結果を確かめます</strong>。ファイルを探すのも、コードを貼るのも、テストを走らせるのも人間の担当。モデルは会話の中に閉じています。`,
          speech: 'クロードやチャットジーピーティーの画面では、あなたが文脈を集めてきて貼り付け、モデルが答えを返し、あなたが実行して結果を確かめます。ファイルを探すのも、テストを走らせるのも人間の担当です。',
        },
        deep: {
          body: `構造的に言えば、<strong>観測と行動のループが人間の側にあります</strong>。モデルの入出力はテキストのみで、環境への副作用を持たない。したがって精度の上限は「人間がどれだけ適切な文脈を渡せたか」で決まり、対象が大きくなるほど人間側がボトルネックになります。`,
          speech: '構造的に言えば、観測と行動のループが人間の側にあります。モデルの入出力はテキストのみで、環境への副作用を持たない。したがって精度の上限は、人間がどれだけ適切な文脈を渡せたかで決まります。',
        },
      },
      {
        h: 'エージェントは「ループが回る」',
        simple: {
          body: `Claude Code や Codex では、モデル自身が<strong>ファイルを探し、読み、書き換え、テストを実行し、その出力を見て直します</strong>。計画 → 調査 → 編集 → 実行 → 検証 → 修正、というループが<strong>モデルの側で回り続ける</strong>。人間は目標と権限を与え、要所で確認する役に回ります。`,
          speech: 'クロードコードやコデックスでは、モデル自身がファイルを探し、読み、書き換え、テストを実行し、その出力を見て直します。計画、調査、編集、実行、検証、修正というループが、モデルの側で回り続ける。人間は目標と権限を与え、要所で確認する役に回ります。',
        },
        deep: {
          body: `技術的な要件は4つです。<strong>①ツール使用</strong>（次にどの道具を呼ぶかをモデルが選び、返り値を見て次を決める）<strong>②権限モデル</strong>（どのコマンドを許すか、どこで確認を挟むか）<strong>③長時間の一貫性</strong>（数十〜数百ターン目的を見失わない訓練とコンテキスト管理）<strong>④検証の内在化</strong>（報告の前に自分でテストを回す）。<strong>MCP</strong> は①の接続部分を標準化するプロトコルです。`,
          speech: '技術的な要件は4つです。ツール使用、権限モデル、長時間の一貫性、そして検証の内在化。エムシーピーは、ツール接続の部分を標準化するプロトコルです。',
        },
      },
      {
        h: '同じモデル、違う器',
        simple: {
          body: `重要なのは、<strong>中身のモデルは同じ</strong>だということ。Claude Code の中で動いているのは Claude です。違うのは<strong>器</strong>のほう——ファイルシステムやシェルへのアクセス、ループを回す仕組み、権限の管理。<strong>能力の差ではなく、環境との接続の差</strong>なのです。`,
          speech: '重要なのは、中身のモデルは同じだということ。クロードコードの中で動いているのはクロードです。違うのは器のほう。ファイルシステムやシェルへのアクセス、ループを回す仕組み、権限の管理。能力の差ではなく、環境との接続の差なのです。',
        },
        deep: {
          body: `ただし完全に同じでもありません。エージェント用途向けには、ツール呼び出しの正確さ、長い軌跡での目標保持、失敗からの回復といった能力が<strong>後訓練で強化</strong>されます。近年のモデルカードで「エージェント性能」が独立した指標として扱われるのはこのためです。器がモデルの訓練目標を変え、モデルが器の設計を変える、という相互作用が起きています。`,
          speech: 'ただし完全に同じでもありません。エージェント用途向けには、ツール呼び出しの正確さ、長い軌跡での目標保持、失敗からの回復といった能力が後訓練で強化されます。器がモデルの訓練目標を変え、モデルが器の設計を変える、という相互作用が起きています。',
        },
      },
      {
        h: '使い分け',
        simple: {
          body: `<strong>調べもの・下書き・相談・学習</strong> → チャット<br><strong>複数ファイルの改修・移行・テストを通すまで</strong> → エージェント<br>注意点として、エージェントは<strong>実際にファイルを書き換えコマンドを実行します</strong>。バージョン管理と権限設定を前提にしてください。`,
          speech: '調べもの、下書き、相談、学習ならチャット。複数ファイルの改修や移行、テストを通すまでならエージェント。注意点として、エージェントは実際にファイルを書き換えコマンドを実行します。バージョン管理と権限設定を前提にしてください。',
        },
        deep: {
          body: `判断軸は<strong>「検証が自動化できるか」</strong>です。テスト・型チェック・lint・ビルドのように機械が正誤を判定できる領域では、エージェントのループが強力に効きます（自分で回して自分で直せる）。逆に、正解が主観的な領域——文章のトーン、設計の good taste、事業判断——では、ループが空回りしやすく人間の判断が要ります。この線引きが、実務での使い分けを最もよく説明します。`,
          speech: '判断軸は、検証が自動化できるかです。テストや型チェックのように機械が正誤を判定できる領域では、エージェントのループが強力に効きます。逆に、正解が主観的な領域では、ループが空回りしやすく人間の判断が要ります。',
        },
      },
    ],
  },
];

const byId = Object.fromEntries(base.map((c) => [c.id, c]));

/**
 * 最終的な章の並び。
 * 「仕組み → 歴史 → 系譜からの橋渡し（計算基盤）→ 産業 → 活用 → 問題」の順に読ませる。
 *
 * compute（GPU・CUDA・蒸留）は genealogy の直後に置く。蒸留の係争ビートが
 * Moonshot・DeepSeek・MiniMax を名指しするため、その企業群を先に紹介しておく必要がある。
 * openness（開くか閉じるか）は compare・agents と同じ「どう選び、どう使うか」の一群として
 * agents の直後に置き、後半の問題編（地域・法・軍事・統治）への橋渡しにする。
 */
export const chapters = [
  byId.tokens, //      1 ことばを数に変える
  byId.attention, //   2 注意という発明
  byId.diffusion, //   3 画像・動画の生成
  byId.history, //     4 技術史
  byId.genealogy, //   5 メーカーの系譜
  compute, //          6 計算という土台（GPU・CUDA・蒸留）
  byId.layers, //      7 レイヤー構造
  byId.compare, //     8 Claude / GPT / Gemini
  byId.agents, //      9 エージェント vs チャット
  openness, //        10 開くか、閉じるか
  byId.regions, //    11 地域
  conflicts, //       12 法と政治の衝突
  uses, //            13 軍事と科学
  frontier, //        14 フロンティアの制御
].map((c, i) => ({ ...c, no: i + 1 }));

/** 参考文献・出典（取得日を明記する） */
export const references = {
  fetchedAt: '2026-07-31',
  groups: [
    {
      label: '基礎論文',
      items: [
        { t: 'Attention Is All You Need (Vaswani et al., 2017)', u: 'https://arxiv.org/abs/1706.03762' },
        { t: 'Scaling Laws for Neural Language Models (Kaplan et al., 2020)', u: 'https://arxiv.org/abs/2001.08361' },
        { t: 'Training Compute-Optimal LLMs / Chinchilla (Hoffmann et al., 2022)', u: 'https://arxiv.org/abs/2203.15556' },
        { t: 'Training language models to follow instructions / InstructGPT (2022)', u: 'https://arxiv.org/abs/2203.02155' },
        { t: 'Constitutional AI: Harmlessness from AI Feedback (Anthropic, 2022)', u: 'https://arxiv.org/abs/2212.08073' },
      ],
    },
    {
      label: '画像・動画生成',
      items: [
        { t: 'Denoising Diffusion Probabilistic Models (Ho et al., 2020)', u: 'https://arxiv.org/abs/2006.11239' },
        { t: 'High-Resolution Image Synthesis with Latent Diffusion Models (Rombach et al., 2022)', u: 'https://arxiv.org/abs/2112.10752' },
        { t: 'Scalable Diffusion Models with Transformers / DiT (Peebles & Xie, 2023)', u: 'https://arxiv.org/abs/2212.09748' },
        { t: 'Video generation models as world simulators (OpenAI, Sora)', u: 'https://openai.com/index/video-generation-models-as-world-simulators/' },
      ],
    },
    {
      label: '2026年の市況（本ページ作成時に参照）',
      items: [
        { t: 'AI Release Tracker — LLM Timeline 2022–2026', u: 'https://aireleasetracker.com/' },
        { t: 'LLM News / Model Releases (llm-stats.com)', u: 'https://llm-stats.com/ai-news' },
        { t: "China's Top AI Models in 2026: DeepSeek, Qwen, Kimi, Doubao", u: 'https://medium.com/coinmonks/chinas-top-ai-models-in-2026-deepseek-qwen-kimi-doubao-and-the-new-ai-race-08083866ac5a' },
        { t: 'AI Video Generation Models: 2026 Complete Guide', u: 'https://wavespeed.ai/blog/posts/ai-video-generation-models-2026/' },
      ],
    },
    {
      label: '計算基盤・蒸留',
      items: [
        { t: 'Distilling the Knowledge in a Neural Network (Hinton et al., 2015)', u: 'https://arxiv.org/abs/1503.02531' },
        { t: 'NVIDIA vs AMD AI GPUs 2026: Blackwell / Rubin vs MI400', u: 'https://gpuinsights.net/nvidia-amd-ai-chips-data-center-war-2026/' },
        { t: 'Google TPUs vs NVIDIA & AMD GPUs — 2026 Deep-Dive', u: 'https://www.dataknobs.com/generativeai/8-tpu-gpu/google-tpus-vs-nvidia-amd-gpus.html' },
      ],
    },
    {
      label: 'オープンウェイトをめぐる議論',
      items: [
        { t: 'Open Weights and American AI Leadership（署名230社超・2026-07）', u: 'https://www.microsoft.com/en-us/corporate-responsibility/topics/open-weight/' },
        { t: 'As US weighs response to Chinese AI, industry urges against broad open-weight restrictions (TechCrunch, 2026-07-24)', u: 'https://techcrunch.com/2026/07/24/as-us-weighs-response-to-chinese-ai-industry-urges-against-broad-open-weight-restrictions/' },
        { t: 'International AI Safety Report 2026', u: 'https://arxiv.org/pdf/2602.21012' },
        { t: 'The State of Open Source AI — v1.0.1 (2026-07)', u: 'https://stateofopensource.ai/' },
      ],
    },
    {
      label: '法と政治の衝突',
      items: [
        { t: "Inside Project Panama, Anthropic's Effort To Scan and Shred Books (IBTimes)", u: 'https://www.ibtimes.co.uk/anthropic-secret-book-scanning-operation-1811155' },
        { t: 'The quest to "destructively scan" all the world\'s books (Washington Post)', u: 'https://www.washingtonpost.com/podcasts/post-reports/the-quest-to-destructively-scan-all-the-worlds-books/' },
        { t: 'The New York Times v. Microsoft and OpenAI (Wikipedia)', u: 'https://en.wikipedia.org/wiki/The_New_York_Times_v._Microsoft_and_OpenAI' },
        { t: 'NYT-Led Group Asks Court to Sanction OpenAI (2026-07-09)', u: 'https://money.usnews.com/investing/news/articles/2026-07-09/new-york-times-led-group-asks-court-to-sanction-openai-in-us-copyright-dispute' },
        { t: 'AI Chip Smuggling: The Limits of US Export Controls (BISI)', u: 'https://bisi.org.uk/reports/ai-chip-smuggling-the-limits-of-us-export-controls' },
        { t: "Global AI Regulation Wave: Italy's DeepSeek Ban", u: 'https://www.compliancehub.wiki/global-ai-regulation-wave-how-italys-deepseek-ban-triggered-a-worldwide-scrutiny-of-chinese-ai-models-germany-netherlands-taiwan/' },
      ],
    },
    {
      label: '軍事と科学',
      items: [
        { t: 'Pentagon-Anthropic Dispute over Autonomous Weapon Systems (CRS / Congress.gov)', u: 'https://www.congress.gov/crs-product/IN12669' },
        { t: 'OpenAI announces Pentagon deal after Trump bans Anthropic (NPR, 2026-02-27)', u: 'https://www.npr.org/2026/02/27/nx-s1-5729118/trump-anthropic-pentagon-openai-ai-weapons-ban' },
        { t: "OpenAI's 'compromise' with the Pentagon is what Anthropic feared (MIT Tech Review)", u: 'https://www.technologyreview.com/2026/03/02/1133850/openais-compromise-with-the-pentagon-is-what-anthropic-feared/' },
        { t: 'AI for Scientific Discovery: The 2026 Guide', u: 'https://o-mega.ai/articles/ai-for-scientific-discovery-the-2026-guide' },
        { t: 'AI for Science in 2026: Real Breakthroughs vs. the Hype', u: 'https://www.fatherofai.in/blog/ai-for-science-2026-breakthroughs-vs-hype/' },
      ],
    },
    {
      label: 'フロンティアの制御',
      items: [
        { t: 'Pacing the Frontier（共同声明・2026-07-28）', u: 'https://www.pacingthefrontier.com/' },
        { t: 'Pacing the Frontier Letter — July 2026 Explained', u: 'https://explainx.ai/blog/pacing-the-frontier-ai-employees-letter-july-2026' },
        { t: 'OpenAI and Anthropic Back Employee Call to Pace AI Progress (Unite.AI)', u: 'https://www.unite.ai/openai-and-anthropic-back-employee-call-to-pace-ai-progress/' },
        { t: 'Russell–Einstein Manifesto (1955)', u: 'https://pugwash.org/1955/07/09/statement-manifesto/' },
        { t: 'Treaty on the Non-Proliferation of Nuclear Weapons (UNODA)', u: 'https://disarmament.unoda.org/wmd/nuclear/npt/' },
      ],
    },
    {
      label: '規制・地域',
      items: [
        { t: 'EU AI Act Guide 2026: Risk Classes, GPAI, Deadlines, Fines', u: 'https://compliance-kit.eu/en/knowledge/eu-ai-act-guide' },
        { t: 'Europe AI Landscape 2026: EU Act, Mistral, Sovereign Compute', u: 'https://explainx.ai/blog/europe-ai-landscape-sovereign-compute-eu-act-2026' },
        { t: 'Sovereign AI in 2026: Mistral, G42, HUMAIN, BharatGen', u: 'https://pdpspectra.com/blog/sovereign-ai-initiatives-2026/' },
        { t: 'Model Context Protocol (MCP)', u: 'https://modelcontextprotocol.io/' },
      ],
    },
  ],
};
