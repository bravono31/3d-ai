/**
 * AlphaFold DB の予測構造を、主鎖（Cα）の点列に変換する。
 *
 * それらしい形を手で作るのではなく、AlphaFold が実際に出した座標をそのまま使う。
 * 全原子は数千点あって描画には過剰なので、主鎖の Cα だけを残す。
 *
 * 使い方: node scripts/make-protein.mjs P69905 src/data/protein.js
 */
import fs from 'node:fs';

const ACC = process.argv[2] ?? 'P69905';
const OUT = process.argv[3] ?? './protein.js';
const API = `https://alphafold.ebi.ac.uk/api/prediction/${ACC}`;

// 名乗らないと EBI 側に 403 で弾かれる
const get = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'make-protein.mjs (3d-ai visual explainer)' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
};

const meta = (await (await get(API)).json())[0];
if (!meta) throw new Error(`AlphaFold DB に ${ACC} が見つかりません`);
const pdb = await (await get(meta.pdbUrl)).text();

// PDB の ATOM 行は桁位置が決まっている（原子名 13-16, x/y/z 31-54, B値 61-66）。
// AlphaFold は B値の欄に pLDDT（0-100 の信頼度）を入れている。
const ca = [];
const plddt = [];
for (const line of pdb.split('\n')) {
  if (!line.startsWith('ATOM') || line.slice(12, 16).trim() !== 'CA') continue;
  ca.push([+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)]);
  plddt.push(+line.slice(60, 66));
}
if (ca.length !== meta.sequenceEnd - meta.sequenceStart + 1) {
  throw new Error(`Cα の数 ${ca.length} が配列長 ${meta.sequenceEnd} と合いません`);
}

// 重心を原点へ、いちばん遠い残基が半径1になるよう正規化する（表示側で好きな大きさに掛ける）
const c = [0, 1, 2].map((k) => ca.reduce((s, p) => s + p[k], 0) / ca.length);
const centered = ca.map((p) => p.map((v, k) => v - c[k]));
const radius = Math.max(...centered.map((p) => Math.hypot(...p)));
const flat = centered.flatMap((p) => p.map((v) => +(v / radius).toFixed(4)));

const mean = plddt.reduce((a, b) => a + b, 0) / plddt.length;
console.log(`${ACC} ${meta.uniprotId}: ${ca.length} residues, pLDDT ${mean.toFixed(1)}, radius ${radius.toFixed(1)}Å`);

// 1行に詰めると差分が読めないので、残基ごとに改行する
const rows = [];
for (let i = 0; i < flat.length; i += 3) rows.push(`  ${flat[i]}, ${flat[i + 1]}, ${flat[i + 2]},`);

fs.writeFileSync(
  OUT,
  `/**
 * ${meta.uniprotDescription}（${meta.organismScientificName} / ${meta.gene}）の
 * AlphaFold 予測構造。主鎖の Cα ${ca.length} 残基を、重心中心・半径1に正規化したもの。
 *
 * 出典: AlphaFold Protein Structure Database ${meta.modelEntityId} v${meta.latestVersion} (CC-BY-4.0)
 * ${meta.pdbUrl}
 * Jumper et al., Nature 596 (2021) / Varadi et al., NAR 52 (2024)
 *
 * 生成: node scripts/make-protein.mjs ${ACC}
 */
export const PROTEIN = {
  id: '${meta.uniprotAccession}',
  entry: '${meta.uniprotId}',
  model: '${meta.modelEntityId}',
  version: ${meta.latestVersion},
  residues: ${ca.length},
  /** 全残基の平均 pLDDT（AlphaFold 自身が出す 0-100 の信頼度） */
  plddt: ${mean.toFixed(1)},
};

/** Cα の座標を x,y,z の順に並べたもの */
export const CA = [
${rows.join('\n')}
];
`,
  'utf8'
);
console.log(`wrote ${OUT}`);
