/* FixUp — gera as ilustrações das categorias (img/categorias/*.webp) a partir da arte "Todas as categorias".

   Uso (uma vez): npm install        (nesta pasta; instala o sharp, que lê e grava imagens)
   Depois:        npm run gerar      (ou: node gerar.js [arte.webp])

   Entrada: categorias-original.webp: a grade 5 x 3 com o pica-pau fazendo cada serviço, sobre fundo
            azul-marinho (1200 x 896 px). A ordem dos blocos é a de IDS, abaixo.
   Saída:   ../../img/categorias/<categoria>.webp: 188 x 188 px, fundo transparente, para funcionar
            no tema claro e no escuro.

   Como funciona: cada bloco é recortado, a cor de fundo do bloco é preenchida a partir das bordas e vira
   transparência. Nos contornos, a mistura com o fundo vira opacidade parcial, sem deixar halo.
   O ícone de piscina não está na arte: ele reaproveita o pica-pau da limpeza, troca a vassoura por uma
   peneira e desenha a piscina com escada no mesmo traço (azul-marinho, azul e branco).
   As posições (COLS, ROWS) valem para a arte atual; se ela mudar de tamanho, ajuste-as. */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IDS = ['eletricista', 'encanador', 'eletrodomesticos', 'limpeza', 'montador',
  'climatizacao', 'eletronicos', 'informatica', 'pintor', 'chaveiro',
  'jardinagem', 'frete', 'beleza', 'reformas'];
const COLS = [[64, 243], [289, 464], [510, 688], [733, 911], [956, 1133]];
const ROWS = [[127, 301], [385, 565], [632, 815]];
const SIZE = 188;              // tela quadrada comum: todos os pica-paus ficam na mesma escala
const PAGE = [11, 15, 43];     // fundo da página, em volta dos blocos
const RAD = 30;                // raio dos cantos dos blocos
const FILL = 17;               // diferença de cor aceita como fundo do bloco
const SOFT = 46;               // distância de cor entre o fundo do bloco e o traço azul-marinho

const SRC = process.argv[2] || path.join(__dirname, 'categorias-original.webp');
const OUT = path.join(__dirname, '..', '..', 'img', 'categorias');

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const STEPS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Recorta um bloco e devolve RGBA (w x h) sem o fundo. */
function cutTile(px, k) {
  const isPage = (c) => dist(c, PAGE) < 16;
  const [x0, x1] = COLS[k % 5], [y0, y1] = ROWS[Math.floor(k / 5)];
  const mx = Math.round((x0 + x1) / 2), my = Math.round((y0 + y1) / 2);
  /* bordas exatas do bloco: primeira coluna/linha que não é o fundo da página */
  let L = x0 - 12; while (isPage(px(L, my))) L++;
  let R = x1 + 5; while (isPage(px(R, my))) R--;
  let T = y0 - 12; while (isPage(px(mx, T))) T++;
  let B = y1 + 5; while (isPage(px(mx, B))) B--;
  const w = R - L + 1, h = B - T + 1;
  const at = (x, y) => px(L + x, T + y);

  /* fora do retângulo arredondado (com 2 px de folga) é sempre transparente */
  const inside = (x, y) => {
    const ix = Math.min(x, w - 1 - x), iy = Math.min(y, h - 1 - y);
    if (ix < 2 || iy < 2) return false;
    if (ix < RAD && iy < RAD) return Math.hypot(RAD - ix, RAD - iy) <= RAD - 2;
    return true;
  };

  /* cor de fundo do bloco: mediana da borda interna */
  const ring = [];
  for (let x = RAD; x < w - RAD; x += 2) ring.push(at(x, 4), at(x, h - 5));
  for (let y = RAD; y < h - RAD; y += 2) ring.push(at(4, y), at(w - 5, y));
  const med = (i) => ring.map((c) => c[i]).sort((a, b) => a - b)[ring.length >> 1];
  const BG = [med(0), med(1), med(2)];

  /* preenchimento a partir das bordas, por pixels parecidos com o fundo */
  const bg = new Uint8Array(w * h), q = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!inside(x, y)) bg[y * w + x] = 2;
  const grow = (x, y) => STEPS4.forEach(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
    const n = ny * w + nx;
    if (!bg[n] && dist(at(nx, ny), BG) < FILL) { bg[n] = 1; q.push(n); }
  });
  for (let j = 0; j < w * h; j++) if (bg[j] === 2) grow(j % w, (j / w) | 0);
  while (q.length) { const j = q.pop(); grow(j % w, (j / w) | 0); }

  /* contorno: a cor é o fundo misturado com o traço. A opacidade vem da distância até o fundo,
     e a cor é recuperada sem a mistura. */
  const nearBg = (x, y) => {
    for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
      for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) if (bg[yy * w + xx]) return true;
    return false;
  };
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = y * w + x, o = j * 4, c = at(x, y);
    let a = 1, f = c;
    if (bg[j]) a = 0;
    else if (nearBg(x, y)) {
      a = Math.min(1, dist(c, BG) / SOFT);
      if (a > 0) f = c.map((v, i) => Math.max(0, Math.min(255, Math.round(BG[i] + (v - BG[i]) / a))));
    }
    out[o] = f[0]; out[o + 1] = f[1]; out[o + 2] = f[2]; out[o + 3] = Math.round(a * 255);
  }

  /* tira pontinhos soltos (ruído da compressão): grupos minúsculos e quase transparentes */
  const seen = new Uint8Array(w * h);
  for (let s0 = 0; s0 < w * h; s0++) {
    if (seen[s0] || !out[s0 * 4 + 3]) continue;
    const comp = [s0], st = [s0];
    seen[s0] = 1;
    let maxA = 0;
    while (st.length) {
      const j = st.pop(), x = j % w, y = (j / w) | 0;
      maxA = Math.max(maxA, out[j * 4 + 3]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!seen[n] && out[n * 4 + 3]) { seen[n] = 1; st.push(n); comp.push(n); }
      }
    }
    if (comp.length <= 8 && maxA < 190) comp.forEach((j) => { out[j * 4 + 3] = 0; });
  }
  return { out, w, h };
}

/** Coloca o recorte no centro da tela quadrada comum. Devolve PNG. */
async function square({ out, w, h }) {
  const tile = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: tile, left: Math.max(0, Math.round((SIZE - w) / 2)), top: Math.max(0, Math.round((SIZE - h) / 2)) }])
    .png().toBuffer();
}

/* ---------- Ícone de piscina, montado sobre o pica-pau da limpeza ---------- */
const N = '#0c0f34';   // contorno azul-marinho
const SW = 2.3;        // espessura do contorno
const POOL = `
<svg xmlns="http://www.w3.org/2000/svg" width="188" height="188" viewBox="0 0 188 188">
  <defs>
    <clipPath id="agua"><rect x="104.5" y="130.5" width="73" height="27" rx="9"/></clipPath>
    <clipPath id="rede"><ellipse cx="131.8" cy="141" rx="10.5" ry="8"/></clipPath>
  </defs>

  <!-- piscina: borda clara, parede do fundo com azulejos e água -->
  <rect x="98" y="124" width="86" height="40" rx="14" fill="#e9ecfa" stroke="${N}" stroke-width="${SW}"/>
  <rect x="104.5" y="130.5" width="73" height="27" rx="9" fill="#74b3ef"/>
  <g clip-path="url(#agua)">
    <rect x="104" y="130" width="74" height="9" fill="#4d82d4"/>
    <path d="M110 130 v9 M117 130 v9 M124 130 v9 M131 130 v9 M138 130 v9 M145 130 v9 M152 130 v9 M159 130 v9 M166 130 v9 M173 130 v9" stroke="#7fa6e6" stroke-width="0.9"/>
    <path d="M103 139 q3.5 -2.2 7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 V160 H103 z" fill="#74b3ef"/>
    <path d="M103 139 q3.5 -2.2 7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0 t7 0" fill="none" stroke="#b9dcfa" stroke-width="1.4"/>
    <path d="M109 150 q4 -3 8 0 t8 0" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M146 152 q4 -3 8 0 t8 0" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <rect x="104.5" y="130.5" width="73" height="27" rx="9" fill="none" stroke="${N}" stroke-width="${SW}"/>

  <!-- escada: dois corrimãos que saem da água e se apoiam na borda, com degraus -->
  <g stroke-linecap="round" stroke-linejoin="round">
    <path d="M158 133 h12 M158 140 h12" stroke="${N}" stroke-width="5"/>
    <path d="M158 133 h12 M158 140 h12" stroke="#d2d3f0" stroke-width="1.8"/>
    <g fill="none">
      <path d="M158 148 V114 q0 -6 6 -6 q6 0 6 6 v12" stroke="${N}" stroke-width="6"/>
      <path d="M158 148 V114 q0 -6 6 -6 q6 0 6 6 v12" stroke="#d2d3f0" stroke-width="2"/>
      <path d="M170 150 V116 q0 -6 6 -6 q6 0 6 6 v10" stroke="${N}" stroke-width="6"/>
      <path d="M170 150 V116 q0 -6 6 -6 q6 0 6 6 v10" stroke="#d2d3f0" stroke-width="2"/>
    </g>
  </g>
  <path d="M155 145.5 q3.5 -2.2 7 0 t7 0 t7 0" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>

  <!-- cabo e peneira tirando uma folha da água -->
  <rect x="129.2" y="112" width="5.2" height="22" fill="#d2d3f0" stroke="${N}" stroke-width="${SW}"/>
  <ellipse cx="131.8" cy="141" rx="10.5" ry="8" fill="#e9ecfa" fill-opacity=".5"/>
  <g clip-path="url(#rede)" stroke="#ffffff" stroke-width="0.9" opacity=".95">
    <path d="M118 132 l28 22 M118 138 l24 19 M118 126 l28 22 M124 126 l24 19 M112 140 l22 17"/>
    <path d="M146 132 l-28 22 M146 138 l-24 19 M146 126 l-28 22 M140 126 l-24 19 M152 140 l-22 17"/>
  </g>
  <ellipse cx="131.8" cy="141" rx="10.5" ry="8" fill="none" stroke="${N}" stroke-width="${SW}"/>
  <ellipse cx="131.8" cy="141" rx="8.3" ry="5.9" fill="none" stroke="#d2d3f0" stroke-width="1.3"/>
  <path d="M125.5 142.5 q5 -7 11.5 -1.6 q-5.4 5 -11.5 1.6 z" fill="#6fae7d" stroke="${N}" stroke-width="1.4"/>
  <path d="M126.6 142.2 q5 -1.6 9.4 -1.2" fill="none" stroke="${N}" stroke-width="0.9"/>
  <path d="M124 151.5 q7.8 3.2 15.6 0" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>

  <!-- brilho -->
  <path d="M114 115 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill="#d6e6fb" stroke="${N}" stroke-width="1.1"/>
</svg>`;

async function pool(limpezaPng) {
  const { data, info } = await sharp(limpezaPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  /* apaga a cabeça da vassoura e a ponta do cabo (canto inferior direito) */
  for (let y = 112; y < W; y++) for (let x = 103; x < W; x++) {
    if (y < 124 && (x < 125 || x > 139)) continue;
    data[(y * W + x) * 4 + 3] = 0;
  }
  const base = await sharp(data, { raw: { width: W, height: info.height, channels: 4 } }).png().toBuffer();
  const layer = await sharp(Buffer.from(POOL), { density: 72 }).resize(W, W).png().toBuffer();
  return sharp(base).composite([{ input: layer }]).png().toBuffer();
}

const webp = (png, file) => sharp(png).webp({ quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(file);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
  const pngs = {};
  for (let k = 0; k < IDS.length; k++) {
    pngs[IDS[k]] = await square(cutTile(px, k));
    await webp(pngs[IDS[k]], path.join(OUT, IDS[k] + '.webp'));
  }
  await webp(await pool(pngs.limpeza), path.join(OUT, 'piscina.webp'));
  console.log(`${IDS.length + 1} ilustrações gravadas em ${OUT}`);
})();
