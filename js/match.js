/* FixUp — busca por problema.

   Como funciona:
   1. O texto do cliente é normalizado (sem acentos, plurais e conjugações) e os erros de digitação
      são corrigidos pela palavra conhecida mais próxima ("gelareira" -> "geladeira").
   2. O texto vira conceitos do vocabulário (js/lexicon.js): aparelho, peça, sintoma, ação e marca.
   3. Cada trabalho do banco (js/db.js) passou pelo mesmo processo quando foi indexado. A busca
      compara os conceitos: aparelho e peça pesam mais; conceitos análogos (geladeira ~ freezer,
      "quebrou" ~ "não liga") contam pela metade; termos raros valem mais que termos comuns.
   4. Os trabalhos são agrupados por profissional. Quem resolveu mais casos parecidos sobe na lista;
      avaliação, distância e disponibilidade desempatam.

   Em produção, o mesmo desenho roda no servidor (busca textual + índice por conceito). */
(function (S) {
  'use strict';

  const W = { device: 3, part: 2.4, symptom: 1.3, action: 0.5, brand: 1.2, place: 0.4 };
  const CW = { device: 3, part: 1.5, symptom: 0.3, action: 0, brand: 0, place: 0.6 };
  const STRONG_W = 2.6, STRONG_CW = 4, MODEL_W = 2.2, TOKEN_W = 0.5;
  const RELATED = 0.5;   // conceito análogo (geladeira ~ freezer)
  const MENTION = 0.35;  // o aparelho só é citado na descrição do problema, não é o objeto do trabalho

  const STOP = new Set(('a o as os um uma uns umas de do da dos das no na nos nas em para pra pro por com que e ou eu me meu minha meus ' +
    'minhas seu sua se ao aos la aqui ali isso esse essa este esta estao ta to tem tenho ter foi vai ser eh mais muito bem ja so tal como ' +
    'quando onde qual quais preciso precisa precisando quero queria gostaria alguem pessoa profissional favor urgente hoje agora modelo ' +
    'marca tipo aquele aquela dele dela ele ela voce voces estou estava fazer faz fez fazendo feito fica ficou ficando pode podem posso ' +
    'consegue conseguir depois antes ainda dia dias vez vezes coisa ontem amanha semana toda todo todos todas uso usar tudo nada algum ' +
    'alguma ate entre sobre').split(' '));

  const SUFFIXES = ['amento', 'imento', 'agem', 'ando', 'endo', 'indo', 'aram', 'eram', 'iram', 'acao', 'ado', 'ada', 'ido', 'ida', 'ou', 'eu', 'iu', 'ar', 'er', 'ir', 'a', 'e', 'o'];

  const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const words = (s) => norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w));

  /** Reduz a palavra ao radical: "ligando", "ligou" e "ligar" viram "lig"; "geladeiras" vira "geladeir". */
  function stem(w) {
    if (w.length <= 3 || /\d/.test(w)) return w;
    if (/(oes|aes)$/.test(w)) w = w.slice(0, -3) + 'ao';
    else if (/ais$/.test(w) && w.length > 4) w = w.slice(0, -2) + 'l';
    else if (/eis$/.test(w) && w.length > 4) w = w.slice(0, -3) + 'el';
    else if (/ns$/.test(w)) w = w.slice(0, -2) + 'm';
    else if (/res$/.test(w) && w.length > 5) w = w.slice(0, -2);
    else if (/[^s]s$/.test(w)) w = w.slice(0, -1);
    for (let i = 0; i < SUFFIXES.length; i++) {
      const s = SUFFIXES[i];
      if (w.length - s.length >= 3 && w.endsWith(s)) return w.slice(0, -s.length);
    }
    return w;
  }

  /* ---------- Vocabulário compilado ---------- */
  const BY_ID = {}, PHRASES = new Map(), REL = {};
  const VOCAB = new Map();      // palavra -> frequência (para corrigir digitação)
  const KNOWN = new Set();      // radicais conhecidos
  const NAMES = new Set();      // nomes de profissionais (não são corrigidos)
  const fixCache = new Map();
  let maxLen = 1, compiled = false;

  function learn(text, weight) {
    words(text).forEach((w) => {
      if (/\d/.test(w)) return;
      VOCAB.set(w, (VOCAB.get(w) || 0) + (weight || 1));
      KNOWN.add(stem(w));
    });
  }

  function compile() {
    if (compiled) return;
    compiled = true;
    S.lexicon.concepts.forEach((c) => {
      const strong = c.type === 'action' && c.strong;
      c.w = strong ? STRONG_W : W[c.type];
      if (c.cw == null) c.cw = strong ? STRONG_CW : CW[c.type];
      BY_ID[c.id] = c;
      c.terms.forEach((t) => {
        const ws = words(t);
        if (!ws.length) return;
        const key = ws.map(stem).join(' ');
        maxLen = Math.max(maxLen, ws.length);
        const ids = PHRASES.get(key) || [];
        if (ids.indexOf(c.id) < 0) ids.push(c.id);
        PHRASES.set(key, ids);
        learn(t, 3);
      });
    });
    S.lexicon.groups.forEach((g) => g.forEach((id) => { REL[id] = (REL[id] || []).concat(g.filter((x) => x !== id)); }));
  }

  /* ---------- Correção de digitação ---------- */
  /** Distância de edição (inserir, apagar, trocar ou inverter letras vizinhas), limitada a `max`. */
  function dist(a, b, max) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev2 = null, prev = [], cur;
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      cur = [i];
      let low = i;
      for (let j = 1; j <= lb; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < low) low = v;
      }
      if (low > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[lb];
  }

  const isName = (w) => { let hit = false; NAMES.forEach((n) => { if (n.indexOf(w) === 0) hit = true; }); return hit; };
  const known = (w) => w.length < 4 || /\d/.test(w) || KNOWN.has(stem(w));

  function fix(w) {
    if (fixCache.has(w)) return fixCache.get(w);
    const max = w.length >= 8 ? 2 : 1;
    let best = w, bestScore = Infinity;
    VOCAB.forEach((freq, cand) => {
      if (cand.length < 4 || Math.abs(cand.length - w.length) > max) return;
      const d = dist(w, cand, max);
      if (d > max) return;
      const score = d + (cand[0] === w[0] ? 0 : 0.6) - Math.min(0.4, freq / 100);
      if (score < bestScore) { bestScore = score; best = cand; }
    });
    fixCache.set(w, best);
    return best;
  }

  /** Completa a palavra que ainda está sendo digitada ("gelad" -> "geladeira"). */
  function complete(w) {
    let best = null, bestFreq = 0;
    VOCAB.forEach((freq, cand) => {
      if (cand.length > w.length && cand.indexOf(w) === 0 && freq > bestFreq) { best = cand; bestFreq = freq; }
    });
    return best;
  }

  /* ---------- Do texto aos conceitos ---------- */
  function analyze(text, opts) {
    opts = opts || {};
    const typed = words(text), fixes = [];
    const ws = !opts.correct ? typed : typed.map((w, i) => {
      if (known(w) || isName(w)) return w;
      if (opts.prefix && i === typed.length - 1) { const p = complete(w); if (p) return p; }
      const c = fix(w);
      if (c !== w) fixes.push({ from: w, to: c });
      return c;
    });
    const st = ws.map(stem);
    const concepts = new Map(), tokens = new Set(), models = new Set();
    let i = 0;
    while (i < st.length) {
      let used = 0;
      for (let n = Math.min(maxLen, st.length - i); n >= 1 && !used; n--) {
        const ids = PHRASES.get(st.slice(i, i + n).join(' '));
        if (ids) { ids.forEach((id) => concepts.set(id, BY_ID[id])); used = n; }
      }
      if (used) { i += used; continue; }
      if (/\d/.test(ws[i])) models.add(ws[i]); else tokens.add(st[i]);
      i += 1;
    }
    return { concepts, tokens, models, fixes, typed };
  }

  /* ---------- Índice dos trabalhos ---------- */
  let docs = [], post = new Map(), df = new Map(), svcDocs = {}, nameWords = {};

  function merge(parts) {
    const d = { concepts: new Map(), tokens: new Set(), models: new Set() };
    parts.forEach((t) => {
      if (!t) return;
      const a = analyze(t);
      a.concepts.forEach((c, id) => d.concepts.set(id, c));
      a.tokens.forEach((t2) => d.tokens.add(t2));
      a.models.forEach((m) => d.models.add(m));
    });
    d.strong = Array.from(d.concepts.values()).filter((c) => c.strong).map((c) => c.id);
    return d;
  }

  function addDoc(job) {
    const d = merge([job.title, job.device, job.brand, job.model, job.problem]);
    d.head = merge([job.title, job.device, job.brand, job.model]).concepts;   // do que o trabalho trata
    d.job = job;
    const i = docs.push(d) - 1;
    const put = (k) => { const a = post.get(k); if (a) a.push(i); else post.set(k, [i]); df.set(k, (df.get(k) || 0) + 1); };
    d.concepts.forEach((c, id) => put('c:' + id));
    d.tokens.forEach((t) => put('t:' + t));
    d.models.forEach((m) => put('m:' + m));
    learn([job.title, job.device, job.problem].join(' '), 1);
  }

  /** Raridade do termo: aparece em poucos trabalhos = diz mais sobre o problema. */
  function idf(key) {
    const raw = Math.log(1 + docs.length / (1 + (df.get(key) || 0))) / 2.7;
    return Math.max(0.5, Math.min(1.5, raw));
  }

  function build() {
    compile();
    docs = []; post = new Map(); df = new Map(); svcDocs = {}; nameWords = {};
    fixCache.clear();
    S.data.pros.forEach((p) => {
      nameWords[p.id] = norm(p.name).split(' ');
      nameWords[p.id].forEach((w) => NAMES.add(w));
    });
    S.data.categories.forEach((c) => {
      learn(c.name + ' ' + c.short + ' ' + c.keywords, 2);
      svcDocs[c.id] = {};
      c.services.forEach((s) => {
        learn(s.name, 2);
        const d = merge([s.name]);
        d.head = d.concepts;
        d.job = { cat: c.id };
        svcDocs[c.id][s.id] = d;
      });
    });
    S.db.all().forEach(addDoc);
  }

  function add(job) {
    if (!compiled) return;
    fixCache.clear();
    addDoc(job);
  }

  /* ---------- Pontuação ---------- */
  function prepare(a) {
    a.list = Array.from(a.concepts.values());
    a.strong = a.list.filter((c) => c.strong);
    a.devices = a.list.some((c) => c.type === 'device');
    a.parts = a.list.some((c) => c.type === 'part');
    a.symptoms = a.list.some((c) => c.type === 'symptom');
    a.actions = a.list.some((c) => c.type === 'action' && !c.generic);
    a.core = Math.max(1, a.list.reduce((s, c) => s + (c.type === 'action' && !c.strong ? 0 : c.w * idf('c:' + c.id)), 0) + a.models.size * MODEL_W);
    a.empty = !a.list.length && !a.tokens.size && !a.models.size;
    return a;
  }

  /** Categorias prováveis do problema descrito. */
  function categories(q) {
    const v = {};
    q.list.forEach((c) => c.cats.forEach((id) => { v[id] = (v[id] || 0) + c.cw; }));
    const all = Object.keys(v).map((id) => ({ id, score: v[id] })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    const only = [];
    q.strong.forEach((c) => { if (c.exclusive) c.cats.forEach((id) => { if (only.indexOf(id) < 0) only.push(id); }); });
    if (only.length) return { all, top: only };
    const best = all.length ? all[0].score : 0;
    return { all, top: best >= 1 ? all.filter((x) => x.score >= best * 0.6).map((x) => x.id) : [] };
  }

  /** Compara a busca com um trabalho. Níveis: same = mesmo problema · similar = parecido · weak = não conta. */
  function scoreDoc(q, d, top) {
    let s = 0, dev = 0, part = 0, strong = 0, symptom = 0, action = 0, tok = 0;
    q.list.forEach((c) => {
      let m = 0;
      if (d.concepts.has(c.id)) m = c.type === 'device' && !d.head.has(c.id) ? MENTION : 1;
      else if (REL[c.id] && REL[c.id].some((r) => d.concepts.has(r))) m = RELATED;
      if (!m) return;
      s += c.w * idf('c:' + c.id) * m;
      if (c.type === 'device') dev = Math.max(dev, m);
      else if (c.type === 'part') part = Math.max(part, m);
      else if (c.type === 'symptom') symptom = Math.max(symptom, m);
      else if (c.type === 'action') {
        if (c.strong) strong = 1;
        if (m === 1 && !c.generic) action = 1;
      }
    });
    q.models.forEach((m) => { if (d.models.has(m)) s += MODEL_W; });
    q.tokens.forEach((t) => { if (d.tokens.has(t)) { s += TOKEN_W * idf('t:' + t); tok += 1; } });
    if (!s) return null;

    if (q.strong.length && !strong) s *= 0.5;                   // a busca pede um serviço que este trabalho não é
    if (!q.strong.length && d.strong.length) s *= 0.45;         // o trabalho é de outro tipo de serviço
    if (top.length && top.indexOf(d.job.cat) < 0) s *= 0.35;    // outra categoria

    const rel = Math.min(1, s / q.core);
    let primary;
    if (q.devices) primary = dev > 0 || part === 1;
    else if (q.parts) primary = part > 0;
    else if (q.strong.length) primary = strong > 0;
    else if (q.symptoms) primary = symptom === 1;
    else primary = tok >= 2;

    let level = 'weak';
    if (primary && rel >= 0.34) {
      /* "Mesmo problema": mesmo aparelho e, além dele, a mesma peça (ou o mesmo sintoma, ou o mesmo serviço). */
      const specific = q.parts ? part === 1 : ((q.symptoms && symptom === 1) || (q.actions && action === 1) || (!q.devices && tok >= 1));
      const same = (!q.devices || dev === 1) && specific && rel >= 0.72;
      level = same ? 'same' : 'similar';
    }
    return { job: d.job, s, rel, level };
  }

  function scoreJobs(q, top) {
    const cand = new Set();
    const pull = (k) => { const a = post.get(k); if (a) a.forEach((i) => cand.add(i)); };
    q.list.forEach((c) => { pull('c:' + c.id); (REL[c.id] || []).forEach((r) => pull('c:' + r)); });
    q.tokens.forEach((t) => pull('t:' + t));
    q.models.forEach((m) => pull('m:' + m));
    const by = new Map();
    cand.forEach((i) => {
      const r = scoreDoc(q, docs[i], top);
      if (!r) return;
      const list = by.get(r.job.proId);
      if (list) list.push(r); else by.set(r.job.proId, [r]);
    });
    by.forEach((list) => list.sort((a, b) => b.s - a.s || b.job.doneAt - a.job.doneAt));
    return by;
  }

  /** Trabalhos que contam para a busca, com os de "mesmo problema" na frente. */
  const rank = (hits) => hits.filter((h) => h.level !== 'weak').sort((a, b) => (b.level === 'same') - (a.level === 'same') || b.s - a.s || b.job.doneAt - a.job.doneAt);

  const median = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : 0; };
  const round5 = (n) => Math.round(n / 5) * 5;

  function bestService(q, pro) {
    const table = svcDocs[pro.cat] || {};
    let best = null;
    pro.services.forEach((svc) => {
      const r = table[svc.id] && scoreDoc(q, table[svc.id], [pro.cat]);
      if (r && r.level !== 'weak' && (!best || r.s > best.s)) best = { svc, s: r.s };
    });
    return best;
  }

  /** O que o app entendeu do texto, para mostrar ao cliente. */
  function summary(q, top) {
    const order = { device: 0, brand: 1, model: 2, part: 3, symptom: 4, action: 5 };
    const chips = q.list.filter((c) => c.type !== 'place' && (c.type !== 'action' || c.strong)).map((c) => ({ type: c.type, label: c.label }));
    q.models.forEach((m) => chips.push({ type: 'model', label: m.toUpperCase() }));
    chips.sort((a, b) => order[a.type] - order[b.type]);
    return { chips, fixes: q.fixes, cat: top[0] || null };
  }

  /* ---------- Busca de profissionais por problema ---------- */
  function search(text, opts) {
    opts = opts || {};
    const q = prepare(analyze(text, { correct: true, prefix: opts.live }));
    const pros = S.data.near().filter((p) => !opts.cat || p.cat === opts.cat);
    const sorters = {
      near: (a, b) => a.pro.km - b.pro.km,
      rating: (a, b) => b.pro.rating - a.pro.rating || b.pro.jobs - a.pro.jobs,
      price: (a, b) => a.price - b.price,
      best: (a, b) => b.score - a.score || a.pro.km - b.pro.km
    };

    if (q.empty) {
      const list = pros.map((p) => ({ pro: p, score: 0, level: 'none', similar: [], count: 0, svc: null, price: p.fromPrice, priceLabel: 'a partir de' }));
      return { q, understood: null, top: [], matched: 0, list: list.sort(sorters[opts.sort] || sorters.near) };
    }

    const top = categories(q).top;
    const by = scoreJobs(q, top);
    const list = [];
    pros.forEach((p) => {
      const similar = rank(by.get(p.id) || []);
      const same = similar.filter((h) => h.level === 'same').length;
      const svc = bestService(q, p);
      const inCat = top.indexOf(p.cat) >= 0;
      const byName = q.typed.some((w) => w.length >= 3 && nameWords[p.id].some((n) => n.indexOf(w) === 0));
      if (!similar.length && !svc && !inCat && !byName) return;

      /* Experiência: cada trabalho parecido soma, com peso menor a cada um (os primeiros contam mais). */
      let exp = 0;
      similar.slice(0, 6).forEach((h, i) => { exp += h.s * (h.level === 'same' ? 1.25 : 1) * Math.pow(0.55, i); });
      const relevance = exp + (svc ? svc.s * 0.9 : 0) + (inCat ? 1.2 : 0) + (byName ? 6 : 0);
      const score = relevance * (1 + 0.12 * (p.rating - 4.5)) + (p.availableNow ? 0.25 : 0) - 0.05 * p.km;
      const price = similar.length ? round5(median(similar.slice(0, 5).map((h) => h.job.price))) : svc ? svc.svc.price : p.fromPrice;
      list.push({
        pro: p, score, svc: svc ? svc.svc : null, similar: similar.slice(0, 3), count: same || similar.length,
        level: same ? 'same' : similar.length ? 'similar' : svc ? 'service' : byName ? 'name' : 'category',
        price, priceLabel: similar.length ? 'em casos parecidos' : svc ? 'pelo serviço' : 'a partir de'
      });
    });
    list.sort(sorters[opts.sort] || sorters.best);
    return { q, understood: summary(q, top), top, matched: list.filter((x) => x.count > 0).length, list };
  }

  /** Trabalhos de um profissional parecidos com o problema descrito. */
  function forPro(proId, text, limit) {
    const q = prepare(analyze(text, { correct: true }));
    if (q.empty) return [];
    return rank(scoreJobs(q, categories(q).top).get(proId) || []).slice(0, limit || 5);
  }

  /** Monta os itens de uma proposta a partir da mensagem do cliente (usado pelo chat).
      Procura primeiro nos trabalhos que o profissional já fez; se não houver, no catálogo dele. */
  function quoteFor(pro, text) {
    const items = [], seen = {};
    let count = 0, example = null;

    const consider = (t) => {
      const q = prepare(analyze(t, { correct: true }));
      if (!q.devices && !q.parts && !q.strong.length) return;
      const svc = bestService(q, pro);
      const hits = rank(scoreJobs(q, [pro.cat]).get(pro.id) || []);
      const brand = q.list.filter((c) => c.type === 'brand')[0];
      let item = null;
      if (hits.length && (!svc || hits[0].s > svc.s * 1.15)) {
        const j = hits[0].job;
        const same = hits.filter((h) => h.job.title === j.title);
        item = {
          key: 'j:' + j.title + '|' + j.device, price: round5(median(same.map((h) => h.job.price))),
          name: j.title + (j.device ? ' — ' + j.device + (brand ? ' ' + brand.label : '') : ''),
          desc: j.title.charAt(0).toLowerCase() + j.title.slice(1) + (j.device ? ' (' + j.device + (brand ? ' ' + brand.label : '') + ')' : '')
        };
        if (!example) { example = j; count = hits.filter((h) => h.level === 'same').length || hits.length; }
      } else if (svc) {
        item = { key: svc.svc.id, name: svc.svc.name, price: svc.svc.price };
      }
      if (item && !seen[item.key]) { seen[item.key] = true; items.push(item); }
    };

    String(text).split(/\s+(?:e|mais|al[eé]m d[eoa]s?|tamb[eé]m|junto com)\s+|[,;+\n]+/i).forEach(consider);
    if (!items.length) consider(text);

    let other = null;
    if (!items.length) {
      const c = categories(prepare(analyze(text, { correct: true })));
      if (c.all.length && c.all[0].id !== pro.cat && c.all[0].score >= 3 && c.top.indexOf(pro.cat) < 0) other = S.data.cat(c.all[0].id);
    }
    return { items: items.slice(0, 2), count, example, other };
  }

  S.match = {
    norm, stem, round5, build, add, search, forPro, quoteFor,
    understand: (text) => { const q = prepare(analyze(text, { correct: true })); return summary(q, categories(q).top); },
    stats: () => ({ jobs: docs.length, concepts: S.lexicon.concepts.length, terms: PHRASES.size })
  };
})(window.FixUp = window.FixUp || {});
