/**
 * GNoME（DeepMind）が予測した新結晶の CIF を、原子座標と結合の一覧に変換する。
 *
 * 公開データは 450MB の zip だが、中身は先頭から順に並んだ小さな CIF なので、
 * 先頭の数MBだけ Range 取得して目的のファイルを取り出す。
 *
 * 使い方: node scripts/make-crystal.mjs MgNb8SnSe16 src/data/crystal.js
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const NAME = process.argv[2] ?? 'MgNb8SnSe16';
const OUT = process.argv[3] ?? './crystal.js';
const ZIP =
  'https://storage.googleapis.com/gdm_materials_discovery/gnome_data/by_reduced_formula.zip';
/** 先頭から読む量。目的の CIF はこの範囲に入っている必要がある。 */
const HEAD = 2_500_000;
/** 並べる単位格子の数 */
const [NX, NY, NZ] = [2, 2, 1];
/** これより近い原子どうしを結合として描く（Å） */
const CUT = 3.05;

// ── zip の先頭だけ取り、ローカルヘッダを順に辿って目的の CIF を取り出す
const buf = Buffer.from(
  await (
    await fetch(ZIP, { headers: { range: `bytes=0-${HEAD - 1}` } })
  ).arrayBuffer()
);

function extract(target) {
  let off = 0;
  while (off + 30 < buf.length) {
    if (buf.readUInt32LE(off) !== 0x04034b50) break; // PK\x03\x04
    const meth = buf.readUInt16LE(off + 8);
    const csz = buf.readUInt32LE(off + 18);
    const fnl = buf.readUInt16LE(off + 26);
    const efl = buf.readUInt16LE(off + 28);
    const name = buf.subarray(off + 30, off + 30 + fnl).toString();
    const body = buf.subarray(off + 30 + fnl + efl, off + 30 + fnl + efl + csz);
    if (name.endsWith(`/${target}.CIF`)) {
      return (meth === 8 ? zlib.inflateRawSync(body) : body).toString();
    }
    off += 30 + fnl + efl + csz;
  }
  return null;
}

const cif = extract(NAME);
if (!cif) throw new Error(`${NAME}.CIF が先頭 ${HEAD} バイトの中に見つかりません`);

// ── CIF を読む。GNoME の CIF は P1（対称操作の展開が不要）で、全サイトが並んでいる。
const num = (key) => Number(cif.match(new RegExp(`${key}\\s+(\\S+)`))[1]);
const cell = {
  a: num('_cell_length_a'),
  b: num('_cell_length_b'),
  c: num('_cell_length_c'),
  al: num('_cell_angle_alpha'),
  be: num('_cell_angle_beta'),
  ga: num('_cell_angle_gamma'),
  volume: num('_cell_volume'),
};
const formula = cif.match(/_chemical_formula_sum\s+'([^']+)'/)[1];
const spg = cif.match(/_symmetry_space_group_name_H-M\s+'([^']+)'/)[1];

const sites = [];
for (const line of cif.split('\n')) {
  // 「元素 ラベル 多重度 x y z 占有率」の行だけ拾う
  const m = line
    .trim()
    .match(/^([A-Z][a-z]?)\s+\S+\s+\d+\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)$/);
  if (m) sites.push({ el: m[1], f: [+m[2], +m[3], +m[4]] });
}
if (!sites.length) throw new Error('原子サイトを読み取れませんでした');

// ── 格子ベクトル（結晶学の標準的な取り方）
const rad = (d) => (d * Math.PI) / 180;
const [ca, cb, cg] = [Math.cos(rad(cell.al)), Math.cos(rad(cell.be)), Math.cos(rad(cell.ga))];
const sg = Math.sin(rad(cell.ga));
const va = [cell.a, 0, 0];
const vb = [cell.b * cg, cell.b * sg, 0];
const cx = cell.c * cb;
const cy = (cell.c * (ca - cb * cg)) / sg;
const vc = [cx, cy, Math.sqrt(cell.c * cell.c - cx * cx - cy * cy)];

// ── 単位格子を並べる
const atoms = [];
for (let i = 0; i < NX; i++)
  for (let j = 0; j < NY; j++)
    for (let k = 0; k < NZ; k++)
      for (const s of sites) {
        const [fa, fb, fc] = [s.f[0] + i, s.f[1] + j, s.f[2] + k];
        atoms.push({
          el: s.el,
          p: [0, 1, 2].map((d) => fa * va[d] + fb * vb[d] + fc * vc[d]),
        });
      }

// 重心を原点へ寄せ、いちばん外の原子が半径1になるよう正規化する
const ctr = [0, 1, 2].map((d) => atoms.reduce((t, a) => t + a.p[d], 0) / atoms.length);
atoms.forEach((a) => (a.p = a.p.map((v, d) => v - ctr[d])));
const radius = Math.max(...atoms.map((a) => Math.hypot(...a.p)));

// ── 結合。総当たりでも 100 原子程度なら一瞬で終わる。
const bonds = [];
for (let i = 0; i < atoms.length; i++) {
  for (let j = i + 1; j < atoms.length; j++) {
    const d = Math.hypot(...[0, 1, 2].map((k) => atoms[i].p[k] - atoms[j].p[k]));
    // 同種の非金属どうし（Se–Se など）は近接しても結合ではないので除く
    if (d < CUT && !(atoms[i].el === atoms[j].el && ['Se', 'S', 'O', 'N'].includes(atoms[i].el))) {
      bonds.push([i, j]);
    }
  }
}

const elements = [...new Set(atoms.map((a) => a.el))];
console.log(
  `${NAME}: ${sites.length} sites/cell → ${atoms.length} atoms (${NX}×${NY}×${NZ}), ` +
    `${bonds.length} bonds, elements ${elements.join(',')}, radius ${radius.toFixed(1)}Å`
);

const rows = atoms.map(
  (a) => `  ['${a.el}', ${a.p.map((v) => +(v / radius).toFixed(4)).join(', ')}],`
);

fs.writeFileSync(
  OUT,
  `/**
 * ${formula.replace(/'/g, '')}（GNoME が予測した層状セレン化物）の結晶構造。
 * 単位格子を ${NX}×${NY}×${NZ} に並べ、重心中心・半径1に正規化したもの。
 *
 * 出典: GNoME — Google DeepMind, Graph Networks for Materials Exploration
 * https://storage.googleapis.com/gdm_materials_discovery/gnome_data/by_reduced_formula.zip
 *   （${NAME}.CIF / CC-BY-4.0）
 * Merchant et al., "Scaling deep learning for materials discovery", Nature 624 (2023)
 *
 * 生成: node scripts/make-crystal.mjs ${NAME}
 */
export const CRYSTAL = {
  name: '${NAME}',
  formula: '${formula.replace(/'/g, '')}',
  spaceGroup: '${spg}',
  /** 単位格子（Å / 度） */
  cell: { a: ${cell.a.toFixed(4)}, b: ${cell.b.toFixed(4)}, c: ${cell.c.toFixed(4)}, alpha: ${cell.al.toFixed(2)}, beta: ${cell.be.toFixed(2)}, gamma: ${cell.ga.toFixed(2)} },
  sitesPerCell: ${sites.length},
  repeat: [${NX}, ${NY}, ${NZ}],
  /** 正規化前の外接半径（Å） */
  radius: ${radius.toFixed(2)},
};

/** [元素記号, x, y, z] */
export const ATOMS = [
${rows.join('\n')}
];

/** 結合（${CUT}Å 以内の原子対）。ATOMS の添字。 */
export const BONDS = [
${bonds.map((b) => `  ${b[0]}, ${b[1]},`).join('\n')}
];
`,
  'utf8'
);
console.log(`wrote ${OUT}`);
