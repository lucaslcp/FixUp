/* FixUp — gera o logo vetorial e a abertura animada a partir do PNG do logo.

   Uso (uma vez): npm install        (nesta pasta; instala o potrace, que vetoriza imagens,
                                      e o resvg, que transforma SVG em PNG)
   Depois:        npm run gerar      (ou: node gerar.js [logo.png])

   Saída: ../../img/logo-fixup.svg  (logo estático: ícone da aba e marca ao lado do aparelho)
          ../../img/abertura.svg    (abertura animada, usada em index.html e artifact.html)
          ../../img/icone-180.png   (ícone da tela inicial do iPhone)
          ../../img/icone-512.png   (prévia de link no WhatsApp e nas redes, e uso geral)

   Como funciona: o PNG é ampliado 4x, cada pixel é classificado em fundo, azul-marinho ou branco,
   e as regiões ligadas viram peças (casa, pássaro, rosto, chave inglesa). Cada peça é vetorizada
   separadamente, para que a animação mova as partes de forma independente.
   As medidas abaixo (linhas da casa, bico) valem para o logo atual; se o desenho mudar, ajuste-as. */
'use strict';

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const potrace = require('potrace');
const { Resvg } = require('@resvg/resvg-js');

const S = 4;                                             // ampliação antes de vetorizar
const COLORS = [[104, 112, 251], [1, 14, 118], [252, 252, 253]];   // 0 fundo, 1 azul-marinho, 2 branco
const PAINT = { tile: '#6870FB', navy: '#010E76', white: '#FFFFFF' };
const VIEWBOX = '38 38 347 337';                          // recorte do quadrado arredondado

/* Linhas-guia da casa: o eixo de cada traço. A animação revela a casa ao longo delas. */
const GUIDES = [
  ['d1', 'M98.5 312V146', 30],                          // parede esquerda, de baixo para cima
  ['d2', 'M66 179L214 66L362 177', 36],                 // telhado: beiral esquerdo, cumeeira, beiral direito
  ['d3', 'M327 146V242', 30],                           // parede direita
  ['d4', 'M300.5 150V86', 46]                           // chaminé
];
const FLOOR_Y = 341;                                     // base do pássaro e da chave: eles sobem a partir daqui
const SPARKS = { at: [340, 181], d: 'M343 167l9-10M346 181h14M343 195l9 10' };   // do lado de fora da parede direita

const input = path.resolve(process.argv[2] || path.join(__dirname, 'logo-original.png'));
const outDir = path.resolve(__dirname, '..', '..', 'img');

async function layers() {
  const src = await Jimp.read(input);
  const im = src.clone().resize(src.bitmap.width * S, src.bitmap.height * S, Jimp.RESIZE_BICUBIC);
  const { width: w, height: h, data } = im.bitmap;

  const cls = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4; let best = 0, bd = Infinity;
    COLORS.forEach((c, k) => { const d = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2; if (d < bd) { bd = d; best = k; } });
    cls[p] = best;
  }

  /* Regiões ligadas de mesma cor. */
  const comp = new Int32Array(w * h).fill(-1), info = [];
  for (let p = 0; p < w * h; p++) {
    if (comp[p] >= 0) continue;
    const id = info.length, k = cls[p]; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, border = false;
    const stack = [p]; comp[p] = id;
    while (stack.length) {
      const q = stack.pop(), x = q % w, y = (q / w) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (!x || !y || x === w - 1 || y === h - 1) border = true;
      for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
        if (r >= 0 && comp[r] < 0 && cls[r] === k) { comp[r] = id; stack.push(r); }
      }
    }
    info.push({ id, k, n, box: [x0 / S, y0 / S, x1 / S, y1 / S], border });
  }

  const inside = (b, B) => b[0] >= B[0] && b[1] >= B[1] && b[2] <= B[2] && b[3] <= B[3];
  const outside = info.find((c) => c.k === 2 && c.border).id;          // o branco em volta do quadrado
  const big = (k) => info.filter((c) => c.k === k && c.n > 60 * S * S).sort((a, b) => b.n - a.n);
  const navy = big(1), white = big(2).filter((c) => c.id !== outside);
  const bird = navy.find((c) => c.box[0] < 100), wrench = navy.find((c) => c !== bird);
  const face = white.find((c) => inside(c.box, bird.box) && c.box[1] > 150);
  const house = white.filter((c) => c !== face);
  if (!bird || !wrench || !face || !house.length) throw new Error('Não reconheci as peças do logo. O desenho mudou? Ajuste a separação em gerar.js.');
  const small = (k, box, not) => info.filter((c) => c.k === k && c.n <= 60 * S * S && c.n >= 6 * S && inside(c.box, box) && !not.includes(c.id));
  const houseIds = house.map((c) => c.id);
  const sets = {
    house: new Set(houseIds),
    birdNavy: new Set([bird.id, ...small(1, bird.box, [wrench.id]).filter((c) => !inside(c.box, wrench.box)).map((c) => c.id)]),
    birdWhite: new Set([face.id, ...small(2, bird.box, [outside, ...houseIds]).filter((c) => !inside(c.box, wrench.box)).map((c) => c.id)]),
    wrench: new Set([wrench.id, ...small(1, wrench.box, [bird.id]).map((c) => c.id)])
  };

  const trace = (pred) => new Promise(async (resolve, reject) => {
    const m = new Jimp(w, h, 0xffffffff);
    for (let p = 0; p < w * h; p++) if (pred(p)) { const i = p * 4; m.bitmap.data[i] = m.bitmap.data[i + 1] = m.bitmap.data[i + 2] = 0; }
    const t = new potrace.Potrace({ turdSize: 12 * S, optTolerance: 0.35, alphaMax: 1, threshold: 128 });
    t.loadImage(await m.getBufferAsync(Jimp.MIME_PNG), (err) => {
      if (err) return reject(err);
      const d = /\sd="([^"]+)"/.exec(t.getPathTag())[1];
      resolve(d.replace(/-?\d+(\.\d+)?/g, (v) => String(Math.round((+v / S) * 100) / 100)));
    });
  });

  return {
    tile: await trace((p) => comp[p] !== outside),
    house: await trace((p) => sets.house.has(comp[p])),
    birdNavy: await trace((p) => sets.birdNavy.has(comp[p])),
    birdWhite: await trace((p) => sets.birdWhite.has(comp[p])),
    wrench: await trace((p) => sets.wrench.has(comp[p]))
  };
}

const staticSvg = (L) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" role="img" aria-label="FixUp">
  <path fill="${PAINT.tile}" d="${L.tile}"/>
  <path fill="${PAINT.white}" d="${L.house}"/>
  <path fill="${PAINT.navy}" fill-rule="evenodd" d="${L.birdNavy}"/>
  <path fill="${PAINT.white}" fill-rule="evenodd" d="${L.birdWhite}"/>
  <path fill="${PAINT.navy}" fill-rule="evenodd" d="${L.wrench}"/>
</svg>
`;

const animatedSvg = (L) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" role="img" aria-label="FixUp">
<style>
  /* Abertura do FixUp (gerada por ferramentas/logo/gerar.js). Linha do tempo, em segundos:
     0,15–1,10 a casa se desenha · 0,75–1,37 o pássaro sobe · 1,15–1,73 a chave gira e encaixa
     1,45–2,07 o pássaro dá duas bicadas na parede da casa, com faíscas do lado de fora */
  .g { fill: none; stroke: #fff; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 0; }
  .d1 { animation: risco .30s .15s cubic-bezier(.5,0,.3,1) both; }
  .d2 { animation: risco .55s .40s cubic-bezier(.45,0,.25,1) both; }
  .d3 { animation: risco .22s .88s cubic-bezier(.4,0,.2,1) both; }
  .d4 { animation: risco .22s .90s cubic-bezier(.4,0,.2,1) both; }
  .ave { transform-box: fill-box; transform-origin: 50% 100%; animation: sobe .62s .75s cubic-bezier(.22,1.15,.36,1) both; }
  .bico { transform-box: fill-box; transform-origin: 0% 100%; animation: bica .62s 1.45s ease-in-out both; }
  .chave { transform-box: fill-box; transform-origin: 50% 50%; animation: gira .58s 1.15s cubic-bezier(.3,1.4,.5,1) both; }
  .faisca { stroke: #fff; stroke-width: 6; stroke-linecap: round; fill: none; opacity: 0; transform-box: view-box; transform-origin: ${SPARKS.at[0]}px ${SPARKS.at[1]}px; animation: brilho .31s 1.52s ease-out 2 both; }
  @keyframes risco { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  @keyframes sobe { from { transform: translateY(105%); } to { transform: none; } }
  @keyframes gira { from { transform: rotate(-200deg) scale(0); } to { transform: none; } }
  @keyframes bica {
    0%, 50%, 100% { transform: none; }
    18%, 68% { transform: rotate(7deg); }
    30%, 80% { transform: rotate(-1deg); }
  }
  @keyframes brilho { 0% { opacity: 0; transform: scale(.4); } 25% { opacity: 1; } 100% { opacity: 0; transform: scale(1.25); } }
  @media (prefers-reduced-motion: reduce) {
    .d1, .d2, .d3, .d4, .ave, .bico, .chave { animation: none; }
    .faisca { display: none; }
  }
</style>
<defs>
  <mask id="casa" maskUnits="userSpaceOnUse" x="38" y="38" width="347" height="337">
    ${GUIDES.map(([c, d, sw]) => `<path class="g ${c}" pathLength="1" stroke-width="${sw}" d="${d}"/>`).join('\n    ')}
  </mask>
  <clipPath id="chao"><rect x="38" y="20" width="347" height="${FLOOR_Y - 20}"/></clipPath>
</defs>
<path fill="${PAINT.white}" mask="url(#casa)" d="${L.house}"/>
<g clip-path="url(#chao)">
  <g class="ave"><g class="bico">
    <path fill="${PAINT.navy}" fill-rule="evenodd" d="${L.birdNavy}"/>
    <path fill="${PAINT.white}" fill-rule="evenodd" d="${L.birdWhite}"/>
  </g></g>
  <g class="chave"><path fill="${PAINT.navy}" fill-rule="evenodd" d="${L.wrench}"/></g>
</g>
<g class="faisca"><path d="${SPARKS.d}"/></g>
</svg>
`;

/* Ícone quadrado: o fundo azul ocupa tudo, porque o celular arredonda os cantos sozinho. */
function iconSvg(L) {
  const [x, y, w, h] = VIEWBOX.split(' ').map(Number), side = Math.max(w, h);
  const x0 = x - (side - w) / 2, y0 = y - (side - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${side} ${side}">
  <rect x="${x0}" y="${y0}" width="${side}" height="${side}" fill="${PAINT.tile}"/>
  <path fill="${PAINT.white}" d="${L.house}"/>
  <path fill="${PAINT.navy}" fill-rule="evenodd" d="${L.birdNavy}"/>
  <path fill="${PAINT.white}" fill-rule="evenodd" d="${L.birdWhite}"/>
  <path fill="${PAINT.navy}" fill-rule="evenodd" d="${L.wrench}"/>
</svg>`;
}

const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

layers().then((L) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'logo-fixup.svg'), staticSvg(L));
  fs.writeFileSync(path.join(outDir, 'abertura.svg'), animatedSvg(L));
  const icon = iconSvg(L);
  [180, 512].forEach((size) => fs.writeFileSync(path.join(outDir, `icone-${size}.png`), png(icon, size)));
  console.log('Gerados em img/: logo-fixup.svg, abertura.svg, icone-180.png e icone-512.png, a partir de', path.basename(input));
}).catch((e) => { console.error(e.message || e); process.exit(1); });
